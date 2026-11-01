/**
 * Режет справочник на короткие тематические файлы под точечное чтение и retrieval:
 * `docs/topics/<slug>.md` (рус.) и `docs/topics/en/<slug>.md` (англ.) — по одному
 * разделу `## N.` из `docs/API.md` / `docs/API.en.md`, плюс индексы.
 *
 * Источник истины остаётся в API.md: файлы генерируются, поэтому расхождение
 * невозможно — `--check` падает, если что-то устарело.
 *
 * Запуск: `npm run docs:topics` (пересобрать) или `npm run docs:check` (проверить).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** slug'и по номеру раздела: одинаковые для обоих языков, имена файлов — ASCII. */
const SLUGS = {
  0: 'setup',
  1: 'state',
  2: 'computations',
  3: 'bindings',
  4: 'elements',
  5: 'lifecycle',
  6: 'lists',
  7: 'performance',
  8: 'limits',
  9: 'grid',
  10: 'tree',
  11: 'key-identity',
  12: 'classes',
};

/** Короткие описания для индекса (руками — качество важнее автоматики). */
const DESCRIPTIONS = {
  ru: {
    0: 'установка, требования, tsconfig, importmap',
    1: 'Signal, Reactive, watch, getPropertyName',
    2: 'effect, onError, computed, batch, untrack',
    3: '$(): привязка значений в текст, атрибуты и style',
    4: 'h(), JSX, таблица атрибутов, низкоуровневые экспорты',
    5: 'mount, scope, releaseBindings',
    6: '<For> (с ключом и без) и <Show>',
    7: 'замеры и известные ограничения производительности',
    8: 'чего нет: SSR, портал, виртуализация, error boundary',
    9: '<Grid>: пропсы, колонки, поведение, a11y',
    10: '<Tree>: пропсы, данные, поведение, клавиатура',
    11: 'ключ = идентичность: почему данные не обновляются',
    12: 'классы разметки компонентов',
  },
  en: {
    0: 'install, requirements, tsconfig, importmap',
    1: 'Signal, Reactive, watch, getPropertyName',
    2: 'effect, onError, computed, batch, untrack',
    3: '$(): bind values into text, attributes and style',
    4: 'h(), JSX, attribute table, low-level exports',
    5: 'mount, scope, releaseBindings',
    6: '<For> (keyed and unkeyed) and <Show>',
    7: 'measurements and known performance limits',
    8: 'what is missing: SSR, portals, virtualization, error boundaries',
    9: '<Grid>: props, columns, behaviour, a11y',
    10: '<Tree>: props, data, behaviour, keyboard',
    11: 'key = identity: why data does not update',
    12: 'component markup classes',
  },
};

const LANGS = [
  { id: 'ru', source: 'docs/API.md', dir: 'docs/topics', index: 'docs/topics/index.md',
    sourceLink: '../API.md', depth: 1, headerTitle: 'bso5 — темы', sourceLabel: 'Источник',
    about: 'Раздел {n} справочника' },
  { id: 'en', source: 'docs/API.en.md', dir: 'docs/topics/en', index: 'docs/topics/en/index.md',
    sourceLink: '../../API.en.md', depth: 2, headerTitle: 'bso5 — topics', sourceLabel: 'Source',
    about: 'Reference section {n}' },
];

/** Читает источник с нормализацией переводов строк (см. build-llm-docs.mjs). */
const read = rel => readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n');

/**
 * Перебазирует относительные ссылки раздела под глубину файла темы: раздел живёт
 * в `docs/API.md`, а тема — в `docs/topics/` (на уровень глубже) или в
 * `docs/topics/en/` (на два). Внешние ссылки и якоря не трогаем.
 */
function rebaseLinks(markdown, depth) {
  const prefix = '../'.repeat(depth);
  return markdown.replace(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g, (_, target) => `](${prefix}${target})`);
}

/** Разбивает markdown на разделы `## N. …`: [{ n, title, body }]. */
function splitSections(markdown) {
  const out = [];
  const lines = markdown.split(/\r?\n/);
  let current = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(\d+)\.\s+(.*)$/);
    if (m) {
      if (current) out.push(current);
      current = { n: Number(m[1]), title: m[2].trim(), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) out.push(current);
  // Хвостовой разделитель между разделами в тему не тащим.
  return out.map(s => ({ ...s, body: s.body.join('\n').trim().replace(/\n+---\s*$/, '') }));
}

const outputs = [];

for (const lang of LANGS) {
  const sections = splitSections(read(lang.source));
  const rows = [];

  for (const section of sections) {
    const slug = SLUGS[section.n];
    if (!slug) throw new Error(`${lang.source}: нет slug для раздела ${section.n} «${section.title}»`);
    const file = `${lang.dir}/${slug}.md`;
    // Заголовок темы: сам раздел; в шапке — номер и ссылка на полный справочник.
    const body = `${lang.about.replace('{n}', section.n)} · ${lang.sourceLabel}: [${lang.source.split('/').pop()}](${lang.sourceLink})\n\n## ${section.title}\n\n${rebaseLinks(section.body, lang.depth)}\n`;
    outputs.push({ file, content: body });
    rows.push({ n: section.n, slug, title: section.title, description: DESCRIPTIONS[lang.id][section.n] ?? '' });
  }

  const indexLines = [
    `# ${lang.headerTitle}`,
    '',
    lang.id === 'ru'
      ? `> Короткие темы для точечного чтения: весь справочник целиком — [API.md](${lang.sourceLink}).\n> Файлы генерируются из него (\`npm run docs:topics\`), правьте справочник.`
      : `> Short topics for targeted reading: the full reference is [API.en.md](${lang.sourceLink}).\n> Files are generated from it (\`npm run docs:topics\`); edit the reference.`,
    '',
  ];
  for (const row of rows) {
    indexLines.push(`- [${row.title}](${row.slug}.md) — ${row.description}`);
  }
  indexLines.push('');
  outputs.push({ file: lang.index, content: indexLines.join('\n') });
}

const check = process.argv.includes('--check');
let failed = false;

for (const { file, content } of outputs) {
  const abs = join(root, file.replace(/\.\.\//g, ''));
  if (check) {
    if (!existsSync(abs)) {
      console.error(`${file} отсутствует — запустите npm run docs:topics`);
      failed = true;
      continue;
    }
    // Сравниваем без учёта стиля переводов строк (CRLF в рабочей копии — не
    // повод объявлять тему устаревшей).
    if (readFileSync(abs, 'utf8').replace(/\r\n/g, '\n') !== content) {
      console.error(`${file} устарел — запустите npm run docs:topics`);
      failed = true;
    }
    continue;
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content, 'utf8');
}

/* Удаляем темы, которых больше нет в справочнике (переименование раздела и т. п.). */
if (!check) {
  for (const lang of LANGS) {
    const dir = join(root, lang.dir);
    if (!existsSync(dir)) continue;
    const keep = new Set(outputs.filter(o => o.file.startsWith(lang.dir)).map(o => o.file.split('/').pop()));
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.md') && !keep.has(name)) {
        rmSync(join(dir, name));
        console.log(`удалён устаревший ${lang.dir}/${name}`);
      }
    }
  }
  console.log(`тем: ${outputs.length} файлов (${LANGS.map(l => l.id).join(' + ')})`);
}

if (failed) process.exit(1);
if (check) console.log(`темы актуальны (${outputs.length} файлов)`);
