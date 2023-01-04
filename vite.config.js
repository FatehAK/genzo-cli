import { resolve } from 'path';
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import pkg from './package.json';

export default defineConfig(() => {
  return {
    build: {
      minify: false,
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        formats: ['es'],
        fileName: 'cli',
      },
      rollupOptions: {
        external: ['os', ...Object.keys(pkg.dependencies)],
        plugins: [
          visualizer({
            filename: 'reports/build-stats.html',
            gzipSize: true,
            brotliSize: true,
          }),
        ],
        output: {
          banner: '#!/usr/bin/env node',
        },
      },
    },
  };
});
