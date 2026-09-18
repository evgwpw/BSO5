import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const bso5 = (p: string) => fileURLToPath(new URL(`./packages/bso5/src/${p}`, import.meta.url));
const comps = (p: string) => fileURLToPath(new URL(`./packages/bso5-components/src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // Let tests import the packages exactly as consumers would.
      // РУС: Пусть тесты импортируют пакеты ровно так, как это делали бы потребители.
      { find: /^bso5-components\/jsx-dev-runtime$/, replacement: comps('jsx-runtime.ts') },
      { find: /^bso5-components\/jsx-runtime$/, replacement: comps('jsx-runtime.ts') },
      { find: /^bso5-components$/, replacement: comps('index.ts') },
      { find: /^bso5\/jsx-dev-runtime$/, replacement: bso5('jsx-runtime.ts') },
      { find: /^bso5\/jsx-runtime$/, replacement: bso5('jsx-runtime.ts') },
      { find: /^bso5$/, replacement: bso5('index.ts') },
    ],
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'bso5-components',
    jsxDev: false,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['packages/*/tests/**/*.test.ts', 'packages/*/tests/**/*.test.tsx'],
  },
});
