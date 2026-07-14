import { getTrustedOrigins } from './env';

const defaultMaximumFormBytes = 16 * 1024;

function hasAcceptableFormSize(
  request: Request,
  maximumBytes: number,
): boolean {
  const contentLength = request.headers.get('content-length');
  if (!contentLength) return true;

  const bytes = Number(contentLength);
  return Number.isFinite(bytes) && bytes >= 0 && bytes <= maximumBytes;
}

export async function readUrlEncodedForm(
  request: Request,
  maximumBytes = defaultMaximumFormBytes,
): Promise<URLSearchParams | null> {
  const contentType = request.headers.get('content-type')?.split(';')[0];
  if (
    contentType !== 'application/x-www-form-urlencoded' ||
    !hasAcceptableFormSize(request, maximumBytes) ||
    !request.body
  ) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.byteLength;
    if (received > maximumBytes) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new URLSearchParams(new TextDecoder().decode(body));
  } catch {
    return null;
  }
}

export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    return getTrustedOrigins().includes(new URL(origin).origin);
  } catch {
    return false;
  }
}
