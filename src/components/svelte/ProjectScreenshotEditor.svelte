<script lang="ts">
  import { tick } from 'svelte';
  import {
    PROJECT_SCREENSHOT_ALT_MAX_LENGTH,
    PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH,
    PROJECT_SCREENSHOT_COUNT_MAX,
  } from '../../lib/data/contentConstraints';
  import { uploadImage } from '../../lib/client/uploadImage';
  interface Screenshot {
    src: string;
    alt: string;
    caption?: string;
  }
  interface Props {
    value?: Screenshot[];
    fieldName?: string;
  }
  let { value = [], fieldName = 'screenshots' }: Props = $props();
  let entries = $state<Screenshot[]>(value.map((item) => ({ ...item })));
  let busy = $state(false);
  let message = $state('');
  let input: HTMLInputElement;
  let serialized: HTMLInputElement;
  let json = $derived(JSON.stringify(entries));

  async function commit(next: Screenshot[]) {
    entries = next;
    await tick();
    serialized.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function addFiles() {
    const file = input.files?.[0];
    if (!file) return;
    if (entries.length >= PROJECT_SCREENSHOT_COUNT_MAX) {
      message = 'A project can have up to 8 screenshots.';
      input.value = '';
      return;
    }
    busy = true;
    message = '';
    try {
      const src = await uploadImage(file);
      await commit([...entries, { src, alt: '' }]);
      message = 'Screenshot uploaded. Add alternative text before saving.';
    } catch (error) {
      message =
        error instanceof Error ? error.message : 'Upload failed. Try again.';
    } finally {
      busy = false;
      input.value = '';
    }
  }
  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    await commit(next);
  }

  async function remove(index: number) {
    await commit(entries.filter((_, entryIndex) => entryIndex !== index));
  }
</script>

<section class="screenshots" aria-labelledby="screenshots-title">
  <h3 id="screenshots-title">Project Screenshots</h3>
  <input bind:this={serialized} type="hidden" name={fieldName} value={json} />
  <label class="upload-label"
    >Add screenshot
    <input
      bind:this={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      disabled={busy || entries.length >= PROJECT_SCREENSHOT_COUNT_MAX}
      onchange={addFiles}
    />
  </label>
  {#if message}<p role="status">{message}</p>{/if}
  {#each entries as entry, index (entry.src)}
    <article class="entry">
      <img src={entry.src} alt="" loading="lazy" />
      <div class="fields">
        <label
          >Alternative text<input
            bind:value={entry.alt}
            maxlength={PROJECT_SCREENSHOT_ALT_MAX_LENGTH}
            required
            placeholder="Describe what the screenshot shows"
          /></label
        >
        <label
          >Caption (optional)<input
            bind:value={entry.caption}
            maxlength={PROJECT_SCREENSHOT_CAPTION_MAX_LENGTH}
          /></label
        >
      </div>
      <div class="actions">
        <button
          type="button"
          onclick={() => move(index, -1)}
          disabled={index === 0}>Move up</button
        >
        <button
          type="button"
          onclick={() => move(index, 1)}
          disabled={index === entries.length - 1}>Move down</button
        >
        <button type="button" onclick={() => remove(index)}>Remove</button>
      </div>
    </article>
  {/each}
  <small
    >Up to {PROJECT_SCREENSHOT_COUNT_MAX} screenshots. Removing a reference does not
    delete its uploaded image.</small
  >
</section>

<style>
  .screenshots {
    display: grid;
    gap: 0.75rem;
  }
  h3 {
    margin: 0;
    font: 0.75rem var(--font-mono);
    color: var(--foreground);
  }
  .entry {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr);
    gap: 0.65rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }
  .entry img {
    width: 7rem;
    max-height: 5rem;
    object-fit: contain;
    grid-row: span 2;
  }
  .fields {
    display: grid;
    gap: 0.5rem;
  }
  label {
    display: grid;
    gap: 0.3rem;
    color: var(--muted-foreground);
    font: 0.68rem var(--font-mono);
  }
  input:not([type='file']) {
    width: 100%;
    min-height: 2.3rem;
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  button,
  .upload-label {
    min-height: 2.4rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    font: 0.65rem var(--font-mono);
  }
  button:disabled {
    opacity: 0.5;
  }
  p,
  small {
    margin: 0;
    color: var(--muted-foreground);
    font: 0.68rem/1.5 var(--type-body);
  }
  :focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (max-width: 600px) {
    .entry {
      grid-template-columns: 1fr;
    }
    .entry img {
      grid-row: auto;
    }
  }
</style>
