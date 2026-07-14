<script lang="ts">
  import { onMount } from 'svelte';

  type Theme = 'light' | 'dim' | 'dark';

  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dim', label: 'Dim' },
    { value: 'dark', label: 'Dark' },
  ] as const satisfies ReadonlyArray<{ value: Theme; label: string }>;

  let theme: Theme = 'dark';

  function isTheme(value: string | undefined): value is Theme {
    return value === 'light' || value === 'dim' || value === 'dark';
  }

  function updateThemeColor(nextTheme: Theme) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', nextTheme === 'light' ? '#f7f3e3' : '#2b2118');
  }

  function selectTheme(nextTheme: Theme) {
    theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    updateThemeColor(nextTheme);

    try {
      localStorage.setItem('theme', nextTheme);
    } catch {
      /* Storage is optional. */
    }
  }

  onMount(() => {
    const initialTheme = document.documentElement.dataset.theme;
    theme = isTheme(initialTheme) ? initialTheme : 'dark';
    updateThemeColor(theme);
  });
</script>

<div class="theme-selector" role="group" aria-label="Color theme">
  {#each themes as option}
    <button
      type="button"
      aria-pressed={theme === option.value}
      title={`Use ${option.label.toLowerCase()} theme`}
      onclick={() => selectTheme(option.value)}
    >
      <span aria-hidden="true">{theme === option.value ? '●' : '○'}</span>
      {option.label}
    </button>
  {/each}
</div>

<style>
  .theme-selector {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--muted);
  }
  button {
    display: inline-flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: center;
    gap: 0.28rem;
    padding: 0.42rem 0.5rem;
    border: 0;
    border-right: 1px solid var(--border);
    background: transparent;
    color: var(--muted-foreground);
    font: 0.64rem var(--font-mono);
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }
  button:last-child {
    border-right: 0;
  }
  button:hover {
    background: var(--accent-soft);
    color: var(--foreground);
  }
  button[aria-pressed='true'] {
    background: var(--card);
    color: var(--accent-text);
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  button span {
    font-size: 0.55rem;
  }
  @media (max-width: 420px) {
    button {
      min-height: 2.15rem;
      padding-inline: 0.42rem;
      font-size: 0.61rem;
    }
  }
</style>
