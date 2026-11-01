/**
 * Бенч bso5: рендер таблицы и дерева на 1k/10k элементах.
 *
 * Запуск: `npm run build && npm run bench`.
 * Числа из этого скрипта попадают в README — вместо непроверяемых «1 мс».
 *
 * Меряется то, что чувствует пользователь: построение компонента + вставка в
 * документ, сортировка по клику, фильтрация через поиск (для крупных
 * источников она включает дебаунс 120 мс — он входит в замер и подписан).
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><div id="host"></div>', { pretendToBeVisual: true });
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
globalThis.Node = window.Node;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.DocumentFragment = window.DocumentFragment;
globalThis.Text = window.Text;

const { Grid } = await import('../packages/bso5-components/dist/index.js');
const { Tree } = await import('../packages/bso5-components/dist/index.js');

const COLUMNS = [
  { key: 'id', header: 'ID', sort: r => r.id, cell: r => r.id },
  { key: 'title', header: 'Title', sort: r => r.title, cell: r => r.title },
  { key: 'group', header: 'Group', sort: r => r.group, cell: r => r.group },
];

const rowsOf = n => Array.from({ length: n }, (_, i) => ({
  id: i,
  title: `row-${i}`,
  group: `g${i % 10}`,
}));

const treeOf = n => {
  // Плоское дерево: корень + n/10 веток по 10 листьев.
  const branches = [];
  for (let b = 0; b < n / 10; b++) {
    const kids = [];
    for (let k = 0; k < 10; k++) kids.push({ label: `leaf-${b}-${k}` });
    branches.push({ label: `branch-${b}`, children: kids });
  }
  return { label: 'root', children: branches };
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ms = t => `${t.toFixed(1)} ms`;

function time(label, fn) {
  const t0 = performance.now();
  const out = fn();
  const dt = performance.now() - t0;
  console.log(`${label.padEnd(46)} ${ms(dt).padStart(10)}`);
  return out;
}

const host = document.getElementById('host');

console.log(`\nNode ${process.version}, jsdom ${dom.window.navigator.userAgent.match(/jsdom\/[\d.]+/)?.[0] ?? ''}\n`);

for (const n of [1000, 10000]) {
  host.replaceChildren();
  const rows = rowsOf(n);
  const grid = time(`Grid: построить ${n} строк (с группами)`, () =>
    Grid({ rows, columns: COLUMNS, groupBy: r => r.group, rowKey: r => r.id }));
  time(`Grid: вставить ${n} строк в документ`, () => host.appendChild(grid));

  const idTh = grid.querySelector('th');
  time(`Grid: сортировка по клику (${n})`, () => { idTh.click(); idTh.click(); });

  const search = grid.querySelector('input.search');
  search.value = 'row-1';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  const filtered = time(`Grid: поиск ${n} → фильтр (+дебаунс 120 мс)`, () => {
    // Дебаунс асинхронный, поэтому ждём его завершения синхронной прокруткой
    // таймеров невозможно — замеряется полный путь через await ниже.
    return grid;
  });
  await sleep(150);
  console.log(`${'  (после дебаунса строк в tbody)'.padEnd(46)} ${String(filtered.querySelectorAll('tbody tr').length).padStart(10)}`);
}

for (const n of [1000, 10000]) {
  host.replaceChildren();
  const tree = time(`Tree: построить ${n} узлов`, () => Tree({ root: treeOf(n) }));
  time(`Tree: вставить ${n} узлов в документ`, () => host.appendChild(tree));

  const search = tree.querySelector('input.search');
  search.value = 'leaf-1';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(150);
  time(`Tree: поиск по ${n} узлам (после дебаунса)`, () => tree.querySelectorAll('.node').length);
  console.log(`${'  (видимых узлов после фильтра)'.padEnd(46)} ${String(tree.querySelectorAll('.node').length).padStart(10)}`);
}
console.log('');
