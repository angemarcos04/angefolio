import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import {
  closeDatabase,
  getDatabase,
  migrateDatabase,
} from '../src/lib/server/db/client';
import { auditEvent } from '../src/lib/server/audit';
import {
  auditLog,
  contentRevisions,
  labRecords,
} from '../src/lib/server/db/schema';
import { revisionValues } from '../src/lib/server/revisions';
import type { LabRecordInput } from '../src/lib/server/validation/lab';
import { validateLabForm } from '../src/lib/server/validation/lab';
import { discoverMarkdownSources } from './markdown-source';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backupIndex = args.indexOf('--backup');
const backupPath = backupIndex >= 0 ? args[backupIndex + 1] : undefined;
if (apply && !backupPath)
  throw new Error('Apply requires --backup <new-file>.');
const directory = resolve('src/content/lab');
const source = await discoverMarkdownSources(directory);
if (!source.exists) {
  console.log('Legacy Lab source directory not found: src/content/lab.');
}
if (source.exists && source.filenames.length === 0) {
  console.log('No .md or .mdx Lab source files found.');
}
if (apply && !source.exists) {
  throw new Error(
    'Cannot apply Lab import: the legacy source directory is missing.',
  );
}
if (apply && source.filenames.length === 0) {
  throw new Error(
    'Cannot apply Lab import: no .md or .mdx source files were found.',
  );
}
const candidates: LabRecordInput[] = [];
const supportedFields = new Set([
  'title',
  'description',
  'status',
  'tags',
  'visible',
  'date',
  'category',
  'featured',
  'repo',
  'demo',
  'relatedProject',
  'tools',
  'lessons',
  'risk',
  'updatedAt',
]);

for (const filename of source.filenames) {
  const raw = await readFile(join(directory, filename), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing frontmatter.`);
  let data: Record<string, unknown>;
  try {
    data = parse(match[1]) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `${filename}: invalid frontmatter. ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const unsupported = Object.keys(data).filter(
    (field) => !supportedFields.has(field),
  );
  if (unsupported.length)
    throw new Error(
      `${filename}: unsupported fields: ${unsupported.join(', ')}.`,
    );
  const body = match[2].trim();
  if (
    /^\s*(?:import|export)\s/m.test(body) ||
    /<\/?[a-z][^>]*>/i.test(body) ||
    /\{[^}\n]+\}/.test(body)
  ) {
    throw new Error(`${filename}: MDX or raw HTML needs manual conversion.`);
  }
  const form = new URLSearchParams({
    slug: filename.replace(/\.mdx?$/, ''),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    status: String(data.status ?? ''),
    category: String(data.category ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.join('\n') : '',
    visible: data.visible ? 'on' : '',
    featured: data.featured ? 'on' : '',
    repo: String(data.repo ?? ''),
    demo: String(data.demo ?? ''),
    relatedProject: String(data.relatedProject ?? ''),
    tools: Array.isArray(data.tools) ? data.tools.join('\n') : '',
    lessons: Array.isArray(data.lessons) ? data.lessons.join('\n') : '',
    risk: String(data.risk ?? ''),
    date: String(data.date ?? ''),
    updatedAt: String(data.updatedAt ?? ''),
    body,
  });
  const result = validateLabForm(form);
  if (!result.success)
    throw new Error(`${filename}: ${Object.values(result.errors).join(' ')}`);
  candidates.push(result.data);
}

await migrateDatabase();
const existing = await getDatabase().select().from(labRecords);
const slugs = new Set(existing.map((row) => row.slug));
const conflicts = candidates.filter((entry) => slugs.has(entry.slug));
for (const entry of candidates)
  console.log(
    `${slugs.has(entry.slug) ? 'CONFLICT' : 'READY'} /lab/${entry.slug}`,
  );
console.log(
  `${candidates.length} source Lab entries, ${conflicts.length} existing slug conflicts.`,
);
if (apply) {
  if (conflicts.length)
    throw new Error(
      'Resolve slug conflicts before import; no rows were changed.',
    );
  execFileSync(
    process.execPath,
    ['scripts/db-maintenance.mjs', 'backup', resolve(backupPath!)],
    { env: process.env, stdio: 'inherit' },
  );
  await getDatabase().transaction(async (tx) => {
    for (const input of candidates) {
      const id = crypto.randomUUID();
      const [record] = await tx
        .insert(labRecords)
        .values({ id, ...input, replacesMdx: false })
        .returning();
      await tx
        .insert(auditLog)
        .values(
          auditEvent(null, 'lab.import', 'lab', id, { slug: input.slug }),
        );
      await tx
        .insert(contentRevisions)
        .values(revisionValues(null, 'lab', id, record));
    }
  });
  console.log(
    `Imported ${candidates.length} Lab entries. MDX remains selected until switched in the editor.`,
  );
} else console.log('Dry run only. Apply with --apply --backup <new-file>.');
closeDatabase();
