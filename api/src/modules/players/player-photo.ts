import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function normalizePlayerPhoto(base64: string): Promise<Uint8Array<ArrayBuffer>> {
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new BadRequestException('Envie uma foto JPEG ou PNG válida.');
  const input = Buffer.from(base64, 'base64');
  if (!input.length || input.length > MAX_PHOTO_BYTES) throw new BadRequestException('A foto deve ter até 2 MiB.');
  if (input.toString('base64') !== base64) throw new BadRequestException('Envie uma foto JPEG ou PNG válida.');
  try {
    const image = sharp(input, { failOn: 'warning', limitInputPixels: 16_777_216, animated: false });
    const metadata = await image.metadata();
    if (!['jpeg', 'png'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
    // Re-encoding both validates pixels and strips EXIF/location metadata.
    return new Uint8Array(await image.rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer());
  } catch {
    throw new BadRequestException('Envie uma foto JPEG ou PNG válida, de até 16 megapixels.');
  }
}
