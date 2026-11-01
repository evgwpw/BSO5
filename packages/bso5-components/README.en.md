# bso5-components

Reusable **headless data components** built on [bso5](../bso5): a generic data
`Grid` and a collapsible `Tree`. Bring your own data (any reactive source) and
your own CSS — the components render semantic markup with stable class names.

**~2.5 kB min+gzip** · zero dependencies (besides the `bso5` peer)

[Русская версия](./README.md)

Requires `bso5` (v0.4+) as a **peer dependency**. Install both:

```bash
npm install bso5 bso5-components
```

## Why a peer dependency?

The components share bso5's module-scoped `REACTIVE_VALUE` symbol: two copies
of bso5 in one bundle would produce two different symbols, silently breaking
`$()`-bound values. Keep exactly one copy — hence the peer dependency.

Working on the package itself requires Node ≥ 22.12 (vitest 5).

## `<Grid>`

```tsx
import { signal } from 'bso5';
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

interface Issue { id: number; title: string; severity: string; project: string }

const COLS: Column<Issue>[] = [
  { key: 'id',    header: 'ID',    sort: it => it.id,    cell: it => it.id },
  { key: 'title', header: 'Title', sort: it => it.title, cell: it => it.title },
  {
    key: 'severity',
    header: 'Sev',
    sort: it => it.severity,
    cell: it => <span class="sev">{it.severity}</span>,
    class: 'sev-cell',
  },
];

const issues = signal<Issue[]>(ISSUES);

<Grid
  rows={issues}                            // array | () => array | Signal | $()
  columns={COLS}
  groupBy={it => it.project}               // optional; null = ungrouped
  initialSort={{ key: 'id', dir: 'desc' }} // optional
  rowKey={it => it.id}                     // optional, enables keyed mode
  searchPlaceholder="Search…"
  empty="Nothing found."
/>
```

**Props `GridProps<Row>`:**

| Prop | Type | Description |
| --- | --- | --- |
| `rows` | `ReactiveSource<readonly Row[]>` | Array, `() => array` thunk (re-read, tracked), `Signal` or `$()` |
| `columns` | `readonly Column<Row>[]` | See below |
| `filter?` | `(row: Row, loweredQuery: string) => boolean` | Custom search matcher; the query is already lower-cased. Default: substring match over `sort(row)` of every column |
| `groupBy?` | `(row: Row) => string \| null` | Group label; `null` keeps the row ungrouped (rendered before the groups) |
| `initialSort?` | `{ key: string; dir: 'asc' \| 'desc' }` | Initial sort; reflected in the direction control |
| `rowKey?` | `(row: Row) => unknown` | Stable row key, enables keyed `<For>`. Called with the row **only** — the index is not part of the key, otherwise sorting would recreate every node |
| `searchPlaceholder?` | `string` | Search placeholder (also `aria-label`) |
| `empty?` | `string` | Empty-state text |
| `class?` | `string` | Extra class for the root (default `grid`) |

**Column `Column<Row>`:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `key` | `string` | yes | Stable id; remembers which column is sorted |
| `header` | `string` | yes | `th` label |
| `cell` | `(row: Row) => JsxChild` | yes | Cell renderer; may return `$()` values |
| `sort` | `(row: Row) => string \| number` | yes | Sort value (and default search text) |
| `sortable?` | `boolean` | no | Header click sorts (default `true`) |
| `class?` | `string` | no | Extra `td` class |
| `headerClass?` | `string` | no | Extra `th` class |

**Keyboard and ARIA:** headers get `scope="col"` and `aria-sort`
(`ascending`/`descending` on the active column only); a group row is
`tabindex="0"` with `aria-expanded` and toggles on Enter/Space; the search box
has an `aria-label`.

## `<Tree>`

```tsx
import { signal } from 'bso5';
import { Tree } from 'bso5-components';
import type { TreeData } from 'bso5-components';

const tree = signal<TreeData>({
  label: 'bso5',
  meta: '7 items',
  children: [
    { label: 'src', meta: '6 items', children: [
      { label: 'index.ts', meta: '412 B', children: null },
    ]},
  ],
});

<Tree root={tree} searchPlaceholder="Filter…" />
```

**Props `TreeProps`:**

| Prop | Type | Description |
| --- | --- | --- |
| `root` | `ReactiveSource<TreeData \| null>` | Object, `() => object`, `Signal` or `$()` |
| `searchPlaceholder?` | `string` | Search placeholder (also `aria-label`) |
| `empty?` | `string` | Text when the tree is empty or filtered to nothing |
| `nodeKey?` | `(node: TreeData, path: string[]) => unknown` | Expansion key. Default: the `label/label/…` path |
| `renderLabel?` | `(node: TreeData) => JsxChild` | Custom label renderer (icons, links, handlers) |
| `class?` | `string` | Extra class for the root `.tree` |

**`TreeData`:** `label: string`, `meta?: string`, `children?: readonly TreeData[] | null`,
`labelClass?: string`.

**Keyboard and ARIA:** the root is `role="tree"`, a node is `role="treeitem"` with
`aria-expanded`, children are a `role="group"`; a row is focusable and reacts to
Enter/Space (toggle), `ArrowRight` (expand), `ArrowLeft` (collapse).

## Classes and CSS

- `Grid`: `grid`, `toolbar`, `search`, `dir`, `chip`, `arrow`, `group-row`, `toggle`, `count`, `empty`;
- `Tree`: `tree`, `toolbar`, `search`, `chip`, `node`, `row`, `caret`, `leaf`, `name`, `dir`, `match`, `meta`, `kids`, `empty`.

Ready-made CSS: [`examples/dataview/style.css`](../../examples/dataview/style.css).
Markup map, minimal CSS and data-adaptation recipes: [`docs/TREE_GRID.md`](../../docs/TREE_GRID.md).

## Keyed mode: key = identity

With `rowKey`, `<For>` reuses DOM nodes: while a key stays in the list, its node is
**not re-rendered**, so data changes inside an existing row do not show up by
themselves. Two working recipes:

```tsx
// 1) bind the field with $() — a point update, the node survives
{ key: 'title', header: 'Title', sort: r => r.title, cell: r => <b>{$(r, x => x.title)}</b> }

// 2) fingerprint key — the node is recreated only when the data really changed
rowKey={r => `${r.id}:${r.updated}`}
```

The first keeps focus in an `<input>`; the second is simpler but loses node state
on every change. Without `rowKey` the grid re-renders rows wholesale — correct,
but more expensive.

## Development

```bash
npm ci              # at the monorepo root
npm test            # 161 tests (core + components)
npm run typecheck
npm run build
npm run bench       # grid/tree timings
```

## License

MIT
