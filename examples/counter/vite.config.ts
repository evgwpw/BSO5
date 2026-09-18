import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Dev config for the counter example.
// The library is consumed from source (../../packages/bso5) as an alias.
// РУС: Dev-конфиг примера counter.
// РУС: Библиотека потребляется из исходников (../../packages/bso5) как алиас.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^bso5\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('../../packages/bso5/src/jsx-runtime.ts', import.meta.url)) },
      { find: /^bso5\/jsx-runtime$/, replacement: fileURLToPath(new URL('../../packages/bso5/src/jsx-runtime.ts', import.meta.url)) },
      { find: /^bso5$/, replacement: fileURLToPath(new URL('../../packages/bso5/src/index.ts', import.meta.url)) },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'bso5',
    jsxDev: false,
  },
});
