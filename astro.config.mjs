import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import svelte from '@astrojs/svelte';
import expressiveCode from 'astro-expressive-code';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Replace this documented placeholder when the final production domain is known.
  site: 'https://angellie-marcos.dev',
  output: 'server',
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
      // Private console routes must never be advertised by the public sitemap.
      filter: (page) => !new URL(page).pathname.startsWith('/console'),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
