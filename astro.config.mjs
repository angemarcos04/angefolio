import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import svelte from '@astrojs/svelte';
import expressiveCode from 'astro-expressive-code';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site:
    process.env.PUBLIC_SITE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    'https://angellie-marcos.dev',
  output: 'server',
  devToolbar: {
    enabled: process.env.PLAYWRIGHT_TEST !== 'true',
  },
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [
    svelte(),
    expressiveCode({
      styleOverrides: {
        codeFontFamily: 'var(--type-code)',
        uiFontFamily: 'var(--type-ui)',
      },
    }),
    mdx(),
    sitemap({
      // Private workspace routes must never be advertised by the public sitemap.
      filter: (page) => !new URL(page).pathname.startsWith('/user'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
