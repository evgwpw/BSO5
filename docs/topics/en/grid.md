Reference section 9 · Source: [API.en.md](../../API.en.md)

## Components: `<Grid>`

```ts
function Grid<Row>(props: GridProps<Row>): HTMLElement;
```

A grid: filter → sort → group, with state local to the instance.

```ts
interface GridProps<Row> {
  rows: ReactiveSource<readonly Row[]>;
  columns: readonly Column<Row>[];
  filter?: (row: Row, loweredQuery: string) => boolean;
  groupBy?: (row: Row) => string | null;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowKey?: (row: Row) => unknown;
  searchPlaceholder?: string;
  searchDebounce?: number | false;      // 120 ms by default
  searchDebounceMinItems?: number;      // 200 rows by default
  empty?: string;
  labels?: Partial<GridLabels>;
  class?: string;                       // root, 'grid' by default
}

interface Column<Row> {
  key: string;                          // column id, remembers the active sort
  header: string;
  cell: (row: Row) => JsxChild;
  sort: (row: Row) => string | number;  // sort value and default search text
  sortable?: boolean;                   // default true
  class?: string;                       // td class
  headerClass?: string;                 // th class
}

interface GridLabels {
  search?: string;           // search aria-label, 'Search'
  searchPlaceholder?: string;// 'Search…'
  sortDirection?: string;    // control aria-label, 'Sort direction'
  descending?: string;       // '↓ desc'
  ascending?: string;        // '↑ asc'
  rows?: string;             // counter prefix, 'rows:'; '' keeps the number only
}
```

**Behaviour:**

- Default search is a case-insensitive substring over `String(sort(row))` of every
  column; a custom matcher is `filter(row, loweredQuery)` (`loweredQuery` is already
  lower-cased).
- Sorting: clicking a `th` sorts descending; clicking the same column again flips the
  direction; `sortable: false` disables it. One column at a time.
- Grouping: group order follows first occurrence in the sorted list; `groupBy` → `null`
  produces an ungrouped bucket rendered before the groups.
- `rowKey` enables the keyed mode: sorting moves nodes instead of recreating them.
  **Cells of existing rows are not updated** — see §11 "key = identity".
- The counter shows the number of rows after filtering (collapsed groups are still counted).
- Search debounce kicks in only from `searchDebounceMinItems` rows; `searchDebounce: false`
  disables it entirely.

**Accessibility:** `th[scope=col]`, `aria-sort` on the active column, the group row is
`tabindex="0"` with `aria-expanded` and toggles on Enter/Space, `aria-label` on the
search box and on the direction control.
