/** Safe public references for uploaded media and image assets served by the site. */
export function isSafeImageReference(value: string): boolean {
  if (!value || value.length > 2048 || /[\\\u0000-\u001f]/.test(value))
    return false;
  if (
    /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i.test(
      value,
    )
  )
    return true;
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (/%(?:2e|2f|5c)/i.test(value)) return false;
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch {
      return false;
    }
    if (
      decoded.split('/').some((part) => part === '..') ||
      decoded.includes('\\')
    )
      return false;
    if (/^\/(?:api|user|auth|admin|media)(?:\/|$)/i.test(decoded)) return false;
    return (
      /^[\w./-]+$/.test(value) &&
      /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(decoded)
    );
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
