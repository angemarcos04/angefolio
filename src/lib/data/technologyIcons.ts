const iconDirectory = '/technology-icons';

const iconPaths: Record<string, string[]> = {
  astro: [`${iconDirectory}/astro.svg`],
  svelte: [`${iconDirectory}/svelte.svg`],
  typescript: [`${iconDirectory}/typescript.svg`],
  'tailwind css': [`${iconDirectory}/tailwindcss.svg`],
  laravel: [`${iconDirectory}/laravel.svg`],
  fastapi: [`${iconDirectory}/fastapi.svg`],
  postgresql: [`${iconDirectory}/postgresql.svg`],
  'gentoo linux': [`${iconDirectory}/gentoo.svg`],
  'bash/zsh': [`${iconDirectory}/gnubash.svg`, `${iconDirectory}/zsh.svg`],
  neovim: [`${iconDirectory}/neovim.svg`],
  git: [`${iconDirectory}/git.svg`],
  'podman/docker': [
    `${iconDirectory}/podman.svg`,
    `${iconDirectory}/docker.svg`,
  ],
  rust: [`${iconDirectory}/rust.svg`],
};

export function technologyIconsFor(name: string): string[] {
  return iconPaths[name.trim().toLowerCase()] ?? [];
}
