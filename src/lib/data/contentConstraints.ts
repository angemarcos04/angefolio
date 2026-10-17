export const PROJECT_SCREENSHOT_COUNT_MAX = 8;
export const PROJECT_SCREENSHOT_ALT_MAX_LENGTH = 300;
export const PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH = 200;

/** URLs used as public destinations must not embed credentials. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
