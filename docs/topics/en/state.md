Reference section 1 · Source: [API.en.md](../../API.en.md)

## State

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
