import type { HomepageCredential, HomepageCredentialType } from './homepage';

export const credentialTypeLabels: Record<HomepageCredentialType, string> = {
  certification: 'Certification',
  digital_badge: 'Digital badge',
  course: 'Course completion',
  training: 'Training certificate',
  license: 'License',
};

export function sortCredentials(
  credentials: HomepageCredential[],
): HomepageCredential[] {
  return [...credentials].sort(
    (first, second) =>
      first.order - second.order || first.id.localeCompare(second.id),
  );
}

export function getVisibleCredentials(
  credentials: HomepageCredential[],
): HomepageCredential[] {
  return sortCredentials(
    credentials.filter((credential) => credential.visible),
  );
}

export function getCredentialSpotlight(
  credentials: HomepageCredential[],
): HomepageCredential | undefined {
  return sortCredentials(
    credentials.filter(
      (credential) => credential.visible && credential.featured,
    ),
  )[0];
}

function parseCredentialDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!match) return undefined;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = dayText ? Number(dayText) : 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return undefined;
  return date;
}

export function credentialDateLabel(value: string): string | undefined {
  const date = parseCredentialDate(value);
  if (!date) return undefined;
  return date.toLocaleDateString('en', {
    ...(value.length === 7 ? {} : { day: 'numeric' as const }),
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function credentialIsExpired(
  value: string,
  now = new Date(),
): boolean | undefined {
  const expiry = parseCredentialDate(value);
  if (!expiry) return undefined;
  if (value.length === 7) {
    expiry.setUTCMonth(expiry.getUTCMonth() + 1, 0);
    expiry.setUTCHours(23, 59, 59, 999);
  } else {
    expiry.setUTCHours(23, 59, 59, 999);
  }
  return expiry.getTime() < now.getTime();
}
