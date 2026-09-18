/**
 * BSO5 — DOM construction helpers.
 *
 * `h(tag, attrs, ...children)` is the universal element factory: strongly
 * typed for every HTML tag, supports nested arrays, `null`/`undefined`/`false`
 * (rendered as nothing), reactive bound values (`$()`) in attributes, style
 * objects, event handlers and data-/aria- attributes. Reactive bindings can
 * be stopped later with `releaseBindings(root)` when a view is detached.
 *
 * РУС: BSO5 — хелперы конструирования DOM.
 *
 * РУС: `h(tag, attrs, ...children)` — универсальная фабрика элементов:
 * сильно типизирована для каждого HTML-тега, поддерживает вложенные массивы,
 * `null`/`undefined`/`false` (рендерится как ничего), реактивные привязанные
 * значения (`$()`) в атрибутах, style-объекты, обработчики событий и
 * data-/aria- атрибуты. Реактивные привязки можно позже остановить через
 * `releaseBindings(root)`, когда вью отсоединяется.
 *
 * @module
 */

import { isBoundValue, type BoundValue } from './reactive.js';

/** Anything that can be rendered as an element child. (РУС: Всё, что может быть отрендерено как ребёнок элемента.) */
export type Content = string | number | boolean | null | undefined | Node | BoundValue | Content[];

/** Attribute object for `h()`; values may be reactive bound values. (РУС: Объект атрибутов для `h()`; значения могут быть реактивными привязанными.) */
export type Attrs = Record<string, unknown> & {
  class?: string;
  className?: string;
  style?: Partial<CSSStyleDeclaration> | string;
};

/** Normalizes any Content into a flat list of renderable Nodes. (РУС: Нормализует любой Content в плоский список рендерабельных узлов.) */
export function flattenChildren(children: Content[]): Array<Node | string | number | BoundValue> {
  const out: Array<Node | string | number | BoundValue> = [];
  const walk = (c: Content): void => {
    if (c === null || c === undefined || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(walk); return; }
    out.push(c as Node | string | number | BoundValue);
  };
  children.forEach(walk);
  return out;
}

/** Cleanups of reactive DOM bindings, keyed by the node they update. (РУС: Очистки реактивных DOM-привязок, ключ — обновляемый ими узел.) */
const domBindings = new WeakMap<Node, Set<() => void>>();

/** Registers a binding cleanup for a node (used by `releaseBindings()`). (РУС: Регистрирует очистку привязки для узла (используется `releaseBindings()`).) */
function registerBinding(node: Node, stop: () => void): void {
  let set = domBindings.get(node);
  if (!set) domBindings.set(node, (set = new Set()));
  set.add(stop);
}

/**
 * Stops every reactive binding under `root` — `$()`-driven text nodes,
 * attributes and style properties. Call it when a view is detached from the
 * document so removed nodes stop receiving updates. Idempotent.
 *
 * РУС: Останавливает все реактивные привязки под `root` — текстовые узлы,
 * атрибуты и style-свойства, управляемые `$()`. Вызывайте, когда вью
 * отсоединяется от документа, чтобы удалённые узлы перестали получать
 * обновления. Идемпотентна.
 */
export function releaseBindings(root: Node): void {
  const stops = domBindings.get(root);
  if (stops) {
    for (const stop of [...stops]) stop();
    domBindings.delete(root);
  }
  root.childNodes.forEach(releaseBindings);
}

/** Creates a live-updating text node bound to a reactive value. (РУС: Создаёт живо-обновляющийся текстовый узел, привязанный к реактивному значению.) */
export function boundTextNode(value: unknown): Text {
  const read = () => (isBoundValue(value) ? value.value : value);
  const node = document.createTextNode(stringify(read()));
  if (isBoundValue(value)) {
    registerBinding(node, value.subscribe(() => { node.textContent = stringify(read()); }));
  }
  return node;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    const str = String(v);
    return str === '[object Object]' ? JSON.stringify(v) : str;
  }
  return String(v);
}

/** Sets a single style property, supporting reactive bound values. (РУС: Устанавливает одно style-свойство, поддерживая реактивные привязанные значения.) */
function setStyleProp(el: HTMLElement, prop: string, v: unknown): void {
  if (isBoundValue(v)) {
    (el.style as any)[prop] = stringify(v.value);
    registerBinding(el, v.subscribe(() => { (el.style as any)[prop] = stringify(v.value); }));
    return;
  }
  (el.style as any)[prop] = typeof v === 'number' ? `${v}px` : stringify(v);
}

/** Applies an attribute/property to an element, supporting reactive values. (РУС: Применяет атрибут/свойство к элементу, поддерживая реактивные значения.) */
function applyAttr(el: HTMLElement, key: string, value: unknown): void {
  if (isBoundValue(value)) {
    // Reactive attribute: apply now and keep it updated.
    // РУС: Реактивный атрибут: применяем сразу и держим обновлённым.
    applyAttrRaw(el, key, value.value);
    registerBinding(el, value.subscribe(() => applyAttrRaw(el, key, value.value)));
    return;
  }
  applyAttrRaw(el, key, value);
}

/** Applies a plain (non-reactive) attribute value. (РУС: Применяет обычное (нереактивное) значение атрибута.) */
function applyAttrRaw(el: HTMLElement, key: string, value: unknown): void {
  if (value === null || value === undefined || value === false) {
    el.removeAttribute(key);
    return;
  }
  if (key === 'class' || key === 'className') {
    el.className = String(value);
    return;
  }
  if (key === 'style') {
    if (typeof value === 'object' && value !== null) {
      // Style object: each property may itself be a reactive bound value.
      // РУС: Style-объект: каждое свойство само может быть реактивным привязанным значением.
      for (const [prop, v] of Object.entries(value as Record<string, unknown>)) {
        setStyleProp(el, prop, v);
      }
    } else if (value) {
      el.setAttribute('style', String(value));
    }
    return;
  }
  if (key === 'dataset' && typeof value === 'object') {
    Object.entries(value as Record<string, string>).forEach(([k, v]) => {
      el.dataset[k] = String(v);
    });
    return;
  }
  if (key.startsWith('on') && typeof value === 'function') {
    const event = key.slice(2).toLowerCase();
    el.addEventListener(event, value as EventListener);
    return;
  }
  if (key === 'value' || key === 'checked' || key === 'selected' || key === 'disabled') {
    // Live properties that must not be stringified.
    // РУС: Живые свойства, которые нельзя строковывать.
    (el as any)[key] = value;
    return;
  }
  if (key in el && typeof value !== 'object') {
    // Known DOM property (id, title, href, ...).
    // РУС: Известное DOM-свойство (id, title, href, ...).
    (el as any)[key] = value;
    return;
  }
  // Fallback: attribute (data-*, aria-*, custom).
  // РУС: Фолбэк: атрибут (data-*, aria-*, кастомные).
  el.setAttribute(key, typeof value === 'object' ? stringify(value) : String(value));
}

/**
 * The universal element factory.
 *
 * ```ts
 * h('div', { class: 'card', style: { color: 'red' } },
 *   h('span', null, 'Hello'),
 *   [h('br'), items.map(i => h('li', null, i))],
 * )
 * ```
 *
 * РУС: Универсальная фабрика элементов.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | ((el: HTMLElementTagNameMap[K]) => void) | null,
  ...children: Content[]
): HTMLElementTagNameMap[K] {
  return hEl(tag, attrs, children) as HTMLElementTagNameMap[K];
}

/** Shared implementation used by both `h()` and the JSX runtime. (РУС: Общая реализация, используемая и `h()`, и JSX-рантаймом.) */
export function hEl(
  tag: string,
  attrs: Attrs | ((el: any) => void) | null | undefined,
  children: Content[],
): HTMLElement {
  const el = document.createElement(tag);
  if (typeof attrs === 'function') {
    attrs(el);
  } else if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'children') continue; // handled separately by JSX runtime
      // РУС: обрабатывается отдельно JSX-рантаймом
      applyAttr(el, key, value);
    }
  }
  appendChildren(el, children);
  return el;
}

/** Recursively appends flattened children (bound values become text nodes). (РУС: Рекурсивно добавляет сплющенных детей (привязанные значения становятся текстовыми узлами).) */
export function appendChildren(parent: Node, children: Content[]): void {
  for (const child of children) {
    if (isBoundValue(child)) {
      parent.appendChild(boundTextNode(child));
    } else if (child === null || child === undefined || typeof child === 'boolean') {
      continue;
    } else if (Array.isArray(child)) {
      appendChildren(parent, child);
    } else if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(document.createTextNode(String(child)));
    } else {
      parent.appendChild(child as Node);
    }
  }
}

export { applyAttr };
