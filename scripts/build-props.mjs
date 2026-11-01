/**
 * Генерирует `docs/PROPS.md` — таблицы пропсов прямо из TypeScript-интерфейсов.
 * Тип и признак необязательности берутся из кода, описание — из JSDoc (английская
 * часть, которая в наших комментариях идёт первой).
 *
 * Так справочник не может отстать от типов: `npm run docs:props` и `--check` в CI.
 *
 * Запуск: `npm run docs:props` (пересобрать) или `npm run docs:check` (проверить).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'docs/PROPS.md';

/** Что и откуда берём: файл → интерфейсы в порядке объявления. */
const SOURCES = [
  {
    file: 'packages/bso5/src/reactive.ts',
    interfaces: ['EffectOptions', 'Scope', 'BoundValue'],
  },
  {
    file: 'packages/bso5/src/dom.ts',
    interfaces: ['Mounted'],
  },
  {
    file: 'packages/bso5/src/control.ts',
    interfaces: ['ForProps', 'ShowProps'],
  },
  {
    file: 'packages/bso5-components/src/Grid.tsx',
    interfaces: ['GridProps', 'Column', 'GridLabels'],
  },
  {
    file: 'packages/bso5-components/src/Tree.tsx',
    interfaces: ['TreeProps', 'TreeData', 'TreeLabels'],
  },
];

/**
 * Английская часть JSDoc: текст обрезается на первом маркере «РУС:» (он стоит и в
 * начале строки, и в её середине — бывает оба варианта).
 *
 * Комментарий берём через `getJSDocCommentsAndTags`: у однострочных `/** … *​/`
 * свойство `node.jsDoc[0].comment` у части узлов пустое, а этот API текст отдаёт.
 */
function descriptionOf(node) {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const doc = docs[docs.length - 1];
  if (!doc) return '';
  const raw = typeof doc.comment === 'string'
    ? doc.comment
    : Array.isArray(doc.comment) ? doc.comment.map(part => part.text ?? '').join('') : '';
  const marker = raw.search(/\(?\s*РУС\s*:/);
  const en = (marker === -1 ? raw : raw.slice(0, marker))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s(]+$/, ''); // недописанная скобка от обрезанного перевода
  return en.replace(/\|/g, '\\|');
}

const typeText = (node, sf) => node.type ? node.type.getText(sf).replace(/\|/g, '\\|') : '—';

const blocks = [];
let missing = 0;

for (const source of SOURCES) {
  const abs = join(root, source.file);
  const sf = ts.createSourceFile(
    source.file,
    readFileSync(abs, 'utf8'),
    ts.ScriptTarget.ESNext,
    true,
    source.file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const declared = new Map();
  for (const stmt of sf.statements) {
    if (ts.isInterfaceDeclaration(stmt)) declared.set(stmt.name.text, stmt);
  }

  for (const name of source.interfaces) {
    const node = declared.get(name);
    if (!node) {
      // Интерфейс переехал или переименован — это должно быть видно сразу.
      console.error(`не найден интерфейс ${name} в ${source.file}`);
      missing++;
      continue;
    }

    const rows = node.members
      .filter(member => ts.isPropertySignature(member) && ts.isIdentifier(member.name))
      .map(member => {
        const field = member.name.text;
        const optional = member.questionToken ? 'нет' : 'да';
        const type = typeText(member, sf);
        const doc = descriptionOf(member) || '—';
        return `| \`${field}\` | \`${type}\` | ${optional} | ${doc} |`;
      });

    const params = node.typeParameters?.map(p => p.getText(sf)).join(', ');
    blocks.push([
      `### \`${name}${params ? `<${params}>` : ''}\``,
      '',
      `[${source.file.replace('packages/', '')}](../${source.file})`,
      '',
      '| Поле | Тип | Обязательно | Описание |',
      '| --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'));
  }
}

if (missing > 0) process.exit(1);

const content = [
  '# bso5 — пропсы и опции (из типов)',
  '',
  '> Файл генерируется `scripts/build-props.mjs` из TypeScript-интерфейсов: типы и',
  '> признак обязательности берутся из кода, описания — из JSDoc. Не редактируйте',
  '> вручную: правьте интерфейсы, затем `npm run docs:props`.',
  '>',
  '> Полная семантика, поведение и крайние случаи — в [API.md](./API.md) / [API.en.md](./API.en.md).',
  '> Событийные пропсы (`onClick`, `onInputCapture`, …) описаны в API §4.',
  '',
  ...blocks,
].join('\n');

const check = process.argv.includes('--check');
const abs = join(root, OUT);

if (check) {
  if (!existsSync(abs)) {
    console.error(`${OUT} отсутствует — запустите npm run docs:props`);
    process.exit(1);
  }
  if (readFileSync(abs, 'utf8') !== content) {
    console.error(`${OUT} устарел — запустите npm run docs:props`);
    process.exit(1);
  }
  console.log(`${OUT} актуален (${blocks.length} интерфейсов)`);
} else {
  writeFileSync(abs, content, 'utf8');
  console.log(`${OUT} собран: ${blocks.length} интерфейсов, ${content.length} символов`);
}
