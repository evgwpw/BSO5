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

/** UI strings of {@link Grid}; every field has an English default. (РУС: Подписи интерфейса {@link Grid}; у каждого поля есть английское значение по умолчанию.) */
export interface GridLabels {
  /** Accessible name of the search box. (РУС: Доступное имя поля поиска.) */
  search?: string;
  /** Placeholder of the search box; defaults to `search`. (РУС: Плейсхолдер поиска; по умолчанию равен `search`.) */
  searchPlaceholder?: string;
  /** Accessible name of the sort-direction control. (РУС: Доступное имя контрола направления сортировки.) */
  sortDirection?: string;
  /** Text of the descending option. (РУС: Текст варианта «по убыванию».) */
  descending?: string;
  /** Text of the ascending option. (РУС: Текст варианта «по возрастанию».) */
  ascending?: string;
  /** Prefix of the row counter; empty string hides the counter text. (РУС: Префикс счётчика строк; пустая строка скрывает текст счётчика.) */
  rows?: string;
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
  /**
   * Stable row key for keyed `<For>` (DOM-node reuse). Optional. Called with
   * the row only: the rendered index is deliberately not part of the key, so
   * sorting reorders existing nodes instead of recreating them.
   *
   * РУС: Стабильный ключ строки для keyed-`<For>` (переиспользование
   * DOM-узлов). Необязателен. Вызывается только со строкой: индекс намеренно
   * не входит в ключ, иначе сортировка пересоздавала бы все узлы.
   */
  rowKey?: (row: Row) => unknown;
  /** Search box placeholder. (РУС: Плейсхолдер строки поиска.) */
  searchPlaceholder?: string;
  /**
   * Search debounce in ms. Applies only to sources of at least
   * `searchDebounceMinItems` rows (small tables must react instantly).
   * `false` disables it. Default: 120.
   *
   * РУС: Задержка поиска в мс. Действует только на источники от
   * `searchDebounceMinItems` строк (маленькие таблицы должны отвечать сразу).
   * `false` отключает. По умолчанию 120.
   */
  searchDebounce?: number | false;
  /** Row count from which the debounce kicks in. Default: 200. (РУС: Число строк, с которого включается задержка. По умолчанию 200.) */
  searchDebounceMinItems?: number;
  /** Text shown when no rows match. Optional. (РУС: Текст при отсутствии строк. Необязательно.) */
  empty?: string;
  /** UI labels (placeholders, aria labels, counter prefix). (РУС: Подписи интерфейса (плейсхолдеры, aria-метки, префикс счётчика).) */
  labels?: Partial<GridLabels>;
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
    searchDebounce, searchDebounceMinItems, labels,
    empty = 'No rows match the current filter.', class: rootClass = 'grid',
  } = props;

  /* UI strings: explicit `labels` win, then the legacy single-purpose props,
   * then English defaults. Kept as plain strings, not signals: they are
   * static per instance and baked into once-built markup.
   * РУС: Подписи: явные `labels` важнее старых одиночных пропсов, затем
   * английские значения по умолчанию. Это обычные строки, не сигналы:
   * они статичны для инстанса и вшиваются в однократно построенную разметку. */
  const ui = {
    search: labels?.search ?? searchPlaceholder ?? 'Search',
    placeholder: labels?.searchPlaceholder ?? searchPlaceholder ?? 'Search…',
    sortDirection: labels?.sortDirection ?? 'Sort direction',
    descending: labels?.descending ?? '↓ desc',
    ascending: labels?.ascending ?? '↑ asc',
    rows: labels?.rows ?? 'rows:',
  };

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

  /* Большие источники получают дебаунс: перерисовка таблицы на каждый символ
   * заметна уже на 300–400 строках, а на малых данных задержка только мешает
   * (и ломала бы «мгновенный» отклик в тестах). Порог и задержка — пропсы. */
  let queryTimer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = searchDebounce === false ? 0 : (searchDebounce ?? 120);
  const debounceMinItems = searchDebounceMinItems ?? 200;
  function onSearchInput(value: string): void {
    const total = (resolveSource(rows) ?? []).length;
    if (queryTimer) { clearTimeout(queryTimer); queryTimer = null; }
    if (debounceMs <= 0 || total < debounceMinItems) { query.value = value; return; }
    queryTimer = setTimeout(() => { queryTimer = null; query.value = value; }, debounceMs);
  }

  // The JSX expression is typed as Node; the root is always a div, so the
  // downcast is safe (the same pattern the bso5 examples use).
  // РУС: JSX-выражение типизировано как Node; корень всегда div, поэтому
  // даункаст безопасен (тот же паттерн, что в примерах bso5).
  const root = (
    <div class={rootClass}>
      <div class="toolbar">
        <input
          type="text"
          class="search"
          aria-label={ui.search}
          placeholder={ui.placeholder}
          onInput={e => { onSearchInput((e.target as HTMLInputElement).value); }}
        />
        {/* Направление сортировки реактивно и в обе стороны: клик по заголовку
            тоже обновляет этот контрол. */}
        {/* РУС: направление сортировки реактивно в обе стороны. */}
        <select
          class="dir"
          aria-label={ui.sortDirection}
          value={$(sortDir)}
          onChange={e => { sortDir.value = (e.target as HTMLSelectElement).value as 'asc' | 'desc'; }}
        >
          <option value="desc">{ui.descending}</option>
          <option value="asc">{ui.ascending}</option>
        </select>
        <span class="chip">{ui.rows ? `${ui.rows} ` : ''}<b>{$(itemCount)}</b></span>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                scope="col"
                class={col.headerClass ?? ''}
                onClick={() => {
                  if (col.sortable === false) return;
                  if (sortKey.value === col.key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
                  else { sortKey.value = col.key; sortDir.value = 'desc'; }
                }}
              >
                {col.header}
                <Show when={() => sortKey.value === col.key}>
                  {/* Направление через Show: у ядра нет computed(), а `$()` не умеет сравнения. */}
                  {/* РУС: направление через Show — computed() в ядре нет. */}
                  <span class="arrow">
                    <Show when={() => sortDir.value === 'asc'} fallback="↓">↑</Show>
                  </span>
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
                <tr
                  class="group-row"
                  data-group={gridRow.key}
                  tabindex="0"
                  onClick={() => toggleGroup(gridRow.key)}
                  onKeydown={e => {
                    const k = (e as KeyboardEvent).key;
                    if (k !== 'Enter' && k !== ' ') return;
                    e.preventDefault();
                    toggleGroup(gridRow.key);
                  }}
                >
                  <td colspan={columns.length}>
                    {/* Стрелка читает состояние группы через Show, а не
                        peek(): в keyed-режиме строка переиспользуется и без
                        реактивной привязки осталась бы с прежним символом. */}
                    {/* РУС: стрелка через Show — иначе в keyed-режиме символ
                        застывает на значении первого рендера. */}
                    <span class="toggle">
                      <Show when={() => collapsedGroups.value.has(gridRow.key)} fallback="▾">▸</Show>
                    </span>
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
    </div>) as HTMLElement;

  /* A11y-состояние, которое нельзя выразить атрибутом в разметке (узлы
   * переиспользуются): aria-sort у заголовков и aria-expanded у групп. */
  // РУС: aria-sort и aria-expanded синхронизируются отдельным эффектом.
  const headCells = [...root.querySelectorAll<HTMLElement>('thead th')];
  effect(() => {
    const activeKey = sortKey.value;
    const dir = sortDir.value;
    headCells.forEach((th, i) => {
      const col = columns[i];
      if (!col) return;
      if (col.key === activeKey) th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    });
    const closed = collapsedGroups.value;
    root.querySelectorAll<HTMLElement>('tr.group-row').forEach(tr => {
      const key = tr.dataset.group;
      if (key === undefined) return;
      tr.setAttribute('aria-expanded', String(!closed.has(key)));
    });
  });

  return root;

  /** Groups are keyed by their label; items — by the caller-supplied key. */
  /** РУС: Группы ключуются меткой; элементы — ключом, заданным вызывающим. */
  function rowKeyFor(gridRow: GridRow<Row>): unknown {
    if (!rowKey) return undefined;
    return gridRow.kind === 'group' ? `group:${gridRow.key}` : rowKey(gridRow.row);
  }
}

