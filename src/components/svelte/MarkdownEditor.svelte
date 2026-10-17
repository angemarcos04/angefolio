<script lang="ts">
  import { uploadImage } from '../../lib/client/uploadImage';
  import {
    markdownStarters,
    type MarkdownStarterKind,
  } from '../../lib/data/markdownStarters';
  interface Props {
    value?: string;
    fieldName?: string;
    ariaLabel?: string;
    maxLength?: number;
    starter?: MarkdownStarterKind;
  }

  let {
    value = '',
    fieldName = 'caseStudyBody',
    ariaLabel = 'Case study in Markdown',
    maxLength = 30000,
    starter,
  }: Props = $props();
  let editor: HTMLTextAreaElement;
  let preview = $state('');
  let previewOpen = $state(false);
  let previewLoading = $state(false);
  let previewError = $state('');
  let imageInput: HTMLInputElement;
  let imagePath = $state('');
  let imageAlt = $state('');
  let decorative = $state(false);
  let imageBusy = $state(false);
  let imageError = $state('');
  let imageStart = 0;
  let imageEnd = 0;

  function insert(before: string, after = '', placeholder = 'text') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selection = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selection}${after}${value.slice(end)}`;
    if (next.length > maxLength) return;
    value = next;
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(
        start + before.length,
        start + before.length + selection.length,
      );
    });
  }

  function linePrefix(prefix: string) {
    const start = editor.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const next = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    if (next.length > maxLength) return;
    value = next;
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  }

  function insertStarter() {
    if (!starter) return;
    if (
      value.trim() &&
      !window.confirm('Replace the current Markdown with this starter?')
    )
      return;
    value = markdownStarters[starter].slice(0, maxLength);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(value.length, value.length);
    });
  }

  function handleShortcut(event: KeyboardEvent) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (event.key.toLowerCase() === 'b') {
      event.preventDefault();
      insert('**', '**');
    }
    if (event.key.toLowerCase() === 'i') {
      event.preventDefault();
      insert('*', '*');
    }
  }

  function chooseImage() {
    imageStart = editor.selectionStart;
    imageEnd = editor.selectionEnd;
    imageError = '';
    imageInput.click();
  }

  async function uploadSelectedImage() {
    const file = imageInput.files?.[0];
    if (!file) return;
    imageBusy = true;
    imageError = '';
    try {
      imagePath = await uploadImage(file);
      imageAlt = '';
      decorative = false;
    } catch (error) {
      imageError =
        error instanceof Error
          ? error.message
          : 'Image upload failed. Try again.';
    } finally {
      imageBusy = false;
      imageInput.value = '';
    }
  }

  function insertImage() {
    if (!imagePath || (!decorative && !imageAlt.trim())) {
      imageError = 'Enter alternative text or mark the image as decorative.';
      return;
    }
    const alt = decorative ? '' : imageAlt.trim().replaceAll(']', '\\]');
    const markdown = `![${alt}](${imagePath})`;
    const next = `${value.slice(0, imageStart)}${markdown}${value.slice(imageEnd)}`;
    if (next.length > maxLength) {
      imageError = `This image reference exceeds the ${maxLength.toLocaleString()} character limit.`;
      return;
    }
    value = next;
    imagePath = '';
    imageAlt = '';
    requestAnimationFrame(() => {
      editor.focus();
      const cursor = imageStart + markdown.length;
      editor.setSelectionRange(cursor, cursor);
    });
  }

  async function showPreview() {
    previewLoading = true;
    previewError = '';
    try {
      const response = await fetch('/api/console/markdown-preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ markdown: value }),
      });
      if (!response.ok) throw new Error('Preview failed.');
      preview = await response.text();
      previewOpen = true;
    } catch {
      previewError =
        'Preview is unavailable. Your text is still in the editor.';
    } finally {
      previewLoading = false;
    }
  }
</script>

<div class="markdown-editor">
  <div class="toolbar" role="toolbar" aria-label="Formatting">
    <button type="button" onclick={() => insert('**', '**')} aria-label="Bold"
      ><strong>B</strong></button
    >
    <button type="button" onclick={() => insert('*', '*')} aria-label="Italic"
      ><em>I</em></button
    >
    <button type="button" onclick={() => linePrefix('## ')} aria-label="Heading"
      >H2</button
    >
    <button
      type="button"
      onclick={() => linePrefix('- ')}
      aria-label="Bullet list">List</button
    >
    <button
      type="button"
      onclick={() => linePrefix('1. ')}
      aria-label="Numbered list">1.</button
    >
    <button
      type="button"
      onclick={() => linePrefix('> ')}
      aria-label="Block quote">Quote</button
    >
    <button
      type="button"
      onclick={() => insert('`', '`', 'code')}
      aria-label="Inline code">Code</button
    >
    <button
      type="button"
      onclick={() => insert('```\n', '\n```', 'code block')}
      aria-label="Code block">{'{ }'}</button
    >
    <button
      type="button"
      onclick={() => insert('\n---\n', '', '')}
      aria-label="Horizontal rule">Rule</button
    >
    <button
      type="button"
      onclick={() => insert('[', '](https://example.com)', 'link text')}
      aria-label="Link">Link</button
    >
    <button type="button" onclick={chooseImage} disabled={imageBusy}
      >Insert Image</button
    >
    <button
      type="button"
      onclick={showPreview}
      disabled={previewLoading}
      class="preview-button"
    >
      {previewLoading ? 'Loading…' : 'Preview Markdown'}
    </button>
    {#if starter}<button type="button" onclick={insertStarter}
        >Insert starter</button
      >{/if}
  </div>
  <input
    bind:this={imageInput}
    class="file-input"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onchange={uploadSelectedImage}
  />
  {#if imageBusy}<p role="status">Uploading image…</p>{/if}
  {#if imagePath}
    <section class="image-insert" aria-label="Image alternative text">
      <img src={imagePath} alt="Uploaded image preview" />
      <label
        >Alternative text<input
          bind:value={imageAlt}
          maxlength="300"
          disabled={decorative}
          placeholder="Describe the image"
        /></label
      >
      <label class="decorative"
        ><input type="checkbox" bind:checked={decorative} /> Decorative image (empty
        alternative text)</label
      >
      <button type="button" onclick={insertImage}>Insert Markdown image</button>
      <button type="button" onclick={() => (imagePath = '')}>Cancel</button>
    </section>
  {/if}
  {#if imageError}<p class="error" role="alert">{imageError}</p>{/if}
  <textarea
    bind:this={editor}
    bind:value
    name={fieldName}
    maxlength={maxLength}
    rows="17"
    onkeydown={handleShortcut}
    aria-label={ariaLabel}></textarea>
  <p class="hint">Markdown source · select text, then use the toolbar.</p>
  {#if previewError}<p class="error" role="alert">{previewError}</p>{/if}
  {#if previewOpen}
    <section class="preview prose-shell" aria-label="Markdown preview">
      <div class="preview-heading">
        <strong>Markdown preview</strong>
        <button type="button" onclick={() => (previewOpen = false)}
          >Close</button
        >
      </div>
      {@html preview}
    </section>
  {/if}
</div>

<style>
  .toolbar,
  .preview-heading {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .toolbar {
    margin-bottom: 0.45rem;
  }
  .toolbar button,
  .preview-heading button {
    min-height: 2rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    cursor: pointer;
    font: 0.7rem var(--type-ui);
  }
  .toolbar button:hover,
  .preview-heading button:hover {
    border-color: var(--border-strong);
  }
  .toolbar .preview-button {
    margin-left: auto;
  }
  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .image-insert {
    display: grid;
    gap: 0.55rem;
    margin: 0 0 0.6rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
  }
  .image-insert img {
    max-width: 12rem;
    max-height: 8rem;
    object-fit: contain;
  }
  .image-insert label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }
  .image-insert input:not([type='checkbox']) {
    min-height: 2.3rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    background: var(--muted);
    color: var(--foreground);
  }
  .image-insert button {
    justify-self: start;
    min-height: 2.3rem;
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
  }
  textarea {
    width: 100%;
    min-height: 19rem;
    padding: 0.8rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    outline: none;
    background: var(--muted);
    color: var(--foreground);
    font: 0.8rem/1.65 var(--type-code);
    resize: vertical;
  }
  textarea:focus {
    border-color: var(--border-strong);
  }
  .hint,
  .error {
    margin: 0.45rem 0 0;
    color: var(--muted-foreground);
    font-size: 0.8rem;
  }
  .error {
    color: var(--danger);
  }
  .preview {
    margin-top: 0.9rem;
    padding: 1.25rem;
    border: 1px solid var(--border);
    background: var(--card);
  }
  .preview-heading {
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }
</style>
