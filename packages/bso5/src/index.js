/**
 * BSO5 — Reactive DOM without the bloat. Just TypeScript.
 *
 * A tiny (~3.4 kB min+gzip) reactive DOM library with first-class JSX support
 * and zero dependencies:
 *
 * - `Signal` / `signal` / `effect` — atomic reactive primitives;
 * - `Reactive` — deep reactive proxy for plain objects and classes;
 * - `watch` — subscribe to a Signal or a reactive property path;
 * - `$` — bind reactive values directly into JSX children/attributes;
 * - `For` / `Show` — reactive list and conditional JSX components;
 * - `h` — universal element factory with full HTML tag typing;
 * - `releaseBindings` — stop reactive DOM bindings of a detached subtree;
 * - JSX runtime — use plain TSX with the TypeScript automatic transform.
 *
 * РУС: BSO5 — реактивный DOM без лишнего веса. Просто TypeScript.
 *
 * РУС: Крошечная (~3.4 kB min+gzip) реактивная DOM-библиотека с первоклассной
 * поддержкой JSX и нулём зависимостей:
 *
 * РУС: - `Signal` / `signal` / `effect` — атомарные реактивные примитивы;
 * РУС: - `Reactive` — глубокий реактивный прокси для объектов и классов;
 * РУС: - `watch` — подписка на Signal или реактивный путь свойства;
 * РУС: - `$` — привязка реактивных значений прямо в детей/атрибуты JSX;
 * РУС: - `For` / `Show` — реактивные JSX-компоненты списка и условия;
 * РУС: - `h` — универсальная фабрика элементов с типизацией всех HTML-тегов;
 * РУС: - `releaseBindings` — остановка реактивных DOM-привязок отсоединённого поддерева;
 * РУС: - JSX-рантайм — пишите обычный TSX с автоматическим трансформом TypeScript.
 *
 * @module
 */
export { Signal, signal, effect, Reactive, getPropertyName, isBoundValue, watch, $, REACTIVE_VALUE, } from './reactive.js';
export { h, hEl, flattenChildren, boundTextNode, appendChildren, releaseBindings, } from './dom.js';
export { For, Show, resolveSource } from './control.js';
export { createElement, Fragment, jsx, jsxs, jsxDEV, } from './jsx-runtime.js';
