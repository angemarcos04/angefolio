import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import expressiveCode from 'astro-expressive-code';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Replace this documented placeholder when the final production domain is known.
  site: 'https://angellie-marcos.dev',
  output: 'static',
  integrations: [svelte(), expressiveCode(), mdx(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
