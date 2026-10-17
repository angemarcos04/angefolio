/** Add the configured public identity to a page title without duplicating it. */
export function formatPageTitle(pageTitle: string, identity: string): string {
  const title = pageTitle.trim();
  const name = identity.trim();

  if (!title) return name;
  if (!name || title === name || title.endsWith(` — ${name}`)) return title;
  return `${title} — ${name}`;
}
