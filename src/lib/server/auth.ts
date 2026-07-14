import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { getDatabase } from './db/client';
import { schema } from './db/schema';
import {
  getServerEnv,
  getSiteOrigin,
  getTrustedOrigins,
  isProduction,
} from './env';

const developmentSecret =
  'angefolio-development-only-secret-do-not-use-in-production';

function getAuthSecret(): string {
  const configured = getServerEnv('AUTH_SECRET');

  if (configured) return configured;
  if (!isProduction()) return developmentSecret;

  throw new Error(
    'AUTH_SECRET is required in production and must contain at least 32 random characters.',
  );
}

export function createAuth(options: { allowSignUp?: boolean } = {}) {
  return betterAuth({
    appName: 'angefolio console',
    baseURL: getSiteOrigin(),
    secret: getAuthSecret(),
    trustedOrigins: getTrustedOrigins(),
    database: drizzleAdapter(getDatabase(), {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      storage: 'memory',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: isProduction(),
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
