/**
 * BSO5 — reactive control-flow components.
 *
 * JSX evaluates once at mount time, so lists and conditionals need components
 * that own their reactivity. `For` and `Show` render between invisible comment
 * anchors, adding no wrapper elements to the DOM.
 *
 * ```tsx
 * <For each={$(state.value, x => x.items)}>
 *   {(item, i) => <li>{i}: {item}</li>}
 * </For>
 *
 * <Show when={() => state.value.count > 10}>
 *   <p class="alert">Too much!</p>
 * </Show>
 * ```
 *
 * РУС: BSO5 — реактивные компоненты управляющего потока.
 *
 * РУС: JSX вычисляется один раз при монтировании, поэтому спискам и условиям
 * нужны компоненты, владеющие своей реактивностью. `For` и `Show` рендерят
 * между невидимыми комментариями-анкорами, не добавляя обёрток в DOM.
 *
 * @module
 */

import { Signal, createScope, dispose, effect, isBoundValue, onScopeDispose, runInScope, type BoundValue, type Scope } from './reactive.js';
import { boundTextNode, flattenChildren, releaseBindings } from './dom.js';
import type { JsxChild } from './jsx-runtime.js';

/**
 * Anything a control-flow `each`/`when` prop can be driven by:
 * a plain value, `() => value` (re-read and auto-tracked inside the effect),
 * a `Signal`, or a `$()`-bound value.
 *
 * РУС: Всё, чем может управляться проп `each`/`when` управляющего потока:
 * обычное значение, `() => value` (перечитывается и автотрекается внутри
 * эффекта), `Signal` или привязанное значение `$()`.
 */
export type ReactiveSource<T> = T | (() => T) | Signal<T> | BoundValue<T>;

/** Reads the current value of a reactive source; auto-tracks inside `effect()`. (РУС: Читает текущее значение реактивного источника; автотрекается внутри `effect()`.) */
export function resolveSource<T>(src: ReactiveSource<T>): T {
  if (typeof src === 'function') return (src as () => T)();
  if (src instanceof Signal) return src.value;
  if (isBoundValue(src)) return src.value as T;
  return src as T;
}

/** Normalizes any JsxChild into concrete DOM nodes. (РУС: Нормализует любой JsxChild в конкретные DOM-узлы.) */
function toNodes(child: JsxChild): Node[] {
  return flattenChildren([child]).map(c => {
    if (typeof c === 'string' || typeof c === 'number') return document.createTextNode(String(c));
    if (isBoundValue(c)) return boundTextNode(c);
    return c as Node;
  });
}

/**
 * Unwraps `[fn]` — the shape the JSX runtime delivers for a function child —
 * into the bare function.
 *
 * РУС: Разворачивает `[fn]` — форму, которую JSX-рантайм доставляет для
 * ребёнка-функции — в саму функцию.
 */
function unwrapChild(children: unknown): unknown {
  return Array.isArray(children) && children.length === 1 && typeof children[0] === 'function'
    ? children[0]
    : children;
}

/** Requires a function child, with a helpful error message. (РУС: Требует ребёнка-функцию с понятным сообщением об ошибке.) */
function childFn<A extends unknown[], R>(children: unknown, what: string): (...args: A) => R {
  const fn = Array.isArray(children) ? children[0] : children;
  if (typeof fn !== 'function') {
    throw new TypeError(`bso5: <${what}> requires a function child, e.g. {(item, i) => <li />}`);
  }
  return fn as (...args: A) => R;
}

/** Removes every node rendered between the two anchors. (РУС: Удаляет все узлы, отрендеренные между двумя анкорами.) */
function clearBetween(start: Node, end: Node): void {
  const host = end.parentNode;
  if (!host) return;
  let node = start.nextSibling;
  while (node && node !== end) {
    const next = node.nextSibling;
    host.removeChild(node);
    node = next;
  }
}

/** Inserts `nodes` right before the end anchor (fragments and live parents). (РУС: Вставляет `nodes` прямо перед конечным анкором (фрагменты и живые родители).) */
function insertAll(nodes: Node[], end: Node): void {
  const host = end.parentNode;
  if (!host) return;
  for (const n of nodes) host.insertBefore(n, end);
}

/** Props of `{@link For}`. (РУС: Пропсы {@link For}.) */
export interface ForProps<T> {
  /**
   * The list to render: a plain array, `() => array` (re-read, auto-tracked),
   * a `Signal` or a `$()`-bound value. Use `$()`/`() =>` when the array can be
   * replaced wholesale.
   *
   * РУС: Список для рендера: обычный массив, `() => array` (перечитывается,
   * автотрекается), `Signal` или привязанное значение `$()`. Используйте
   * `$()`/`() =>`, когда массив может быть заменён целиком.
   */
  each: ReactiveSource<readonly T[]>;
  /**
   * Optional stable item key. When provided, keyed reconciliation kicks in:
   * DOM nodes are reused and moved instead of being recreated, preserving
   * focus, caret, selection, media state and CSS transitions across reorders.
   * The key identifies the element — while it stays in the list, the item's
   * nodes are NOT re-rendered (bind item fields with `$()` instead); the
   * rendered index is captured at first render; duplicate keys collapse into
   * one group of nodes.
   *
   * РУС: Необязательный стабильный ключ элемента. Если задан — включается
   * keyed-реконсиляция: DOM-узлы переиспользуются и перемещаются вместо
   * пересоздания, сохраняя фокус, каретку, выделение, состояние медиа и
   * CSS-transition'ы при пересортировках. Ключ идентифицирует элемент — пока
   * он в списке, узлы элемента НЕ перерисовываются (привязывайте поля через
   * `$()`); отрисованный индекс фиксируется при первом рендере; дубликаты
   * ключей схлопываются в одну группу узлов.
   */
  key?: (item: T, index: number) => unknown;
  /** Item renderer, called with `(item, index)`. (РУС: Рендерер элемента, вызывается как `(item, index)`.) */
  children: (item: T, index: number) => JsxChild;
}

/**
 * Reactive list rendering between comment anchors (no wrapper element).
 * Without `key` the whole list re-renders on change — item functions are
 * expected to be cheap and pure; use `$()` inside them for fine-grained
 * bindings. With `key`, existing nodes are reused and reordered instead.
 *
 * РУС: Реактивный рендер списка между комментариями-анкорами (без обёртки).
 * Без `key` при изменении перерисовывается весь список — функции элементов
 * должны быть дешёвыми и чистыми; для тонких привязок используйте `$()` внутри
 * них. С `key` существующие узлы переиспользуются и переставляются.
 */
export function For<T>(props: ForProps<T>): DocumentFragment {
  const start = document.createComment('for');
  const end = document.createComment('/for');
  const frag = document.createDocumentFragment();
  frag.append(start, end);
  const render = childFn<[T, number], JsxChild>(unwrapChild(props.children), 'For');
  const keyOf = props.key;

  // Unkeyed: full re-render — simple and correct.
  // РУС: Без ключа: полный ре-рендер — просто и корректно.
  if (!keyOf) {
    // Every pass owns its effects; the previous pass is torn down before the
    // new nodes go in, so nothing from a removed render keeps running.
    // РУС: Каждый проход владеет своими эффектами; предыдущий проход сносится
    // до вставки новых узлов, поэтому снятый рендер ничего не продолжает.
    let passScope: Scope = createScope();
    let mounted: Node[] = [];
    const stop = effect(() => {
      const items = resolveSource(props.each) ?? [];
      const scope = createScope();
      const nodes: Node[] = [];
      runInScope(scope, () => {
        for (let i = 0; i < items.length; i++) {
          nodes.push(...toNodes(render(items[i], i)));
        }
      });
      // Tear down the previous pass: effects, then DOM bindings, then nodes.
      // РУС: Снимаем предыдущий проход: эффекты, затем DOM-привязки, затем узлы.
      dispose(passScope);
      for (const n of mounted) releaseBindings(n);
      passScope = scope;
      mounted = nodes;
      clearBetween(start, end);
      insertAll(nodes, end);
    });
    onScopeDispose(() => {
      stop();
      dispose(passScope);
    });
    return frag;
  }

  // Keyed: one GROUP of nodes per key (an item may render several nodes).
  // РУС: Keyed: одна ГРУППА узлов на ключ (элемент может рендерить несколько узлов).
  interface Group {
    nodes: Node[];
    scope: Scope;
  }
  let prev = new Map<unknown, Group>();
  const stopKeyed = effect(() => {
    const items = resolveSource(props.each) ?? [];
    const host = end.parentNode;
    if (!host) return;

    // Collect the new group order, reusing nodes by key. Checking `next`
    // first also collapses duplicate keys in one batch without a wasted
    // second render (first occurrence wins).
    // РУС: Собираем новый порядок групп, переиспользуя узлы по ключу. Проверка
    // `next` первой также схлопывает дубликаты ключей в одном батче без
    // потерянного второго рендера (побеждает первое вхождение).
    const next = new Map<unknown, Group>();
    for (let i = 0; i < items.length; i++) {
      const k = keyOf(items[i], i);
      const existing = next.get(k) ?? prev.get(k);
      if (existing) {
        next.set(k, existing);
        continue;
      }
      const scope = createScope();
      const nodes = runInScope(scope, () => toNodes(render(items[i], i)));
      next.set(k, { nodes, scope });
    }

    // Place the groups in list order before `end`. Moving only the nodes that
    // are actually out of place keeps a no-op update (same order, new array)
    // free: Node.prototype.insertBefore on a node that is already in position
    // is the single most expensive DOM call in the whole render.
    // РУС: Расставляем группы в порядке списка перед `end`. Двигаем только
    // узлы, стоящие не на своём месте: обновление «тот же порядок, новый
    // массив» тогда ничего не стоит, а insertBefore для узла на месте —
    // самый дорогой DOM-вызов всего рендера.
    let cursor: Node = start;
    for (const group of next.values()) {
      for (const n of group.nodes) {
        if (n.parentNode !== host || n.previousSibling !== cursor) host.insertBefore(n, end);
        cursor = n;
      }
    }

    // Drop the groups whose keys left the list: stop their effects, release
    // their DOM bindings, then remove the nodes.
    // РУС: Удаляем группы, чьи ключи исчезли из списка: останавливаем их
    // эффекты, снимаем DOM-привязки, затем убираем узлы.
    for (const [k, group] of prev) {
      if (next.has(k)) continue;
      dispose(group.scope);
      for (const n of group.nodes) {
        if (n.parentNode === host) {
          releaseBindings(n);
          host.removeChild(n);
        }
      }
    }
    prev = next;
  });
  onScopeDispose(() => {
    stopKeyed();
    for (const group of prev.values()) dispose(group.scope);
    prev = new Map();
  });
  return frag;
}

/** Props of `{@link Show}`. (РУС: Пропсы {@link Show}.) */
export interface ShowProps {
  /**
   * Condition: a boolean, `() => boolean` (re-evaluated, auto-tracked),
   * a `Signal` or a `$()`-bound value.
   *
   * РУС: Условие: boolean, `() => boolean` (пере-вычисляется, автотрекается),
   * `Signal` или привязанное значение `$()`.
   */
  when: ReactiveSource<boolean>;
  /**
   * Content shown while `when` is falsy. Static JSX is rendered once and
   * re-inserted on every toggle; a `() => JsxChild` function re-evaluates
   * each time the block is shown. Optional.
   *
   * РУС: Контент, показываемый пока `when` ложно. Статический JSX рендерится
   * один раз и пере-вставляется при каждом переключении; функция
   * `() => JsxChild` перевычисляется при каждом показе блока. Необязателен.
   */
  fallback?: JsxChild | (() => JsxChild);
  /**
   * Content shown while `when` is truthy. Static JSX is rendered once and
   * re-inserted on every toggle; a `() => JsxChild` function re-evaluates
   * each time the block is shown.
   *
   * РУС: Контент, показываемый пока `when` истинно. Статический JSX рендерится
   * один раз и пере-вставляется при каждом переключении; функция
   * `() => JsxChild` перевычисляется при каждом показе блока.
   */
  children: JsxChild | (() => JsxChild);
}

/** Reactive conditional rendering between comment anchors (no wrapper). (РУС: Реактивный условный рендер между комментариями-анкорами (без обёртки).) */
export function Show(props: ShowProps): DocumentFragment {
  const start = document.createComment('show');
  const end = document.createComment('/show');
  const frag = document.createDocumentFragment();
  frag.append(start, end);
  const child = unwrapChild(props.children);
  const fallback = props.fallback ?? null;
  let staticMain: Node[] | null = null;
  let staticFallback: Node[] | null = null;
  // Dynamic branches are rebuilt on every show, so the previous branch owns
  // its effects and bindings and must be torn down explicitly.
  // РУС: Динамические ветки строятся заново при каждом показе, поэтому
  // предыдущая ветка владеет своими эффектами и её надо снимать явно.
  let branchScope: Scope | null = null;
  let branchNodes: Node[] = [];

  const releaseBranch = (): void => {
    if (branchScope) {
      dispose(branchScope);
      branchScope = null;
    }
    for (const n of branchNodes) releaseBindings(n);
    branchNodes = [];
  };

  const stop = effect(() => {
    const show = !!resolveSource(props.when);
    const branch = show ? child : fallback;
    if (branch === null || branch === undefined || branch === false) {
      releaseBranch();
      clearBetween(start, end);
      return;
    }
    if (typeof branch === 'function') {
      releaseBranch();
      const scope = createScope();
      const nodes = runInScope(scope, () => toNodes((branch as () => JsxChild)()));
      branchScope = scope;
      branchNodes = nodes;
      clearBetween(start, end);
      insertAll(nodes, end);
      return;
    }
    // Static JSX is rendered once and re-inserted on toggle: it keeps its
    // effects for the whole lifetime of the Show.
    // РУС: Статический JSX рендерится один раз и пере-вставляется при
    // переключении: его эффекты живут всё время жизни Show.
    releaseBranch();
    let nodes = show ? staticMain : staticFallback;
    if (!nodes) {
      nodes = toNodes(branch as JsxChild);
      if (show) staticMain = nodes;
      else staticFallback = nodes;
    }
    clearBetween(start, end);
    insertAll(nodes, end);
  });

  onScopeDispose(() => {
    stop();
    releaseBranch();
  });
  return frag;
}