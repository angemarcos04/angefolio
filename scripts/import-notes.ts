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
import {
  auditLog,
  contentRevisions,
  noteRecords,
} from '../src/lib/server/db/schema';
import { auditEvent } from '../src/lib/server/audit';
import { revisionValues } from '../src/lib/server/revisions';
import { validateNoteForm } from '../src/lib/server/validation/notes';
import type { NoteRecordInput } from '../src/lib/server/validation/notes';
import { discoverMarkdownSources } from './markdown-source';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const backupIndex = args.indexOf('--backup');
const backupPath = backupIndex >= 0 ? args[backupIndex + 1] : undefined;
if (apply && !backupPath)
  throw new Error('Apply requires --backup <new-file>.');

const directory = resolve('src/content/notes');
const source = await discoverMarkdownSources(directory);
if (!source.exists) {
  console.log('Legacy Notes source directory not found: src/content/notes.');
}
if (source.exists && source.filenames.length === 0) {
  console.log('No .md or .mdx Notes source files found.');
}
if (apply && !source.exists) {
  throw new Error(
    'Cannot apply Notes import: the legacy source directory is missing.',
  );
}
if (apply && source.filenames.length === 0) {
  throw new Error(
    'Cannot apply Notes import: no .md or .mdx source files were found.',
  );
}
const candidates: NoteRecordInput[] = [];
const supportedFields = new Set([
  'title',
  'description',
  'summary',
  'category',
  'tags',
  'published',
  'featured',
  'createdAt',
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
  if (unsupported.length) {
    throw new Error(
      `${filename}: unsupported fields: ${unsupported.join(', ')}.`,
    );
  }
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
    summary: String(data.summary ?? ''),
    category: String(data.category ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.join('\n') : '',
    createdAt: String(data.createdAt ?? ''),
    body,
    ...(data.published ? { published: 'on' } : {}),
    ...(data.featured ? { featured: 'on' } : {}),
  });
  const result = validateNoteForm(form);
  if (!result.success)
    throw new Error(`${filename}: ${Object.values(result.errors).join(' ')}`);
  candidates.push(result.data);
}
await migrateDatabase();
const existing = await getDatabase().select().from(noteRecords);
const slugs = new Set(existing.map((row) => row.slug));
const conflicts = candidates.filter((note) => slugs.has(note.slug));
for (const note of candidates)
  console.log(
    `${slugs.has(note.slug) ? 'CONFLICT' : 'READY'} /notes/${note.slug}`,
  );
console.log(
  `${candidates.length} source notes, ${conflicts.length} existing slug conflicts.`,
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
        .insert(noteRecords)
        .values({ id, ...input, replacesMdx: false, updatedAt: new Date() })
        .returning();
      await tx
        .insert(auditLog)
        .values(
          auditEvent(null, 'note.import', 'note', id, { slug: input.slug }),
        );
      await tx
        .insert(contentRevisions)
        .values(revisionValues(null, 'note', id, record));
    }
  });
  console.log(
    `Imported ${candidates.length} notes. MDX remains the active source until switched in the editor.`,
  );
} else console.log('Dry run only. Apply with --apply --backup <new-file>.');
closeDatabase();
