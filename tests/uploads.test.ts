import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
const sdk = vi.hoisted(() => ({
  config: vi.fn(),
  api: { upload_preset: vi.fn(), resource: vi.fn() },
  utils: { api_sign_request: vi.fn(() => 'mock-signature') },
  uploader: { destroy: vi.fn() },
}));
vi.mock('cloudinary', () => ({ v2: sdk }));
import { authorizeUpload, finalizeUpload, deleteAsset } from '../src/lib/server/assets';
import { services } from '../src/lib/server/firebase';
const actor = { uid: 'mock-upload-qa', email: 'qa@example.test', role: 'admin' as const };
const assetId = `qa-asset-${randomUUID()}`;
let ticket = '';
let publicId = '';
describe.skipIf(process.env.TEST_EMULATORS !== '1')(
  'Cloudinary contract simulation + real Firestore references (not a live Cloudinary test)',
  () => {
    beforeAll(() => {
      process.env.FIREBASE_PROJECT_ID = 'demo-stillvein';
      process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      process.env.CLOUDINARY_CLOUD_NAME = 'mock';
      process.env.CLOUDINARY_API_KEY = 'mock';
      process.env.CLOUDINARY_API_SECRET = 'mock';
      process.env.CLOUDINARY_UPLOAD_PRESET = 'mock';
      sdk.api.upload_preset.mockResolvedValue({
        unsigned: false,
        settings: { allowed_formats: ['jpg', 'png', 'webp'], overwrite: false },
      });
    });
    afterAll(async () => {
      const db = services().db;
      await db.doc(`assets/${assetId}`).delete();
      if (ticket) await db.doc(`uploadTickets/${ticket}`).delete();
      for (const k of [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
        'CLOUDINARY_UPLOAD_PRESET',
      ])
        delete process.env[k];
    });
    it('restricts file types and sizes before signing', async () => {
      await expect(
        authorizeUpload(
          { productId: 'qa', kind: 'gallery', mime: 'image/svg+xml', size: 100 },
          actor,
        ),
      ).rejects.toThrow();
      await expect(
        authorizeUpload(
          { productId: 'qa', kind: 'textures', mime: 'image/png', size: 11000000 },
          actor,
        ),
      ).rejects.toThrow();
    });
    it('rejects insecure unsigned presets', async () => {
      sdk.api.upload_preset.mockResolvedValueOnce({ unsigned: true, settings: {} });
      await expect(
        authorizeUpload({ productId: 'qa', kind: 'textures', mime: 'image/png', size: 100 }, actor),
      ).rejects.toThrow(/preset must be signed/);
    });
    it('locks upload destination without exposing a bypassable Cloudinary signature', async () => {
      const r = await authorizeUpload(
        { productId: 'qa', kind: 'textures', mime: 'image/png', size: 100 },
        actor,
      );
      ticket = r.ticket;
      publicId = (await services().db.doc(`uploadTickets/${ticket}`).get()).get('publicId');
      expect(publicId).toMatch(/^stillvein\/products\/qa\/textures\//);
      expect(r).not.toHaveProperty('signature');
      expect(r).not.toHaveProperty('secret');
    });
    it('verifies provider metadata and records ready assets only after success', async () => {
      await services().db.doc(`uploadTickets/${ticket}`).update({ state: 'uploaded' });
      sdk.api.resource.mockResolvedValueOnce({
        format: 'svg',
        bytes: 100,
        width: 100,
        height: 100,
        secure_url: 'https://res.cloudinary.com/mock/image/upload/test.svg',
      });
      await expect(finalizeUpload({ ticket, alt: 'test' }, actor)).rejects.toThrow(/violates/);
      sdk.api.resource.mockResolvedValue({
        asset_id: assetId,
        public_id: publicId,
        format: 'png',
        bytes: 1000,
        width: 1024,
        height: 1024,
        secure_url: 'https://res.cloudinary.com/mock/image/upload/test.png',
      });
      const a = await finalizeUpload({ ticket, alt: 'test' }, actor);
      expect(a.assetId).toBe(assetId);
      const d = await services().db.doc(`assets/${assetId}`).get();
      expect(d.get('state')).toBe('ready');
    });
    it('rejects someone else finalizing the ticket', async () => {
      await expect(
        finalizeUpload({ ticket, alt: 'test' }, { ...actor, uid: 'other' }),
      ).rejects.toThrow(/belongs to another/);
    });
    it('blocks deletion while referenced by a product', async () => {
      await services()
        .db.doc(`assets/${assetId}`)
        .update({ refs: ['product-a'] });
      await expect(deleteAsset(assetId, actor)).rejects.toThrow(/still referenced/);
      expect(sdk.uploader.destroy).not.toHaveBeenCalled();
    });
    it('recovers an asset when deletion fails', async () => {
      await services().db.doc(`assets/${assetId}`).update({ refs: [] });
      sdk.uploader.destroy.mockRejectedValueOnce(new Error('network'));
      await expect(deleteAsset(assetId, actor)).rejects.toThrow('network');
      expect((await services().db.doc(`assets/${assetId}`).get()).get('state')).toBe('ready');
    });
    it('deletes an unreferenced asset only after authorized reservation', async () => {
      sdk.uploader.destroy.mockResolvedValue({ result: 'ok' });
      await deleteAsset(assetId, actor);
      expect((await services().db.doc(`assets/${assetId}`).get()).get('state')).toBe('deleted');
    });
  },
);
