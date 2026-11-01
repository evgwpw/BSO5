Reference section 2 · Source: [API.en.md](../../API.en.md)

## Reactive computations

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
