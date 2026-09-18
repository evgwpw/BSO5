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
import { type BoundValue } from './reactive.js';
/** Anything that can be rendered as an element child. (РУС: Всё, что может быть отрендерено как ребёнок элемента.) */
export type Content = string | number | boolean | null | undefined | Node | BoundValue | Content[];
/** Attribute object for `h()`; values may be reactive bound values. (РУС: Объект атрибутов для `h()`; значения могут быть реактивными привязанными.) */
export type Attrs = Record<string, unknown> & {
    class?: string;
    className?: string;
    style?: Partial<CSSStyleDeclaration> | string;
};
/** Normalizes any Content into a flat list of renderable Nodes. (РУС: Нормализует любой Content в плоский список рендерабельных узлов.) */
export declare function flattenChildren(children: Content[]): Array<Node | string | number | BoundValue>;
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
export declare function releaseBindings(root: Node): void;
/** Creates a live-updating text node bound to a reactive value. (РУС: Создаёт живо-обновляющийся текстовый узел, привязанный к реактивному значению.) */
export declare function boundTextNode(value: unknown): Text;
/** Applies an attribute/property to an element, supporting reactive values. (РУС: Применяет атрибут/свойство к элементу, поддерживая реактивные значения.) */
declare function applyAttr(el: HTMLElement, key: string, value: unknown): void;
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
export declare function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | ((el: HTMLElementTagNameMap[K]) => void) | null, ...children: Content[]): HTMLElementTagNameMap[K];
/** Shared implementation used by both `h()` and the JSX runtime. (РУС: Общая реализация, используемая и `h()`, и JSX-рантаймом.) */
export declare function hEl(tag: string, attrs: Attrs | ((el: any) => void) | null | undefined, children: Content[]): HTMLElement;
/** Recursively appends flattened children (bound values become text nodes). (РУС: Рекурсивно добавляет сплющенных детей (привязанные значения становятся текстовыми узлами).) */
export declare function appendChildren(parent: Node, children: Content[]): void;
export { applyAttr };
