import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  getDatabase,
  closeDatabase,
  migrateDatabase,
} from '../src/lib/server/db/client';
import {
  auditLog,
  contentRevisions,
  projectRecords,
} from '../src/lib/server/db/schema';
import { auditEvent } from '../src/lib/server/audit';
import { revisionValues } from '../src/lib/server/revisions';
import { discoverMarkdownSources } from './markdown-source';
import {
  validateProjectForm,
  type ProjectRecordInput,
} from '../src/lib/server/validation/projects';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backupIndex = args.indexOf('--backup');
const backupPath = backupIndex >= 0 ? args[backupIndex + 1] : undefined;
if (apply && !backupPath) {
  throw new Error('Apply requires --backup <new-file>.');
}
if (
  args.some(
    (arg, index) =>
      arg !== '--apply' && arg !== '--backup' && index !== backupIndex + 1,
  )
) {
  throw new Error('Usage: projects:import [--apply --backup <new-file>]');
}

const sourceDirectory = resolve('src/content/projects');
const source = await discoverMarkdownSources(sourceDirectory);
const filenames = source.filenames;
if (!source.exists) {
  console.log(
    'Legacy project source directory not found: src/content/projects.',
  );
}
if (source.exists && filenames.length === 0) {
  console.log('No .md or .mdx project source files found.');
}
if (apply && !source.exists) {
  throw new Error(
    'Cannot apply project import: the legacy source directory is missing.',
  );
}
if (apply && filenames.length === 0) {
  throw new Error(
    'Cannot apply project import: no .md or .mdx source files were found.',
  );
}
const candidates: ProjectRecordInput[] = [];
const supportedFields = new Set([
  'title',
  'description',
  'status',
  'featured',
  'visible',
  'stack',
  'github',
  'demo',
  'caseStudy',
  'date',
  'category',
  'problem',
  'solution',
  'role',
  'highlights',
  'links',
  'cover',
  'order',
]);

for (const filename of filenames) {
  const raw = await readFile(join(sourceDirectory, filename), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing frontmatter.`);
  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = parse(match[1]) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `${filename}: invalid frontmatter. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const body = match[2].trim();
  const unsupported = Object.keys(frontmatter).filter(
    (field) => !supportedFields.has(field),
  );
  if (unsupported.length) {
    throw new Error(
      `${filename}: unsupported fields: ${unsupported.join(', ')}.`,
    );
  }
  if (
    /^\s*(?:import|export)\s/m.test(body) ||
    /<\/?[a-z][^>]*>/i.test(body) ||
    /\{[^}\n]+\}/.test(body)
  ) {
    throw new Error(`${filename}: MDX or raw HTML needs manual conversion.`);
  }
  if (frontmatter.caseStudy) {
    throw new Error(`${filename}: caseStudy needs a manual link mapping.`);
  }
  if (
    Array.isArray(frontmatter.links) &&
    frontmatter.links.some((link) => link?.external === false)
  ) {
    throw new Error(
      `${filename}: internal link metadata needs manual mapping.`,
    );
  }
  const slug = filename.replace(/\.mdx?$/, '');
  const form = new URLSearchParams({
    slug,
    title: String(frontmatter.title ?? ''),
    description: String(frontmatter.description ?? ''),
    status: String(frontmatter.status ?? ''),
    category: String(frontmatter.category ?? ''),
    role: String(frontmatter.role ?? ''),
    problem: String(frontmatter.problem ?? ''),
    solution: String(frontmatter.solution ?? ''),
    stack: Array.isArray(frontmatter.stack) ? frontmatter.stack.join('\n') : '',
    links: Array.isArray(frontmatter.links)
      ? frontmatter.links
          .map((link) => `${link.label} | ${link.href}`)
          .join('\n')
      : '',
    github: String(frontmatter.github ?? ''),
    demo: String(frontmatter.demo ?? ''),
    caseStudyBody: body,
    projectDate: String(frontmatter.date ?? ''),
    highlights: Array.isArray(frontmatter.highlights)
      ? frontmatter.highlights.join('\n')
      : '',
    cover: String(frontmatter.cover ?? ''),
    orderIndex:
      frontmatter.order === undefined ? '' : String(frontmatter.order),
    replacesMdx: 'on',
    ...(frontmatter.visible ? { visible: 'on' } : {}),
    ...(frontmatter.featured ? { featured: 'on' } : {}),
  });
  const validated = validateProjectForm(form);
  if (!validated.success) {
    throw new Error(
      `${filename}: ${Object.values(validated.errors).join(' ')}`,
    );
  }
  candidates.push(validated.data);
}

await migrateDatabase();
const existing = await getDatabase().select().from(projectRecords);
const bySlug = new Map(existing.map((record) => [record.slug, record]));
const conflicts = candidates.filter((candidate) => bySlug.has(candidate.slug));
for (const candidate of candidates) {
  console.log(
    `${bySlug.has(candidate.slug) ? 'CONFLICT' : 'READY'} /projects/${candidate.slug}`,
  );
}
console.log(
  `${candidates.length} source projects, ${conflicts.length} existing slug conflicts.`,
);

if (apply) {
  if (conflicts.length)
    throw new Error(
      'Resolve slug conflicts before import; no rows were changed.',
    );
  execFileSync(
    process.execPath,
    ['scripts/db-maintenance.mjs', 'backup', resolve(backupPath!)],
    {
      env: process.env,
      stdio: 'inherit',
    },
  );
  await getDatabase().transaction(async (transaction) => {
    for (const input of candidates) {
      const id = crypto.randomUUID();
      const now = new Date();
      const [record] = await transaction
        .insert(projectRecords)
        .values({
          id,
          ...input,
          archived: false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      await transaction.insert(auditLog).values(
        auditEvent(null, 'project.import', 'project', id, {
          slug: input.slug,
        }),
      );
      await transaction
        .insert(contentRevisions)
        .values(revisionValues(null, 'project', id, record));
    }
  });
  console.log(
    `Imported ${candidates.length} projects. MDX files remain as rollback copies.`,
  );
} else {
  console.log('Dry run only. Apply with --apply --backup <new-file>.');
}
closeDatabase();
