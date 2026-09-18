import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// Dev config for the dataview example.
// Both packages are consumed from source (../../packages/*) as aliases —
// exactly the way a consumer app would install them.
// РУС: Dev-конфиг примера dataview.
// РУС: Оба пакета потребляются из исходников (../../packages/*) как алиасы —
// ровно так, как их ставило бы приложение-потребитель.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^bso5-components\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('../../packages/bso5-components/src/jsx-runtime.ts', import.meta.url)) },
      { find: /^bso5-components\/jsx-runtime$/, replacement: fileURLToPath(new URL('../../packages/bso5-components/src/jsx-runtime.ts', import.meta.url)) },
      { find: /^bso5-components$/, replacement: fileURLToPath(new URL('../../packages/bso5-components/src/index.ts', import.meta.url)) },
      { find: /^bso5\/jsx-dev-runtime$/, replacement: fileURLToPath(new URL('../../packages/bso5/src/jsx-runtime.ts', import.meta.url)) },
      { find: /^bso5\/jsx-runtime$/, replacement: fileURLToPath(new URL('../../packages/bso5/src/jsx-runtime.ts', import.meta.url)) },
      { find: /^bso5$/, replacement: fileURLToPath(new URL('../../packages/bso5/src/index.ts', import.meta.url)) },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'bso5-components',
    jsxDev: false,
  },
});
