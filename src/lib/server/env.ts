type RuntimeEnv = Record<string, string | undefined>;

function viteEnvironment(): RuntimeEnv | undefined {
  return (import.meta as ImportMeta & { env?: RuntimeEnv }).env;
}

export function getServerEnv(name: string): string | undefined {
  const value = process.env[name] ?? viteEnvironment()?.[name];
  return value?.trim() || undefined;
}

export function requireServerEnv(name: string): string {
  const value = getServerEnv(name);

  if (!value) {
    throw new Error(`${name} is required for the angefolio server runtime.`);
  }

  return value;
}

export function isProduction(): boolean {
  return (getServerEnv('NODE_ENV') ?? 'development') === 'production';
}

export function getSiteOrigin(): string {
  const configured =
    getServerEnv('AUTH_TRUSTED_ORIGIN')?.split(',')[0] ??
    getServerEnv('PUBLIC_SITE_URL') ??
    'http://localhost:4321';

  try {
    return new URL(configured).origin;
  } catch {
    throw new Error(
      'AUTH_TRUSTED_ORIGIN or PUBLIC_SITE_URL must be a valid URL.',
    );
  }
}

export function getTrustedOrigins(): string[] {
  const configured = [
    ...(getServerEnv('AUTH_TRUSTED_ORIGIN')?.split(',') ?? []),
    getServerEnv('PUBLIC_SITE_URL'),
  ].filter((value): value is string => Boolean(value));

  const origins =
    configured.length > 0 ? configured : ['http://localhost:4321'];

  return [...new Set(origins.map((origin) => new URL(origin.trim()).origin))];
}
