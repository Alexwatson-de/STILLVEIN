import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Actor } from './auth';
import { services, AppError } from './firebase';
import { audit, now } from './data';
import { idSchema } from '../schema';
import { readImageBody } from './image-validation';
export function cloud() {
  const {
    CLOUDINARY_CLOUD_NAME: cloud_name,
    CLOUDINARY_API_KEY: api_key,
    CLOUDINARY_API_SECRET: api_secret,
    CLOUDINARY_UPLOAD_PRESET: preset,
  } = process.env;
  if (!cloud_name || !api_key || !api_secret || !preset)
    throw new AppError(
      503,
      'Image uploads need CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and a restricted signed CLOUDINARY_UPLOAD_PRESET on the server. Existing images remain unchanged.',
    );
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
  return { sdk: cloudinary, cloudName: cloud_name, apiKey: api_key, secret: api_secret, preset };
}
export const uploadRequest = z.object({
  productId: idSchema,
  kind: z.enum(['gallery', 'textures', 'site']),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
});
export async function authorizeUpload(input: unknown, actor: Actor) {
  const p = uploadRequest.parse(input);
  const c = cloud();
  const { db } = services();
  // Cloudinary presets enforce formats, not max_file_size. Actual byte and
  // pixel limits are enforced by the authenticated server transfer endpoint.
  const preset = await c.sdk.api.upload_preset(c.preset);
  const opts = preset.settings || {};
  const formats = Array.isArray(opts.allowed_formats)
    ? opts.allowed_formats
    : String(opts.allowed_formats || '').split(',');
  if (
    preset.unsigned ||
    opts.overwrite !== false ||
    !formats.length ||
    formats.some((f: string) => !['jpg', 'jpeg', 'png', 'webp'].includes(f))
  )
    throw new AppError(
      503,
      'Cloudinary preset must be signed, limited to jpg/png/webp and disable overwrite.',
    );
  const ticket = randomUUID();
  const publicId = `stillvein/${p.kind === 'site' ? 'site' : `products/${p.productId}/${p.kind}`}/${ticket}`;
  await db.doc(`uploadTickets/${ticket}`).set({
    uid: actor.uid,
    publicId,
    createdAt: now(),
    expiresAt: Date.now() + 3600000,
    state: 'pending',
  });
  // No reusable Cloudinary signature is exposed to the browser: it could bypass
  // byte validation. The SDK signs only after validated bytes reach the server.
  return { ticket };
}
export async function transferUpload(req: Request, ticketId: string, actor: Actor) {
  z.uuid().parse(ticketId);
  const { db } = services();
  const ref = db.doc(`uploadTickets/${ticketId}`);
  const ticket = await db.runTransaction(async (tx) => {
    const d = (await tx.get(ref)).data();
    if (!d || d.uid !== actor.uid || d.expiresAt < Date.now())
      throw new AppError(403, 'Upload authorization expired or belongs to another user.');
    if (d.state !== 'pending')
      throw new AppError(
        409,
        'This upload ticket has already been used. Retry verification or start a new upload.',
      );
    tx.update(ref, { state: 'processing' });
    return d;
  });
  let uploaded = false;
  try {
    const bytes = await readImageBody(req);
    const c = cloud();
    await new Promise<void>((resolve, reject) => {
      const stream = c.sdk.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: ticket.publicId,
          upload_preset: c.preset,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result)
            reject(
              new AppError(
                502,
                'Cloudinary could not accept the image. Existing product images are unchanged.',
              ),
            );
          else resolve();
        },
      );
      stream.end(bytes);
    });
    uploaded = true;
    await ref.update({ state: 'uploaded' });
    return await finalizeUpload({ ticket: ticketId, alt: 'Uploaded stone image' }, actor);
  } catch (e) {
    if (!uploaded) await ref.update({ state: 'failed' });
    throw e;
  }
}
export async function finalizeUpload(input: unknown, actor: Actor) {
  const p = z.object({ ticket: z.uuid(), alt: z.string().trim().min(1).max(250) }).parse(input);
  const { db } = services();
  const ref = db.doc(`uploadTickets/${p.ticket}`);
  const ticket = (await ref.get()).data();
  if (!ticket || ticket.uid !== actor.uid || ticket.expiresAt < Date.now())
    throw new AppError(403, 'Upload authorization expired or belongs to another user.');
  if (!['uploaded', 'complete'].includes(ticket.state))
    throw new AppError(409, 'The validated image transfer has not completed.');
  const c = cloud();
  const resource = await c.sdk.api.resource(ticket.publicId, { resource_type: 'image' });
  if (
    !['jpg', 'jpeg', 'png', 'webp'].includes(resource.format) ||
    resource.bytes > 10485760 ||
    resource.width * resource.height > 25000000 ||
    !resource.secure_url.startsWith(`https://res.cloudinary.com/${c.cloudName}/`)
  )
    throw new AppError(400, 'Uploaded image violates the format, 10 MB or 25 megapixel limit.');
  const asset = {
    assetId: resource.asset_id,
    publicId: resource.public_id,
    url: resource.secure_url,
    width: resource.width,
    height: resource.height,
    alt: p.alt,
  };
  await db.runTransaction(async (tx) => {
    const a = db.doc(`assets/${asset.assetId}`);
    const existing = await tx.get(a);
    if (!existing.exists)
      tx.set(a, { ...asset, state: 'ready', refs: [], createdBy: actor.uid, createdAt: now() });
    tx.update(ref, { state: 'complete', assetId: asset.assetId });
    tx.set(db.collection('audit').doc(), audit(actor, 'asset.upload', asset.assetId));
  });
  return asset;
}
export async function deleteAsset(id: string, actor: Actor) {
  const { db } = services();
  const ref = db.doc(`assets/${id}`);
  const c = cloud();
  const asset = await db.runTransaction(async (tx) => {
    const a = (await tx.get(ref)).data();
    if (!a) throw new AppError(404, 'Asset not found.');
    if (a.refs?.length)
      throw new AppError(
        409,
        'This asset is still referenced. Remove it from every product and site setting first.',
      );
    if (a.sample)
      throw new AppError(400, 'Local sample assets cannot be deleted through Cloudinary.');
    tx.update(ref, { state: 'deleting' });
    return a;
  });
  try {
    await c.sdk.uploader.destroy(asset.publicId, { invalidate: true, resource_type: 'image' });
    await ref.update({ state: 'deleted', deletedAt: now() });
    await db.collection('audit').add(audit(actor, 'asset.delete', id));
  } catch (e) {
    await ref.update({ state: 'ready' });
    throw e;
  }
}
