<script lang="ts">
  export let targetId = 'project-cover';
  export let label = 'Upload a project image';
  let fileInput: HTMLInputElement;
  let busy = false;
  let message = '';
  let path = '';

  async function upload() {
    const file = fileInput.files?.[0];
    if (!file) {
      message = 'Choose an image first.';
      return;
    }
    busy = true;
    message = '';
    try {
      const form = new FormData();
      form.set('image', file);
      const result = await fetch('/api/console/media/upload', {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });
      const payload = await result.json();
      if (!result.ok || typeof payload.path !== 'string') {
        message = payload.error ?? 'Image upload failed.';
        return;
      }
      path = payload.path;
      const coverField = document.getElementById(targetId);
      if (coverField instanceof HTMLInputElement) {
        coverField.value = path;
        coverField.dispatchEvent(new Event('input', { bubbles: true }));
      }
      message = 'Image uploaded and selected.';
    } catch {
      message = 'Image upload failed. Try again.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="media-upload">
  <label>
    <span>{label}</span>
    <input
      bind:this={fileInput}
      type="file"
      accept="image/jpeg,image/png,image/webp"
    />
  </label>
  <button type="button" onclick={upload} disabled={busy}>
    {busy ? 'Uploading…' : 'Upload and use image'}
  </button>
  {#if message}<p role="status">{message}</p>{/if}
  {#if path}<img src={path} alt="Uploaded project cover preview" />{/if}
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
</style>
