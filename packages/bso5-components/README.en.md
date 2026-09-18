# bso5-components

Reusable **headless data components** built on [bso5](../bso5): a generic data
`Grid` and a collapsible `Tree`. Bring your own data (any reactive source) and
your own CSS — the components render semantic markup with stable class names.

Requires `bso5` (v0.3+) as a **peer dependency**. Install both:

```bash
npm install bso5 bso5-components
```

## Why peer dependency?

The components share bso5's module-scoped `REACTIVE_VALUE` symbol: two copies
of bso5 in one bundle would produce two different symbols, silently breaking
`$()`-bound values. Keep exactly one copy — hence the peer dependency.

## Components

### `<Grid<Row>>`

A filterable, sortable, optionally groupable table. Generic over your row
type; every aspect is a prop:

```tsx
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

interface Issue { id: number; title: string; project: string; severity: 'critical' | 'high' | 'medium' | 'low'; }

const COLUMNS: Column<Issue>[] = [
  { key: 'id',   header: 'ID',   sort: r => r.id,   cell: r => r.id },
  { key: 'title', header: 'Title', sort: r => r.title, cell: r => r.title },
  { key: 'severity', header: 'Sev', sort: r => r.severity, cell: r => r.severity },
];

// Any data source a `<For>` understands — here a live signal:
const issues = signal(ISSUES);
<Grid<Issue> rows={issues} columns={COLUMNS} groupBy={r => r.project} rowKey={r => r.id} />
```

| Prop | Purpose |
| --- | --- |
| `rows` | Data source: array, `() => array`, `Signal` or `$()`-bound value |
| `columns` | `Column<Row>[]` — `header`/`cell`/`sort` per column (`sort` also feeds the default search) |
| `filter` | Custom search predicate (defaults to searching `sort(row)` values) |
| `groupBy` | `(row) => group label \| null` — `null` rows land before the groups |
| `initialSort` | `{ key, dir }` initial sort state |
| `rowKey` | Stable key → keyed `<For>` (DOM reuse, focus preservation) |
| `searchPlaceholder` / `empty` / `class` | Cosmetic tweaks |

UI state (query, sort, collapsed groups) is internal per instance — render two
`<Grid>`s and they never interfere.

### `<Tree>`

A collapsible tree with search. Feed the **final** tree in; sorting, async
loads and deriving a tree from flat data are your `effect()`/`signal()` job
(the example below does exactly that).

```tsx
import { Tree } from 'bso5-components';
import type { TreeData } from 'bso5-components';

// Sort or transform your tree before handing it in — e.g. by child count:
const root = signal<TreeData | null>(TREE);
<Tree root={root} searchPlaceholder="Filter files…" />
```

| Prop | Purpose |
| --- | --- |
| `root` | Tree source: object, `() => object`, `Signal` or `$()`-bound value |
| `renderLabel` | Custom label renderer |
| `nodeKey` | Stable node key (defaults to the node path) |
| `searchPlaceholder` / `empty` / `class` | Cosmetic tweaks |

While searching, matching branches auto-expand and matches are highlighted
(class `match`).

## Styling

Both components are headless: they emit `toolbar`, `search`, `chip`,
`grid`/`table`/`th`/`td`/`group-row`, `tree`/`node`/`row`/`caret`/`name`/`meta`/`kids`
and `empty` classes. The [dataview example](../../examples/dataview) styles
all of them in one CSS file — copy `style.css` as a starting point.

## Development

```bash
npm run build    # tsc → dist/ (both packages)
npm test         # vitest (jsdom), tests of both packages
npm run typecheck
```

MIT.
