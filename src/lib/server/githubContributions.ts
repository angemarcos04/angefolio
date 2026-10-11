export interface GitHubContributionDay {
  date: string;
  level: number;
  weekday: number;
  week: number;
}

export interface GitHubContributions {
  total: string;
  days: GitHubContributionDay[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<
  string,
  { value: GitHubContributions; expiresAt: number }
>();
const inFlight = new Map<string, Promise<GitHubContributions | null>>();

function accountFromProfileUrl(profileUrl: string): string | null {
  try {
    const url = new URL(profileUrl);
    const [account, extra] = url.pathname.split('/').filter(Boolean);
    if (
      url.hostname !== 'github.com' ||
      extra !== undefined ||
      !account ||
      !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(account)
    ) {
      return null;
    }
    return account;
  } catch {
    return null;
  }
}

function attribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return tag.match(new RegExp(`\\b${escaped}="([^"]*)"`))?.[1] ?? null;
}

export function parseGitHubContributions(
  html: string,
): GitHubContributions | null {
  const heading = html.match(
    /<h2\b[^>]*id="js-contribution-activity-description"[^>]*>([\s\S]*?)<\/h2>/i,
  )?.[1];
  const total = heading
    ?.replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!total) return null;

  const tags =
    html.match(
      /<td\b[^>]*\bclass="[^"]*\bContributionCalendar-day\b[^"]*"[^>]*>/gi,
    ) ?? [];
  const days: GitHubContributionDay[] = [];
  for (const tag of tags) {
    const date = attribute(tag, 'data-date');
    const level = attribute(tag, 'data-level');
    const position = attribute(tag, 'id')?.match(
      /^contribution-day-component-(\d+)-(\d+)$/,
    );
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !level ||
      !/^[0-4]$/.test(level) ||
      !position
    ) {
      return null;
    }
    days.push({
      date,
      level: Number(level),
      weekday: Number(position[1]),
      week: Number(position[2]),
    });
  }
  if (days.length < 360 || days.length > 370) return null;
  return { total, days };
}

async function fetchContributions(
  account: string,
): Promise<GitHubContributions | null> {
  try {
    // GitHub renders this calendar as HTML. A markup change returns null here
    // so the page never substitutes fabricated activity.
    const response = await fetch(
      `https://github.com/users/${encodeURIComponent(account)}/contributions`,
      {
        headers: { Accept: 'text/html', 'User-Agent': 'angefolio-portfolio' },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) return null;
    return parseGitHubContributions(await response.text());
  } catch {
    return null;
  }
}

export async function getGitHubContributions(
  profileUrl: string,
): Promise<GitHubContributions | null> {
  const account = accountFromProfileUrl(profileUrl);
  if (!account) return null;

  const now = Date.now();
  const cached = cache.get(account);
  if (cached && cached.expiresAt > now) return cached.value;

  let request = inFlight.get(account);
  if (!request) {
    request = fetchContributions(account);
    inFlight.set(account, request);
  }
  const fresh = await request;
  inFlight.delete(account);
  if (fresh) {
    cache.set(account, { value: fresh, expiresAt: now + CACHE_TTL_MS });
    return fresh;
  }
  return cached?.value ?? null;
}
