import sharp from 'sharp';
import { AppError } from './firebase';
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const formats: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};
// Read a bounded stream, not an unbounded formData()/arrayBuffer() allocation.
// Client-declared Content-Length and MIME type are only early rejection hints.
export async function readImageBody(req: Request) {
  const mime = req.headers.get('content-type')?.split(';')[0].trim() || '';
  if (!formats[mime]) throw new AppError(400, 'Choose a JPEG, PNG or WebP image.');
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_IMAGE_BYTES) throw new AppError(413, 'Image exceeds the 10 MB limit.');
  if (!req.body) throw new AppError(400, 'Image data is missing.');
  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new AppError(413, 'Image exceeds the 10 MB limit.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (!size) throw new AppError(400, 'Image data is empty.');
  const bytes = Buffer.concat(chunks, size);
  try {
    // Exclude SVG/HEIF/other parsers before decoding, regardless of MIME claims.
    const magicMatches =
      mime === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === 'image/jpeg'
          ? bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.subarray(0, 4).toString() === 'RIFF' &&
            bytes.subarray(8, 12).toString() === 'WEBP';
    if (!magicMatches) throw new Error('Image signature mismatch.');
    const image = sharp(bytes, { limitInputPixels: 25000000, failOn: 'error' });
    const meta = await image.metadata();
    if (
      meta.format !== formats[mime] ||
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 25000000 ||
      (meta.pages || 1) > 1
    )
      throw new Error('Invalid image metadata.');
    // Force a bounded decode to reject truncated or malformed image data.
    await image.resize(1, 1).toBuffer();
  } catch {
    throw new AppError(
      400,
      'Image must be a valid static JPEG, PNG or WebP, at most 25 megapixels, matching its declared format.',
    );
  }
  return bytes;
}
