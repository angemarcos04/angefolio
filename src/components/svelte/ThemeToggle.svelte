<script lang="ts">
  import { onMount } from 'svelte';
  type Theme = 'dark' | 'dim';
  let theme: Theme = 'dark';
  let mounted = false;
  onMount(() => {
    theme = document.documentElement.dataset.theme === 'dim' ? 'dim' : 'dark';
    mounted = true;
  });
  function toggleTheme() {
    theme = theme === 'dark' ? 'dim' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* Storage is optional. */
    }
  }
</script>

<button
  type="button"
  onclick={toggleTheme}
  aria-label={`Switch to ${theme === 'dark' ? 'dim' : 'dark'} theme`}
  aria-pressed={theme === 'dim'}
  title="Toggle color theme"
>
  <span aria-hidden="true">{theme === 'dark' ? '◐' : '◑'}</span><span
    >{mounted ? theme : 'dark'}</span
  >
</button>

<style>
  button {
    display: inline-flex;
    min-height: 2.35rem;
    align-items: center;
    gap: 0.45rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--muted);
    color: var(--foreground);
    font: 0.7rem var(--font-mono);
    text-transform: capitalize;
    cursor: pointer;
  }
  button:hover {
    border-color: var(--accent-cyan);
  }
</style>
