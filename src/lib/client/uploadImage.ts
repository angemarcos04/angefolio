export async function uploadImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }
  if (file.size > 8 * 1024 * 1024)
    throw new Error('Image exceeds the 8 MB upload limit.');
  const form = new FormData();
  form.set('image', file);
  const response = await fetch('/api/console/media/upload', {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (
    !response.ok ||
    !payload ||
    typeof payload !== 'object' ||
    !('path' in payload) ||
    typeof payload.path !== 'string'
  ) {
    const error =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : 'Image upload failed. Try again.';
    throw new Error(error);
  }
  return payload.path;
}
