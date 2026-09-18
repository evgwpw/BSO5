/**
 * BSO5 dataview example: a reactive issues grid and a file tree.
 *
 * Demonstrates the split installation story:
 * - `bso5` — the reactive core (signals, `Reactive`, `$()`);
 * - `bso5-components` — reusable `<Grid>` / `<Tree>` (peer dependency);
 * - the example only supplies data, column definitions, a `FileNode →
 *   TreeData` adapter and the tree **sort** (a plain `effect()` derivation —
 *   transformations stay with the data owner, not the component).
 *
 * РУС: Пример dataview для BSO5: реактивная таблица задач и файловое дерево.
 *
 * РУС: Демонстрирует раздельную установку:
 * РУС: - `bso5` — реактивное ядро (сигналы, `Reactive`, `$()`);
 * РУС: - `bso5-components` — переиспользуемые `<Grid>` / `<Tree>` (peer dependency);
 * РУС: - пример лишь поставляет данные, определения колонок, адаптер
 *   `FileNode → TreeData` и **сортировку** дерева (обычная деривация через
 *   `effect()` — трансформации остаются у владельца данных, не у компонента).
 */
import { effect, signal } from 'bso5';
import { Grid, Tree } from 'bso5-components';
import type { Column, TreeData } from 'bso5-components';

/* ── data ──────────────────────────────────────────────────── */
/* РУС: данные */

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface Issue {
  id: number;
  title: string;
  project: string;
  assignee: string;
  severity: Severity;
  points: number;
  updated: string;
}

const ISSUES: Issue[] = [
  { id: 4101, title: 'Login fails on Safari 17', project: 'Web App', assignee: 'Anna', severity: 'critical', points: 8, updated: '2026-09-14' },
  { id: 4102, title: 'Flaky e2e: checkout flow', project: 'Web App', assignee: 'Mark', severity: 'high', points: 5, updated: '2026-09-13' },
  { id: 4103, title: 'Dark mode contrast audit', project: 'Web App', assignee: 'Anna', severity: 'low', points: 2, updated: '2026-09-10' },
  { id: 4104, title: 'API returns 500 on empty cart', project: 'Web App', assignee: 'Igor', severity: 'critical', points: 8, updated: '2026-09-15' },
  { id: 4201, title: 'Migration stalls on pg 14', project: 'Backend', assignee: 'Igor', severity: 'high', points: 13, updated: '2026-09-12' },
  { id: 4202, title: 'Add request tracing', project: 'Backend', assignee: 'Lena', severity: 'medium', points: 5, updated: '2026-09-08' },
  { id: 4203, title: 'Rate limiter leaks buckets', project: 'Backend', assignee: 'Mark', severity: 'high', points: 8, updated: '2026-09-15' },
  { id: 4204, title: 'Deprecate v1 endpoints', project: 'Backend', assignee: 'Lena', severity: 'low', points: 3, updated: '2026-09-01' },
  { id: 4301, title: 'Tree shaking misses plugins', project: 'CLI', assignee: 'Mark', severity: 'medium', points: 5, updated: '2026-09-11' },
  { id: 4302, title: 'Windows path separators', project: 'CLI', assignee: 'Anna', severity: 'critical', points: 3, updated: '2026-09-14' },
  { id: 4303, title: 'Help text typos', project: 'CLI', assignee: 'Igor', severity: 'low', points: 1, updated: '2026-08-28' },
  { id: 4401, title: 'Crash on import of >2GB dump', project: 'Desktop', assignee: 'Lena', severity: 'critical', points: 13, updated: '2026-09-15' },
  { id: 4402, title: 'Memory leak in renderer', project: 'Desktop', assignee: 'Mark', severity: 'high', points: 8, updated: '2026-09-13' },
  { id: 4403, title: 'Auto-update prompt loops', project: 'Desktop', assignee: 'Anna', severity: 'medium', points: 2, updated: '2026-09-09' },
  { id: 4404, title: 'Add ARM builds', project: 'Desktop', assignee: 'Igor', severity: 'medium', points: 5, updated: '2026-09-05' },
];

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

/* ── grid: columns are plain data — the generic Grid does the rest ── */
/* РУС: грид: колонки — обычные данные, остальное делает генерик-Grid */

function SevBadge(props: { severity: Severity }) {
  return <span class={`sev ${props.severity}`}>{props.severity}</span>;
}

const COLS: Column<Issue>[] = [
  { key: 'id', header: 'ID', class: 'mono muted', sort: it => it.id, cell: it => it.id },
  { key: 'title', header: 'Title', sort: it => it.title, cell: it => it.title },
  { key: 'severity', header: 'Sev', sort: it => SEV_ORDER[it.severity], cell: it => <SevBadge severity={it.severity} /> },
  { key: 'points', header: 'Pts', class: 'mono', sort: it => it.points, cell: it => it.points },
  { key: 'assignee', header: 'Assignee', sort: it => it.assignee, cell: it => it.assignee },
  { key: 'project', header: 'Project', sort: it => it.project, cell: it => it.project },
  { key: 'updated', header: 'Updated', class: 'mono muted', sort: it => it.updated, cell: it => it.updated },
];

const issues = signal(ISSUES);

/* ── tree: FileNode → TreeData adapter + external sort ─────── */
/* РУС: дерево: адаптер FileNode → TreeData + внешняя сортировка */

interface FileNode {
  name: string;
  size?: number;   // bytes, files only — байты, только файлы
  kids?: FileNode[];
}

const TREE: FileNode = {
  name: 'bso5',
  kids: [
    {
      name: 'src',
      kids: [
        { name: 'index.ts', size: 412 },
        { name: 'reactive.ts', size: 3712 },
        { name: 'dom.ts', size: 5201 },
        { name: 'jsx-runtime.ts', size: 2890 },
        { name: 'control.ts', size: 2048 },
        {
          name: 'internal',
          kids: [
            { name: 'symbols.ts', size: 156 },
            { name: 'util.ts', size: 987 },
          ],
        },
      ],
    },
    {
      name: 'tests',
      kids: [
        { name: 'reactive.test.ts', size: 4460 },
        { name: 'dom.test.ts', size: 5980 },
        { name: 'jsx.test.tsx', size: 3710 },
      ],
    },
    {
      name: 'examples',
      kids: [
        { name: 'counter', kids: [{ name: 'main.tsx', size: 1830 }] },
        { name: 'dataview', kids: [{ name: 'main.tsx', size: 9200 }] },
      ],
    },
    { name: 'package.json', size: 1204 },
    { name: 'README.md', size: 8930 },
    { name: 'LICENSE', size: 1070 },
  ],
};

function totalSize(node: FileNode): number {
  return node.size ?? (node.kids ?? []).reduce((s, k) => s + totalSize(k), 0);
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

/** Maps a FileNode into the component's TreeData shape (label + meta + kids). */
/** РУС: Отображает FileNode в форму TreeData компонента (метка + мета + дети). */
function toTreeData(node: FileNode): TreeData {
  const kids = node.kids ?? [];
  return {
    label: node.name,
    meta: kids.length > 0
      ? `${kids.length} ${kids.length === 1 ? 'item' : 'items'}, ${fmtSize(totalSize(node))}`
      : fmtSize(node.size ?? 0),
    children: kids.length > 0 ? kids.map(toTreeData) : null,
  };
}

/** The sort stays with the data owner: a plain `effect()` derivation. */
/** РУС: Сортировка остаётся у владельца данных: обычная деривация через `effect()`. */
const treeSort = signal<'name' | 'size'>('name');
const treeData = signal<TreeData>(toTreeData(TREE));

effect(() => {
  const mode = treeSort.value;
  const sortNode = (n: FileNode): FileNode => {
    if (!n.kids) return n;
    const kids = n.kids
      .map(sortNode)
      .sort((a, b) => mode === 'size'
        ? totalSize(b) - totalSize(a)
        : a.name.localeCompare(b.name));
    return { ...n, kids };
  };
  treeData.value = toTreeData(sortNode(TREE));
});

/* ── app ───────────────────────────────────────────────────── */
/* РУС: приложение */

function App() {
  return (
    <div class="layout">
      <header>
        <h1>BSO5 DataView <small>— reactive grid &amp; tree, no framework</small></h1>
        <p class="subtitle">
          Grid and Tree come from <code>bso5-components</code> (a peer package);
          data, columns, adapters and derivations stay here. Filter, sort and
          group inside <code>&lt;Grid&gt;</code> are its own <code>effect()</code>{' '}
          derivations over <code>signal()</code>s.
        </p>
      </header>

      <section class="card">
        <h2>Issues grid <span class="tag">filter · sort · group · collapse</span></h2>
        <Grid
          rows={issues}
          columns={COLS}
          groupBy={it => it.project}
          initialSort={{ key: 'updated', dir: 'desc' }}
          rowKey={it => it.id}
          searchPlaceholder="Search: id, title, project, assignee…"
          empty="No rows match the current filter."
        />
      </section>

      <section class="card">
        <h2>File tree <span class="tag">recursive components · search · auto-expand</span></h2>
        <Tree root={treeData} searchPlaceholder="Filter files by name…" />
        <select onChange={e => { treeSort.value = (e.target as HTMLSelectElement).value as 'name' | 'size'; }}>
          <option value="name">Sort: name</option>
          <option value="size">Sort: size</option>
        </select>
        <p class="footer-note">
          While the filter is active, branches auto-expand and matches are highlighted; sorting by
          <code> size</code> orders directories by the recursive sum of nested file sizes.
        </p>
      </section>
    </div>
  );
}

document.getElementById('app')!.appendChild(<App />);

