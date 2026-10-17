<script lang="ts">
  interface Props {
    formId: string;
    kind: 'project' | 'blog' | 'note' | 'lab';
  }
  let { formId, kind }: Props = $props();
  let dialog: HTMLDialogElement;
  let title = $state('');
  let description = $state('');
  let category = $state('');
  let status = $state('');
  let summary = $state('');
  let date = $state('');
  let cover = $state('');
  let bodyHtml = $state('');
  let fields = $state<Record<string, string>>({});
  let screenshotItems = $state<
    Array<{ src: string; alt: string; caption?: string }>
  >([]);
  let loading = $state(false);
  let error = $state('');
  let trigger: HTMLButtonElement | null = null;

  function get(form: HTMLFormElement, name: string) {
    return String(new FormData(form).get(name) ?? '').trim();
  }

  async function openPreview(event: MouseEvent) {
    trigger = event.currentTarget as HTMLButtonElement;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    title = get(form, 'title') || 'Untitled';
    description = get(form, 'description');
    category = get(form, 'category');
    status = get(form, 'status');
    summary = get(form, 'summary');
    date = get(form, 'createdAt') || get(form, 'date');
    cover = get(form, 'cover');
    fields = Object.fromEntries(
      Array.from(new FormData(form)).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    try {
      const parsed: unknown = JSON.parse(fields.screenshots ?? '[]');
      screenshotItems = Array.isArray(parsed)
        ? parsed.filter(
            (shot) =>
              shot &&
              typeof shot.src === 'string' &&
              typeof shot.alt === 'string',
          )
        : [];
    } catch {
      screenshotItems = [];
    }
    const markdown = get(form, kind === 'project' ? 'caseStudyBody' : 'body');
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/console/content-preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ kind, body: markdown }),
      });
      if (!response.ok)
        throw new Error('Preview is unavailable. Your edits are unchanged.');
      const result = (await response.json()) as { bodyHtml: string };
      bodyHtml = result.bodyHtml;
      dialog.showModal();
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : 'Preview is unavailable.';
    } finally {
      loading = false;
    }
  }

  function close() {
    dialog.close();
    requestAnimationFrame(() => trigger?.focus());
  }

  function safeImage(source: string) {
    if (
      source.startsWith('/') &&
      !source.startsWith('//') &&
      !source.includes('..') &&
      !source.startsWith('/api/') &&
      !source.startsWith('/user/')
    )
      return source;
    return '';
  }

  function lines(name: string) {
    const value = fields[name] ?? '';
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
</script>

<button
  type="button"
  class="preview-page-trigger"
  onclick={openPreview}
  disabled={loading}
>
  {loading ? 'Preparing preview…' : 'Preview Page'}
</button>
{#if error}<p role="alert" class="preview-error">{error}</p>{/if}
<dialog
  bind:this={dialog}
  class="page-preview"
  aria-labelledby="preview-title"
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
  onclick={(event) => {
    if (event.target === dialog) close();
  }}
>
  <header>
    <span>PRIVATE PREVIEW</span><button
      type="button"
      onclick={close}
      aria-label="Close page preview">Close</button
    >
  </header>
  <article class="preview-content">
    {#if safeImage(cover)}<img
        class="cover"
        src={safeImage(cover)}
        alt=""
      />{/if}
    {#if category}<p class="eyebrow">{category}</p>{/if}
    <h1 id="preview-title">{title}</h1>
    {#if description}<p class="description">{description}</p>{/if}
    <p class="meta">{[status, date].filter(Boolean).join(' · ')}</p>
    {#if kind === 'project'}
      {@const problem = fields.problem ?? ''}
      {@const solution = fields.solution ?? ''}
      {@const stack = lines('stack')}
      {@const highlights = lines('highlights')}
      {@const role = fields.role ?? ''}
      {@const projectDate = fields.projectDate ?? ''}
      {@const demos = [fields.demo, fields.github].filter(Boolean)}
      {@const projectLinks = lines('links')}
      {#if role || projectDate}<p class="meta">
          {[role, projectDate].filter(Boolean).join(' · ')}
        </p>{/if}
      {#if problem}<section>
          <h2>Problem</h2>
          <p>{problem}</p>
        </section>{/if}
      {#if solution}<section>
          <h2>Solution</h2>
          <p>{solution}</p>
        </section>{/if}
      {#if stack.length}<section>
          <h2>Stack</h2>
          <p>{stack.join(' · ')}</p>
        </section>{/if}
      {#if highlights.length}<section>
          <h2>Highlights</h2>
          <ul>
            {#each highlights as item}<li>{item}</li>{/each}
          </ul>
        </section>{/if}
      {#if screenshotItems.length}
        <section>
          <h2>Screenshots</h2>
          <div class="gallery">
            {#each screenshotItems as shot}<figure>
                {#if safeImage(shot.src)}<img
                    src={safeImage(shot.src)}
                    alt={shot.alt || ''}
                  />{/if}{#if shot.caption}<figcaption>
                    {shot.caption}
                  </figcaption>{/if}
              </figure>{/each}
          </div>
        </section>
      {/if}
      {#if demos.length || projectLinks.length}<section>
          <h2>Links</h2>
          <p>
            {demos.join(' · ')}{demos.length && projectLinks.length
              ? ' · '
              : ''}{projectLinks.join(' · ')}
          </p>
        </section>{/if}
    {/if}
    {#if kind !== 'project'}
      {@const tags = lines('tags')}
      {#if tags.length}<p class="meta">{tags.join(' · ')}</p>{/if}
    {/if}
    {#if kind === 'lab'}
      {@const tools = lines('tools')}
      {@const lessons = lines('lessons')}
      {@const risk = fields.risk ?? ''}
      {#if risk}<p class="meta">Risk: {risk}</p>{/if}
      {#if tools.length}<section>
          <h2>Tools</h2>
          <p>{tools.join(' · ')}</p>
        </section>{/if}
      {#if lessons.length}<section>
          <h2>Lessons</h2>
          <ul>
            {#each lessons as lesson}<li>{lesson}</li>{/each}
          </ul>
        </section>{/if}
    {/if}
    {#if summary}<section>
        <h2>{kind === 'project' ? 'Overview' : 'Summary'}</h2>
        <p>{summary}</p>
      </section>{/if}
    {#if bodyHtml}<section class="prose-shell">{@html bodyHtml}</section>{/if}
  </article>
</dialog>

<style>
  .preview-page-trigger,
  header button {
    min-height: 2.5rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    font: 0.72rem var(--type-ui);
    cursor: pointer;
  }
  .preview-error {
    color: var(--danger-text);
    font-size: 0.8rem;
  }
  .page-preview {
    width: min(900px, calc(100vw - 2rem));
    max-height: min(90dvh, 1000px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--background);
    color: var(--foreground);
  }
  .page-preview::backdrop {
    background: rgb(0 0 0 / 0.68);
  }
  header {
    position: sticky;
    top: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    color: var(--muted-foreground);
    font: 0.7rem var(--font-mono);
  }
  .preview-content {
    max-width: 760px;
    margin: auto;
    padding: clamp(1rem, 4vw, 2.5rem);
  }
  h1 {
    margin: 0.3rem 0 1rem;
    font-size: clamp(1.6rem, 4vw, 2.4rem);
  }
  h2 {
    font-size: 1rem;
  }
  .eyebrow,
  .meta {
    color: var(--muted-foreground);
    font: 0.75rem var(--font-mono);
  }
  .description {
    font-size: 1.1rem;
    line-height: 1.6;
  }
  .cover {
    width: 100%;
    max-height: 22rem;
    object-fit: cover;
    border-radius: var(--radius-sm);
    margin-bottom: 1.25rem;
  }
  section {
    margin-top: 1.5rem;
  }
  .gallery {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
  }
  figure {
    margin: 0;
  }
  figure img {
    width: 100%;
    max-height: 20rem;
    object-fit: contain;
    background: var(--muted);
  }
  figcaption {
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }
  @media (max-width: 600px) {
    .page-preview {
      width: 100vw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      border-radius: 0;
      border-inline: 0;
    }
    .gallery {
      grid-template-columns: 1fr;
    }
  }
</style>
