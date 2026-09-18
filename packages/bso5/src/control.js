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
import { Signal, effect, isBoundValue } from './reactive.js';
import { boundTextNode, flattenChildren, releaseBindings } from './dom.js';
/** Reads the current value of a reactive source; auto-tracks inside `effect()`. (РУС: Читает текущее значение реактивного источника; автотрекается внутри `effect()`.) */
export function resolveSource(src) {
    if (typeof src === 'function')
        return src();
    if (src instanceof Signal)
        return src.value;
    if (isBoundValue(src))
        return src.value;
    return src;
}
/** Normalizes any JsxChild into concrete DOM nodes. (РУС: Нормализует любой JsxChild в конкретные DOM-узлы.) */
function toNodes(child) {
    return flattenChildren([child]).map(c => {
        if (typeof c === 'string' || typeof c === 'number')
            return document.createTextNode(String(c));
        if (isBoundValue(c))
            return boundTextNode(c);
        return c;
    });
}
/**
 * Unwraps `[fn]` — the shape the JSX runtime delivers for a function child —
 * into the bare function.
 *
 * РУС: Разворачивает `[fn]` — форму, которую JSX-рантайм доставляет для
 * ребёнка-функции — в саму функцию.
 */
function unwrapChild(children) {
    return Array.isArray(children) && children.length === 1 && typeof children[0] === 'function'
        ? children[0]
        : children;
}
/** Requires a function child, with a helpful error message. (РУС: Требует ребёнка-функцию с понятным сообщением об ошибке.) */
function childFn(children, what) {
    const fn = Array.isArray(children) ? children[0] : children;
    if (typeof fn !== 'function') {
        throw new TypeError(`bso5: <${what}> requires a function child, e.g. {(item, i) => <li />}`);
    }
    return fn;
}
/** Removes every node rendered between the two anchors. (РУС: Удаляет все узлы, отрендеренные между двумя анкорами.) */
function clearBetween(start, end) {
    const host = end.parentNode;
    if (!host)
        return;
    let node = start.nextSibling;
    while (node && node !== end) {
        const next = node.nextSibling;
        host.removeChild(node);
        node = next;
    }
}
/** Inserts `nodes` right before the end anchor (fragments and live parents). (РУС: Вставляет `nodes` прямо перед конечным анкором (фрагменты и живые родители).) */
function insertAll(nodes, end) {
    const host = end.parentNode;
    if (!host)
        return;
    for (const n of nodes)
        host.insertBefore(n, end);
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
export function For(props) {
    const start = document.createComment('for');
    const end = document.createComment('/for');
    const frag = document.createDocumentFragment();
    frag.append(start, end);
    const render = childFn(unwrapChild(props.children), 'For');
    const keyOf = props.key;
    // Unkeyed: full re-render — simple and correct.
    // РУС: Без ключа: полный ре-рендер — просто и корректно.
    if (!keyOf) {
        effect(() => {
            const items = resolveSource(props.each) ?? [];
            const nodes = [];
            for (let i = 0; i < items.length; i++) {
                nodes.push(...toNodes(render(items[i], i)));
            }
            clearBetween(start, end);
            insertAll(nodes, end);
        });
        return frag;
    }
    // Keyed: one GROUP of nodes per key (an item may render several nodes).
    // РУС: Keyed: одна ГРУППА узлов на ключ (элемент может рендерить несколько узлов).
    let prev = new Map();
    effect(() => {
        const items = resolveSource(props.each) ?? [];
        const host = end.parentNode;
        if (!host)
            return;
        // Collect the new group order, reusing nodes by key. Checking `next`
        // first also collapses duplicate keys in one batch without a wasted
        // second render (first occurrence wins).
        // РУС: Собираем новый порядок групп, переиспользуя узлы по ключу. Проверка
        // `next` первой также схлопывает дубликаты ключей в одном батче без
        // потерянного второго рендера (побеждает первое вхождение).
        const next = new Map();
        for (let i = 0; i < items.length; i++) {
            const k = keyOf(items[i], i);
            next.set(k, next.get(k) ?? prev.get(k) ?? toNodes(render(items[i], i)));
        }
        // Place the groups in list order before `end`. insertBefore MOVES nodes
        // that are already mounted, so reused groups are reordered, not rebuilt;
        // new groups are mounted here as well.
        // РУС: Расставляем группы в порядке списка перед `end`. insertBefore
        // ПЕРЕМЕЩАЕТ уже смонтированные узлы, поэтому переиспользуемые группы
        // переставляются, а не пересоздаются; новые группы монтируются здесь же.
        for (const nodes of next.values()) {
            for (const n of nodes)
                host.insertBefore(n, end);
        }
        // Drop the groups whose keys left the list, stopping their bindings.
        // РУС: Удаляем группы, чьи ключи исчезли из списка, останавливая их привязки.
        for (const [k, nodes] of prev) {
            if (next.has(k))
                continue;
            for (const n of nodes) {
                if (n.parentNode === host) {
                    releaseBindings(n);
                    host.removeChild(n);
                }
            }
        }
        prev = next;
    });
    return frag;
}
/** Reactive conditional rendering between comment anchors (no wrapper). (РУС: Реактивный условный рендер между комментариями-анкорами (без обёртки).) */
export function Show(props) {
    const start = document.createComment('show');
    const end = document.createComment('/show');
    const frag = document.createDocumentFragment();
    frag.append(start, end);
    const child = unwrapChild(props.children);
    const fallback = props.fallback ?? null;
    let staticMain = null;
    let staticFallback = null;
    effect(() => {
        const show = !!resolveSource(props.when);
        const branch = show ? child : fallback;
        if (branch === null || branch === undefined || branch === false) {
            clearBetween(start, end);
            return;
        }
        if (typeof branch === 'function') {
            const nodes = toNodes(branch());
            clearBetween(start, end);
            insertAll(nodes, end);
            return;
        }
        let nodes = show ? staticMain : staticFallback;
        if (!nodes) {
            nodes = toNodes(branch);
            if (show)
                staticMain = nodes;
            else
                staticFallback = nodes;
        }
        clearBetween(start, end);
        insertAll(nodes, end);
    });
    return frag;
}
