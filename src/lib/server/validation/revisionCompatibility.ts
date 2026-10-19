import type { RevisionEntityType } from '../revisions';

type Snapshot = Record<string, unknown>;

export type RevisionNormalizationResult =
  { success: true; data: Snapshot } | { success: false; reason: string };

/**
 * Adapt only established missing optional fields in decoded historical JSON.
 * Values that are present, including malformed values, go to domain validation
 * unchanged. The stored snapshot is never modified.
 */
export function normalizeRevisionSnapshot(
  type: RevisionEntityType,
  value: unknown,
): RevisionNormalizationResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return { success: false, reason: 'Snapshot is not an object.' };

  const snapshot = value as Snapshot;
  if (type === 'project') {
    return {
      success: true,
      data: {
        ...snapshot,
        ...(snapshot.projectDate === undefined ? { projectDate: null } : {}),
        // Migration 0012 added screenshot storage after revisions existed.
        ...(snapshot.screenshots === undefined ? { screenshots: [] } : {}),
      },
    };
  }
  if (type === 'lab' && snapshot.updatedAt === undefined) {
    return { success: true, data: { ...snapshot, updatedAt: null } };
  }
  return { success: true, data: snapshot };
}
