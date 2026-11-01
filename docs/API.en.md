# bso5 — API reference

Complete public API of both packages: signatures, semantics, edge cases and known
limits. Written to be readable by a human and by an agent: one unit of knowledge per
section, with an explicit signature.

Русская версия: [API.md](./API.md).

Versions: `bso5` **0.4.0**, `bso5-components` **0.2.0**. Sizes: 4.2 and 2.5 kB min+gzip,
no dependencies (besides the `bso5` peer of the components).

- Task-oriented recipes — [GUIDE.en.md](./GUIDE.en.md).
- Markup, class names and CSS of the components — [TREE_GRID.md](./TREE_GRID.md).
- Deliberate trade-offs — [COMPROMISES.md](./COMPROMISES.md).

---

## 0. Install and requirements

```bash
npm install bso5                 # core only
npm install bso5 bso5-components # core + components
```

| What | Requirement |
| --- | --- |
| Browser | ES2020, native ES modules |
| Build | anything with the `react-jsx` transform (tsc, esbuild, vite) — or nothing at all: `dist` is already ESM |
| Package development | Node ≥ 22.12 (vitest 5), npm ≥ 10 (lockfile v3) |
| TypeScript | ≥ 5.0 |

`tsconfig.json` for JSX:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bso5"          // or "bso5-components" — same runtime
  }
}
```

Export map of `bso5`: `"."`, `"./jsx-runtime"`, `"./jsx-dev-runtime"`, `"./package.json"`.
`bso5-components` has the same plus its own runtime re-export.

Without a bundler:

```html
<script type="importmap">
{ "imports": {
    "bso5": "./packages/bso5/dist/index.js",
    "bso5/jsx-runtime": "./packages/bso5/dist/jsx-runtime.js",
    "bso5-components": "./packages/bso5-components/dist/index.js"
} }
</script>
<script type="module">import { h, signal } from 'bso5'; /* … */</script>
```

Runnable example — [`examples/importmap`](../examples/importmap/index.html).

---

## 1. State

### `Signal<T>`

An atomic reactive value.

```ts
class Signal<T> {
  constructor(initial: T);
  get value(): T;                 // read; inside effect() registers a dependency
  set value(next: T);             // write; notifies only on real change (Object.is)
  peek(): T;                      // read without tracking
  update(fn: (current: T) => T): void;   // write derived from the current value, untracked read
  subscribe(cb: () => void): () => void; // manual subscription; returns an unsubscribe
}
```

- `set` compares with `Object.is`: `signal(0); s.value = 0` notifies nobody.
- `subscribe` callbacks run **synchronously** after the write (inside `batch` — once at the end).
- Subscriptions live in a `Set`, so re-subscribing the same callback does not duplicate it.

### `signal<T>(initial: T): Signal<T>`

```ts
const count = signal(0);
```

### `Reactive<T extends object>`

Deep reactive proxy over a plain object or a class instance.

```ts
class Reactive<T extends object> {
  constructor(raw: T);            // throws if the object is already wrapped
  get value(): T;                 // proxy tree; nested objects are wrapped lazily
  get target(): T;                // raw object: reads/writes are not tracked
  watch(path: ((t: T) => any) | string, cb: () => void): () => void;
  dispose(): void;                // stops subscriptions and effect tracking
}
```

- `watch(x => x.user.name, cb)` fires on `x.user.name = …` **and** on `x.user = { … }`
  (the nested path re-binds to the new object).
- Index notation works: `x => x.rows[0].done`, `'rows.0.done'`.
- The accessor must be a **plain, pure property chain**: it is executed once to trace
  the path. Expressions (`x => x.a + 1`), method calls and `async` are rejected —
  `watch()` throws, `$()` returns a non-reactive value.
- `dispose()` makes the proxy inert for reactivity: reads and writes keep working,
  subscribers simply stop being notified.

**What is not wrapped** (passes through, no proxy, no reactivity):
`Map`, `Set`, `WeakMap`, `WeakSet`, `Promise`, `Date`, `RegExp`, `Error`,
`ArrayBuffer` and typed arrays, `Blob`/`File`, `AbortController`/`AbortSignal`,
`FormData`, `URL`/`URLSearchParams`, and any DOM node.

```
model.value.cache.set(k, v);    // works, but does NOT notify subscribers
model.value.cache = new Map(…); // notifies — replace the value as a whole
```

Reason: a built-in method invoked through a proxy receives the proxy as `receiver`
and throws `TypeError: Method Map.prototype.set called on incompatible receiver`.

### `watch(source, path, cb): () => void`

Free-standing subscription: `source` is either a `Signal` (then `path` is ignored) or a
`Reactive` value/proxy (then `path` is an accessor or a dotted string).

```ts
const stop = watch(model.value, x => x.user.name, () => { /* … */ });
```

### `getPropertyName(fn): string | null`

Traces an accessor path (`x => x.items[0].title` → `'items.0.title'`). Returns `null`
when the accessor is not a plain property chain. Exported for tooling; not needed in
regular code.

### `Reactive` vs `Signal`: which one

| Need | Use |
| --- | --- |
| a single value with simple updates | `Signal` |
| an object/model with nested fields and path-level subscriptions | `Reactive` |
| a value derived from several sources | `computed` |
| a value usable both as an attribute and as text | `$()` |

---

## 2. Reactive computations

### `effect(fn, options?): () => void`

Runs `fn` immediately and re-runs it whenever any `Signal` or `Reactive` property it
read changes (synchronously, unless inside `batch`).

```ts
interface EffectOptions {
  onError?: (error: unknown) => void;
}
```

- Returns a stop function (idempotent).
- Dependencies are reset before every run: what is no longer read stops triggering.
- An exception inside the effect is **not** propagated to the code that wrote the
  signal. The default sink is `console.error`, overridable per effect (`onError`) or
  globally (`setEffectErrorHandler`).
- An effect that both reads and writes the same signal does not recurse: synchronous
  recursion is guarded (`rec.running`). Still, prefer `peek()`/`update()`.
- Nested effects are supported; an effect created inside an ownership scope stops
  with that scope (see §5).

### `setEffectErrorHandler(handler: ((error: unknown) => void) | null): void`

Global sink for effect errors. `null` restores `console.error`.
Priority: per-effect `onError` → global handler → `console.error`.
If the handler itself throws, the error goes to `console.error` and the graph keeps going.

### `computed<T>(fn): Signal<T>`

A derived value: recomputes when a dependency changes and notifies readers only when
the result actually changed (`Object.is`).

```ts
const count = signal(2);
const doubled = computed(() => count.value * 2);   // Signal<number>
doubled.value;                                      // 4
```

- Recomputation is **eager** (on dependency change, not on read): there is no lazy cache.
- Returns a `Signal`, so it fits `$()`, `each`, `<Show when>` and plain reads inside `effect()`.
- Inside a scope (`mount()`, `<For>`, `<Show>`) it stops together with the scope.

### `batch<T>(fn: () => T): T`

Groups writes: dependent effects and listeners run once at the end of the block.
Nested `batch` calls collapse into one. Listeners are deduplicated by identity,
effects by record.

```ts
batch(() => { a.value = 10; b.value = 20; });  // one effect run
```

### `untrack<T>(fn: () => T): T`

Runs `fn` without registering what it reads as a dependency of the current effect.

```ts
effect(() => { render(tracked.value, untrack(() => ignored.value)); });
```

---

## 3. Binding to the DOM: `$()`

### `$(source, path?): BoundValue<T>`

The bridge between state and markup. Accepts a `Signal` (`$(countSignal)`) or a
`Reactive` value/proxy plus an accessor (`$(model.value, x => x.user.name)`).
The result is used as a child or as an attribute value; the DOM is patched in place.

```tsx
<p>Count: {$(count)}</p>
<input value={$(model.value, x => x.name)} />
<div style={{ color: $(model.value, x => x.color) }} />
```

- `BoundValue<T>` is an object with the `REACTIVE_VALUE` marker, a `value` getter and
  `subscribe`. Type guard: `isBoundValue(v)`.
- `$()` over a **plain** object (not `Reactive`) resolves once and never updates.
- Do not interpolate it into a string: `` `total: ${$(count)}` `` yields `[object Object]`.
  Bind the child/attribute itself, not a string around it.
- The accessor is a plain property chain (see `Reactive.watch`).
- Inside an ownership scope the binding is released together with its node (`releaseBindings`).

---

## 4. Elements: `h()` and JSX

### `h(tag, attrs?, ...children): HTMLElementTagNameMap[tag]`

Universal factory, typed per HTML tag. The JSX transform calls the same implementation
(`hEl`), so the rules below are identical for both.

`attrs` may be an object or a function `(el) => void`:

```ts
h('input', el => el.focus());
```

**Attribute rules:**

| Key | Value | Behaviour |
| --- | --- | --- |
| `class`, `className` | string | `el.className = value` (synonyms; if both, the last one wins) |
| `style` | string | `setAttribute('style', value)` |
| `style` | object | per property: `el.style[prop] = value` |
| `style` value | number | **always** gains `px`: `{ width: 10 }` → `10px`; unitless props (`opacity`, `zIndex`) must be strings |
| `style` value | `$()` | the property becomes reactive |
| `onClick`, `onInput`, … | function | `addEventListener('click' / 'input' / …)`; camelCase required |
| `onDoubleClick` | function | the `dblclick` event |
| `onInputCapture` | function | capture phase (`{ capture: true }`) |
| `value`, `checked`, `selected`, `disabled` | any | assigned as a **property**, not a string |
| `value` on `<select>` | any | applied **after** its `<option>`s exist |
| `dataset` | object | `el.dataset[k] = String(v)` |
| `ref` | `(el) => void` | called with the created element (before children are appended) |
| `data-*`, `aria-*`, anything else | any | `setAttribute` when the element has no such property |
| any key | `null`/`undefined`/`false` | `removeAttribute(key)` |
| any key | `$()` | applied now and kept in sync with the source |

**Children rules:** `string`/`number` → text node; `null`/`undefined`/`true`/`false` →
nothing; array → recursive; `Node` → as is; `$()` → a live text node.

**Not supported:** object `ref` (`{ current }`), option-free `on*Capture` semantics,
`class` normalization from arrays/objects, `dangerouslySetInnerHTML`.

### `hEl(tag, attrs, children[]): HTMLElement`

Same, but `children` is an array (used by the JSX runtime; rarely useful publicly).

### `parseEventProp(key): { event: string; capture: boolean }`

`'onDoubleClick'` → `{ event: 'dblclick', capture: false }`,
`'onInputCapture'` → `{ event: 'input', capture: true }`.

### JSX runtime

```ts
createElement(tag, props, ...children): Node
jsx / jsxs / jsxDEV(tag, props, key?): Node   // react-jsx entry points
Fragment({ children }): DocumentFragment
```

- A function tag is called with the props (including `children`) and must return a `Node`.
- `key` never lands in the props of intrinsic tags; for function components it is folded
  back into the props (needed by `<For key>`).
- Types: `JsxChild`, `JsxNode`, `Component<P>`, `DOMAttributes`, `namespace JSX`.

---

## 5. Lifecycle and effect ownership

### `mount(target, view): { node, dispose }`

```ts
function mount(target: Element | DocumentFragment, view: Node | (() => Node)): Mounted;
interface Mounted { readonly node: Node; readonly dispose: () => void; }
```

- Pass a **thunk** (`() => <App />`) to hand ownership of the view's effects to the
  mount scope, so they stop with it. A ready-made node is accepted too, but its effects
  were already created outside any scope.
- `dispose()`: `releaseBindings` over the subtree → `dispose(scope)` → node removal.
  Idempotent.

### Ownership scopes

```ts
interface Scope { readonly stops: Set<() => void>; disposed: boolean }
createScope(): Scope
dispose(scope): void                       // idempotent, rejects new registrations
runInScope<T>(scope, fn: () => T): T       // effects created inside fn belong to scope
onScopeDispose(fn): void                   // cleanup on dispose; no-op outside a scope
getCurrentScope(): Scope | null
```

`effect()` called inside `runInScope` registers its stop function in that scope.
`<For>`, `<Show>` and `mount()` build scopes themselves.

**Contract boundary:** ownership exists only where there is `mount()`, `<For>` or
`<Show>`. A module-level `effect()` has no owner — stop it manually.

### `releaseBindings(root: Node): void`

Stops every `$()` binding (text, attributes, style) inside the subtree. Idempotent;
effects are not touched — that is what scopes are for.

---

## 6. Lists and conditionals

### `<For each={…} key={…?}>{(item, index) => …}</For>`

```ts
interface ForProps<T> {
  each: ReactiveSource<readonly T[]>;
  key?: (item: T, index: number) => unknown;
  children: (item: T, index: number) => JsxChild;
}
type ReactiveSource<T> = T | (() => T) | Signal<T> | BoundValue<T>;
```

Renders between comment anchors, without a wrapper element.

**Without `key`** — the whole list re-renders on any change; item functions must be
cheap; effects and bindings of the previous pass are released.

**With `key`** — keyed reconciliation:

- DOM nodes are reused and moved (`insertBefore`), and only nodes that are out of place
  are moved;
- while a key stays in the list its nodes are **not re-rendered** (key = identity):
  changed data does not appear by itself — bind fields with `$()` or change the key
  (fingerprint recipe in [GUIDE.en.md](./GUIDE.en.md#4-lists-with-the-keyed-mode));
- the rendered index is captured at first render;
- duplicate keys collapse into one group (the first occurrence wins);
- when a key leaves the list, its group's effects are stopped and bindings released.

### `<Show when={…} fallback={…?}>{…}</Show>`

```ts
interface ShowProps {
  when: ReactiveSource<boolean>;
  fallback?: JsxChild | (() => JsxChild);
  children: JsxChild | (() => JsxChild);
}
```

- Also wrapper-free (comment anchors).
- `children`/`fallback` are a **thunk** or a ready `JsxChild`.
- A thunk is rebuilt on every show and torn down on every hide: a hidden branch stops
  reacting to model changes.
- A ready node cannot be re-bound (its subscriptions live in a `WeakMap` keyed by the
  node itself), so it is cached and lives until the whole `<Show>` is disposed. Need a
  real teardown — pass a thunk.
- A node branch is not rebuilt when the decision did not change
  (`when={() => count > 10}` does not touch the DOM on every `count` write).
- A thunk is re-evaluated on every effect run — it may read reactive values itself.

### `resolveSource(src): T`

Reads a `ReactiveSource` value (plain value, thunk, `Signal`, `$()`); tracked
automatically inside `effect()`. Handy when writing your own components.

---

## 7. Resources and performance

| Operation | 1 000 | 10 000 | Environment |
| --- | --- | --- | --- |
| Build `Grid` (grouping + `rowKey`) | 64 ms | 1 480 ms | jsdom |
| Insert a ready grid | 5 ms | 44 ms | jsdom |
| Sort by click (2 clicks) | 96–102 ms | 7.6–9.3 s | jsdom |
| Keyed list update, same order | — | **1.8 ms** | jsdom |
| `Tree` search (filter + render) | 0.9 ms | 4.5 ms | jsdom |

jsdom moves nodes roughly 30× slower than a browser: absolute DOM numbers are inflated,
ratios are meaningful. Reproduce with `npm run build && npm run bench`
(or `BENCH_SIZES=1000`).

**Known performance limits:**

- `Tree` re-renders the whole tree on every snapshot (it is not keyed) — hence the
  default search debounce; 10k expanded nodes means 10k DOM nodes;
- there is no virtualization in `Grid` or `Tree`;
- `Reactive` tracks property reads through a `Proxy` — hot loops are better served by
  `Signal` or by `.target`.

---

## 8. Limits and missing features

| Missing | Consequence / workaround |
| --- | --- |
| SSR / hydration | `h()` and `<For>` use the global `document`; server rendering is impossible |
| Portals | mount into the needed node with `mount()` |
| Object `ref` | `ref={el => …}`, keep the reference yourself |
| `class` from objects/arrays | build the string yourself |
| Lazy `computed` | recomputation is eager; cache manually for expensive work |
| Multi-column sorting | `Grid` sorts by a single column |
| Virtualization | no render window |
| Error boundaries | effect errors go to `console.error`/`onError`; rendering is not intercepted |
| Auto-batching | synchronous writes run effects one by one; group them with `batch()` |

---

## 9. Components: `<Grid>`

```ts
function Grid<Row>(props: GridProps<Row>): HTMLElement;
```

A grid: filter → sort → group, with state local to the instance.

```ts
interface GridProps<Row> {
  rows: ReactiveSource<readonly Row[]>;
  columns: readonly Column<Row>[];
  filter?: (row: Row, loweredQuery: string) => boolean;
  groupBy?: (row: Row) => string | null;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowKey?: (row: Row) => unknown;
  searchPlaceholder?: string;
  searchDebounce?: number | false;      // 120 ms by default
  searchDebounceMinItems?: number;      // 200 rows by default
  empty?: string;
  labels?: Partial<GridLabels>;
  class?: string;                       // root, 'grid' by default
}

interface Column<Row> {
  key: string;                          // column id, remembers the active sort
  header: string;
  cell: (row: Row) => JsxChild;
  sort: (row: Row) => string | number;  // sort value and default search text
  sortable?: boolean;                   // default true
  class?: string;                       // td class
  headerClass?: string;                 // th class
}

interface GridLabels {
  search?: string;           // search aria-label, 'Search'
  searchPlaceholder?: string;// 'Search…'
  sortDirection?: string;    // control aria-label, 'Sort direction'
  descending?: string;       // '↓ desc'
  ascending?: string;        // '↑ asc'
  rows?: string;             // counter prefix, 'rows:'; '' keeps the number only
}
```

**Behaviour:**

- Default search is a case-insensitive substring over `String(sort(row))` of every
  column; a custom matcher is `filter(row, loweredQuery)` (`loweredQuery` is already
  lower-cased).
- Sorting: clicking a `th` sorts descending; clicking the same column again flips the
  direction; `sortable: false` disables it. One column at a time.
- Grouping: group order follows first occurrence in the sorted list; `groupBy` → `null`
  produces an ungrouped bucket rendered before the groups.
- `rowKey` enables the keyed mode: sorting moves nodes instead of recreating them.
  **Cells of existing rows are not updated** — see §11 "key = identity".
- The counter shows the number of rows after filtering (collapsed groups are still counted).
- Search debounce kicks in only from `searchDebounceMinItems` rows; `searchDebounce: false`
  disables it entirely.

**Accessibility:** `th[scope=col]`, `aria-sort` on the active column, the group row is
`tabindex="0"` with `aria-expanded` and toggles on Enter/Space, `aria-label` on the
search box and on the direction control.

---

## 10. Components: `<Tree>`

```ts
function Tree(props: TreeProps): HTMLElement;

interface TreeData {
  label: string;
  meta?: string;                          // secondary text; also searched
  children?: readonly TreeData[] | null;  // null/absent — a leaf
  labelClass?: string;
}

interface TreeProps {
  root: ReactiveSource<TreeData | null>;
  searchPlaceholder?: string;
  searchDebounce?: number | false;        // 120 ms
  searchDebounceMinItems?: number;        // 200 nodes
  showExpandAll?: boolean;                // bulk expand/collapse buttons, default false
  nodeKey?: (node: TreeData, path: string[]) => unknown;  // expansion key, path by default
  renderLabel?: (node: TreeData) => JsxChild;
  empty?: string;
  labels?: Partial<TreeLabels>;
  class?: string;                         // extra `.tree` class
}

interface TreeLabels {
  search?: string;           // 'Search'
  searchPlaceholder?: string;// 'Search…'
  matched?: string;          // counter prefix, 'matched:'; '' hides it
  expandAll?: string;        // 'Expand all'
  collapseAll?: string;      // 'Collapse all'
}
```

**Behaviour:**

- Search: a substring over `label` **and** `meta`; nodes with a matching descendant are
  kept; while the query is non-empty everything is expanded and matches get the `match`
  class.
- Expansion is stored by `nodeKey(node, path)` (the `label/label/…` path by default).
- `children: []` counts as a folder (renders a toggle with no children); `null` is a leaf.
- The snapshot is rebuilt on every data/query/expansion change and the tree re-renders
  as a whole (deliberate, see [COMPROMISES.md](./COMPROMISES.md)).

**Keyboard:** a single `Tab` stop (the root row), `ArrowDown`/`ArrowUp` move focus over
visible rows, `Enter`/`Space` toggles, `ArrowRight`/`ArrowLeft` expands/collapses. Focus
is restored to the same node after a re-render.

**Accessibility:** `role="tree"` + `aria-label` (the root label), `role="treeitem"` +
`aria-expanded`, `role="group"` on children.

---

## 11. Key = identity (the most important trap)

In the keyed `<For>` mode and in `Grid` with `rowKey`, a node whose key stayed in the
list is **not re-rendered**. Therefore:

```tsx
// ❌ the value freezes at first render
{ key: 'title', header: 'Title', sort: r => r.title, cell: r => r.title }

// ✅ point binding: the field updates, the node (and focus) survive
{ key: 'title', header: 'Title', sort: r => r.title, cell: r => <b>{$(r, x => x.title)}</b> }

// ✅ or a fingerprint key: the node is recreated on a real change
rowKey={r => `${r.id}:${r.updated}`}
```

`$()` inside `cell` works only when the row is a reactive proxy (`Reactive`); on a plain
array the binding resolves once.

---

## 12. Component markup classes

- `Grid`: `grid`, `toolbar`, `search`, `dir`, `chip`, `arrow`, `group-row`, `toggle`,
  `count`, `empty` (+ `class`/`headerClass` of columns).
- `Tree`: `tree`, `toolbar`, `search`, `bulk`, `expand-all`, `collapse-all`, `chip`,
  `node`, `row`, `caret`, `leaf`, `name`, `dir`, `match`, `meta`, `kids`, `empty`.

Markup, attributes and a minimal CSS — [TREE_GRID.md](./TREE_GRID.md).
