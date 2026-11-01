# bso5 — recipes

Tasks, not API: how to do a typical thing and why exactly this way. Every recipe is
self-contained and can be copied as a whole. Full signatures — [API.en.md](./API.en.md).

Русская версия: [GUIDE.md](./GUIDE.md).

- [1. Counter and text field](#1-counter-and-text-field)
- [2. Lists: with and without a key](#2-lists-with-and-without-a-key)
- [3. Conditionals and tabs](#3-conditionals-and-tabs)
- [4. Lists with the keyed mode](#4-lists-with-the-keyed-mode)
- [5. Loading data](#5-loading-data)
- [6. Derived values](#6-derived-values)
- [7. A view with a lifecycle](#7-a-view-with-a-lifecycle)
- [8. Grid](#8-grid)
- [9. Tree](#9-tree)
- [10. Errors in effects](#10-errors-in-effects)
- [11. Without a bundler](#11-without-a-bundler)
- [12. Traps](#12-traps)

---

## 1. Counter and text field

```tsx
import { mount, signal, $ } from 'bso5';

const count = signal(0);

mount(document.body, () => (
  <main>
    <button onClick={() => count.update(n => n - 1)}>−</button>
    <output>{$(count)}</output>
    <button onClick={() => count.update(n => n + 1)}>+</button>
  </main>
));
```

A text field — state lives in a signal, the value comes back into the DOM via `value`:

```tsx
const name = signal('');

const field = (
  <input
    value={$(name)}
    onInput={e => { name.value = (e.target as HTMLInputElement).value; }}
  />
);
```

Why: `$()` updates the `value` **property**, not the attribute, so the caret does not
jump while the user is typing. `count.update(fn)` reads the current value untracked,
which is safe inside a handler.

## 2. Lists: with and without a key

**Without `key`** — simple and predictable, the whole list re-renders:

```tsx
const history = signal<string[]>([]);

<ul>
  <For each={$(history)}>{item => <li>{item}</li>}</For>
</ul>
```

**With `key`** — nodes are reused and moved (focus, caret and CSS transitions survive):

```tsx
<For each={() => model.value.rows} key={row => row.id}>
  {row => <li>#{row.id} <input value={$(row, x => x.name)} /></li>}
</For>
```

Choice: if items contain inputs, media or animations — use `key`; a throwaway list of
plain strings does not need it.

## 3. Conditionals and tabs

```tsx
const tab = signal<'list' | 'stats'>('list');

<nav>
  <button onClick={() => { tab.value = 'list'; }}>List</button>
  <button onClick={() => { tab.value = 'stats'; }}>Stats</button>
</nav>

<Show when={() => tab.value === 'list'} fallback={() => <Stats />}>
  {() => <List />}
</Show>
```

Both branches are **thunks**: on a switch the old one is torn down completely (its
effects and bindings are released). Passing a ready node (`fallback={<Stats />}`) caches
it and keeps it alive while hidden — sometimes useful, but its subscriptions stay active.

## 4. Lists with the keyed mode

The key is identity. While a key stays in the list its node is **not re-rendered**, so
changed data does not appear by itself. Three working options:

```tsx
// a) the field updates in place; the row must be a reactive proxy
{cell: row => <b>{$(row, x => x.title)}</b>}

// b) fingerprint key: the node is recreated on a real change
<For each={() => model.value.rows} key={row => `${row.id}:${row.updated}`}>…</For>

// c) drop the keyed mode and accept full re-renders
<For each={() => model.value.rows}>…</For>
```

Preference order: (a) is cheapest and keeps focus; (b) is simpler but loses node state;
(c) only for small lists.

Same for `Grid`: `rowKey` enables the keyed mode, a `cell` with `$()` makes cells live.

## 5. Loading data

The recipe: one signal per state, errors in a separate signal, `finally` clears the
loading flag. No magical states.

```ts
import { signal } from 'bso5';

interface Issue { id: number; title: string }

const issues = signal<Issue[]>([]);
const loading = signal(false);
const error = signal<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetch('/api/issues');
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    issues.value = await res.json() as Issue[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
```

```tsx
<Show when={() => loading.value} fallback={() => (
  <Show when={() => error.value !== null} fallback={() => <List rows={issues} />}>
    {() => <p class="error">{$(error)}</p>}
  </Show>
)}>
  {() => <p>Loading…</p>}
</Show>
```

Nested `<Show>` looks bulky but reads top to bottom and needs no extra abstractions:
"loading → error → data".

## 6. Derived values

```ts
import { computed, signal } from 'bso5';

const items = signal<number[]>([]);
const total = computed(() => items.value.reduce((s, n) => s + n, 0));
const isEmpty = computed(() => items.value.length === 0);
```

`computed` is a regular `Signal`: it can go into `$()`, `each`, `<Show when>` and reads
inside `effect()`. If the result did not change, subscribers do not re-run (`Object.is`
comparison) — so `isEmpty` does not touch the DOM on every append.

## 7. A view with a lifecycle

```tsx
import { effect, mount, onScopeDispose, signal, $ } from 'bso5';

const target = document.getElementById('app')!;

const app = mount(target, () => {
  const seconds = signal(0);
  const timer = setInterval(() => seconds.update(n => n + 1), 1000);

  // the effect belongs to the mount scope: it stops with the view
  effect(() => console.log('tick', seconds.value));

  // your own cleanup goes through the same scope
  onScopeDispose(() => clearInterval(timer));

  return <p>{$(seconds)}</p>;
});

app.dispose(); // timer cleared, effect stopped, node removed
```

Why a thunk: everything created **inside** `() => …` gets an owner. A node built before
`mount()` has already created its effects outside any scope, and nothing can stop them.

## 8. Grid

```tsx
import { Reactive, signal } from 'bso5';
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

interface Issue { id: number; title: string; project: string; severity: string }

const model = new Reactive<{ issues: Issue[] }>({ issues: [] });
const query = signal('');

const COLS: Column<Issue>[] = [
  { key: 'id', header: 'ID', sort: i => i.id, cell: i => i.id },
  // a live cell: the row is a Reactive proxy, so $() updates in place
  { key: 'title', header: 'Task', sort: i => i.title, cell: i => <b>{$(i, x => x.title)}</b> },
  { key: 'severity', header: 'Severity', sort: i => i.severity, cell: i => i.severity },
];

<Grid
  rows={() => model.value.issues}
  columns={COLS}
  groupBy={i => i.project}
  rowKey={i => i.id}
  searchPlaceholder="Search tasks"
  labels={{ rows: 'rows:', descending: 'desc', ascending: 'asc' }}
  empty="Nothing found"
/>
```

- `rows` is a thunk so that replacing the whole array is picked up.
- `rowKey` + `$()` in `cell` — data updates while focus and selection survive.
- `filter` is needed when the default search over `sort(row)` is not enough:
  `filter={(row, q) => row.title.toLowerCase().includes(q) || row.assignee.toLowerCase().includes(q)}`.
- `initialSort={{ key: 'id', dir: 'desc' }}` is reflected both in the list order and in the direction control.

## 9. Tree

A flat list → tree → component:

```tsx
import { computed, signal } from 'bso5';
import { Tree } from 'bso5-components';
import type { TreeData } from 'bso5-components';

interface FileNode { path: string; name: string; size?: number; children?: FileNode[] }

const files = signal<FileNode[]>([]);

const toTreeData = (nodes: FileNode[]): TreeData[] =>
  nodes
    .slice()
    .sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name))
    .map(n => ({
      label: n.name,
      meta: n.size === undefined ? undefined : `${n.size} B`,
      children: n.children?.length ? toTreeData(n.children) : null,
    }));

const root = computed<TreeData | null>(() =>
  files.value.length ? { label: 'root', children: toTreeData(files.value) } : null);

<Tree
  root={root}
  nodeKey={node => node.label}          // expansion key: by label, not by path
  showExpandAll
  labels={{ matched: 'matched:', expandAll: 'Expand all', collapseAll: 'Collapse all' }}
  searchPlaceholder="Filter by name or size"
/>
```

- Sorting and building happen before the component: it renders what it is given.
- `meta` is searched too: put there whatever should be findable.
- `nodeKey` is required when labels may repeat or reorder.

## 10. Errors in effects

```ts
import { effect, setEffectErrorHandler } from 'bso5';

// locally
effect(() => riskyRendering(), { onError: err => toast(String(err)) });

// globally (e.g. in dev mode — log with context)
setEffectErrorHandler(err => console.error('[bso5]', err));
```

An exception in an effect is not propagated to the code that wrote the signal: one
broken view must not bring down the model. In tests the handler is handy to fail on the
spot:

```ts
setEffectErrorHandler(err => { throw err; });  // in a test — fail right there
```

## 11. Without a bundler

```html
<!DOCTYPE html>
<html>
<head>
<script type="importmap">
{ "imports": {
    "bso5": "./packages/bso5/dist/index.js",
    "bso5/jsx-runtime": "./packages/bso5/dist/jsx-runtime.js",
    "bso5-components": "./packages/bso5-components/dist/index.js"
} }
</script>
</head>
<body>
<div id="app"></div>
<script type="module">
  import { h, mount, signal, $ } from 'bso5';

  const count = signal(0);
  mount(document.getElementById('app'), () =>
    h('div', null,
      h('button', { onClick: () => { count.update(n => n - 1); } }, '−'),
      h('span', null, $(count)),
      h('button', { onClick: () => { count.update(n => n + 1); } }, '+'),
    ));
</script>
</body>
</html>
```

`npm run build` produces `dist`; after that a static server is enough
(`py -3 -m http.server 8080`). Over `file://` Chrome blocks ES modules — that is a
browser restriction, not a library one. Live example: [`examples/importmap`](../examples/importmap/index.html).

## 12. Traps

| Symptom | Cause | What to do |
| --- | --- | --- |
| `[object Object]` in text | `$()` interpolated into a template string | bind the child/attribute, not a string |
| Data in a row does not update | keyed mode: key = identity | `$()` in the cell or a fingerprint key (§4) |
| `watch()` throws "requires a plain property path" | the accessor contains an expression or a method call | only a property chain: `x => x.a.b`, `x => x.rows[0].c` |
| `TypeError: Method Map.prototype.set called on incompatible receiver` | a `Map`/`Set` inside `Reactive` is not proxied, yet its method is called through a proxy | cannot happen on 0.4.0; if you see it, the object was wrapped manually |
| A binding "froze" at its first value | `$()` over a plain object (not `Reactive`) | wrap the model in `Reactive` or use `Signal` |
| An effect stops firing after a row is removed | the node is gone, its effect was stopped by the scope | expected: create effects inside a live render |
| The `onDoubleClick` handler never fires | old core (before 0.4.0) emitted `doubleclick` | upgrade bso5 |
| `<select>` ignores `value` | the value was applied before `<option>`s existed | handled in 0.4.0; when building by hand, set `value` after children |
| Memory grows on large lists | effects created outside any scope | create effects inside `mount()`/`<For>`/`<Show>` |
| A hidden tab keeps reacting | the `<Show>` branch was passed as a ready node | pass a thunk: `{() => <Tab />}` |
