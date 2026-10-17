import { eq } from 'drizzle-orm';
import { site as siteDefaults } from '../data/site';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, contentRevisions, siteSettings } from './db/schema';
import { pruneContentRevisions, revisionValues } from './revisions';

export const primarySiteSettingsId = 'primary';

export interface PublicSiteSettings {
  siteName: string;
  name: string;
  seoDescription: string;
  github: string;
  email: string;
}

export const defaultSiteSettings: PublicSiteSettings = {
  siteName: siteDefaults.siteName,
  name: siteDefaults.name,
  seoDescription: siteDefaults.seoDescription,
  github: siteDefaults.github,
  email: siteDefaults.email,
};

export function normalizePublicSiteSettings(
  value: unknown,
): PublicSiteSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultSiteSettings;
  }

  const candidate = value as Record<string, unknown>;
  const setting = (key: keyof PublicSiteSettings) =>
    typeof candidate[key] === 'string' ? candidate[key].trim() : '';
  return {
    siteName: setting('siteName') || defaultSiteSettings.siteName,
    name: setting('name') || defaultSiteSettings.name,
    seoDescription:
      setting('seoDescription') || defaultSiteSettings.seoDescription,
    github: setting('github') || defaultSiteSettings.github,
    email: setting('email') || defaultSiteSettings.email,
  };
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    await migrateDatabase();
    const [record] = await getDatabase()
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, primarySiteSettingsId));
    return normalizePublicSiteSettings(record?.settings);
  } catch {
    return defaultSiteSettings;
  }
}

export async function saveSiteSettings(
  settings: PublicSiteSettings,
  actorUserId: string,
): Promise<void> {
  await migrateDatabase();
  const updatedAt = new Date();
  const storedSettings = settings as unknown as Record<string, unknown>;
  await getDatabase().transaction(async (transaction) => {
    await transaction
      .insert(siteSettings)
      .values({
        id: primarySiteSettingsId,
        settings: storedSettings,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: siteSettings.id,
        set: { settings: storedSettings, updatedAt },
      });
    await transaction.insert(auditLog).values(
      auditEvent(
        actorUserId,
        'site_settings.update',
        'site_settings',
        primarySiteSettingsId,
        {
          fields: Object.keys(settings).join(','),
        },
      ),
    );
    await transaction.insert(contentRevisions).values(
      revisionValues(actorUserId, 'site_settings', primarySiteSettingsId, {
        id: primarySiteSettingsId,
        ...settings,
        updatedAt,
      }),
    );
    await pruneContentRevisions(
      transaction,
      'site_settings',
      primarySiteSettingsId,
    );
  });
}
