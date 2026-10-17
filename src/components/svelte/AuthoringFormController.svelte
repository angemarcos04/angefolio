<script lang="ts">
  import { tick } from 'svelte';

  interface Props {
    formId: string;
  }

  let { formId }: Props = $props();
  let status = $state('');
  let dirty = $state(false);
  let saving = false;
  let initial = '';
  let form: HTMLFormElement;

  function currentSnapshot() {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string') params.append(key, value);
    }
    return params.toString();
  }

  function removeDescriptionReference(element: HTMLElement, id: string) {
    const remaining = (element.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((reference) => reference && reference !== id);
    if (remaining.length) {
      element.setAttribute('aria-describedby', remaining.join(' '));
    } else {
      element.removeAttribute('aria-describedby');
    }
  }

  async function updateDirty(event?: Event) {
    // Svelte-bound and serialized hidden controls may update at the end of the
    // current flush. Compare only after that DOM update has completed.
    await tick();
    if (event?.target instanceof HTMLElement) {
      event.target.removeAttribute('aria-invalid');
      removeDescriptionReference(event.target, 'authoring-status');
    }
    dirty = currentSnapshot() !== initial;
    status = dirty ? 'Unsaved changes' : '';
  }

  function revealNativeInvalid(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const section = target.closest('details');
    if (section) section.open = true;
    requestAnimationFrame(() => target.focus({ preventScroll: false }));
  }

  function findField(field: string | null): HTMLElement | null {
    if (!field) return null;
    const named = form.elements.namedItem(field);
    if (
      named instanceof HTMLElement &&
      named instanceof HTMLInputElement &&
      named.type === 'hidden'
    ) {
      if (field === 'screenshots') {
        return form.querySelector<HTMLElement>(
          '.screenshots input:not([type="hidden"]), .screenshots button',
        );
      }
      return null;
    }
    if (named instanceof HTMLElement) return named;
    if (named && 'length' in named) {
      const first = named.item(0);
      return first instanceof HTMLElement ? first : null;
    }
    return null;
  }

  function revealField(field: string | null) {
    const target = findField(field);
    if (!target) return false;
    target.closest('details')?.setAttribute('open', '');
    target.setAttribute('aria-invalid', 'true');
    const descriptions = new Set(
      (target.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter(Boolean),
    );
    descriptions.add('authoring-status');
    target.setAttribute('aria-describedby', [...descriptions].join(' '));
    target.focus({ preventScroll: false });
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  function fieldLabel(field: string | null) {
    const labels: Record<string, string> = {
      title: 'title',
      slug: 'slug',
      description: 'description',
      category: 'category',
      createdAt: 'date',
      date: 'date',
      updatedAt: 'updated date',
      body: 'Markdown content',
      caseStudyBody: 'case study',
      tags: 'tags',
      status: 'status',
      risk: 'risk',
      cover: 'cover image',
      screenshots: 'screenshots',
      stack: 'technology stack',
      links: 'additional links',
      role: 'role',
      problem: 'problem',
      solution: 'solution',
      highlights: 'highlights',
      tools: 'tools',
      lessons: 'lessons',
      repo: 'repository URL',
      demo: 'demo URL',
      relatedProject: 'related project',
    };
    return field ? (labels[field] ?? 'content') : 'content';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (saving) return;
    saving = true;
    status = 'Saving…';
    form.inert = true;
    form.setAttribute('aria-busy', 'true');
    const submitter = event.submitter as HTMLButtonElement | null;
    const submitterWasDisabled = submitter?.disabled ?? false;
    if (submitter) submitter.disabled = true;
    let recovery: { field: string | null; message: string } | null = null;
    let successDestination: URL | null = null;
    try {
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form)) {
        if (typeof value === 'string') params.append(key, value);
      }
      if (submitter?.name) params.append(submitter.name, submitter.value);
      const response = await fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (response.status === 401 || response.url.includes('/user/login')) {
        recovery = {
          field: null,
          message:
            'Your session expired. Your edits are still here; sign in again before saving.',
        };
      } else if (response.redirected) {
        const destination = new URL(response.url, window.location.href);
        if (destination.origin !== window.location.origin) {
          throw new Error(
            'The save response was invalid. Your edits are still here.',
          );
        }
        const error = destination.searchParams.get('error');
        if (error) {
          const field = destination.searchParams.get('field');
          recovery = {
            field,
            message:
              error === 'validation'
                ? `Review the ${fieldLabel(field)} field. Your edits are still here.`
                : error === 'slug'
                  ? 'That slug is already in use or reserved. Choose another slug; your edits are still here.'
                  : error === 'invalid'
                    ? 'The request was rejected. Your edits are still here.'
                    : `Could not save (${error}). Your edits are still here.`,
          };
        } else if (isConfirmedSuccess(destination)) {
          successDestination = destination;
        } else {
          recovery = {
            field: null,
            message:
              'The save could not be confirmed. Your edits are still here.',
          };
        }
      } else {
        throw new Error(
          'The save could not be confirmed. Your edits are still here.',
        );
      }
    } catch (error) {
      recovery = {
        field: null,
        message:
          error instanceof Error
            ? error.message
            : 'Could not save. Your edits are still here.',
      };
    } finally {
      form.inert = false;
      form.removeAttribute('aria-busy');
      if (submitter) submitter.disabled = submitterWasDisabled;
      saving = false;
    }

    if (successDestination) {
      dirty = false;
      status = 'Saved. Opening the updated record…';
      window.location.assign(successDestination.href);
      return;
    }

    if (recovery) {
      const fieldWasFound = revealField(recovery.field);
      status =
        recovery.field && !fieldWasFound
          ? `${recovery.message} The server reported an unavailable field; your edits are still here.`
          : recovery.message;
      if (!recovery.field || !fieldWasFound) {
        const statusElement = document.getElementById('authoring-status');
        statusElement?.focus({ preventScroll: false });
      }
    }
  }

  function isConfirmedSuccess(destination: URL) {
    const notice = destination.searchParams.get('notice');
    const path = destination.pathname;
    if (formId === 'project-editor') {
      return (
        (notice === 'created' && path === '/user/projects') ||
        (notice === 'updated' && path === '/user/projects')
      );
    }
    const collection = {
      'blog-editor': 'blog',
      'note-editor': 'notes',
      'lab-editor': 'lab',
    }[formId];
    if (!collection) return false;
    return (
      notice === 'saved' && new RegExp(`^/user/${collection}/[^/]+$`).test(path)
    );
  }

  $effect(() => {
    form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;
    initial = currentSnapshot();
    const scheduleDirty = (event: Event) => void updateDirty(event);
    form.addEventListener('input', scheduleDirty);
    form.addEventListener('change', scheduleDirty);
    form.addEventListener('submit', submit);
    form.addEventListener('invalid', revealNativeInvalid, true);
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      form.removeEventListener('input', scheduleDirty);
      form.removeEventListener('change', scheduleDirty);
      form.removeEventListener('submit', submit);
      form.removeEventListener('invalid', revealNativeInvalid, true);
      window.removeEventListener('beforeunload', guard);
    };
  });
</script>

<p
  id="authoring-status"
  class="form-status"
  class:warning={dirty}
  tabindex="-1"
  role="status"
  aria-live="polite"
>
  {status}
</p>

<style>
  .form-status {
    min-height: 1.2em;
    margin: 0.5rem 0;
    color: var(--muted-foreground);
    font: 0.75rem var(--type-ui);
  }
  .warning {
    color: var(--accent-text);
  }
  .form-status:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 3px;
  }
</style>
