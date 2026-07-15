import type { PortfolioTerminalData, TerminalLine } from './types';

export interface VirtualFile {
  type: 'file';
  content: string[];
  url?: string;
}

export interface VirtualDirectory {
  type: 'directory';
  children: Record<string, VirtualNode>;
}

export type VirtualNode = VirtualFile | VirtualDirectory;

const directory = (
  children: Record<string, VirtualNode>,
): VirtualDirectory => ({
  type: 'directory',
  children,
});

const file = (content: string | string[], url?: string): VirtualFile => ({
  type: 'file',
  content: Array.isArray(content) ? content : [content],
  url,
});

export function buildFilesystem(data: PortfolioTerminalData): VirtualDirectory {
  const projects = Object.fromEntries(
    data.projects.map((project) => [
      project.slug,
      directory({
        'README.md': file(
          [
            `# ${project.title}`,
            project.description,
            `status: ${project.status}`,
            `category: ${project.category ?? 'uncategorized'}`,
            `stack: ${project.stack.join(', ') || 'not listed'}`,
          ],
          project.url,
        ),
      }),
    ]),
  );
  const notes = Object.fromEntries(
    data.notes.map((note) => [
      `${note.slug}.md`,
      file(
        [`# ${note.title}`, note.summary ?? 'No summary provided.'],
        note.url,
      ),
    ]),
  );

  return directory({
    'about.md': file([`# ${data.name}`, data.about]),
    'now.txt': file(data.nowItems),
    'contact.txt': file([data.email, data.github]),
    'resume.pdf': file(
      'Resume download is not published in this portfolio build. Try `contact`.',
    ),
    projects: directory(projects),
    notes: directory(notes),
    lab: directory({
      'README.md': file(
        'Experiments and prototypes live at /lab.',
        data.routes.lab,
      ),
    }),
  });
}

export function resolvePath(cwd: string, target = '.'): string {
  const raw = target.trim() || '.';
  const parts =
    raw.startsWith('/') || raw.startsWith('~') || !cwd ? [] : cwd.split('/');
  const incoming = raw.replace(/^~\/?/, '').replace(/^\/+/, '').split('/');

  for (const part of incoming) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }

  return parts.join('/');
}

export function getNode(
  root: VirtualDirectory,
  path: string,
): VirtualNode | undefined {
  let node: VirtualNode = root;
  if (!path) return node;

  for (const segment of path.split('/').filter(Boolean)) {
    if (node.type !== 'directory') return undefined;
    node = node.children[segment];
    if (!node) return undefined;
  }

  return node;
}

export function displayPath(path: string): string {
  return path ? `~/${path}` : '~';
}

export function listNode(
  node: VirtualDirectory,
  showDetails = false,
): TerminalLine[] {
  const entries = Object.entries(node.children).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  if (!showDetails) {
    return [
      {
        text: entries
          .map(
            ([name, child]) =>
              `${name}${child.type === 'directory' ? '/' : ''}`,
          )
          .join('  '),
      },
    ];
  }

  return [
    { text: 'dr-xr-xr-x  .', kind: 'muted' },
    { text: 'dr-xr-xr-x  ..', kind: 'muted' },
    ...entries.map(([name, child]) => ({
      text: `${child.type === 'directory' ? 'dr-xr-xr-x' : '-r--r--r--'}  ${name}${child.type === 'directory' ? '/' : ''}`,
    })),
  ];
}

export function treeLines(
  root: VirtualDirectory,
  path: string,
  prefix = '',
): TerminalLine[] {
  const entries = Object.entries(root.children).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const lines: TerminalLine[] = prefix ? [] : [{ text: displayPath(path) }];

  entries.forEach(([name, node], index) => {
    const last = index === entries.length - 1;
    lines.push({ text: `${prefix}${last ? '└──' : '├──'} ${name}` });
    if (node.type === 'directory') {
      lines.push(
        ...treeLines(
          node,
          path ? `${path}/${name}` : name,
          `${prefix}${last ? '    ' : '│   '}`,
        ),
      );
    }
  });

  return lines;
}

export function getPathCandidates(
  root: VirtualDirectory,
  cwd: string,
  partial: string,
): string[] {
  const slashIndex = partial.lastIndexOf('/');
  const parentInput = slashIndex >= 0 ? partial.slice(0, slashIndex) : '.';
  const prefix = slashIndex >= 0 ? partial.slice(0, slashIndex + 1) : '';
  const fragment = slashIndex >= 0 ? partial.slice(slashIndex + 1) : partial;
  const parentPath = resolvePath(cwd, parentInput);
  const parent = getNode(root, parentPath);

  if (!parent || parent.type !== 'directory') return [];
  return Object.entries(parent.children)
    .filter(([name]) => name.startsWith(fragment))
    .map(
      ([name, node]) =>
        `${prefix}${name}${node.type === 'directory' ? '/' : ''}`,
    );
}
