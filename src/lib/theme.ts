export type Theme = 'light' | 'dim' | 'dark';

export const themes: Theme[] = ['light', 'dim', 'dark'];
export const themeChangeEvent = 'angefolio:theme-change';

export const themeColors = {
  light: '#f7f3e3',
  dim: '#1b2430',
  dark: '#080b10',
} satisfies Record<Theme, string>;

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && themes.includes(value as Theme);
}

export function getCurrentTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return isTheme(theme) ? theme : 'dark';
}

export function applyTheme(theme: Theme): void {
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
    new CustomEvent<{ theme: Theme }>(themeChangeEvent, {
      detail: { theme },
    }),
  );
}
