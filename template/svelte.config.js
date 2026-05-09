import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ precompress: false }),
    files: {
      assets: 'static',
      lib: 'src/shared'
    },
    alias: {
      '@/app': 'src/app',
      '@/app/*': 'src/app/*',
      '@/pages': 'src/pages',
      '@/pages/*': 'src/pages/*',
      '@/widgets': 'src/widgets',
      '@/widgets/*': 'src/widgets/*',
      '@/features': 'src/features',
      '@/features/*': 'src/features/*',
      '@/entities': 'src/entities',
      '@/entities/*': 'src/entities/*',
      '@/shared': 'src/shared',
      '@/shared/*': 'src/shared/*'
    }
  }
};

export default config;
