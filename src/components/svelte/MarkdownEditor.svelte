<script lang="ts">
  interface Props {
    value?: string;
    fieldName?: string;
    ariaLabel?: string;
    maxLength?: number;
  }

  let {
    value = '',
    fieldName = 'caseStudyBody',
    ariaLabel = 'Case study in Markdown',
    maxLength = 30000,
  }: Props = $props();
  let editor: HTMLTextAreaElement;
  let preview = $state('');
  let previewOpen = $state(false);
  let previewLoading = $state(false);
  let previewError = $state('');

  function insert(before: string, after = '', placeholder = 'text') {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selection = value.slice(start, end) || placeholder;
    value = `${value.slice(0, start)}${before}${selection}${after}${value.slice(end)}`;
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
    value = `${value.slice(0, lineStart)}${prefix}${value.slice(lineStart)}`;
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length);
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
      onclick={() => insert('[', '](https://example.com)', 'link text')}
      aria-label="Link">Link</button
    >
    <button
      type="button"
      onclick={showPreview}
      disabled={previewLoading}
      class="preview-button"
    >
      {previewLoading ? 'Loading…' : 'Preview'}
    </button>
  </div>
  <textarea
    bind:this={editor}
    bind:value
    name={fieldName}
    maxlength={maxLength}
    rows="17"
    aria-label={ariaLabel}></textarea>
  <p class="hint">Markdown source · select text, then use the toolbar.</p>
  {#if previewError}<p class="error" role="alert">{previewError}</p>{/if}
  {#if previewOpen}
    <section class="preview prose-shell" aria-label="Case study preview">
      <div class="preview-heading">
        <strong>Preview</strong>
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
