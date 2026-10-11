import type { APIRoute } from 'astro';
import { hasTrustedOrigin } from '../../../../lib/server/security';
import {
  maxMediaUploadBytes,
  storeImageUpload,
} from '../../../../lib/server/media';

function response(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.user) return response('Authentication required.', 401);
  if (!hasTrustedOrigin(request))
    return response('Invalid request origin.', 403);

  const contentLengthHeader = request.headers.get('content-length');
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
  const maximumRequestBytes = maxMediaUploadBytes + 64 * 1024;
  if (
    contentLengthHeader &&
    (!Number.isFinite(contentLength) || contentLength > maximumRequestBytes)
  ) {
    return response('Image exceeds the 8 MB upload limit.', 413);
  }

  let form: FormData;
  try {
    if (!request.body) return response('Choose a supported image file.', 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maximumRequestBytes) {
        await reader.cancel();
        return response('Image exceeds the 8 MB upload limit.', 413);
      }
      chunks.push(value);
    }
    const body = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    form = await new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body,
    }).formData();
  } catch {
    return response('Choose a supported image file.', 400);
  }
  const file = form.get('image');
  if (!(file instanceof File) || file.size === 0) {
    return response('Choose a supported image file.', 400);
  }
  if (file.size > maxMediaUploadBytes) {
    return response('Image exceeds the 8 MB upload limit.', 413);
  }

  try {
    const path = await storeImageUpload(
      Buffer.from(await file.arrayBuffer()),
      file.type,
      locals.user.id,
    );
    return Response.json({ path });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'file-too-large')
      return response('Image exceeds the 8 MB upload limit.', 413);
    if (message === 'unsupported-image')
      return response('Use a static JPEG, PNG, or WebP image.', 415);
    if (message === 'processed-image-too-large')
      return response('Processed image exceeds the 2 MB storage limit.', 413);
    return response('Image could not be processed.', 400);
  }
};
