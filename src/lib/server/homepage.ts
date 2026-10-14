import { eq } from 'drizzle-orm';
import { defaultHomepageConfig, type HomepageConfig } from '../data/homepage';
import { auditEvent } from './audit';
import { getDatabase, migrateDatabase } from './db/client';
import { auditLog, contentRevisions, homepageSettings } from './db/schema';
import { pruneContentRevisions, revisionValues } from './revisions';

export const primaryHomepageSettingsId = 'primary';

export async function getHomepageConfig(): Promise<HomepageConfig> {
  try {
    await migrateDatabase();
    const record = await getDatabase().query.homepageSettings.findFirst({
      where: eq(homepageSettings.id, primaryHomepageSettingsId),
    });
    if (!record) return defaultHomepageConfig;
    const saved = record.settings as Partial<HomepageConfig>;
    return {
      ...defaultHomepageConfig,
      ...saved,
      affiliations: (
        saved.affiliations ?? defaultHomepageConfig.affiliations
      ).map((affiliation) => ({
        ...affiliation,
        url:
          affiliation.url ??
          defaultHomepageConfig.affiliations.find(
            (defaultAffiliation) =>
              defaultAffiliation.name === affiliation.name,
          )?.url,
      })),
      credentials: saved.credentials ?? defaultHomepageConfig.credentials,
      cards: { ...defaultHomepageConfig.cards, ...saved.cards },
    };
  } catch {
    return defaultHomepageConfig;
  }
}

export async function saveHomepageConfig(
  config: HomepageConfig,
  actorUserId: string,
): Promise<void> {
  await migrateDatabase();
  const now = new Date();
  await getDatabase().transaction(async (transaction) => {
    await transaction
      .insert(homepageSettings)
      .values({
        id: primaryHomepageSettingsId,
        settings: config as unknown as Record<string, unknown>,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: homepageSettings.id,
        set: {
          settings: config as unknown as Record<string, unknown>,
          updatedAt: now,
        },
      });
    await transaction.insert(auditLog).values(
      auditEvent(
        actorUserId,
        'homepage.update',
        'homepage_settings',
        primaryHomepageSettingsId,
        {
          cardCount: Object.values(config.cards).filter((card) => card.visible)
            .length,
          stackGroupCount: config.stackGroups.length,
        },
      ),
    );
    await transaction.insert(contentRevisions).values(
      revisionValues(
        actorUserId,
        'homepage_settings',
        primaryHomepageSettingsId,
        {
          id: primaryHomepageSettingsId,
          ...config,
          updatedAt: now,
        },
      ),
    );
    await pruneContentRevisions(
      transaction,
      'homepage_settings',
      primaryHomepageSettingsId,
    );
  });
}
