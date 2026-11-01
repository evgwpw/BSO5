Reference section 8 · Source: [API.en.md](../../API.en.md)

## Limits and missing features

| Missing | Consequence / workaround |
| --- | --- |
| SSR / hydration | `h()` and `<For>` use the global `document`; server rendering is impossible |
| Portals | mount into the needed node with `mount()` |
| Object `ref` | `ref={el => …}`, keep the reference yourself |
| Lazy `computed` | recomputation is eager; cache manually for expensive work |
| Multi-column sorting | `Grid` sorts by a single column |
| Virtualization | no render window |
| Error boundaries | effect errors go to `console.error`/`onError`; rendering is not intercepted |
| Auto-batching | synchronous writes run effects one by one; group them with `batch()` |
