import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { readImageBody, MAX_IMAGE_BYTES } from '../src/lib/server/image-validation';
function request(bytes: Uint8Array, mime = 'image/png', headers: Record<string, string> = {}) {
  return new Request('http://localhost/upload', {
    method: 'POST',
    headers: { 'Content-Type': mime, ...headers },
    body: new Uint8Array(bytes),
  });
}
describe('Server-side image byte enforcement', () => {
  it.each(['png', 'jpeg', 'webp'] as const)(
    'accepts and decodes valid %s images',
    async (format) => {
      const b = await sharp({
        create: { width: 32, height: 32, channels: 3, background: '#bbaabb' },
      })
        .toFormat(format)
        .toBuffer();
      expect(await readImageBody(request(b, `image/${format}`))).toEqual(b);
    },
  );
  it('rejects forged MIME declarations', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: 'white' } })
      .png()
      .toBuffer();
    await expect(readImageBody(request(png, 'image/jpeg'))).rejects.toThrow(/matching/);
  });
  it('rejects a request exceeding the actual byte cap even without Content-Length', async () => {
    await expect(readImageBody(request(new Uint8Array(MAX_IMAGE_BYTES + 1)))).rejects.toThrow(
      /10 MB/,
    );
  });
  it('rejects oversized declared requests early', async () => {
    await expect(
      readImageBody(
        request(new Uint8Array(1), 'image/png', { 'Content-Length': String(MAX_IMAGE_BYTES + 1) }),
      ),
    ).rejects.toThrow(/10 MB/);
  });
  it('rejects SVG despite a fake PNG header', async () => {
    await expect(
      readImageBody(
        request(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')),
      ),
    ).rejects.toThrow(/valid static/);
  });
  it('rejects invalid and truncated images', async () => {
    await expect(readImageBody(request(Buffer.from('not an image')))).rejects.toThrow(
      /valid static/,
    );
  });
  it('rejects empty images', async () => {
    await expect(readImageBody(request(new Uint8Array()))).rejects.toThrow(/empty/);
  });
  it('rejects more than 25 megapixels', async () => {
    const large = await sharp({
      create: { width: 5001, height: 5000, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();
    await expect(readImageBody(request(large))).rejects.toThrow(/25 megapixels/);
  });
});
