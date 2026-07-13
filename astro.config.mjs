import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import svelte from '@astrojs/svelte';
import expressiveCode from 'astro-expressive-code';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'static',
  integrations: [svelte(), expressiveCode(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
