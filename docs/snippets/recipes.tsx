/**
 * Компилируемые копии кода из docs/GUIDE.md.
 *
 * Файл входит в `npm run typecheck`: если API изменится, а рецепт — нет,
 * проверка типов упадёт. Проза остаётся в GUIDE.md, код здесь.
 */
import {
  For, Reactive, Show, computed, effect, mount, onScopeDispose, setEffectErrorHandler,
  signal, $,
} from 'bso5';
import type { BoundValue } from 'bso5';
import { Grid, Tree } from 'bso5-components';
import type { Column, TreeData } from 'bso5-components';

/* ── 1. Счётчик и поле ввода ───────────────────────────────── */

const count = signal(0);

export function counter(): Node {
  return (
    <main>
      <button onClick={() => count.update(n => n - 1)}>−</button>
      <output>{$(count)}</output>
      <button onClick={() => count.update(n => n + 1)}>+</button>
    </main>
  );
}

const name = signal('');

export const field: HTMLElement = (
  <input
    value={$(name)}
    onInput={e => { name.value = (e.target as HTMLInputElement).value; }}
  />
) as HTMLElement;

/* ── 2. Список ─────────────────────────────────────────────── */

const history = signal<string[]>([]);

export function listUnkeyed(): Node {
  return <ul><For each={$(history)}>{item => <li>{item}</li>}</For></ul>;
}

interface Row { id: number; name: string }
const model = new Reactive<{ rows: Row[] }>({ rows: [] });

export function listKeyed(): Node {
  return (
    <ul>
      <For each={() => model.value.rows} key={row => row.id}>
        {row => <li>#{row.id} <input value={$(row, x => x.name)} /></li>}
      </For>
    </ul>
  );
}

const keyedRows = signal<Row[]>([]);

export function listWithFingerprintKey(): Node {
  return (
    <ul>
      <For each={() => keyedRows.value} key={row => `${row.id}:${row.name}`}>
        {row => <li>{row.name}</li>}
      </For>
    </ul>
  );
}

/* ── 3. Условия и вкладки ──────────────────────────────────── */

const tab = signal<'list' | 'stats'>('list');

function List(): Node { return <ul />; }
function Stats(): Node { return <p />; }

export function tabs(): Node {
  return (
    <div>
      <nav>
        <button onClick={() => { tab.value = 'list'; }}>Список</button>
        <button onClick={() => { tab.value = 'stats'; }}>Статистика</button>
      </nav>
      {/* танки: при переключении старая ветка снимается целиком */}
      <Show when={() => tab.value === 'list'} fallback={() => <Stats />}>
        {() => <List />}
      </Show>
    </div>
  );
}

/* ── 5. Загрузка данных ────────────────────────────────────── */

interface Issue { id: number; title: string }

const issues = signal<Issue[]>([]);
const loading = signal(false);
const error = signal<string | null>(null);

export async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/issues');
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    issues.value = await res.json() as Issue[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

export function loadStates(): Node {
  return (
    <Show when={() => loading.value} fallback={() => (
      <Show when={() => error.value !== null} fallback={() => <ul />}>
        {() => <p class="error">{$(error)}</p>}
      </Show>
    )}>
      {() => <p>Загрузка…</p>}
    </Show>
  );
}

/* ── 6. Производные значения ───────────────────────────────── */

const numbers = signal<number[]>([]);
const total = computed(() => numbers.value.reduce((s, n) => s + n, 0));
const isEmpty: BoundValue<boolean> = $(computed(() => numbers.value.length === 0));

export function derived(): Node {
  return <p>{$(total)}{isEmpty ? '' : ''}</p>;
}

/* ── 7. Своя вью с жизненным циклом ────────────────────────── */

export function mountApp(target: Element): { node: Node; dispose: () => void } {
  return mount(target, () => {
    const seconds = signal(0);
    const timer = setInterval(() => seconds.update(n => n + 1), 1000);
    effect(() => console.log('тик', seconds.value));
    onScopeDispose(() => clearInterval(timer));
    return <p>{$(seconds)}</p>;
  });
}

/* ── 8. Грид ───────────────────────────────────────────────── */

interface GridIssue { id: number; title: string; project: string; severity: string }

const gridModel = new Reactive<{ issues: GridIssue[] }>({ issues: [] });

const COLS: Column<GridIssue>[] = [
  { key: 'id', header: 'ID', sort: i => i.id, cell: i => i.id },
  { key: 'title', header: 'Задача', sort: i => i.title, cell: i => <b>{$(i, x => x.title)}</b> },
  { key: 'severity', header: 'Важность', sort: i => i.severity, cell: i => i.severity },
];

export function issueGrid(): HTMLElement {
  return Grid({
    rows: () => gridModel.value.issues,
    columns: COLS,
    groupBy: i => i.project,
    rowKey: i => i.id,
    searchPlaceholder: 'Поиск по задачам',
    labels: { rows: 'строк:', descending: 'убыв', ascending: 'возр' },
    empty: 'Ничего не найдено',
  });
}

/* ── 9. Дерево ─────────────────────────────────────────────── */

interface FileNode { path: string; name: string; size?: number; children?: FileNode[] }

const files = signal<FileNode[]>([]);

const toTreeData = (nodes: FileNode[]): TreeData[] =>
  nodes
    .slice()
    .sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name))
    .map(n => ({
      label: n.name,
      meta: n.size === undefined ? undefined : `${n.size} B`,
      children: n.children?.length ? toTreeData(n.children) : null,
    }));

const treeRoot = computed<TreeData | null>(() =>
  files.value.length ? { label: 'root', children: toTreeData(files.value) } : null);

export function fileTree(): HTMLElement {
  return Tree({
    root: treeRoot,
    nodeKey: node => node.label,
    showExpandAll: true,
    labels: { matched: 'найдено:', expandAll: 'Развернуть', collapseAll: 'Свернуть' },
    searchPlaceholder: 'Фильтр по имени или размеру',
  });
}

/* ── 10. Ошибки в эффектах ─────────────────────────────────── */

export function errorHandling(): void {
  effect(() => { /* riskyRendering() */ }, { onError: err => console.error(String(err)) });
  setEffectErrorHandler(err => console.error('[bso5]', err));
  setEffectErrorHandler(null);
}
