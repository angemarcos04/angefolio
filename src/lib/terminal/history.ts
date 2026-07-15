export const terminalHistoryLimit = 100;

export function appendHistory(
  history: string[],
  command: string,
  limit = terminalHistoryLimit,
): string[] {
  const entry = command.trim();
  if (!entry || history.at(-1) === entry) return history;

  return [...history, entry].slice(-Math.max(1, limit));
}
