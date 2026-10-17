<script lang="ts">
  import { tick } from 'svelte';
  import type { ContentPreviewData } from '../../lib/data/contentPreview';
  import { isSafeImageReference } from '../../lib/data/mediaReference';

  interface Props {
    formId: string;
    kind: 'project' | 'blog' | 'note' | 'lab';
  }
  let { formId, kind }: Props = $props();
  let dialog: HTMLDialogElement;
  let preview = $state<ContentPreviewData | null>(null);
  let bodyHtml = $state('');
  let loading = $state(false);
  let error = $state('');
  let trigger: HTMLButtonElement | null = null;

  async function openPreview(event: MouseEvent) {
    trigger = event.currentTarget as HTMLButtonElement;
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form || loading) return;
    const values = new FormData(form);
    const body = String(
      values.get(kind === 'project' ? 'caseStudyBody' : 'body') ?? '',
    );
    const request = new URLSearchParams({ kind, body });
    for (const [name, value] of values) {
      if (
        typeof value === 'string' &&
        name !== 'kind' &&
        name !== 'body' &&
        name !== 'caseStudyBody'
      ) {
        request.set(name, value);
      }
    }
    loading = true;
    error = '';
    try {
      const response = await fetch('/api/console/content-preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: request,
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            'Your owner session has expired. Sign in again; your edits are unchanged.',
          );
        }
        throw new Error('Preview is unavailable. Your edits are unchanged.');
      }
      const result = (await response.json()) as {
        preview: ContentPreviewData;
        bodyHtml: string;
      };
      preview = result.preview;
      bodyHtml = result.bodyHtml;
      await tick();
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

  function tagTone(status: string) {
    const normalized = status.toLowerCase();
    return normalized === 'live' || normalized === 'in progress'
      ? 'strong'
      : normalized === 'prototype' || normalized === 'testing'
        ? 'accent'
        : 'neutral';
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
  <header class="preview-toolbar">
    <span>PRIVATE PREVIEW</span>
    <button type="button" onclick={close} aria-label="Close page preview"
      >Close</button
    >
  </header>
  {#if preview}
    <div class="preview-page-content">
      {#if kind === 'project'}
        <article class="project-hero bento-surface subtle-grid">
          {#if preview.cover && isSafeImageReference(preview.cover)}
            <img
              class="project-cover"
              src={preview.cover}
              alt={`Cover image for ${preview.title}`}
            />
          {/if}
          <div class="hero-meta">
            {#if preview.status}<span
                class={`tag tone-${tagTone(preview.status)}`}
                >{preview.status}</span
              >{/if}
            {#if preview.category}<span class="tag tone-accent"
                >{preview.category}</span
              >{/if}
            {#if preview.featured}<span class="tag tone-strong">Featured</span
              >{/if}
          </div>
          <h1 id="preview-title">{preview.title}</h1>
          {#if preview.description}<p class="description">
              {preview.description}
            </p>{/if}
          {#if preview.links.length}
            <div class="hero-links" aria-label="Project links">
              {#each preview.links as link, index}
                <a
                  class={`button size-sm variant-${index === 0 ? 'primary' : 'secondary'}`}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  >{link.label}<span aria-hidden="true">↗</span><span
                    class="sr-only"
                  >
                    (opens in a new tab)</span
                  ></a
                >
              {/each}
            </div>
          {/if}
        </article>
        {#if preview.screenshots.length}
          <section
            class="project-gallery bento-surface"
            aria-labelledby="preview-gallery-title"
          >
            <h2 id="preview-gallery-title">Project screenshots</h2>
            <div class="gallery-grid">
              {#each preview.screenshots as screenshot}
                {#if screenshot.src !== preview.cover && isSafeImageReference(screenshot.src)}
                  <figure>
                    <img
                      src={screenshot.src}
                      alt={screenshot.alt}
                      loading="lazy"
                      decoding="async"
                    />{#if screenshot.caption}<figcaption>
                        {screenshot.caption}
                      </figcaption>{/if}
                  </figure>
                {/if}
              {/each}
            </div>
          </section>
        {/if}
        {#if preview.date || preview.role || preview.stack.length}
          <section class="metadata-grid" aria-label="Project information">
            {#if preview.date}<div class="project-meta">
                <span>Project date</span><strong>{preview.date}</strong>
              </div>{/if}
            {#if preview.role}<div class="project-meta">
                <span>Role</span><strong>{preview.role}</strong>
              </div>{/if}
            {#if preview.stack.length}<div class="project-meta stack-meta">
                <span>Stack</span>
                <div class="tag-list">
                  {#each preview.stack as item}<span class="tag">{item}</span
                    >{/each}
                </div>
              </div>{/if}
          </section>
        {/if}
        {#if preview.problem || preview.solution || preview.highlights.length}
          <aside
            class="case-summary bento-surface"
            aria-label="Project overview"
          >
            {#if preview.problem}<section>
                <h2>Problem</h2>
                <p>{preview.problem}</p>
              </section>{/if}
            {#if preview.solution}<section>
                <h2>Solution</h2>
                <p>{preview.solution}</p>
              </section>{/if}
            {#if preview.highlights.length}<section>
                <h2>Highlights</h2>
                <ul>
                  {#each preview.highlights as item}<li>{item}</li>{/each}
                </ul>
              </section>{/if}
          </aside>
        {/if}
        {#if bodyHtml.trim()}<article class="prose-shell bento-surface">
            {@html bodyHtml}
          </article>{/if}
      {:else if kind === 'blog' || kind === 'note'}
        <article class={`${kind}-hero bento-surface subtle-grid`}>
          <div class="hero-meta">
            {#if preview.category}<span class="tag tone-accent"
                >{preview.category}</span
              >{/if}
            {#if preview.featured}<span class="tag tone-strong">Featured</span
              >{/if}
          </div>
          <h1 id="preview-title">{preview.title}</h1>
          {#if preview.description}<p class="description">
              {preview.description}
            </p>{/if}
          <div class="meta">
            {#if preview.date}<span>Published {preview.date}</span>{/if}
            {#if preview.updatedAt}<span>Updated {preview.updatedAt}</span>{/if}
            <span>{preview.readingTime}</span>
          </div>
          {#if preview.tags.length}<div
              class="tags"
              aria-label={kind === 'blog' ? 'Post tags' : 'Note tags'}
            >
              {#each preview.tags as tag}<span class="tag">{tag}</span>{/each}
            </div>{/if}
        </article>
        {#if kind === 'blog' && preview.cover && isSafeImageReference(preview.cover)}<img
            class="article-cover"
            src={preview.cover}
            alt=""
            fetchpriority="high"
          />{/if}
        {#if preview.summary}<aside class="summary bento-surface">
            <strong>In short</strong>
            <p>{preview.summary}</p>
          </aside>{/if}
        {#if bodyHtml.trim()}<article class="prose-shell bento-surface">
            {@html bodyHtml}
          </article>{/if}
      {:else}
        <article class="lab-hero bento-surface subtle-grid">
          <div class="hero-meta">
            {#if preview.status}<span
                class={`tag tone-${tagTone(preview.status)}`}
                >{preview.status}</span
              >{/if}
            {#if preview.category}<span class="tag tone-accent"
                >{preview.category}</span
              >{/if}
            {#if preview.featured}<span class="tag tone-strong"
                >Featured experiment</span
              >{/if}
          </div>
          <h1 id="preview-title">{preview.title}</h1>
          {#if preview.description}<p class="description">
              {preview.description}
            </p>{/if}
          <div class="meta">
            {#if preview.date}<span>Logged {preview.date}</span
              >{/if}{#if preview.updatedAt}<span
                >Updated {preview.updatedAt}</span
              >{/if}
          </div>
          {#if preview.tags.length}<div
              class="tags"
              aria-label="Experiment tags"
            >
              {#each preview.tags as tag}<span class="tag">{tag}</span>{/each}
            </div>{/if}
          {#if preview.links.length}<div class="hero-links">
              {#each preview.links as link, index}
                {#if link.external}<a
                    class={`button size-sm variant-${index === 0 ? 'primary' : 'secondary'}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    >{link.label}<span aria-hidden="true">↗</span><span
                      class="sr-only">(opens in a new tab)</span
                    ></a
                  >{:else}<span
                    class={`button size-sm variant-${index === 0 ? 'primary' : 'secondary'}`}
                    aria-label={`${link.label}. Internal project links are shown for preview and are not opened.`}
                    >{link.label}</span
                  >{/if}
              {/each}
            </div>{/if}
        </article>
        {#if preview.status || preview.category || preview.date || preview.risk || preview.updatedAt || preview.tools.length}
          <section
            class="metadata-grid lab-metadata"
            aria-label="Experiment metadata"
          >
            {#if preview.status}<div class="project-meta">
                <span>Status</span><strong>{preview.status}</strong>
              </div>{/if}
            <div class="project-meta">
              <span>Category</span><strong
                >{preview.category || 'Open experiment'}</strong
              >
            </div>
            {#if preview.date}<div class="project-meta">
                <span>Logged</span><strong>{preview.date}</strong>
              </div>{/if}
            {#if preview.risk}<div class="project-meta">
                <span>Risk</span><strong>{preview.risk}</strong>
              </div>{/if}
            {#if preview.updatedAt}<div class="project-meta">
                <span>Last updated</span><strong>{preview.updatedAt}</strong>
              </div>{/if}
            {#if preview.tools.length}<div class="project-meta stack-meta">
                <span>Tools</span>
                <div class="tag-list">
                  {#each preview.tools as tool}<span class="tag">{tool}</span
                    >{/each}
                </div>
              </div>{/if}
          </section>
        {/if}
        {#if preview.lessons.length}<aside class="lesson-log bento-surface">
            <p>Current lessons</p>
            <ul>
              {#each preview.lessons as lesson}<li>{lesson}</li>{/each}
            </ul>
          </aside>{/if}
        {#if bodyHtml.trim()}<article class="prose-shell bento-surface">
            {@html bodyHtml}
          </article>{/if}
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .preview-page-trigger,
  .preview-toolbar button {
    min-height: 2.5rem;
    padding: 0.65rem 0.9rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    font: 0.72rem var(--type-ui);
    cursor: pointer;
  }
  .preview-page-trigger:focus-visible,
  .preview-toolbar button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 3px;
  }
  .preview-error {
    color: var(--danger-text);
    font-size: 0.8rem;
  }
  .page-preview {
    width: min(1100px, calc(100vw - 2rem));
    max-height: min(92dvh, 1200px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--background);
    color: var(--foreground);
  }
  .page-preview::backdrop {
    background: rgb(0 0 0 / 0.68);
  }
  .preview-toolbar {
    position: sticky;
    z-index: 2;
    top: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    color: var(--muted-foreground);
    font: 0.7rem var(--type-mono, var(--type-code));
  }
  .preview-page-content {
    max-width: 1000px;
    min-width: 0;
    margin: auto;
    padding: clamp(1rem, 4vw, 2.5rem);
  }
  .preview-page-content h1 {
    max-width: 20ch;
    margin: 1rem 0 0;
    font-size: clamp(2rem, 7vw, 4rem);
    line-height: 0.98;
    letter-spacing: 0.02em;
    overflow-wrap: anywhere;
  }
  .preview-page-content .project-hero h1 {
    max-width: 17ch;
    font-size: clamp(2.4rem, 8vw, 5rem);
  }
  .preview-page-content .blog-hero h1,
  .preview-page-content .note-hero h1,
  .preview-page-content .lab-hero h1 {
    font-size: clamp(2.3rem, 8vw, 4.75rem);
  }
  .project-hero,
  .blog-hero,
  .note-hero,
  .lab-hero {
    padding: clamp(1.5rem, 5vw, 3rem);
    position: relative;
    overflow: hidden;
  }
  .project-hero::before,
  .blog-hero::before,
  .note-hero::before,
  .lab-hero::before {
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: var(--accent);
    content: '';
    opacity: 0.72;
  }
  .project-hero::before {
    background: var(--accent-hover);
  }
  .project-hero > *,
  .blog-hero > *,
  .note-hero > *,
  .lab-hero > * {
    position: relative;
  }
  .hero-meta,
  .meta,
  .tags,
  .hero-links {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
  }
  .description {
    max-width: 66ch;
    margin: 1rem 0 0;
    color: var(--muted-foreground);
    font-size: clamp(1rem, 2vw, 1.15rem);
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .meta {
    margin-top: 1.25rem;
    color: var(--muted-foreground);
    font: 0.68rem/1.5 var(--type-code);
  }
  .meta span + span::before {
    margin-right: 0.45rem;
    color: var(--border);
    content: '/';
  }
  .tags {
    margin-top: 0.8rem;
  }
  .tag {
    display: inline-flex;
    max-width: 100%;
    min-height: 1.65rem;
    align-items: center;
    padding: 0.16rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--muted);
    color: var(--muted-foreground);
    font: 500 0.68rem/1.2 var(--type-ui);
    overflow-wrap: anywhere;
  }
  .tone-accent {
    border-color: color-mix(in srgb, var(--accent) 48%, var(--border));
    background: var(--accent-soft);
    color: var(--accent-text);
  }
  .tone-strong {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
    color: var(--accent-foreground);
  }
  .project-cover,
  .article-cover {
    display: block;
    width: 100%;
    max-height: 34rem;
    object-fit: cover;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .project-cover {
    margin-bottom: 1.25rem;
  }
  .article-cover {
    max-height: 32rem;
    margin-top: 0.75rem;
    object-fit: contain;
  }
  .hero-links {
    margin-top: 1.2rem;
  }
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    font: 600 0.7rem/1 var(--type-ui);
    padding: 0.45rem 0.65rem;
    min-height: 2rem;
  }
  .variant-primary {
    border-color: var(--primary-background);
    background: var(--primary-background);
    color: var(--primary-foreground);
  }
  .variant-secondary {
    border-color: var(--border-strong);
    background: var(--muted);
    color: var(--foreground);
  }
  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 0.75rem;
    margin-top: 0.75rem;
  }
  .project-meta {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    box-shadow: none;
  }
  .project-meta > span {
    color: var(--accent-text);
    font: 0.65rem var(--type-code);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .project-meta strong {
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .stack-meta {
    grid-column: 1/-1;
  }
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .project-gallery {
    margin-top: 0.75rem;
    padding: clamp(1rem, 3vw, 1.5rem);
  }
  .project-gallery h2 {
    margin: 0 0 1rem;
    color: var(--accent-text);
    font: 0.72rem var(--type-code);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
  }
  .gallery-grid figure {
    min-width: 0;
    margin: 0;
    padding: 0.6rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
  }
  .gallery-grid img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 34rem;
    object-fit: contain;
  }
  .gallery-grid figcaption {
    margin-top: 0.55rem;
    color: var(--muted-foreground);
    font-size: 0.8rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .case-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
    margin-top: 0.75rem;
    overflow: hidden;
    box-shadow: none;
  }
  .case-summary section {
    min-width: 0;
    padding: 1.15rem;
    border-right: 1px solid var(--border);
  }
  .case-summary h2 {
    margin: 0 0 0.55rem;
    color: var(--accent-text);
    font: 0.65rem/1.4 var(--type-code);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .case-summary p,
  .case-summary li {
    color: var(--muted-foreground);
    font-size: 0.84rem;
    line-height: 1.55;
    overflow-wrap: anywhere;
  }
  .case-summary p {
    margin: 0;
  }
  .case-summary ul {
    display: grid;
    gap: 0.35rem;
    margin: 0;
    padding-left: 1.1rem;
  }
  .summary,
  .lesson-log {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr);
    gap: 1rem;
    margin-top: 0.75rem;
    padding: 1rem 1.25rem;
    box-shadow: none;
  }
  .summary strong,
  .lesson-log > p {
    color: var(--accent-text);
    font: 0.68rem var(--type-code);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .summary p {
    margin: 0;
    color: var(--muted-foreground);
  }
  .lesson-log {
    grid-template-columns: 9rem minmax(0, 1fr);
  }
  .lesson-log > p {
    margin: 0;
  }
  .lesson-log ul {
    margin: 0;
    padding-left: 1.1rem;
  }
  .lesson-log li {
    color: var(--muted-foreground);
  }
  .prose-shell {
    margin-top: 0.75rem;
  }
  .project-hero + .prose-shell {
    margin-top: 0.75rem;
  }
  @media (max-width: 700px) {
    .gallery-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 560px) {
    .page-preview {
      width: 100vw;
      max-width: none;
      height: 100dvh;
      max-height: none;
      border-radius: 0;
      border-inline: 0;
    }
    .preview-page-content .project-hero h1,
    .preview-page-content .blog-hero h1,
    .preview-page-content .note-hero h1,
    .preview-page-content .lab-hero h1 {
      font-size: clamp(1.55rem, 7vw, 2rem);
      line-height: 1.18;
    }
    .summary,
    .lesson-log {
      grid-template-columns: 1fr;
      gap: 0.4rem;
    }
    .case-summary section {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }
    .case-summary section:last-child {
      border-bottom: 0;
    }
  }
</style>
