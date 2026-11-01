Reference section 5 · Source: [API.en.md](../../API.en.md)

## Lifecycle and effect ownership

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
