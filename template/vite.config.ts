import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    sourcemap: false
  },
  server: {
    port: 5174,
    strictPort: false,
    fs: {
      strict: false
    }
  }
});
