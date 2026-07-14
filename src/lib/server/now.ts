import { eq } from 'drizzle-orm';
import { nowItems } from '../data/home';
import { getDatabase, migrateDatabase } from './db/client';
import { nowStatus } from './db/schema';

export const primaryNowStatusId = 'primary';

export interface PublicNowStatus {
  items: string[];
  statusNote: string | null;
  updatedAt: Date;
}

export async function getEditableNowStatus() {
  await migrateDatabase();

  return getDatabase().query.nowStatus.findFirst({
    where: eq(nowStatus.id, primaryNowStatusId),
  });
}

export async function getPublicNowStatus(): Promise<PublicNowStatus | null> {
  try {
    const status = await getEditableNowStatus();
    if (!status?.published) return null;

    const items = [
      status.currentFocus,
      ...status.workingOn,
      ...status.learning,
      ...status.using,
    ].filter(Boolean);

    if (items.length === 0) return null;

    return {
      items,
      statusNote: status.statusNote,
      updatedAt: status.updatedAt,
    };
  } catch {
    // Public rendering must stay available before database setup or during an outage.
    return null;
  }
}

export function getFallbackNowItems(): readonly string[] {
  return nowItems;
}
