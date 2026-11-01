/**
 * bso5-components — a generic collapsible Tree on top of the bso5 runtime.
 *
 * `Tree` renders a hierarchy of `TreeData` nodes (label + optional children +
 * optional meta) between comment anchors. It ships its own search box: while
 * the query is non-empty the tree is filtered (nodes whose label matches or
 * that have a matching descendant stay) and auto-expanded so the matches are
 * visible. Expansion state and the query live inside the component instance,
 * so two `<Tree>`s are fully independent.
 *
 * The data source is any `ReactiveSource<TreeData | null>` — a plain object,
 * `() => object` thunk, `Signal` or a `$()`-bound value. Transformations
 * (sorting, deriving a tree from flat data, async loads into a signal) are the
 * consumer's job: feed the *final* tree in.
 *
 * The component is **headless**: it renders semantic markup with stable class
 * names (`tree`, `toolbar`, `search`, `node`, `row`, `caret`, `name`, `meta`,
 * `kids`, `empty`, …) and leaves all styling to the consumer.
 *
 * РУС: bso5-components — генерик-сворачиваемое дерево поверх рантайма bso5.
 *
 * РУС: `Tree` рендерит иерархию узлов `TreeData` (метка + опциональные дети +
 * опциональная мета) между комментариями-анкорами. Со своей строкой поиска:
 * пока запрос непуст, дерево фильтруется (остаются узлы с совпадением в метке
 * или совпадающим потомком) и авто-раскрывается, чтобы совпадения были видны.
 * Состояние раскрытия и запрос живут внутри инстанса компонента, поэтому два
 * `<Tree>` полностью независимы.
 *
 * РУС: Источник данных — любой `ReactiveSource<TreeData | null>` — обычный
 * объект, `() => object`-танка, `Signal` или `$()`-значение. Трансформации
 * (сортировка, постройка дерева из плоских данных, асинхронные загрузки в
 * сигнал) — задача потребителя: подавайте на вход *финальное* дерево.
 *
 * РУС: Компонент **headless**: рендерит семантическую разметку со стабильными
 * именами классов (`tree`, `toolbar`, `search`, `node`, `row`, `caret`,
 * `name`, `meta`, `kids`, `empty`, …) и оставляет стилизацию потребителю.
 *
 * @module
 */
import { For, $, effect, resolveSource, signal } from 'bso5';
import type { ReactiveSource, JsxChild } from 'bso5';

/* ── public types ──────────────────────────────────────────── */
/* РУС: публичные типы */

/**
 * A single tree node: label, optional meta line (sizes, counts, …) and
 * optional children. `children === null`/omitted means a leaf.
 *
 * РУС: Узел дерева: метка, опциональная мета-строка (размеры, счётчики, …) и
 * опциональные дети. `children === null`/отсутствует — лист.
 */
export interface TreeData {
  /** Node label. (РУС: Метка узла.) */
  label: string;
  /** Secondary text rendered next to the label. Optional. (РУС: Вторичный текст рядом с меткой. Необязателен.) */
  meta?: string;
  /** Child nodes; `null`/omitted — this node is a leaf. (РУС: Дочерние узлы; `null`/нет — этот узел лист.) */
  children?: readonly TreeData[] | null;
  /** Extra class for the label `span`. Optional. (РУС: Дополнительный класс для `span`-метки. Необязателен.) */
  labelClass?: string;
}

/** UI strings of {@link Tree}; every field has an English default. (РУС: Подписи интерфейса {@link Tree}; у каждого поля есть английское значение по умолчанию.) */
export interface TreeLabels {
  /** Accessible name of the search box. (РУС: Доступное имя поля поиска.) */
  search?: string;
  /** Placeholder of the search box; defaults to `search`. (РУС: Плейсхолдер поиска; по умолчанию равен `search`.) */
  searchPlaceholder?: string;
  /** Prefix of the match counter; empty string hides it. (РУС: Префикс счётчика совпадений; пустая строка его скрывает.) */
  matched?: string;
  /** Text of the "expand all" button. (РУС: Текст кнопки «развернуть всё».) */
  expandAll?: string;
  /** Text of the "collapse all" button. (РУС: Текст кнопки «свернуть всё».) */
  collapseAll?: string;
}

/** Props of {@link Tree}. (РУС: Пропсы {@link Tree}.) */
export interface TreeProps {
  /** Data source: tree object, thunk, `Signal` or `$()`-bound value. (РУС: Источник данных: объект-дерево, танка, `Signal` или `$()`-значение.) */
  root: ReactiveSource<TreeData | null>;
  /** Search box placeholder. (РУС: Плейсхолдер строки поиска.) */
  searchPlaceholder?: string;
  /** Text shown when the tree is empty or filtered to nothing. Optional. (РУС: Текст, когда дерево пустое или отфильтровано в ноль. Необязательно.) */
  empty?: string;
  /** Stable node key for keyed rendering. Defaults to the node path. (РУС: Стабильный ключ узла для keyed-рендеринга. По умолчанию — путь узла.) */
  nodeKey?: (node: TreeData, path: string[]) => unknown;
  /**
   * Search debounce in ms; applies from `searchDebounceMinItems` nodes up.
   * `false` disables it. Default: 120.
   *
   * РУС: Задержка поиска в мс; действует от `searchDebounceMinItems` узлов.
   * `false` отключает. По умолчанию 120.
   */
  searchDebounce?: number | false;
  /** Node count from which the debounce kicks in. Default: 200. (РУС: Число узлов, с которого включается задержка. По умолчанию 200.) */
  searchDebounceMinItems?: number;
  /** Show "expand all" / "collapse all" buttons in the toolbar. Default: false. (РУС: Показывать кнопки «развернуть всё»/«свернуть всё». По умолчанию false.) */
  showExpandAll?: boolean;
  /** UI labels (placeholders, aria labels, counters, buttons). (РУС: Подписи интерфейса (плейсхолдеры, aria-метки, счётчики, кнопки).) */
  labels?: Partial<TreeLabels>;
  /** Extra class for the root element. (РУС: Дополнительный класс корневого элемента.) */
  class?: string;
  /** Node label renderer; defaults to `node.label`. (РУС: Рендер метки узла; по умолчанию `node.label`.) */
  renderLabel?: (node: TreeData) => JsxChild;
}

/* ── internal snapshot type ────────────────────────────────── */
/* РУС: внутренний тип снапшота */

/**
 * A renderable snapshot of the tree: everything `TreeNode` needs, frozen.
 * The top-level keyed `<For>` re-renders from it; `TreeNode` itself stays a
 * pure render of static data — no per-node effects, no leaks.
 *
 * РУС: Рендерабельный снапшот дерева: всё, что нужно `TreeNode`, заморожено.
 * Верхнеуровневый keyed-`<For>` перерисовывает из него; сам `TreeNode`
 * остаётся чистым рендером статичных данных — без пер-узловых эффектов и утечек.
 */
interface TreeView {
  root: TreeData | null;
  query: string;
  expanded: ReadonlySet<string>;
}

/* ── helpers ───────────────────────────────────────────────── */
/* РУС: хелперы */

/** Keeps only nodes whose label or meta matches, or that have a matching descendant. */
/** РУС: Оставляет только узлы, чья метка или мета совпадает либо у которых есть совпадающий потомок. */
function filterTree(node: TreeData, q: string): TreeData | null {
  const hit = node.label.toLowerCase().includes(q) || (node.meta?.toLowerCase().includes(q) ?? false);
  const kids = (node.children ?? [])
    .map(k => filterTree(k, q))
    .filter((k): k is TreeData => k !== null);
  if (!hit && kids.length === 0) return null;
  return kids.length > 0 ? { ...node, children: kids } : { ...node, children: null };
}

function countNodes(node: TreeData | null): number {
  if (!node) return 0;
  return 1 + (node.children ?? []).reduce((s, k) => s + countNodes(k), 0);
}

/* ── Tree ──────────────────────────────────────────────────── */
/* РУС: дерево */

/**
 * Generic collapsible tree with search: the internal `effect()` builds an
 * immutable `TreeView` snapshot (filter → capture expansion state); the whole
 * tree is then rendered from it, so `TreeItem` stays a pure function of
 * static data.
 *
 * РУС: Генерик-сворачиваемое дерево с поиском: внутренний `effect()` строит
 * иммутабельный снапшот `TreeView` (фильтр → захват состояния раскрытия);
 * затем всё дерево рендерится из него, поэтому `TreeItem` остаётся чистой
 * функцией статичных данных.
 */
export function Tree(props: TreeProps): HTMLElement {
  const {
    root, searchPlaceholder, nodeKey, renderLabel,
    searchDebounce, searchDebounceMinItems, showExpandAll = false, labels,
    empty = 'Nothing matches this filter.', class: rootClass = '',
  } = props;

  /* Подписи: явные `labels` важнее старых одиночных пропсов и умолчаний. */
  const ui = {
    search: labels?.search ?? searchPlaceholder ?? 'Search',
    placeholder: labels?.searchPlaceholder ?? searchPlaceholder ?? 'Search…',
    matched: labels?.matched ?? 'matched:',
    expandAll: labels?.expandAll ?? 'Expand all',
    collapseAll: labels?.collapseAll ?? 'Collapse all',
  };

  /* Курсор фокуса для клавиатуры: перерисовка дерева пересоздаёт узлы, и без
   * возврата фокуса навигация стрелками обрывалась бы после первого раскрытия. */
  // РУС: ключ узла, на который надо вернуть фокус после перерисовки.
  const focus: { pending: string | null } = { pending: null };
  let treeEl: HTMLElement | null = null;

  /* Instance state: fresh signals per component call — two Trees are
   * independent.
   * РУС: Состояние инстанса: свежие сигналы на каждый вызов компонента —
   * два дерева независимы. */
  const query = signal('');
  const expanded = signal<ReadonlySet<string>>(new Set());
  const matchCount = signal(0);

  /* ── derived snapshot: filter → capture expansion state ──── */
  /* РУС: производный снапшот: фильтр → захват состояния раскрытия */

  const treeView = signal<TreeView>({ root: null, query: '', expanded: new Set() });

  effect(() => {
    const src = resolveSource(root);
    const q = query.value.trim().toLowerCase();
    let r: TreeData | null = src ? { ...src } : null;
    if (r && q) r = filterTree(r, q);
    treeView.value = { root: r, query: q, expanded: expanded.value };
    matchCount.value = countNodes(r);
  });

  /* ── render ──────────────────────────────────────────────── */
  /* РУС: рендер */

  /* Крупные деревья получают дебаунс поиска: перерисовка всего дерева на
   * каждый символ — O(N). Порог и задержка — пропсы. */
  // РУС: дебаунс поиска для крупных деревьев.
  let queryTimer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = searchDebounce === false ? 0 : (searchDebounce ?? 120);
  const debounceMinItems = searchDebounceMinItems ?? 200;
  function onSearchInput(value: string): void {
    if (queryTimer) { clearTimeout(queryTimer); queryTimer = null; }
    if (debounceMs <= 0 || countNodes(resolveSource(root)) < debounceMinItems) { query.value = value; return; }
    queryTimer = setTimeout(() => { queryTimer = null; query.value = value; }, debounceMs);
  }

  /** Expand every directory, or collapse the tree back to the root. (РУС: Раскрыть все папки либо свернуть дерево до корня.) */
  function setAllExpanded(open: boolean): void {
    if (!open) { expanded.value = new Set(); return; }
    const src = resolveSource(root);
    expanded.value = new Set(src ? collectKeys(src, [], nodeKey) : []);
  }

  // The JSX expression is typed as Node; the root is always a div, so the
  // downcast is safe (the same pattern the bso5 examples use).
  // РУС: JSX-выражение типизировано как Node; корень всегда div, поэтому
  // даункаст безопасен (тот же паттерн, что в примерах bso5).
  const rootEl = (
    <div>
      <div class="toolbar">
        <input
          type="text"
          class="search"
          aria-label={ui.search}
          placeholder={ui.placeholder}
          onInput={e => { onSearchInput((e.target as HTMLInputElement).value); }}
        />
        {showExpandAll ? (
          <span class="bulk">
            <button type="button" class="expand-all" onClick={() => setAllExpanded(true)}>{ui.expandAll}</button>
            <button type="button" class="collapse-all" onClick={() => setAllExpanded(false)}>{ui.collapseAll}</button>
          </span>
        ) : null}
        <span class="chip">{ui.matched ? `${ui.matched} ` : ''}<b>{$(matchCount)}</b></span>
      </div>
      {/* Unkeyed on purpose: every snapshot change re-renders the whole tree
          (a keyed For with a constant key would never re-render — key=identity). */}
      {/* РУС: Намеренно без ключа: каждое изменение снапшота перерисовывает всё
          дерево (keyed-For с константным ключом не перерисовался бы — ключ=идентичность). */}
      <For each={() => [treeView.value]}>
        {(v) => v.root !== null
          ? <div class={`tree ${rootClass}`} role="tree" aria-label={v.root.label} ref={el => { treeEl = el; }}>
              <TreeItem node={v.root} path={[]} view={v} nodeKey={nodeKey} renderLabel={renderLabel} expanded={expanded} focus={focus} isRoot />
            </div>
          : <div class="empty">{empty}</div>}
      </For>
    </div>) as HTMLElement;

  /* Возврат фокуса после перерисовки: снапшот пересоздаёт узлы, а навигация
   * стрелками держится именно на текущем узле. Эффект создаётся после `<For>`,
   * поэтому выполняется уже по готовому DOM. */
  // РУС: эффект создан после <For> — срабатывает после перестройки дерева.
  effect(() => {
    treeView.value; // зависимость: любое изменение снапшота
    const pending = focus.pending;
    if (pending === null || !treeEl) return;
    focus.pending = null;
    const rows = [...treeEl.querySelectorAll<HTMLElement>('.row')];
    rows.find(row => row.dataset.key === pending)?.focus();
  });

  return rootEl;
}

/** A single node row; reads the frozen snapshot only, never signals. */
/** РУС: Строка одного узла; читает только замороженный снапшот, никогда сигналы. */
function TreeItem(props: {
  node: TreeData;
  path: string[];
  view: TreeView;
  nodeKey?: (node: TreeData, path: string[]) => unknown;
  renderLabel?: (node: TreeData) => JsxChild;
  expanded: { value: ReadonlySet<string> };
  /** Focus cursor shared with the owning Tree. (РУС: Курсор фокуса, общий с владельцем дерева.) */
  focus: { pending: string | null };
  /** True for the root row — the single Tab stop of the tree. (РУС: Истинно для корневой строки — единственной точки входа Tab.) */
  isRoot?: boolean;
}): HTMLElement {
  const { node, path, view, nodeKey, renderLabel, expanded, focus, isRoot } = props;
  // Ключ раскрытия: nodeKey вызывающего кода, иначе путь по меткам.
  // РУС: ключ раскрытия — nodeKey вызывающего, иначе путь по меткам.
  const key = nodeKey ? String(nodeKey(node, path)) : [...path, node.label].join('/');
  const isDir = (node.children ?? []).length > 0;

  // While filtering, everything is expanded so matches are visible; otherwise
  // expansion comes from the snapshot's captured expansion state.
  // РУС: При фильтрации всё раскрыто, чтобы совпадения были видны; иначе
  // раскрытие берётся из захваченного состояния раскрытия снапшота.
  const open = isDir && (view.query.length > 0 || view.expanded.has(key));
  const match = view.query.length > 0
    && (node.label.toLowerCase().includes(view.query) || (node.meta?.toLowerCase().includes(view.query) ?? false));

  /* Любое изменение раскрытия перерисовывает дерево, поэтому ключ узла
   * запоминается до записи, а возвращается уже после рендера. */
  // РУС: запоминаем узел до перерисовки, фокус вернётся после неё.
  const markFocus = (): void => { focus.pending = key; };

  const toggle = (): void => {
    if (!isDir) return;
    markFocus();
    const next = new Set(expanded.value);
    if (next.has(key)) next.delete(key); else next.add(key);
    expanded.value = next; // → new snapshot → full tree re-render
    // РУС: → новый снапшот → полный ре-рендер дерева
  };

  const expand = (): void => {
    if (!isDir || open) return;
    markFocus();
    const next = new Set(expanded.value);
    next.add(key);
    expanded.value = next;
  };

  const collapse = (): void => {
    if (!isDir || !open) return;
    markFocus();
    const next = new Set(expanded.value);
    next.delete(key);
    expanded.value = next;
  };

  /** Moves focus to the neighbouring row in DOM order. (РУС: Переводит фокус на соседнюю строку в порядке DOM.) */
  const moveFocus = (row: HTMLElement, delta: 1 | -1): void => {
    const tree = row.closest('.tree');
    if (!tree) return;
    const rows = [...tree.querySelectorAll<HTMLElement>('.row')];
    const next = rows[rows.indexOf(row) + delta];
    next?.focus();
  };

  return (
    (<div class="node" role="treeitem" aria-expanded={isDir ? String(open) : undefined}>
      <div
        class="row"
        data-key={key}
        tabindex={isRoot ? '0' : '-1'}
        onClick={toggle}
        onKeydown={e => {
          const k = (e as KeyboardEvent).key;
          if (k === 'Enter' || k === ' ') { e.preventDefault(); toggle(); return; }
          if (k === 'ArrowRight') { e.preventDefault(); expand(); return; }
          if (k === 'ArrowLeft') { e.preventDefault(); collapse(); return; }
          if (k === 'ArrowDown') { e.preventDefault(); moveFocus(e.currentTarget as HTMLElement, 1); return; }
          if (k === 'ArrowUp') { e.preventDefault(); moveFocus(e.currentTarget as HTMLElement, -1); }
        }}
      >
        <span class={`caret ${isDir ? '' : 'leaf'}`}>{isDir ? (open ? '▾' : '▸') : '·'}</span>
        <span class={`name ${isDir ? 'dir' : ''} ${match ? 'match' : ''}`}>{renderLabel ? renderLabel(node) : node.label}</span>
        {node.meta ? <span class="meta">{node.meta}</span> : null}
      </div>
      {open ? (
        <div class="kids" role="group">
          <For each={node.children ?? []}>
            {(kid) => <TreeItem node={kid} path={[...path, node.label]} view={view} nodeKey={nodeKey} renderLabel={renderLabel} expanded={expanded} focus={focus} />}
          </For>
        </div>
      ) : null}
    </div>) as HTMLElement
  );
}

/** Every directory key of the tree, using the same key function as `TreeItem`. (РУС: Все ключи папок дерева, той же функцией, что и `TreeItem`.) */
function collectKeys(node: TreeData, path: string[], nodeKey?: (node: TreeData, path: string[]) => unknown): string[] {
  const key = nodeKey ? String(nodeKey(node, path)) : [...path, node.label].join('/');
  const kids = node.children ?? [];
  if (kids.length === 0) return [];
  return [key, ...kids.flatMap(kid => collectKeys(kid, [...path, node.label], nodeKey))];
}


