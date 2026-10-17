<script lang="ts">
  interface Props {
    formId: string;
  }

  let { formId }: Props = $props();
  let status = $state('');
  let dirty = $state(false);
  let initial = '';
  let form: HTMLFormElement;

  function currentSnapshot() {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === 'string') params.append(key, value);
    }
    return params.toString();
  }

  function updateDirty(event?: Event) {
    if (event?.target instanceof HTMLElement) {
      event.target.removeAttribute('aria-invalid');
      event.target.removeAttribute('aria-describedby');
    }
    dirty = currentSnapshot() !== initial;
    status = dirty ? 'Unsaved changes' : '';
  }

  function revealNativeInvalid(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const section = target.closest('details');
    if (section) section.open = true;
  }

  function revealField(field: string | null) {
    const target = field
      ? (form.elements.namedItem(field) as HTMLElement | null)
      : null;
    const firstInvalid =
      target ??
      form.querySelector<HTMLElement>(
        'input:not([type=hidden]), textarea, select',
      );
    firstInvalid?.closest('details')?.setAttribute('open', '');
    if (firstInvalid instanceof HTMLElement) {
      firstInvalid.setAttribute('aria-invalid', 'true');
      firstInvalid.setAttribute('aria-describedby', 'authoring-status');
      firstInvalid.focus({ preventScroll: false });
    }
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
    status = 'Saving…';
    form.inert = true;
    const submitter = event.submitter as HTMLButtonElement | null;
    if (submitter) submitter.disabled = true;
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
      if (response.redirected) {
        const destination = new URL(response.url, window.location.href);
        if (destination.origin !== window.location.origin) {
          throw new Error(
            'The save response was invalid. Your edits are still here.',
          );
        }
        const error = destination.searchParams.get('error');
        if (error) {
          const field = destination.searchParams.get('field');
          revealField(field);
          status =
            error === 'validation'
              ? `Review the ${fieldLabel(field)} field. Your edits are still here.`
              : error === 'slug'
                ? 'That slug is already in use or reserved. Choose another slug; your edits are still here.'
                : error === 'invalid'
                  ? 'The request was rejected. Your edits are still here.'
                  : `Could not save (${error}). Your edits are still here.`;
          return;
        }
        if (destination.pathname === '/user/login') {
          status =
            'Your session expired. Your edits are still here; sign in again before saving.';
          return;
        }
        dirty = false;
        window.location.assign(destination.href);
        return;
      }
      throw new Error(
        'The save could not be confirmed. Your edits are still here.',
      );
    } catch (error) {
      status =
        error instanceof Error
          ? error.message
          : 'Could not save. Your edits are still here.';
    } finally {
      form.inert = false;
      if (submitter) submitter.disabled = false;
    }
  }

  $effect(() => {
    form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;
    initial = currentSnapshot();
    form.addEventListener('input', updateDirty);
    form.addEventListener('change', updateDirty);
    form.addEventListener('submit', submit);
    form.addEventListener('invalid', revealNativeInvalid, true);
    const guard = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => {
      form.removeEventListener('input', updateDirty);
      form.removeEventListener('change', updateDirty);
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
</style>
