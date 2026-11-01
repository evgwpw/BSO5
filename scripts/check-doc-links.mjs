/**
 * Проверка относительных ссылок в документации: каждая ссылка `](путь)` или
 * `](путь#anchor)` должна указывать на существующий файл. Якоря не проверяются —
 * только наличие цели, чтобы дешёво ловить переименования и переезды.
 *
 * Запуск: `node scripts/check-doc-links.mjs`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'README.md',
  'llms.txt',
  'CHANGELOG.md',
  'docs/README.md',
  'docs/API.md',
  'docs/GUIDE.md',
  'docs/TREE_GRID.md',
  'packages/bso5/README.md',
  'packages/bso5-components/README.md',
];

const LINK = /\]\(([^)\s]+)\)/g;
const problems = [];
let checked = 0;

for (const rel of FILES) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    problems.push(`${rel}: файл отсутствует`);
    continue;
  }
  const text = readFileSync(abs, 'utf8');
  for (const match of text.matchAll(LINK)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    checked++;
    const [pathPart] = target.split('#');
    if (pathPart === '') continue;
    const resolved = resolve(dirname(abs), pathPart);
    if (!existsSync(resolved)) problems.push(`${rel}: битая ссылка -> ${target}`);
  }
}

if (problems.length > 0) {
  console.error(`Проверено ${checked} ссылок, проблем: ${problems.length}`);
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log(`Ссылки в порядке: ${checked} проверено в ${FILES.length} файлах`);
