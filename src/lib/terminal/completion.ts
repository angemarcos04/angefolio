import { getPathCandidates, type VirtualDirectory } from './filesystem';

interface CompletionContext {
  commandNames: string[];
  cwd: string;
  filesystem: VirtualDirectory;
  projectSlugs: string[];
  routeNames: string[];
}

export interface CompletionResult {
  value: string;
  candidates: string[];
}

export function completeInput(
  value: string,
  context: CompletionContext,
): CompletionResult {
  const trailingSpace = /\s$/.test(value);
  const tokens = value.trim().split(/\s+/).filter(Boolean);
  const active = trailingSpace ? '' : (tokens.at(-1) ?? '');

  if (tokens.length <= 1 && !trailingSpace) {
    const candidates = context.commandNames.filter((name) =>
      name.startsWith(active.toLowerCase()),
    );
    return applyCompletion(value, active, candidates);
  }

  const command = tokens[0]?.toLowerCase();
  let candidates: string[];
  if (
    command === 'project' ||
    (command === 'git' && tokens[1]?.toLowerCase() === 'show')
  ) {
    candidates = context.projectSlugs.filter((slug) => slug.startsWith(active));
  } else if (command === 'open') {
    candidates = [
      ...new Set([...context.routeNames, ...context.projectSlugs]),
    ].filter((name) => name.startsWith(active));
  } else if (command === 'theme') {
    candidates = ['light', 'dim', 'dark'].filter((theme) =>
      theme.startsWith(active),
    );
  } else if (['cd', 'cat', 'ls', 'tree'].includes(command ?? '')) {
    candidates = getPathCandidates(context.filesystem, context.cwd, active);
  } else {
    candidates = [];
  }

  return applyCompletion(value, active, candidates);
}

function applyCompletion(
  value: string,
  active: string,
  candidates: string[],
): CompletionResult {
  if (candidates.length === 0) return { value, candidates };
  const replacement =
    candidates.length === 1 ? candidates[0] : longestCommonPrefix(candidates);
  if (!replacement || replacement === active) return { value, candidates };
  const base = active ? value.slice(0, -active.length) : value;
  return {
    value: `${base}${replacement}${candidates.length === 1 && !replacement.endsWith('/') ? ' ' : ''}`,
    candidates,
  };
}

function longestCommonPrefix(values: string[]): string {
  return values.slice(1).reduce((prefix, value) => {
    let index = 0;
    while (index < prefix.length && prefix[index] === value[index]) index += 1;
    return prefix.slice(0, index);
  }, values[0] ?? '');
}
