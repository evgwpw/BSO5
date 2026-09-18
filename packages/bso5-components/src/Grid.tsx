/**
 * bso5-components — a generic data Grid on top of the bso5 runtime.
 *
 * `Grid<Row>` renders any list of rows with a search box, sortable columns,
 * optional grouping with collapsible group rows and an empty state. The data
 * source is any `ReactiveSource` (plain array, `() => array` thunk, `Signal`
 * or a `$()`-bound value) — the grid re-derives filter → sort → group on every
 * change. All UI state (query, sort key/direction, collapsed groups) lives
 * inside the component instance, so two `<Grid>`s are fully independent.
 *
 * The component is **headless**: it renders semantic markup with stable class
 * names (`grid`, `toolbar`, `search`, `group-row`, `empty`, …) and leaves all
 * styling to the consumer.
 *
 * РУС: bso5-components — генерик-грид данных поверх рантайма bso5.
 *
 * РУС: `Grid<Row>` рендерит любой список строк с поиском, сортируемыми
 * колонками, опциональной группировкой со сворачиваемыми групповыми строками
 * и пустым состоянием. Источник данных — любой `ReactiveSource` (обычный
 * массив, `() => array`-танка, `Signal` или `$()`-значение) — грид
 * пересчитывает фильтр → сортировку → группировку при каждом изменении. Всё
 * UI-состояние (запрос, ключ/направление сортировки, свёрнутые группы) живёт
 * внутри инстанса компонента, поэтому два `<Grid>` полностью независимы.
 *
 * РУС: Компонент **headless**: он рендерит семантическую разметку со
 * стабильными именами классов (`grid`, `toolbar`, `search`, `group-row`,
 * `empty`, …) и оставляет всю стилизацию потребителю.
 *
 * @module
 */
import { For, Show, $, effect, resolveSource, signal } from 'bso5';
import type { ReactiveSource, JsxChild } from 'bso5';

/* ── public types ──────────────────────────────────────────── */
/* РУС: публичные типы */

/**
 * Column definition: header label, per-cell renderer and the value used for
 * sorting (and, optionally, plain-text filtering).
 *
 * РУС: Определение колонки: заголовок, рендер ячейки и значение для
 * сортировки (и, опционально, текстовой фильтрации).
 */
export interface Column<Row> {
  /** Stable column id, used to remember which column is sorted. (РУС: Стабильный id колонки — по нему помнится, что отсортировано.) */
  key: string;
  /** Header cell label. (РУС: Надпись в заголовке.) */
  header: string;
  /** Cell renderer; may return reactive bound values. (РУС: Рендер ячейки; может возвращать реактивные привязанные значения.) */
  cell: (row: Row) => JsxChild;
  /** Sort accessor: the value to compare rows by. (РУС: Аксессор сортировки: значение для сравнения строк.) */
  sort: (row: Row) => string | number;
  /** Extra class for the `td`. Optional. (РУС: Дополнительный класс для `td`. Необязателен.) */
  class?: string;
  /** Extra class for the `th`. Optional. (РУС: Дополнительный класс для `th`. Необязателен.) */
  headerClass?: string;
  /** Whether clicking the header sorts by this column (default: true). (РУС: Сортирует ли клик по заголовку по этой колонке (по умолчанию: true).) */
  sortable?: boolean;
}

/** Props of {@link Grid}. (РУС: Пропсы {@link Grid}.) */
export interface GridProps<Row> {
  /** Data source: array, thunk, `Signal` or `$()`-bound value. (РУС: Источник данных: массив, танка, `Signal` или `$()`-значение.) */
  rows: ReactiveSource<readonly Row[]>;
  /** Column definitions. (РУС: Определения колонок.) */
  columns: readonly Column<Row>[];
  /**
   * Plain-text filter predicate. The default searches `sort(row)` values.
   * (РУС: Предикат текстового фильтра. По умолчанию ищет по значениям `sort(row)`.)
   */
  filter?: (row: Row, loweredQuery: string) => boolean;
  /**
   * Groups rows by the returned label; return `null` for no grouping for that
   * row (it lands in an ungrouped bucket rendered before the groups).
   * (РУС: Группирует строки по возвращённой метке; `null` — строка без группы,
   * попадает в негруппированный бакет, рендеримый перед группами.)
   */
  groupBy?: (row: Row) => string | null;
  /** Initial sort column key and direction. Optional. (РУС: Начальная колонка сортировки и направление. Необязательно.) */
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  /** Stable row key for keyed `<For>` (DOM-node reuse). Optional. (РУС: Стабильный ключ строки для keyed-`<For>` (переиспользование DOM-узлов). Необязателен.) */
  rowKey?: (row: Row, index: number) => unknown;
  /** Search box placeholder. (РУС: Плейсхолдер строки поиска.) */
  searchPlaceholder?: string;
  /** Text shown when no rows match. Optional. (РУС: Текст при отсутствии строк. Необязательно.) */
  empty?: string;
  /** Extra class for the root element. (РУС: Дополнительный класс корневого элемента.) */
  class?: string;
}

/* ── internal derived row shape ────────────────────────────── */
/* РУС: внутренняя форма производной строки */

type GridRow<Row> =
  | { kind: 'group'; key: string; rows: Row[] }
  | { kind: 'item'; row: Row; index: number };

/* ── Grid ──────────────────────────────────────────────────── */
/* РУС: грид */

/**
 * Generic data grid: filter → sort → group, computed by an internal `effect()`
 * into a snapshot signal; the body renders it with a (keyed) `<For>`.
 *
 * РУС: Генерик-грид данных: фильтр → сортировка → группировка, вычисляемые
 * внутренним `effect()` в сигнал-снапшот; тело рендерит его (keyed-)`<For>`-ом.
 */
export function Grid<Row>(props: GridProps<Row>): HTMLElement {
  const {
    rows, columns, filter, groupBy, initialSort, rowKey, searchPlaceholder,
    empty = 'No rows match the current filter.', class: rootClass = 'grid',
  } = props;

  /* Instance state: fresh signals per component call — two Grids are
   * independent; note that static markup (headers, toolbar) is built once
   * and reads these signals through reactive `$()`/`Show` bindings only.
   * РУС: Состояние инстанса: свежие сигналы на каждый вызов компонента —
   * два грида независимы; статичная разметка (заголовки, тулбар) строится
   * один раз и читает эти сигналы только через реактивные `$()`/`Show`. */
  const query = signal('');
  const sortKey = signal(initialSort?.key ?? '');
  const sortDir = signal<'asc' | 'desc'>(initialSort?.dir ?? 'desc');
  const collapsedGroups = signal<ReadonlySet<string>>(new Set());

  /* ── derived snapshot: filter → sort → group ─────────────── */
  /* РУС: производный снапшот: фильтр → сортировка → группировка */

  const view = signal<GridRow<Row>[]>([]);
  const itemCount = signal(0);

  effect(() => {
    const all = resolveSource(rows) ?? [];
    const q = query.value.trim().toLowerCase();
    let list = q
      ? all.filter(row => filter
        ? filter(row, q)
        : columns.some(col => String(col.sort(row)).toLowerCase().includes(q)))
      : all.slice();

    const col = columns.find(c => c.key === sortKey.value);
    if (col) {
      const dir = sortDir.value === 'asc' ? 1 : -1;
      list = list.slice().sort((a, b) => {
        const va = col.sort(a);
        const vb = col.sort(b);
        return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
      });
    }

    if (!groupBy) {
      view.value = list.map((row, index) => ({ kind: 'item', row, index }) as GridRow<Row>);
      itemCount.value = list.length;
      return;
    }

    const groups = new Map<string, Row[]>();
    const ungrouped: Row[] = [];
    for (const row of list) {
      const key = groupBy(row);
      if (key === null) ungrouped.push(row);
      else {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }
    }
    const out: GridRow<Row>[] = [];
    for (const row of ungrouped) out.push({ kind: 'item', row, index: 0 });
    const closed = collapsedGroups.value;
    for (const [key, rowsInGroup] of groups) {
      out.push({ kind: 'group', key, rows: rowsInGroup });
      if (!closed.has(key)) rowsInGroup.forEach((row, gi) => out.push({ kind: 'item', row, index: gi }));
    }
    view.value = out;
    itemCount.value = list.length;
  });

  function toggleGroup(key: string): void {
    const next = new Set(collapsedGroups.value);
    if (next.has(key)) next.delete(key); else next.add(key);
    collapsedGroups.value = next;
  }

  /** Sort direction arrow — derived from `sortDir` via a signal + effect. */
  /** РУС: Стрелка направления сортировки — производная от `sortDir` через signal + effect. */
  const sortArrow = signal('↓');
  effect(() => { sortArrow.value = sortDir.value === 'asc' ? '↑' : '↓'; });

  // The JSX expression is typed as Node; the root is always a div, so the
  // downcast is safe (the same pattern the bso5 examples use).
  // РУС: JSX-выражение типизировано как Node; корень всегда div, поэтому
  // даункаст безопасен (тот же паттерн, что в примерах bso5).
  return (
    (<div class={rootClass}>
      <div class="toolbar">
        <input
          type="text"
          class="search"
          placeholder={searchPlaceholder ?? 'Search…'}
          onInput={e => { query.value = (e.target as HTMLInputElement).value; }}
        />
        <select onChange={e => { sortDir.value = (e.target as HTMLSelectElement).value as 'asc' | 'desc'; }}>
          <option value="desc">↓ desc</option>
          <option value="asc">↑ asc</option>
        </select>
        <span class="chip">rows: <b>{$(itemCount)}</b></span>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                class={col.headerClass ?? ''}
                onClick={() => {
                  if (col.sortable === false) return;
                  if (sortKey.value === col.key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
                  else { sortKey.value = col.key; sortDir.value = 'desc'; }
                }}
              >
                {col.header}
                <Show when={() => sortKey.value === col.key}>
                  <span class="arrow">{$(sortArrow)}</span>
                </Show>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Keyed mode only when the caller supplies rowKey: a constant key
              would collapse all rows into one group (Map semantics), and an
              always-same key would freeze content (key = identity). */}
          {/* РУС: Keyed-режим только когда вызывающий задал rowKey: константный
              ключ схлопнул бы все строки в одну группу (семантика Map), а
              вечно-одинаковый ключ заморозил бы контент (ключ = идентичность). */}
          <For each={view} key={rowKey ? rowKeyFor : undefined}>
            {(gridRow) =>
              gridRow.kind === 'group' ? (
                <tr class="group-row" onClick={() => toggleGroup(gridRow.key)}>
                  <td colspan={columns.length}>
                    <span class="toggle">{collapsedGroups.peek().has(gridRow.key) ? '▸' : '▾'}</span>
                    {gridRow.key}
                    <span class="count">({gridRow.rows.length})</span>
                  </td>
                </tr>
              ) : (
                <tr>
                  {columns.map(col => (
                    <td class={col.class ?? ''}>{col.cell(gridRow.row)}</td>
                  ))}
                </tr>
              )
            }
          </For>
        </tbody>
      </table>
      <Show when={() => itemCount.value === 0}>
        <div class="empty">{empty}</div>
      </Show>
    </div>) as HTMLElement
  );

  /** Groups are keyed by their label; items — by the caller-supplied key. */
  /** РУС: Группы ключуются меткой; элементы — ключом, заданным вызывающим. */
  function rowKeyFor(gridRow: GridRow<Row>, _i: number): unknown {
    if (!rowKey) return undefined;
    return gridRow.kind === 'group' ? `group:${gridRow.key}` : rowKey(gridRow.row, gridRow.index);
  }
}

