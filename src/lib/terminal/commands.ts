import {
  displayPath,
  getNode,
  listNode,
  resolvePath,
  treeLines,
  type VirtualDirectory,
} from './filesystem';
import type {
  PortfolioTerminalData,
  PortfolioTheme,
  TerminalLine,
  TerminalProject,
  TerminalResult,
} from './types';

export interface CommandContext {
  data: PortfolioTerminalData;
  filesystem: VirtualDirectory;
  cwd: string;
  history: string[];
}

interface CommandDefinition {
  name: string;
  usage: string;
  summary: string;
  execute: (args: string[], context: CommandContext) => TerminalResult;
}

const line = (
  text: string,
  kind: TerminalLine['kind'] = 'normal',
): TerminalLine => ({ text, kind });

const error = (text: string): TerminalResult => ({
  lines: [line(text, 'error')],
  ok: false,
});

function projectLines(project: TerminalProject): TerminalLine[] {
  const links = [
    project.url ? { label: 'case study', url: project.url } : undefined,
    project.github
      ? { label: 'github', url: project.github, external: true }
      : undefined,
    project.demo
      ? { label: 'demo', url: project.demo, external: true }
      : undefined,
  ].filter((link): link is NonNullable<typeof link> => Boolean(link));

  return [
    line(project.title, 'accent'),
    line(project.description),
    line(`status: ${project.status}`),
    line(`category: ${project.category ?? 'uncategorized'}`),
    line(`stack: ${project.stack.join(', ') || 'not listed'}`),
    ...(links.length > 0 ? [{ text: 'links:', links }] : []),
  ];
}

function knownTargets(data: PortfolioTerminalData) {
  const targets = new Map<
    string,
    { label: string; url: string; external?: boolean }
  >();
  Object.entries(data.routes).forEach(([name, url]) =>
    targets.set(name.toLowerCase(), { label: name, url }),
  );
  data.projects.forEach((project) => {
    if (project.url)
      targets.set(project.slug, { label: project.title, url: project.url });
  });
  data.socials.forEach((social) =>
    targets.set(social.label.toLowerCase(), {
      label: social.label,
      url: social.url,
      external: /^https?:\/\//.test(social.url),
    }),
  );
  targets.set('github', { label: 'GitHub', url: data.github, external: true });
  targets.set('email', { label: 'Email', url: `mailto:${data.email}` });
  return targets;
}

function gitLogLines(
  data: PortfolioTerminalData,
  latestOnly: boolean,
): TerminalLine[] {
  const entries: TerminalLine[] = [];
  if (data.buildCommit) {
    const shortCommit = data.buildCommit.slice(0, 8);
    entries.push(
      line(
        `${shortCommit} build${data.buildDate ? ` ${data.buildDate}` : ''} angefolio build commit`,
      ),
    );
  } else if (data.latestUpdate) {
    entries.push(
      line(
        `content${data.latestUpdate.date ? ` ${data.latestUpdate.date}` : ''} ${data.latestUpdate.label}`,
      ),
    );
  } else {
    entries.push(line('commit metadata unavailable in this build', 'muted'));
  }

  if (!latestOnly) {
    const existing = new Set(entries.map((entry) => entry.text));
    const updates = [
      ...data.notes.map((note) => ({
        label: `note: ${note.title}`,
        date: note.updatedAt ?? note.createdAt,
      })),
      ...data.projects
        .filter((project) => project.updatedAt)
        .map((project) => ({
          label: `project: ${project.title}`,
          date: project.updatedAt!,
        })),
    ]
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 5);

    for (const update of updates) {
      const text = `content ${update.date.slice(0, 10)} ${update.label}`;
      if (!existing.has(text)) entries.push(line(text));
    }
  }

  return entries;
}

const commands: CommandDefinition[] = [
  {
    name: 'help',
    usage: 'help',
    summary: 'List available commands.',
    execute: () => ({
      lines: [
        line('Core', 'accent'),
        line('help  man  pwd  ls  cd  cat  tree  clear  history  echo'),
        line('whoami  date  uptime  uname  fastfetch  exit'),
        line('Portfolio', 'accent'),
        line('status  now  projects  project  notes  lab  contact  socials'),
        line('skills  resume  open  theme'),
        line('Git-inspired', 'accent'),
        line('git status  git log  git branch  git show  git remote -v'),
        line('Tip: Tab completes commands and known paths.', 'muted'),
      ],
    }),
  },
  {
    name: 'man',
    usage: 'man <command>',
    summary: 'Show command usage.',
    execute: ([name]) => {
      if (!name) return error('man: expected a command name');
      const command = commandRegistry.get(name.toLowerCase());
      return command
        ? { lines: [line(command.usage, 'accent'), line(command.summary)] }
        : error(`No manual entry for ${name}`);
    },
  },
  {
    name: 'pwd',
    usage: 'pwd',
    summary: 'Print the current virtual directory.',
    execute: (_args, context) => ({
      lines: [
        line(
          `/home/${context.data.username}${context.cwd ? `/${context.cwd}` : ''}`,
        ),
      ],
    }),
  },
  {
    name: 'ls',
    usage: 'ls [-la] [path]',
    summary: 'List a virtual directory.',
    execute: (args, context) => {
      const showDetails = args.some((arg) => arg === '-la' || arg === '-al');
      const target = args.find((arg) => !arg.startsWith('-')) ?? '.';
      const path = resolvePath(context.cwd, target);
      const node = getNode(context.filesystem, path);
      if (!node) return error(`ls: ${target}: No such file or directory`);
      if (node.type === 'file') return { lines: [line(target)] };
      return { lines: listNode(node, showDetails) };
    },
  },
  {
    name: 'cd',
    usage: 'cd [path]',
    summary: 'Change the current virtual directory.',
    execute: ([target = '~'], context) => {
      const path = resolvePath(context.cwd, target);
      const node = getNode(context.filesystem, path);
      if (!node) return error(`cd: ${target}: No such file or directory`);
      if (node.type !== 'directory')
        return error(`cd: ${target}: Not a directory`);
      return { cwd: path };
    },
  },
  {
    name: 'cat',
    usage: 'cat <file>',
    summary: 'Read a file from the virtual portfolio.',
    execute: ([target], context) => {
      if (!target) return error('cat: missing file operand');
      const node = getNode(
        context.filesystem,
        resolvePath(context.cwd, target),
      );
      if (!node) return error(`cat: ${target}: No such file`);
      if (node.type === 'directory')
        return error(`cat: ${target}: Is a directory`);
      return {
        lines: node.content.map((content) => line(content)),
      };
    },
  },
  {
    name: 'tree',
    usage: 'tree [path]',
    summary: 'Print the read-only virtual filesystem tree.',
    execute: ([target = '.'], context) => {
      const path = resolvePath(context.cwd, target);
      const node = getNode(context.filesystem, path);
      if (!node) return error(`tree: ${target}: No such directory`);
      if (node.type !== 'directory') return { lines: [line(target)] };
      return { lines: treeLines(node, path) };
    },
  },
  {
    name: 'clear',
    usage: 'clear',
    summary: 'Clear terminal output.',
    execute: () => ({ clear: true }),
  },
  {
    name: 'history',
    usage: 'history',
    summary: 'Show commands entered in this session.',
    execute: (_args, context) => ({
      lines: context.history.map((entry, index) =>
        line(`${String(index + 1).padStart(3, ' ')}  ${entry}`),
      ),
    }),
  },
  {
    name: 'echo',
    usage: 'echo <text>',
    summary: 'Print plain text. Shell expansion is intentionally unsupported.',
    execute: (args) => ({ lines: [line(args.join(' '))] }),
  },
  {
    name: 'whoami',
    usage: 'whoami',
    summary: 'Show the portfolio owner.',
    execute: (_args, context) => ({
      lines: [
        line(context.data.name, 'accent'),
        line('Developer building practical, privacy-minded systems.'),
      ],
    }),
  },
  {
    name: 'date',
    usage: 'date',
    summary: 'Show the visitor browser’s local date and time.',
    execute: () => ({ lines: [line(new Date().toString())] }),
  },
  {
    name: 'uptime',
    usage: 'uptime',
    summary: 'Show portfolio-building history, not machine uptime.',
    execute: (_args, context) => ({
      lines: [
        line(`portfolio uptime: building since ${context.data.portfolioSince}`),
      ],
    }),
  },
  {
    name: 'uname',
    usage: 'uname',
    summary: 'Describe the virtual shell environment.',
    execute: () => ({
      lines: [line('angefolio virtual-shell browser read-only')],
    }),
  },
  {
    name: 'fastfetch',
    usage: 'fastfetch',
    summary: 'Show a compact portfolio summary.',
    execute: (_args, context) => ({
      lines: [
        line(`${context.data.username}@${context.data.hostname}`, 'accent'),
        line(`owner: ${context.data.name}`),
        line(`projects: ${context.data.projects.length} public`),
        line(`notes: ${context.data.notes.length} published`),
        line('shell: angefolio virtual shell (read-only)'),
        line(`cwd: ${displayPath(context.cwd)}`),
      ],
    }),
  },
  {
    name: 'exit',
    usage: 'exit',
    summary: 'Close the expanded terminal.',
    execute: () => ({ close: true }),
  },
  {
    name: 'status',
    usage: 'status',
    summary: 'Show a concise portfolio activity summary.',
    execute: (_args, context) => ({
      lines: [
        line(
          `focus: ${context.data.nowItems[0] ?? 'building angefolio'}`,
          'accent',
        ),
        line(
          `queue: ${context.data.nowItems.slice(1, 3).join(' · ') || 'clear'}`,
        ),
        line(
          `public: ${context.data.projects.length} projects · ${context.data.notes.length} notes`,
        ),
      ],
    }),
  },
  {
    name: 'now',
    usage: 'now',
    summary: 'Show the same current-focus data as the homepage Now card.',
    execute: (_args, context) => ({
      lines: context.data.nowItems.map((item) => line(`- ${item}`)),
    }),
  },
  {
    name: 'projects',
    usage: 'projects [--featured]',
    summary: 'List public portfolio projects.',
    execute: (args, context) => {
      const featuredOnly = args.includes('--featured');
      const projects = featuredOnly
        ? context.data.projects.filter((project) => project.featured)
        : context.data.projects;
      return {
        lines:
          projects.length > 0
            ? projects.map((project) =>
                line(
                  `${project.slug.padEnd(18)} ${project.status.padEnd(12)} ${project.category ?? 'uncategorized'} — ${project.title}`,
                ),
              )
            : [line('No matching public projects.', 'muted')],
      };
    },
  },
  {
    name: 'project',
    usage: 'project <slug>',
    summary: 'Show details for a public project.',
    execute: ([slug], context) => {
      if (!slug) return error('project: expected a project slug');
      const project = context.data.projects.find(
        (entry) => entry.slug === slug,
      );
      return project
        ? { lines: projectLines(project) }
        : error(`project: ${slug}: not found`);
    },
  },
  {
    name: 'notes',
    usage: 'notes',
    summary: 'List published notes.',
    execute: (_args, context) => ({
      lines: context.data.notes.map((note) => ({
        text: `${note.createdAt.slice(0, 10)}  ${note.title}`,
        links: [{ label: 'read', url: note.url }],
      })),
    }),
  },
  {
    name: 'lab',
    usage: 'lab',
    summary: 'Link to the public experiments area.',
    execute: (_args, context) => ({
      lines: [
        {
          text: 'Experiments, prototypes, and learning artifacts.',
          links: [{ label: 'open /lab', url: context.data.routes.lab }],
        },
      ],
    }),
  },
  {
    name: 'contact',
    usage: 'contact',
    summary: 'Show public contact details.',
    execute: (_args, context) => ({
      lines: [
        {
          text: context.data.email,
          links: [{ label: 'email', url: `mailto:${context.data.email}` }],
        },
        {
          text: context.data.github,
          links: [
            { label: 'github', url: context.data.github, external: true },
          ],
        },
      ],
    }),
  },
  {
    name: 'socials',
    usage: 'socials',
    summary: 'List configured public social profiles.',
    execute: (_args, context) => ({
      lines: context.data.socials.map((social) => ({
        text: social.label,
        links: [{ label: social.url, url: social.url, external: true }],
      })),
    }),
  },
  {
    name: 'skills',
    usage: 'skills',
    summary: 'Show the portfolio stack by domain.',
    execute: (_args, context) => ({
      lines: context.data.stack.map((group) =>
        line(`${group.title.toLowerCase()}: ${group.items.join(', ')}`),
      ),
    }),
  },
  {
    name: 'resume',
    usage: 'resume',
    summary: 'Open a published resume when available.',
    execute: (_args, context) => {
      const resumeUrl = context.data.routes.resume;
      return resumeUrl
        ? { navigate: { label: 'resume', url: resumeUrl } }
        : {
            lines: [
              line(
                'Resume is not published in this build. Try `contact`.',
                'muted',
              ),
            ],
          };
    },
  },
  {
    name: 'open',
    usage: 'open <target>',
    summary:
      'Open only a known portfolio route, project, or social destination.',
    execute: ([target], context) => {
      if (!target) return error('open: expected a known target');
      const destination = knownTargets(context.data).get(target.toLowerCase());
      return destination
        ? { navigate: destination }
        : error(`open: ${target}: target is not whitelisted`);
    },
  },
  {
    name: 'theme',
    usage: 'theme <light|dim|dark>',
    summary: 'Change the site’s existing theme.',
    execute: ([theme]) => {
      const validThemes: PortfolioTheme[] = ['light', 'dim', 'dark'];
      return validThemes.includes(theme as PortfolioTheme)
        ? { theme: theme as PortfolioTheme, lines: [line(`theme: ${theme}`)] }
        : error('theme: expected light, dim, or dark');
    },
  },
  {
    name: 'git',
    usage: 'git <status|log|branch|show|remote>',
    summary:
      'Inspect truthful portfolio/build metadata; this is not the visitor’s Git repository.',
    execute: ([subcommand, ...args], context) => {
      if (subcommand === 'status') {
        return {
          lines: [
            line('On branch portfolio/main'),
            line('Virtual portfolio state: read-only and public-data only.'),
            line(
              `${context.data.projects.length} projects and ${context.data.notes.length} notes indexed.`,
            ),
          ],
        };
      }
      if (subcommand === 'log') {
        return { lines: gitLogLines(context.data, args.includes('-1')) };
      }
      if (subcommand === 'branch') {
        return { lines: [line('* portfolio/main', 'accent')] };
      }
      if (subcommand === 'show') {
        const slug = args[0];
        if (!slug) return error('git show: expected a project slug');
        const project = context.data.projects.find(
          (entry) => entry.slug === slug,
        );
        return project
          ? { lines: projectLines(project) }
          : error(`git show: ${slug}: unknown project`);
      }
      if (subcommand === 'remote' && args[0] === '-v') {
        return {
          lines: [
            line(`origin  ${context.data.github} (fetch)`),
            line(`origin  ${context.data.github} (push)`),
          ],
        };
      }
      return error(
        'git: supported subcommands are status, log, branch, show, and remote -v',
      );
    },
  },
];

export const commandRegistry = new Map(
  commands.map((command) => [command.name, command]),
);

export const commandNames = commands.map((command) => command.name);

function editDistance(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = rows[0];
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const saved = rows[leftIndex];
      rows[leftIndex] = Math.min(
        rows[leftIndex] + 1,
        rows[leftIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      previous = saved;
    }
  }
  return rows[left.length];
}

export function executeCommand(
  name: string,
  args: string[],
  context: CommandContext,
): TerminalResult {
  const command = commandRegistry.get(name);
  if (command) return { ok: true, ...command.execute(args, context) };

  const suggestion = commandNames
    .map((candidate) => ({
      candidate,
      distance: editDistance(name, candidate),
    }))
    .sort((left, right) => left.distance - right.distance)[0];
  const hint =
    suggestion && suggestion.distance <= 2
      ? ` Did you mean '${suggestion.candidate}'?`
      : " Type 'help' to list commands.";
  return error(`Command '${name}' not found.${hint}`);
}
