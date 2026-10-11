import { eq } from 'drizzle-orm';
import { auditEvent } from './audit';
import { createAuth } from './auth';
import { closeDatabase, getDatabase, migrateDatabase } from './db/client';
import { account, auditLog, user } from './db/schema';

export async function recoverOwnerPassword(
  ownerEmail: string,
  newPassword: string,
): Promise<void> {
  const normalizedEmail = ownerEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid owner email address.');
  }
  if (newPassword.length < 12 || newPassword.length > 128) {
    throw new Error('The new password must contain 12 to 128 characters.');
  }

  await migrateDatabase();
  const owners = await getDatabase()
    .select({ id: user.id, email: user.email })
    .from(user);
  if (
    owners.length !== 1 ||
    owners[0].email.toLowerCase() !== normalizedEmail
  ) {
    throw new Error(
      'Recovery requires the exact email of the single existing owner account.',
    );
  }

  const credentials = await getDatabase()
    .select({ providerId: account.providerId, password: account.password })
    .from(account)
    .where(eq(account.userId, owners[0].id));
  const credentialAccount = credentials.find(
    (item) => item.providerId === 'credential' && item.password,
  );
  if (!credentialAccount) {
    throw new Error('The owner credential account is unavailable.');
  }

  const auth = createAuth();
  const context = await auth.$context;
  const passwordHash = await context.password.hash(newPassword);

  // Revoke first: if the password write fails, the owner can still sign in
  // with the old password, but no previously issued session remains active.
  await context.internalAdapter.deleteUserSessions(owners[0].id);
  await context.internalAdapter.updatePassword(owners[0].id, passwordHash);
  await getDatabase()
    .insert(auditLog)
    .values(
      auditEvent(owners[0].id, 'owner.password.recover', 'user', owners[0].id, {
        sessionsRevoked: true,
      }),
    );
}

export function closeRecoveryDatabase(): void {
  closeDatabase();
}
