/**
 * Проверка ссылок в документации: каждая ссылка `](путь)` должна указывать на
 * существующий файл, а `](путь#якорь)` — ещё и на существующий заголовок в нём.
 * Якорь считается так же, как в build-docs-html.mjs и у GitHub: нижний регистр,
 * без пунктуации, пробелы → дефисы.
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
  'docs/API.en.md',
  'docs/GUIDE.md',
  'docs/GUIDE.en.md',
  'docs/TREE_GRID.md',
  'packages/bso5/README.md',
  'packages/bso5-components/README.md',
];

const LINK = /\]\(([^)\s]+)\)/g;

/**
 * Якорь как у GitHub: нижний регистр, пунктуация выброшена, каждый пробел → дефис
 * (без схлопывания — «a = b» даёт «a--b», иначе ссылки на такие заголовки не работают).
 */
const slug = text => text
  .toLowerCase()
  .replace(/`|\*\*|\*|__/g, '')
  .replace(/[^\p{L}\p{N}\s-]/gu, '')
  .trim()
  .replace(/\s/g, '-');

/** Якоря всех заголовков файла. */
function anchorsOf(abs) {
  const set = new Set();
  for (const line of readFileSync(abs, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(.*)$/);
    if (m) set.add(slug(m[1]));
  }
  return set;
}

const anchorCache = new Map();
const anchors = abs => {
  if (!anchorCache.has(abs)) anchorCache.set(abs, anchorsOf(abs));
  return anchorCache.get(abs);
};

const problems = [];
let links = 0;
let anchorsChecked = 0;

for (const rel of FILES) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    problems.push(`${rel}: файл отсутствует`);
    continue;
  }
  for (const match of readFileSync(abs, 'utf8').matchAll(LINK)) {
    const target = match[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    links++;
    const [pathPart, frag] = target.split('#');
    const fileForAnchor = pathPart === '' ? abs : resolve(dirname(abs), pathPart);

    if (pathPart !== '' && !existsSync(fileForAnchor)) {
      problems.push(`${rel}: битая ссылка -> ${target}`);
      continue;
    }
    if (!frag || !fileForAnchor.endsWith('.md')) continue;

    anchorsChecked++;
    if (!anchors(fileForAnchor).has(decodeURIComponent(frag).toLowerCase())) {
      problems.push(`${rel}: нет якоря #${frag} в ${pathPart || 'этом файле'}`);
    }
  }
}

if (problems.length > 0) {
  console.error(`Ссылок: ${links}, якорей: ${anchorsChecked}, проблем: ${problems.length}`);
  for (const p of problems) console.error(' -', p);
  process.exit(1);
}
console.log(`Ссылки в порядке: ${links} ссылок (${anchorsChecked} с якорем) в ${FILES.length} файлах`);
