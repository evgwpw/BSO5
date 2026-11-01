Reference section 6 · Source: [API.en.md](../../API.en.md)

## Lists and conditionals

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
  (fingerprint recipe in [GUIDE.en.md](../.././GUIDE.en.md#4-lists-with-the-keyed-mode));
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
