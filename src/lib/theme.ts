import type { PortfolioTheme } from './terminal/types';

export const themes: PortfolioTheme[] = ['light', 'dim', 'dark'];
export const themeChangeEvent = 'angefolio:theme-change';

export const themeColors = {
  light: '#f7f3e3',
  dim: '#1b2430',
  dark: '#080b10',
} satisfies Record<PortfolioTheme, string>;

export function isTheme(value: string | undefined): value is PortfolioTheme {
  return themes.includes(value as PortfolioTheme);
}

export function getCurrentTheme(): PortfolioTheme {
  const theme = document.documentElement.dataset.theme;
  return isTheme(theme) ? theme : 'dark';
}

export function applyTheme(theme: PortfolioTheme): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColors[theme]);

  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* Storage is optional. */
  }

  window.dispatchEvent(
    new CustomEvent<PortfolioTheme>(themeChangeEvent, { detail: theme }),
  );
}
