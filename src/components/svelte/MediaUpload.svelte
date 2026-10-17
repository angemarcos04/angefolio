<script lang="ts">
  import { uploadImage } from '../../lib/client/uploadImage';

  interface Props {
    targetId?: string;
    label?: string;
    currentPath?: string;
    purpose?: string;
  }
  let {
    targetId = 'project-cover',
    label = 'Upload an image',
    currentPath = '',
    purpose = 'image',
  }: Props = $props();
  let fileInput: HTMLInputElement;
  let busy = $state(false);
  let message = $state('');
  let path = $state(currentPath);

  async function upload() {
    const file = fileInput.files?.[0];
    if (!file) {
      message = 'Choose an image first.';
      return;
    }
    busy = true;
    message = '';
    try {
      const uploadedPath = await uploadImage(file);
      path = uploadedPath;
      const target = document.getElementById(targetId);
      if (target instanceof HTMLInputElement) {
        target.value = uploadedPath;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
      message = 'Image uploaded and selected.';
    } catch (error) {
      message =
        error instanceof Error
          ? error.message
          : 'Image upload failed. Try again.';
    } finally {
      busy = false;
      fileInput.value = '';
    }
  }

  function clear() {
    path = '';
    const target = document.getElementById(targetId);
    if (target instanceof HTMLInputElement) {
      target.value = '';
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    message = 'Image reference cleared. The uploaded asset is retained.';
  }
</script>

<div class="media-upload">
  <label>
    <span>{label}</span>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      disabled={busy}
    />
  </label>
  <button type="button" onclick={upload} disabled={busy}
    >{busy ? 'Uploading…' : 'Upload and use image'}</button
  >
  {#if path}<button type="button" onclick={clear} disabled={busy}
      >Clear image reference</button
    >{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if path}<img src={path} alt={`Selected ${purpose} preview`} />{/if}
</div>

<style>
  .media-upload {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.6rem;
  }
  label span {
    display: block;
    margin-bottom: 0.35rem;
    color: var(--muted-foreground);
    font: 0.65rem var(--font-mono);
  }
  input {
    max-width: 100%;
    color: var(--muted-foreground);
    font: 0.7rem var(--font-mono);
  }
  button {
    justify-self: start;
    min-height: 2.5rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    font: 0.65rem var(--font-mono);
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  p {
    margin: 0;
    color: var(--muted-foreground);
    font: 0.65rem/1.5 var(--font-mono);
  }
  img {
    max-width: 20rem;
    max-height: 12rem;
    object-fit: contain;
    border: 1px solid var(--border);
  }
  :focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
