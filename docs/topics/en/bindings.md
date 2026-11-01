Reference section 3 · Source: [API.en.md](../../API.en.md)

## Binding to the DOM: `$()`

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
- A root and a nested proxy behave differently when an intermediate link is replaced:
  - `$(model.value, x => x.rows[0].title)` — the path is resolved from the root, so the
    subscription survives `model.rows[0] = {…}`;
  - `$(row, x => x.title)`, where `row` is a nested proxy, binds **to that object**:
    writes to its fields are seen, while replacing its slot in the parent is not (the
    value stays from the old object). Bind from the root when that matters.
- Do not interpolate it into a string: `` `total: ${$(count)}` `` yields `[object Object]`.
  Bind the child/attribute itself, not a string around it.
- The accessor is a plain property chain (see `Reactive.watch`).
- Inside an ownership scope the binding is released together with its node (`releaseBindings`).
