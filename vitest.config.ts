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
    // Порог — защита от тихого падения покрытия, а не цель. Замер на 2026-11-01:
    // 93.7 % операторов, 88.6 % ветвей, 97.7 % строк.
    // РУС: порог стоит заметно ниже фактического, чтобы не мигать на рефакторинге.
    // `include` намеренно не задан: он заставляет инструментировать файлы по
    // маске и рассинхронизирует карту с реально исполненным кодом (замер падал
    // до 3 %), поэтому считаем только то, что тесты действительно загрузили.
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 88,
        branches: 84,
        functions: 90,
        lines: 92,
      },
    },
  },
});
