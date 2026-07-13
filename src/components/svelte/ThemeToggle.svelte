<script lang="ts">
  import { onMount } from 'svelte';

  let light = false;

  onMount(() => {
    light = document.documentElement.dataset.theme === 'light';
  });

  function toggleTheme() {
    light = !light;
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    localStorage.setItem('theme', light ? 'light' : 'dark');
  }
</script>

<button
  type="button"
  on:click={toggleTheme}
  aria-label={light ? 'Use dark theme' : 'Use light theme'}
>
  {light ? 'Dark mode' : 'Light mode'}
</button>

<style>
  button {
    padding: 0.5rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 0.65rem;
    background: var(--muted);
    color: var(--foreground);
    font: 0.72rem var(--font-mono);
    cursor: pointer;
  }

  button:hover {
    border-color: var(--accent-cyan);
  }
</style>
