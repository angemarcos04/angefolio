import type { PublicSiteSettings } from '../siteSettings';

export interface SiteSettingsValidationResult {
  success: boolean;
  data?: PublicSiteSettings;
}

function field(form: URLSearchParams, name: string): string {
  return (form.get(name) ?? '').trim();
}

function validGithub(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'github.com' &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/[A-Za-z0-9-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function validateSiteSettingsForm(
  form: URLSearchParams,
): SiteSettingsValidationResult {
  const data = {
    siteName: field(form, 'siteName'),
    name: field(form, 'name'),
    seoDescription: field(form, 'seoDescription'),
    github: field(form, 'github'),
    email: field(form, 'email'),
  };
  if (
    !data.siteName ||
    data.siteName.length > 50 ||
    !data.name ||
    data.name.length > 100 ||
    !data.seoDescription ||
    data.seoDescription.length > 320 ||
    !validGithub(data.github) ||
    !validEmail(data.email)
  )
    return { success: false };
  return { success: true, data };
}
