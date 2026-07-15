import assert from 'node:assert/strict';
import test from 'node:test';
import { commandNames, executeCommand } from '../src/lib/terminal/commands';
import { completeInput } from '../src/lib/terminal/completion';
import {
  buildFilesystem,
  getNode,
  resolvePath,
} from '../src/lib/terminal/filesystem';
import { parseCommandLine } from '../src/lib/terminal/parser';
import { appendHistory } from '../src/lib/terminal/history';
import type { PortfolioTerminalData } from '../src/lib/terminal/types';

const data: PortfolioTerminalData = {
  name: 'Angellie D. Marcos',
  username: 'ange',
  hostname: 'angefolio',
  email: 'ange@example.com',
  github: 'https://github.com/angemarcos04',
  repositoryUrl: 'https://github.com/angemarcos04/angefolio',
  about: 'Portfolio owner.',
  nowItems: ['Building angefolio.', 'Working on CSPAMS and Aulert.'],
  projects: [
    {
      slug: 'cspams',
      title: 'CSPAMS',
      description: 'Concern tracking system.',
      status: 'Active',
      category: 'Web',
      stack: ['Astro', 'Svelte'],
      featured: true,
      url: '/projects/cspams',
      github: 'https://github.com/angemarcos04/cspams',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
    {
      slug: 'aulert',
      title: 'Aulert',
      description: 'Alerting project.',
      status: 'Planned',
      stack: ['Rust'],
      featured: false,
    },
  ],
  notes: [
    {
      slug: 'building-angefolio',
      title: 'Building angefolio',
      summary: 'Portfolio implementation notes.',
      url: '/notes/building-angefolio',
      createdAt: '2026-06-01T00:00:00.000Z',
    },
  ],
  socials: [
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/angellie-marcos-6a904917a/',
    },
  ],
  stack: [{ title: 'Frontend', items: ['Astro', 'Svelte'] }],
  routes: {
    home: '/',
    projects: '/projects',
    notes: '/notes',
    lab: '/lab',
    contact: '/#contact',
  },
  latestUpdate: {
    label: 'note: Building angefolio',
    date: '2026-06-01',
    url: '/notes/building-angefolio',
  },
  portfolioSince: 2023,
};

const filesystem = buildFilesystem(data);
const run = (name: string, args: string[] = [], cwd = '') =>
  executeCommand(name, args, {
    data,
    filesystem,
    cwd,
    history: ['help', 'pwd'],
  });

test('parser supports quoted arguments and constrained && chains', () => {
  assert.deepEqual(parseCommandLine('echo "hello world" && pwd').commands, [
    { name: 'echo', args: ['hello world'], raw: 'echo "hello world"' },
    { name: 'pwd', args: [], raw: 'pwd' },
  ]);
  assert.equal(
    parseCommandLine('echo "unfinished').error,
    'Unclosed quoted string.',
  );
  assert.equal(
    parseCommandLine('pwd &&').error,
    'Expected a command after `&&`.',
  );
});

test('registry contains every required command', () => {
  const required = [
    'help',
    'man',
    'pwd',
    'ls',
    'cd',
    'cat',
    'tree',
    'clear',
    'history',
    'echo',
    'whoami',
    'date',
    'uptime',
    'uname',
    'fastfetch',
    'exit',
    'status',
    'now',
    'projects',
    'project',
    'notes',
    'lab',
    'contact',
    'socials',
    'skills',
    'resume',
    'open',
    'theme',
    'git',
  ];
  assert.deepEqual([...commandNames].sort(), required.sort());
});

test('virtual filesystem stays inside its read-only root', () => {
  assert.equal(resolvePath('projects', '../../../../../'), '');
  assert.equal(getNode(filesystem, 'projects/cspams/README.md')?.type, 'file');
  assert.equal(getNode(filesystem, 'private'), undefined);
  assert.equal(run('cd', ['projects']).cwd, 'projects');
  assert.equal(run('cd', ['about.md']).ok, false);
  assert.match(
    run('cat', ['README.md'], 'projects/cspams').lines![0].text,
    /CSPAMS/,
  );
});

test('core and portfolio commands return truthful public data', () => {
  assert.match(run('help').lines![0].text, /Core/);
  assert.equal(run('man', ['ls']).lines![0].text, 'ls [-la] [path]');
  assert.equal(
    run('pwd', [], 'projects').lines![0].text,
    '/home/ange/projects',
  );
  assert.match(run('ls').lines![0].text, /projects\//);
  assert.match(run('ls', ['-la']).lines![0].text, /dr-xr-xr-x/);
  assert.match(run('tree').lines![0].text, /~/);
  assert.equal(run('clear').clear, true);
  assert.match(run('history').lines![1].text, /pwd/);
  assert.equal(run('echo', ['hello world']).lines![0].text, 'hello world');
  assert.equal(run('whoami').lines![0].text, data.name);
  assert.ok(!Number.isNaN(Date.parse(run('date').lines![0].text)));
  assert.match(run('uptime').lines![0].text, /since 2023/);
  assert.match(run('uname').lines![0].text, /virtual-shell/);
  assert.match(run('fastfetch').lines![1].text, /Angellie/);
  assert.equal(run('exit').close, true);
  assert.match(run('status').lines![0].text, /Building angefolio/);
  assert.deepEqual(
    run('now').lines!.map((line) => line.text),
    data.nowItems.map((item) => `- ${item}`),
  );
  assert.equal(run('projects').lines!.length, 2);
  assert.equal(run('projects', ['--featured']).lines!.length, 1);
  assert.equal(run('project', ['cspams']).lines![0].text, 'CSPAMS');
  assert.match(run('notes').lines![0].text, /Building angefolio/);
  assert.equal(run('lab').lines![0].links![0].url, '/lab');
  assert.equal(run('contact').lines![0].text, data.email);
  assert.equal(run('socials').lines![0].text, 'LinkedIn');
  assert.match(run('skills').lines![0].text, /Astro/);
  assert.match(run('resume').lines![0].text, /not published/);
});

test('completion handles commands, known targets, themes, and virtual paths', () => {
  const context = {
    commandNames,
    cwd: '',
    filesystem,
    projectSlugs: data.projects.map((project) => project.slug),
    routeNames: Object.keys(data.routes),
  };
  assert.equal(completeInput('pw', context).value, 'pwd ');
  assert.equal(completeInput('project cs', context).value, 'project cspams ');
  assert.equal(completeInput('git show cs', context).value, 'git show cspams ');
  assert.equal(completeInput('theme da', context).value, 'theme dark ');
  assert.equal(completeInput('cd pro', context).value, 'cd projects/');
});

test('history ignores empty and consecutive duplicate commands and stays bounded', () => {
  assert.deepEqual(appendHistory(['help'], '  '), ['help']);
  assert.deepEqual(appendHistory(['help'], 'help'), ['help']);
  assert.deepEqual(appendHistory(['help'], ' pwd '), ['help', 'pwd']);
  assert.deepEqual(appendHistory(['one', 'two'], 'three', 2), ['two', 'three']);
});

test('navigation and theme results remain explicitly allowlisted', () => {
  assert.equal(run('open', ['projects']).navigate?.url, '/projects');
  assert.equal(run('open', ['cspams']).navigate?.url, '/projects/cspams');
  assert.equal(run('open', ['github']).navigate?.url, data.github);
  assert.equal(run('open', ['javascript:alert(1)']).ok, false);
  const unsafeData = {
    ...data,
    routes: {
      ...data.routes,
      unsafe: 'javascript:alert(1)',
      resume: 'javascript:alert(1)',
    },
  };
  assert.equal(
    executeCommand('open', ['unsafe'], {
      data: unsafeData,
      filesystem: buildFilesystem(unsafeData),
      cwd: '',
      history: [],
    }).ok,
    false,
  );
  assert.equal(run('theme', ['dim']).theme, 'dim');
  assert.equal(run('theme', ['sepia']).ok, false);
  assert.match(
    executeCommand('resume', [], {
      data: unsafeData,
      filesystem: buildFilesystem(unsafeData),
      cwd: '',
      history: [],
    }).lines![0].text,
    /not published/,
  );
});

test('git-inspired commands use supplied metadata without invented hashes', () => {
  assert.match(
    run('git', ['status']).lines![1].text,
    /Virtual portfolio state/,
  );
  assert.match(run('git', ['log']).lines![0].text, /^content 2026-06-01/);
  assert.match(run('git', ['log', '-1']).lines![0].text, /^content 2026-06-01/);
  assert.equal(
    run('git', ['branch']).lines![0].text,
    'branch metadata unavailable in this build',
  );
  assert.equal(
    executeCommand('git', ['branch'], {
      data: { ...data, buildBranch: 'agent/terminal-fix' },
      filesystem,
      cwd: '',
      history: [],
    }).lines![0].text,
    '* agent/terminal-fix',
  );
  assert.equal(run('git', ['show', 'cspams']).lines![0].text, 'CSPAMS');
  assert.match(
    run('git', ['remote', '-v']).lines![0].text,
    /angemarcos04\/angefolio/,
  );
});

test('unknown commands offer a useful close-match suggestion', () => {
  assert.equal(
    run('sl').lines![0].text,
    "Command 'sl' not found. Did you mean 'ls'?",
  );
});
