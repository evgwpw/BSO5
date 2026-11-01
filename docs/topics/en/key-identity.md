Reference section 11 · Source: [API.en.md](../../API.en.md)

## Key = identity (the most important trap)

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
