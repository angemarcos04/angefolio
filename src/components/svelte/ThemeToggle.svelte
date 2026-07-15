<script lang="ts">
  import { onMount } from 'svelte';
  import {
    applyTheme,
    getCurrentTheme,
    isTheme,
    themeChangeEvent,
    themes,
  } from '../../lib/theme';
  import type { PortfolioTheme as Theme } from '../../lib/terminal/types';

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

  let theme: Theme = 'dark';

  function getNextTheme(currentTheme: Theme): Theme {
    const currentIndex = themes.indexOf(currentTheme);
    return themes[(currentIndex + 1) % themes.length];
  }

  function cycleTheme() {
    const nextTheme = getNextTheme(theme);

    theme = nextTheme;
    applyTheme(nextTheme);
  }

  onMount(() => {
    theme = getCurrentTheme();

    const syncTheme = (event: Event) => {
      const nextTheme = (event as CustomEvent<string>).detail;
      if (isTheme(nextTheme)) theme = nextTheme;
    };

    window.addEventListener(themeChangeEvent, syncTheme);
    return () => window.removeEventListener(themeChangeEvent, syncTheme);
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
