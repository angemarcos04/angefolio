import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import svelte from '@astrojs/svelte';
import expressiveCode from 'astro-expressive-code';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

const siteUrl =
  process.env.PUBLIC_SITE_URL ||
  process.env.RENDER_EXTERNAL_URL ||
  'https://angellie-marcos.dev';
const siteOrigin = new URL(siteUrl);

export default defineConfig({
  site: siteUrl,
  output: 'server',
  security: {
    allowedDomains: [
      // Render terminates TLS before the request reaches Astro. Trust its
      // forwarded HTTPS origin so same-site form posts pass Astro's CSRF check.
      { hostname: 'angefolio.onrender.com', protocol: 'https' },
      {
        hostname: siteOrigin.hostname,
        protocol: siteOrigin.protocol.slice(0, -1),
      },
      { hostname: 'localhost', protocol: 'http' },
      { hostname: '127.0.0.1', protocol: 'http' },
    ],
  },
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
