Раздел 9 справочника · Источник: [API.md](../API.md)

## Компоненты: `<Grid>`

```ts
function Grid<Row>(props: GridProps<Row>): HTMLElement;
```

Грид: фильтр → сортировка → группировка, состояние внутри экземпляра.

```ts
interface GridProps<Row> {
  rows: ReactiveSource<readonly Row[]>;
  columns: readonly Column<Row>[];
  filter?: (row: Row, loweredQuery: string) => boolean;
  groupBy?: (row: Row) => string | null;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowKey?: (row: Row) => unknown;
  searchPlaceholder?: string;
  searchDebounce?: number | false;      // по умолчанию 120 мс
  searchDebounceMinItems?: number;      // по умолчанию 200 строк
  empty?: string;
  labels?: Partial<GridLabels>;
  class?: string;                       // корень, по умолчанию 'grid'
}

interface Column<Row> {
  key: string;                          // id колонки, запоминается сортировка
  header: string;
  cell: (row: Row) => JsxChild;
  sort: (row: Row) => string | number;  // значение сортировки и текст для поиска
  sortable?: boolean;                   // по умолчанию true
  class?: string;                       // класс td
  headerClass?: string;                 // класс th
}

interface GridLabels {
  search?: string;           // aria-label поиска, 'Search'
  searchPlaceholder?: string;// 'Search…'
  sortDirection?: string;    // aria-label контрола, 'Sort direction'
  descending?: string;       // '↓ desc'
  ascending?: string;        // '↑ asc'
  rows?: string;             // префикс счётчика, 'rows:'; '' — только число
}
```

**Поведение:**

- Поиск по умолчанию — подстрока (без учёта регистра) в `String(sort(row))` любой
  колонки; свой матчер задаётся `filter(row, loweredQuery)` (`loweredQuery` уже в нижнем регистре).
- Сортировка: клик по `th` → по убыванию; повторный клик по той же колонке меняет
  направление; `sortable: false` отключает. Колонка одна.
- Группировка: порядок групп — по первому вхождению в отсортированном списке;
  `groupBy` → `null` даёт негруппированный бакет перед группами.
- `rowKey` включает keyed-режим: при сортировке узлы переставляются, а не пересоздаются.
  **Ячейки существующих строк не обновляются** — см. §11 «ключ = идентичность».
- Счётчик показывает число строк после фильтра (свёрнутые группы всё равно считаются).
- Дебаунс поиска включается только от `searchDebounceMinItems` строк; `searchDebounce: false`
  отключает его целиком.

**Доступность:** `th[scope=col]`, `aria-sort` у активной колонки, строка группы —
`tabindex="0"` + `aria-expanded`, переключение по Enter/Space, `aria-label` у поиска
и контрола направления.
