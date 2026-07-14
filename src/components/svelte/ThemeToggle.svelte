<script lang="ts">
  import { onMount } from 'svelte';

  type Theme = 'light' | 'dim' | 'dark';

  const themes: Theme[] = ['light', 'dim', 'dark'];

  const labels: Record<Theme, string> = {
    light: 'Light',
    dim: 'Dim',
    dark: 'Dark',
  };

  const icons: Record<Theme, string> = {
    light: '☀',
    dim: '◐',
    dark: '●',
  };

  const themeColors = {
    light: '#f7f3e3',
    dim: '#1b2430',
    dark: '#080b10',
  } satisfies Record<Theme, string>;

  let theme: Theme = 'dark';

  function isTheme(value: string | undefined): value is Theme {
    return value === 'light' || value === 'dim' || value === 'dark';
  }

  function updateThemeColor(nextTheme: Theme) {
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeColors[nextTheme]);
  }

  function getNextTheme(currentTheme: Theme): Theme {
    const currentIndex = themes.indexOf(currentTheme);
    return themes[(currentIndex + 1) % themes.length];
  }

  function cycleTheme() {
    const nextTheme = getNextTheme(theme);

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

  $: nextTheme = getNextTheme(theme);
</script>

<button
  type="button"
  onclick={cycleTheme}
  aria-label={`Current theme: ${labels[theme]}. Switch to ${labels[nextTheme]} theme.`}
  title={`Switch to ${labels[nextTheme]} theme`}
>
  <span class="theme-icon" aria-hidden="true">{icons[theme]}</span>
  <span>{labels[theme]}</span>
</button>

<style>
  button {
    display: inline-flex;
    min-height: 2.35rem;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: var(--muted);
    color: var(--foreground);
    font-family: var(--type-ui);
    font-size: 0.7rem;
    font-weight: 600;
    font-variant-ligatures: none;
    font-feature-settings:
      'calt' 0,
      'liga' 0;
    letter-spacing: 0.02em;
    cursor: pointer;
    white-space: nowrap;
    transition:
      border-color 140ms ease,
      background-color 140ms ease,
      color 140ms ease;
  }
  button:hover {
    border-color: var(--border-strong);
    background: var(--accent-soft);
  }
  button:active {
    transform: translateY(1px);
  }
  .theme-icon {
    display: inline-flex;
    width: 1em;
    align-items: center;
    justify-content: center;
    color: var(--accent-hover);
    text-align: center;
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
    button:active {
      transform: none;
    }
  }
</style>
