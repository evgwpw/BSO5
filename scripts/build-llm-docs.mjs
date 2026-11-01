/**
 * Собирает llms-full.txt — всю документацию одним файлом для загрузки в контекст
 * модели. Список и порядок файлов заданы здесь, поэтому «актуальность» проверяема:
 * `--check` падает, если файл на диске отличается от пересобранного.
 *
 * Запуск: `npm run docs:llm` (пересобрать) или `npm run docs:check` (проверить).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'llms-full.txt';

/**
 * Порядок важен: сначала справочник (факты), потом рецепты и разметка,
 * затем вводные README — так модель получает самое плотное знание первым.
 */
const FILES = [
  'docs/API.md',
  'docs/GUIDE.md',
  'docs/TREE_GRID.md',
  'packages/bso5/README.md',
  'packages/bso5-components/README.md',
  'docs/README.md',
];

const read = rel => readFileSync(join(root, rel), 'utf8');

const parts = FILES.map(rel => {
  const body = read(rel).trimEnd();
  const bar = '='.repeat(78);
  return `${bar}\nFILE: ${rel}\n${bar}\n\n${body}\n`;
});

const header = [
  '# bso5 — полная документация одним файлом',
  '',
  '> Сгенерировано `scripts/build-llm-docs.mjs` из перечисленных ниже файлов.',
  '> Не редактируйте вручную: правьте источники и запустите `npm run docs:llm`.',
  '> Версии: bso5 0.4.0, bso5-components 0.2.0.',
  '',
  `Источники (${FILES.length}): ${FILES.join(', ')}.`,
  '',
].join('\n');

const content = `${header}\n${parts.join('\n')}`;
const target = join(root, OUT);
const check = process.argv.includes('--check');

if (check) {
  let existing = '';
  try {
    existing = readFileSync(target, 'utf8');
  } catch {
    console.error(`${OUT} отсутствует — запустите npm run docs:llm`);
    process.exit(1);
  }
  if (existing !== content) {
    console.error(`${OUT} устарел — запустите npm run docs:llm`);
    process.exit(1);
  }
  console.log(`${OUT} актуален (${content.length} символов)`);
} else {
  writeFileSync(target, content, 'utf8');
  console.log(`${OUT} собран: ${content.length} символов, ${FILES.length} файлов`);
}
