<script lang="ts">
  import type { HomepageCredential } from '../../lib/data/homepage';

  export let credentials: HomepageCredential[] = [];

  let records = credentials.map((credential) => ({ ...credential }));
  let uploadMessages: Record<string, string> = {};
  let busyIds = new Set<string>();

  $: serialized = JSON.stringify(records);

  const types = [
    ['certification', 'Professional certification'],
    ['digital_badge', 'Digital badge'],
    ['course', 'Course completion'],
    ['training', 'Training certificate'],
    ['license', 'License'],
  ] as const;

  const sources = [
    ['credly', 'Credly'],
    ['linkedin', 'LinkedIn'],
    ['issuer', 'Issuer'],
    ['manual', 'Manual'],
  ] as const;

  function update(
    index: number,
    key: keyof HomepageCredential,
    value: string | number | boolean | null,
  ) {
    records = records.map((record, recordIndex) =>
      recordIndex === index ? { ...record, [key]: value } : record,
    ) as HomepageCredential[];
  }

  function addCredential() {
    const id = globalThis.crypto?.randomUUID?.() ?? `credential-${Date.now()}`;
    records = [
      ...records,
      {
        id,
        title: '',
        issuer: '',
        type: 'course',
        image: null,
        verificationUrl: null,
        source: 'manual',
        sourceUrl: null,
        issuedAt: null,
        expiresAt: null,
        featured: false,
        visible: false,
        order: records.length,
      },
    ];
  }

  function removeCredential(index: number) {
    const record = records[index];
    if (
      !record ||
      !window.confirm(`Remove “${record.title || 'this credential'}”?`)
    )
      return;
    records = records.filter((_, recordIndex) => recordIndex !== index);
    const { [record.id]: _removed, ...remainingMessages } = uploadMessages;
    uploadMessages = remainingMessages;
  }

  async function uploadImage(index: number, event: Event) {
    const record = records[index];
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;
    const file = input.files?.[0];
    if (!record || !file) return;

    busyIds = new Set(busyIds).add(record.id);
    uploadMessages = { ...uploadMessages, [record.id]: '' };
    try {
      const form = new FormData();
      form.set('image', file);
      const response = await fetch('/api/console/media/upload', {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });
      const result = (await response.json()) as {
        path?: string;
        error?: string;
      };
      if (!response.ok || typeof result.path !== 'string') {
        uploadMessages = {
          ...uploadMessages,
          [record.id]: result.error ?? 'Image upload failed.',
        };
        return;
      }
      update(index, 'image', result.path);
      uploadMessages = {
        ...uploadMessages,
        [record.id]: 'Badge image uploaded.',
      };
    } catch {
      uploadMessages = {
        ...uploadMessages,
        [record.id]: 'Image upload failed. Try again.',
      };
    } finally {
      const nextBusy = new Set(busyIds);
      nextBusy.delete(record.id);
      busyIds = nextBusy;
      input.value = '';
    }
  }
</script>

<input type="hidden" name="credentials" value={serialized} />

<div class="credential-editor-list">
  {#each records as credential, index (credential.id)}
    <fieldset class="credential-editor-item">
      <legend>{credential.title || `Credential ${index + 1}`}</legend>
      <div class="fields">
        <label>
          <span>Title</span>
          <input
            maxlength="160"
            required
            value={credential.title}
            oninput={(event) =>
              update(index, 'title', event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Issuer</span>
          <input
            maxlength="120"
            required
            value={credential.issuer}
            oninput={(event) =>
              update(index, 'issuer', event.currentTarget.value)}
          />
        </label>
        <label>
          <span>Type</span>
          <select
            value={credential.type}
            onchange={(event) =>
              update(
                index,
                'type',
                event.currentTarget.value as HomepageCredential['type'],
              )}
          >
            {#each types as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>
        <label>
          <span>Source</span>
          <select
            value={credential.source}
            onchange={(event) =>
              update(
                index,
                'source',
                event.currentTarget.value as HomepageCredential['source'],
              )}
          >
            {#each sources as [value, label]}
              <option {value}>{label}</option>
            {/each}
          </select>
        </label>
        <label class="wide">
          <span>Verification URL</span>
          <input
            type="url"
            maxlength="2048"
            placeholder="https://"
            value={credential.verificationUrl ?? ''}
            oninput={(event) =>
              update(
                index,
                'verificationUrl',
                event.currentTarget.value || null,
              )}
          />
        </label>
        <label class="wide">
          <span>Credential ID</span>
          <input
            maxlength="200"
            value={credential.credentialId ?? ''}
            oninput={(event) =>
              update(index, 'credentialId', event.currentTarget.value || null)}
          />
        </label>
        <label class="wide">
          <span>Source URL</span>
          <input
            type="url"
            maxlength="2048"
            placeholder="https://"
            value={credential.sourceUrl ?? ''}
            oninput={(event) =>
              update(index, 'sourceUrl', event.currentTarget.value || null)}
          />
        </label>
        <label>
          <span>Issued</span>
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]{4}-[0-9]{2}(-[0-9]{2})?"
            placeholder="YYYY-MM or YYYY-MM-DD"
            value={credential.issuedAt ?? ''}
            onchange={(event) =>
              update(index, 'issuedAt', event.currentTarget.value || null)}
          />
        </label>
        <label>
          <span>Expires</span>
          <input
            type="text"
            inputmode="numeric"
            pattern="[0-9]{4}-[0-9]{2}(-[0-9]{2})?"
            placeholder="YYYY-MM or YYYY-MM-DD"
            value={credential.expiresAt ?? ''}
            onchange={(event) =>
              update(index, 'expiresAt', event.currentTarget.value || null)}
          />
        </label>
        <label class="wide">
          <span>Local badge image path</span>
          <input
            maxlength="2048"
            placeholder="/media/... or /credentials/..."
            value={credential.image ?? ''}
            oninput={(event) =>
              update(index, 'image', event.currentTarget.value || null)}
          />
        </label>
        <label class="wide upload">
          <span>Upload badge artwork (JPEG, PNG, WebP)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busyIds.has(credential.id)}
            onchange={(event) => uploadImage(index, event)}
          />
          {#if credential.image}
            <img
              class="preview"
              src={credential.image}
              alt="Badge artwork preview"
            />
          {/if}
          {#if uploadMessages[credential.id]}
            <small role="status">{uploadMessages[credential.id]}</small>
          {/if}
        </label>
      </div>
      <div class="flags">
        <label>
          <input
            type="checkbox"
            checked={credential.featured}
            onchange={(event) =>
              update(index, 'featured', event.currentTarget.checked)}
          />
          Feature on homepage
        </label>
        <label>
          <input
            type="checkbox"
            checked={credential.visible}
            onchange={(event) =>
              update(index, 'visible', event.currentTarget.checked)}
          />
          Show publicly
        </label>
        <label class="order">
          <span>Order</span>
          <input
            type="number"
            min="0"
            max="999"
            value={credential.order}
            oninput={(event) =>
              update(index, 'order', Number(event.currentTarget.value))}
          />
        </label>
        <button
          type="button"
          class="remove"
          onclick={() => removeCredential(index)}
        >
          Remove credential
        </button>
      </div>
    </fieldset>
  {/each}
</div>

<button type="button" class="add" onclick={addCredential}>Add credential</button
>

<style>
  .credential-editor-list {
    display: grid;
    gap: 0.75rem;
  }
  .credential-editor-item {
    min-width: 0;
    padding: 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
  }
  legend,
  label > span {
    color: var(--muted-foreground);
    font: 0.68rem var(--font-mono);
  }
  .fields {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.7rem;
  }
  .fields label,
  .order {
    display: grid;
    min-width: 0;
    gap: 0.3rem;
  }
  .fields .wide {
    grid-column: 1 / -1;
  }
  input,
  select {
    box-sizing: border-box;
    width: 100%;
    min-height: 2.4rem;
    padding: 0.45rem 0.55rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    font: 0.78rem var(--type-ui);
  }
  input[type='file'] {
    padding: 0.35rem;
    font-size: 0.7rem;
  }
  .preview {
    width: 5rem;
    height: 5rem;
    object-fit: contain;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: #ece9e1;
  }
  .upload small {
    color: var(--muted-foreground);
    font: 0.68rem/1.5 var(--type-ui);
  }
  .flags {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 0.7rem 1rem;
    margin-top: 0.75rem;
  }
  .flags > label:not(.order) {
    display: inline-flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--foreground);
    font: 0.75rem var(--type-ui);
  }
  .flags input[type='checkbox'] {
    width: 1rem;
    min-height: 1rem;
    accent-color: var(--accent);
  }
  .order input {
    width: 5rem;
  }
  button {
    min-height: 2.5rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--muted);
    color: var(--foreground);
    font: 0.72rem var(--font-mono);
    cursor: pointer;
  }
  button:hover {
    border-color: var(--accent);
  }
  .add {
    margin-top: 0.75rem;
  }
  .remove {
    color: var(--danger-foreground);
  }
  @media (max-width: 520px) {
    .fields {
      grid-template-columns: minmax(0, 1fr);
    }
    .fields .wide {
      grid-column: auto;
    }
  }
</style>
