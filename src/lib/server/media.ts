import { eq } from 'drizzle-orm';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, mediaAssets } from './db/schema';

export const maxMediaUploadBytes = 8 * 1024 * 1024;
const maxStoredMediaBytes = 2 * 1024 * 1024;
const maxImagePixels = 40_000_000;
const maxImageSide = 2000;

export async function storeImageUpload(
  source: Buffer,
  inputMimeType: string,
  actorUserId: string,
): Promise<string> {
  if (source.byteLength > maxMediaUploadBytes) {
    throw new Error('file-too-large');
  }

  const sharp = (await import('sharp')).default;
  const input = sharp(source, {
    failOn: 'error',
    limitInputPixels: maxImagePixels,
    animated: false,
  });
  const metadata = await input.metadata();
  const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (
    !supportedMimeTypes.has(inputMimeType) ||
    metadata.format !== inputMimeType.slice(6)
  ) {
    throw new Error('unsupported-image');
  }
  if (
    !metadata.width ||
    !metadata.height ||
    (metadata.pages && metadata.pages > 1)
  ) {
    throw new Error('unsupported-image');
  }

  const output = await input
    .rotate()
    .resize({
      width: maxImageSide,
      height: maxImageSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 5 })
    .toBuffer();
  if (output.byteLength > maxStoredMediaBytes) {
    throw new Error('processed-image-too-large');
  }

  await migrateDatabase();
  const id = crypto.randomUUID();
  await getDatabase().transaction(async (transaction) => {
    await transaction.insert(mediaAssets).values({
      id,
      mimeType: 'image/webp',
      data: output,
      createdAt: new Date(),
    });
    await transaction.insert(auditLog).values(
      auditEvent(actorUserId, 'media.upload', 'media', id, {
        mimeType: 'image/webp',
        bytes: output.byteLength,
      }),
    );
  });
  return `/media/${id}.webp`;
}

export async function getMediaAsset(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return undefined;
  await migrateDatabase();
  return getDatabase().query.mediaAssets.findFirst({
    where: eq(mediaAssets.id, id),
    columns: { mimeType: true, data: true },
  });
}
