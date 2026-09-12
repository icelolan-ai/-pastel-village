import { defineConfig } from 'vite';

// IMPORTANT: This MUST match the GitHub repository name exactly,
// including the leading hyphen, or every asset will 404 on GitHub Pages.
// Repo: https://github.com/icelolan-ai/-pastel-village
// Pages URL: https://icelolan-ai.github.io/-pastel-village/
export default defineConfig({
  base: '/-pastel-village/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    host: true,
  },
});
