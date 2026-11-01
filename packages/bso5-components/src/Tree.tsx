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
    empty = 'Nothing matches this filter.', class: rootClass = '',
  } = props;

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
   * каждый символ — O(N). На малых данных задержка только мешает. */
  // РУС: дебаунс поиска для крупных деревьев.
  let queryTimer: ReturnType<typeof setTimeout> | null = null;
  const QUERY_DEBOUNCE_MIN = 200;
  const QUERY_DEBOUNCE_MS = 120;
  function onSearchInput(value: string): void {
    if (queryTimer) { clearTimeout(queryTimer); queryTimer = null; }
    if (countNodes(resolveSource(root)) < QUERY_DEBOUNCE_MIN) { query.value = value; return; }
    queryTimer = setTimeout(() => { queryTimer = null; query.value = value; }, QUERY_DEBOUNCE_MS);
  }

  // The JSX expression is typed as Node; the root is always a div, so the
  // downcast is safe (the same pattern the bso5 examples use).
  // РУС: JSX-выражение типизировано как Node; корень всегда div, поэтому
  // даункаст безопасен (тот же паттерн, что в примерах bso5).
  return (
    (<div>
      <div class="toolbar">
        <input
          type="text"
          class="search"
          aria-label={searchPlaceholder ?? 'Search'}
          placeholder={searchPlaceholder ?? 'Search…'}
          onInput={e => { onSearchInput((e.target as HTMLInputElement).value); }}
        />
        <span class="chip">matched: <b>{$(matchCount)}</b></span>
      </div>
      {/* Unkeyed on purpose: every snapshot change re-renders the whole tree
          (a keyed For with a constant key would never re-render — key=identity). */}
      {/* РУС: Намеренно без ключа: каждое изменение снапшота перерисовывает всё
          дерево (keyed-For с константным ключом не перерисовался бы — ключ=идентичность). */}
      <For each={() => [treeView.value]}>
        {(v) => v.root !== null
          ? <div class={`tree ${rootClass}`} role="tree" aria-label={v.root.label}>
              <TreeItem node={v.root} path={[]} view={v} nodeKey={nodeKey} renderLabel={renderLabel} expanded={expanded} />
            </div>
          : <div class="empty">{empty}</div>}
      </For>
    </div>) as HTMLElement
  );
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
}): HTMLElement {
  const { node, path, view, nodeKey, renderLabel, expanded } = props;
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

  const toggle = (): void => {
    if (!isDir) return;
    const next = new Set(expanded.value);
    if (next.has(key)) next.delete(key); else next.add(key);
    expanded.value = next; // → new snapshot → full tree re-render
    // РУС: → новый снапшот → полный ре-рендер дерева
  };

  const expand = (): void => {
    if (!isDir || open) return;
    const next = new Set(expanded.value);
    next.add(key);
    expanded.value = next;
  };

  const collapse = (): void => {
    if (!isDir || !open) return;
    const next = new Set(expanded.value);
    next.delete(key);
    expanded.value = next;
  };

  return (
    (<div class="node" role="treeitem" aria-expanded={isDir ? String(open) : undefined}>
      <div
        class="row"
        tabindex="0"
        onClick={toggle}
        onKeydown={e => {
          const k = (e as KeyboardEvent).key;
          if (k === 'Enter' || k === ' ') { e.preventDefault(); toggle(); return; }
          if (k === 'ArrowRight') { e.preventDefault(); expand(); return; }
          if (k === 'ArrowLeft') { e.preventDefault(); collapse(); }
        }}
      >
        <span class={`caret ${isDir ? '' : 'leaf'}`}>{isDir ? (open ? '▾' : '▸') : '·'}</span>
        <span class={`name ${isDir ? 'dir' : ''} ${match ? 'match' : ''}`}>{renderLabel ? renderLabel(node) : node.label}</span>
        {node.meta ? <span class="meta">{node.meta}</span> : null}
      </div>
      {open ? (
        <div class="kids" role="group">
          <For each={node.children ?? []}>
            {(kid) => <TreeItem node={kid} path={[...path, node.label]} view={view} nodeKey={nodeKey} renderLabel={renderLabel} expanded={expanded} />}
          </For>
        </div>
      ) : null}
    </div>) as HTMLElement
  );
}


