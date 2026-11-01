# bso5 — topics

> Short topics for targeted reading: the full reference is [API.en.md](../../API.en.md).
> Files are generated from it (`npm run docs:topics`); edit the reference.

- [Install and requirements](setup.md) — install, requirements, tsconfig, importmap
- [State](state.md) — Signal, Reactive, watch, getPropertyName
- [Reactive computations](computations.md) — effect, onError, computed, batch, untrack
- [Binding to the DOM: `$()`](bindings.md) — $(): bind values into text, attributes and style
- [Elements: `h()` and JSX](elements.md) — h(), JSX, attribute table, low-level exports
- [Lifecycle and effect ownership](lifecycle.md) — mount, scope, releaseBindings
- [Lists and conditionals](lists.md) — <For> (keyed and unkeyed) and <Show>
- [Resources and performance](performance.md) — measurements and known performance limits
- [Limits and missing features](limits.md) — what is missing: SSR, portals, virtualization, error boundaries
- [Components: `<Grid>`](grid.md) — <Grid>: props, columns, behaviour, a11y
- [Components: `<Tree>`](tree.md) — <Tree>: props, data, behaviour, keyboard
- [Key = identity (the most important trap)](key-identity.md) — key = identity: why data does not update
- [Component markup classes](classes.md) — component markup classes
