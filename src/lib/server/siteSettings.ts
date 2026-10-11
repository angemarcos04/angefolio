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

function validSettings(value: unknown): value is PublicSiteSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.siteName === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.seoDescription === 'string' &&
    typeof candidate.github === 'string' &&
    typeof candidate.email === 'string'
  );
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    await migrateDatabase();
    const [record] = await getDatabase()
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.id, primarySiteSettingsId));
    return validSettings(record?.settings)
      ? record.settings
      : defaultSiteSettings;
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
