export type AuditMetadata = Record<string, string | number | boolean | null>;

export function auditEvent(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: AuditMetadata = {},
) {
  return {
    id: crypto.randomUUID(),
    actorUserId,
    action,
    entityType,
    entityId,
    metadata,
    createdAt: new Date(),
  };
}
