# bso5

Reactive DOM without the bloat. A tiny (~3.4 kB min+gzip) TypeScript library that gives you
signals, deep reactive state and first-class **JSX support — with no framework, no virtual DOM
and no compiler beyond the standard JSX transform**.

```tsx
import { Reactive, $ } from 'bso5';

const state = new Reactive({ count: 0, user: { name: 'World' } });

document.body.appendChild(
  <main>
    <h1>Hello, {$(state.value, x => x.user.name)}!</h1>
    <p>Count: <strong>{$(state.value, x => x.count)}</strong></p>
    <button onClick={() => state.value.count++}>+1</button>
  </main>
);
```

Updates are **fine-grained**: writing `state.value.count = 5` patches exactly one text node.
No component ever re-renders.

## Install

```sh
npm install bso5
```

Requires TypeScript ≥ 5.0 (for `react-jsx` + custom `jsxImportSource`) or any
esbuild/Vite-based build with the automatic JSX transform.

## Setup (JSX)

In your `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bso5"
  }
}
```

For Vite (or plain esbuild) add the same options to `esbuild`:

```ts
// vite.config.ts
export default {
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'bso5',
  },
};
```

No JSX? Use the `h()` factory directly — everything else works identically.

## Core concepts

| Export | Purpose |
| --- | --- |
| `Signal<T>` / `signal(v)` | Atomic reactive value: `.value` get/set, `.peek()`, `.update()`, `.subscribe()` |
| `Reactive<T>` | Deep reactive proxy over a plain object, with path subscriptions |
| `effect(fn)` | Auto-tracked computation: re-runs when anything it read changes |
| `watch(src, path, cb)` | Manual subscription to a `Signal` or a `Reactive` property path |
| `$(src, path?)` | Create a **bound value** for JSX children and attributes |
| `<For each={…}>` | Reactive list rendering; optional `key` enables DOM-node reuse |
| `<Show when={…}>` | Reactive conditional rendering, with an optional `fallback` |
| `h(tag, attrs, ...kids)` | Universal element factory (strongly typed per HTML tag) |
| `releaseBindings(root)` | Stop the reactive DOM bindings of a detached subtree |
| `Fragment` | JSX fragment; `bso5/jsx-runtime` — automatic JSX entry points |

### Signal

```ts
import { signal, effect } from 'bso5';

const name = signal('ann');

effect(() => {
  console.log(name.value); // 'ann', then 'bob'
});

name.value = 'bob';   // notifies subscribers and effects
name.peek();          // 'bob' — read without tracking
name.update(v => v + '!');  // update from current value (untracked read)
```

### Reactive

```ts
import { Reactive, watch } from 'bso5';

const state = new Reactive({
  user: { name: 'ann', address: { city: 'Rome' } },
  tags: ['a', 'b'],
});

// Watch a nested path — an accessor or a 'user.address.city' string.
watch(state.value, x => x.user.address.city, () => { /* ... */ });
// Index notation works too: 'rows.1.done' via accessor or string.
watch(state.value, x => x.rows[1].done, () => { /* ... */ });

state.value.user.address.city = 'Milan';  // fires the watcher
state.value.user = { name: 'bob', ... };  // re-binds nested paths automatically
state.value.tags.push('c');               // arrays supported (length tracked)
```

`.value` returns the reactive proxy tree; `.target` exposes the raw object
(reads/writes there are untracked). `dispose()` stops all subscriptions and
effect tracking — bindings go quiet while reads/writes through the proxy keep
working as a plain pass-through.


### Bound values: `$()`

`$()` is the bridge between state and markup. Use it as a **JSX child** or an
**attribute value** and it keeps the DOM up to date:

```tsx
<p>Count: {$(state.value, x => x.count)}</p>
<input value={$(state.value, x => x.name)} disabled={$(state.value, x => x.busy)} />
<div style={{ color: $(state.value, x => x.color) }}>colored</div>
```

- `$()` accepts a `Signal` (`$(countSignal)`) or a `Reactive` proxy + path accessor.
- The path accessor must be a **plain, pure property chain** (`x => x.user.name`;
  `x => x.items[0].title` — index notation supported). It is *executed* once per
  subscription to trace the path, so it must have no side effects. Computed
  expressions (`x => x.count + 1`) and method calls are rejected. Wrap those in
  `effect()` instead.
- Bound values can't be interpolated into template strings — `label={`+${$(...)}`}` renders
  `[object Object]`. Bind the attribute/child itself, not a string around it.

### Lists and conditionals: `<For>` and `<Show>`

JSX expressions evaluate **once** at mount. For reactive lists and conditions use
`<For>` / `<Show>` — they render between invisible comment anchors (no wrapper
elements, no re-render of the parent):

```tsx
import { For, Show } from 'bso5';

<ul class="history">
  <For each={() => state.value.history}>
    {(value, i) => <li>step {i + 1}: {value}</li>}
  </For>
</ul>

<Show when={() => state.value.count > 10}>
  <p class="alert">Too much!</p>
</Show>
```

`each` / `when` accept a plain value, a `() => value` thunk (re-read and
auto-tracked), a `Signal` or a `$()`-bound value. By default `<For>` re-renders
the whole list on change — keep item functions cheap; use `$()` inside them for
fine-grained bindings.

Pass a `key` to switch to **keyed reconciliation**: existing DOM nodes are
reused and moved (`insertBefore`) instead of being recreated, preserving focus,
caret, text selection, media state and CSS transitions across reorders. The
semantics are the usual React/Solid ones:

- the key identifies the element — **while the key stays in the list, the item's
  nodes are not re-rendered**: bind item fields with `$()` inside the render
  function rather than relying on fresh item data;
- the rendered `index` is captured at first render and does not update on
  reorder — bind it via `$()` if you need a live index;
- keys must be unique: duplicates collapse into a single group of nodes.

```tsx
<For each={() => state.value.rows} key={(row: Row) => row.id}>
  {(row) => <li>#{row.id} <input value={$(row, x => x.name)} /></li>}
</For>
```

A `<Show>` with a function child re-evaluates it every
time the block is shown, and an optional `fallback` (same shapes) is rendered
while the condition is false:

```tsx
<Show when={() => state.value.items.length > 0} fallback={<p>No items yet.</p>}>
  <ul>{/* … */}</ul>
</Show>
```

### `effect()` for full control

When you need something the declarative components don't cover — canvas
drawing, third-party widgets, manual DOM — use `effect()`. It tracks every
`Signal` and every `Reactive` property read inside it:

```tsx
import { effect, h } from 'bso5';

const list = h('ul', { class: 'history' });
effect(() => {
  const items = state.value.history;
  list.replaceChildren(...items.map((v, i) => h('li', null, `#${i}: ${v}`)));
});
```

The effect re-runs with fresh dependency tracking on every run, supports nested
effects and can be stopped via the returned function. Effects are also
resilient by design:

- an exception thrown inside an effect is logged via `console.error` and
  **never propagates into the code that wrote the signal** — one bad effect
  cannot take the app down;
- an effect that writes a value it also reads (`effect(() => { s.value++ })`)
  runs once instead of recursing infinitely — counters inside effects should
  use `s.update(n => n + 1)` / `s.peek()`, which read untracked.

When a view built with `$()` bindings is detached from the document, call
`releaseBindings(root)` to stop its subscriptions — removed nodes stop
receiving updates and become garbage-collectable.

### Components

A component is any function from props to a DOM node. No hooks, no re-renders —
components run exactly once:

```tsx
function Button(props: { label: string; onClick: () => void; kind?: string }) {
  return (
    <button class={`btn ${props.kind ?? ''}`} onClick={props.onClick}>
      {props.label}
    </button>
  );
}
```

## Examples

Two complete apps live in [`examples/`](../../examples) (at the monorepo root):

- [`examples/counter`](../../examples/counter) — counter with history list and step control:
  ```sh
  npm run example   # serves on http://localhost:5173
  ```
- [`examples/dataview`](../../examples/dataview) — reactive issues grid and file tree
  built with [`bso5-components`](../bso5-components) (`<Grid>`/`<Tree>` as a peer
  package, this example only supplies data, columns and adapters):
  ```sh
  npm run example:dataview
  ```

## Development

```sh
npm run build           # tsc → dist/ of both packages (run at the repo root)
npm test                # vitest (jsdom), 135 tests across both packages
npm run test:coverage   # with V8 coverage
npm run typecheck       # strict tsc over both packages + examples
```

## Package layout

```
bso5                    → Signal, Reactive, effect, watch, $, h, boundTextNode
bso5/jsx-runtime        → jsx, jsxs, jsxDEV, createElement, Fragment, JSX types
bso5/jsx-dev-runtime    → same module (dev-mode entry point)
```

## License

[MIT](LICENSE)

