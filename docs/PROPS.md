# bso5 — пропсы и опции (из типов)

> Файл генерируется `scripts/build-props.mjs` из TypeScript-интерфейсов: типы и
> признак обязательности берутся из кода, описания — из JSDoc. Не редактируйте
> вручную: правьте интерфейсы, затем `npm run docs:props`.
>
> Полная семантика, поведение и крайние случаи — в [API.md](./API.md) / [API.en.md](./API.en.md).
> Событийные пропсы (`onClick`, `onInputCapture`, …) описаны в API §4.

### `EffectOptions`

[bso5/src/reactive.ts](../packages/bso5/src/reactive.ts)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `onError` | `(error: unknown) => void` | нет | Receives exceptions thrown by the effect body instead of `console.error`. |

### `Scope`

[bso5/src/reactive.ts](../packages/bso5/src/reactive.ts)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `stops` | `Set<() => void>` | да | Stop functions of the effects owned by this scope. |
| `disposed` | `boolean` | да | Once disposed, the scope accepts no new effects. |

### `BoundValue<T = unknown>`

[bso5/src/reactive.ts](../packages/bso5/src/reactive.ts)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `value` | `T` | да | Current value of the bound source. |

### `Mounted`

[bso5/src/dom.ts](../packages/bso5/src/dom.ts)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `node` | `Node` | да | The mounted node. |
| `dispose` | `() => void` | да | Stops bindings and effects of the view and detaches it. Idempotent. |

### `ForProps<T>`

[bso5/src/control.ts](../packages/bso5/src/control.ts)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `each` | `ReactiveSource<readonly T[]>` | да | The list to render: a plain array, `() => array` (re-read, auto-tracked), a `Signal` or a `$()`-bound value. Use `$()`/`() =>` when the array can be replaced wholesale. |
| `key` | `(item: T, index: number) => unknown` | нет | Optional stable item key. When provided, keyed reconciliation kicks in: DOM nodes are reused and moved instead of being recreated, preserving focus, caret, selection, media state and CSS transitions across reorders. The key identifies the element — while it stays in the list, the item's nodes are NOT re-rendered (bind item fields with `$()` instead); the rendered index is captured at first render; duplicate keys collapse into one group of nodes. |
| `children` | `(item: T, index: number) => JsxChild` | да | Item renderer, called with `(item, index)`. |

### `ShowProps`

[bso5/src/control.ts](../packages/bso5/src/control.ts)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `when` | `ReactiveSource<boolean>` | да | Condition: a boolean, `() => boolean` (re-evaluated, auto-tracked), a `Signal` or a `$()`-bound value. |
| `fallback` | `JsxChild \| (() => JsxChild)` | нет | Content shown while `when` is falsy. Static JSX is rendered once and re-inserted on every toggle; a `() => JsxChild` function re-evaluates each time the block is shown. Optional. |
| `children` | `JsxChild \| (() => JsxChild)` | да | Content shown while `when` is truthy. Static JSX is rendered once and re-inserted on every toggle; a `() => JsxChild` function re-evaluates each time the block is shown. |

### `GridProps<Row>`

[bso5-components/src/Grid.tsx](../packages/bso5-components/src/Grid.tsx)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `rows` | `ReactiveSource<readonly Row[]>` | да | Data source: array, thunk, `Signal` or `$()`-bound value. |
| `columns` | `readonly Column<Row>[]` | да | Column definitions. |
| `filter` | `(row: Row, loweredQuery: string) => boolean` | нет | Plain-text filter predicate. The default searches `sort(row)` values. |
| `groupBy` | `(row: Row) => string \| null` | нет | Groups rows by the returned label; return `null` for no grouping for that row (it lands in an ungrouped bucket rendered before the groups). |
| `initialSort` | `{ key: string; dir: 'asc' \| 'desc' }` | нет | Initial sort column key and direction. Optional. |
| `rowKey` | `(row: Row) => unknown` | нет | Stable row key for keyed `<For>` (DOM-node reuse). Optional. Called with the row only: the rendered index is deliberately not part of the key, so sorting reorders existing nodes instead of recreating them. |
| `searchPlaceholder` | `string` | нет | Search box placeholder. |
| `searchDebounce` | `number \| false` | нет | Search debounce in ms. Applies only to sources of at least `searchDebounceMinItems` rows (small tables must react instantly). `false` disables it. Default: 120. |
| `searchDebounceMinItems` | `number` | нет | Row count from which the debounce kicks in. Default: 200. |
| `empty` | `string` | нет | Text shown when no rows match. Optional. |
| `labels` | `Partial<GridLabels>` | нет | UI labels (placeholders, aria labels, counter prefix). |
| `class` | `string` | нет | Extra class for the root element. |

### `Column<Row>`

[bso5-components/src/Grid.tsx](../packages/bso5-components/src/Grid.tsx)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `key` | `string` | да | Stable column id, used to remember which column is sorted. |
| `header` | `string` | да | Header cell label. |
| `cell` | `(row: Row) => JsxChild` | да | Cell renderer; may return reactive bound values. |
| `sort` | `(row: Row) => string \| number` | да | Sort accessor: the value to compare rows by. |
| `class` | `string` | нет | Extra class for the `td`. Optional. |
| `headerClass` | `string` | нет | Extra class for the `th`. Optional. |
| `sortable` | `boolean` | нет | Whether clicking the header sorts by this column (default: true). |

### `GridLabels`

[bso5-components/src/Grid.tsx](../packages/bso5-components/src/Grid.tsx)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `search` | `string` | нет | Accessible name of the search box. |
| `searchPlaceholder` | `string` | нет | Placeholder of the search box; defaults to `search`. |
| `sortDirection` | `string` | нет | Accessible name of the sort-direction control. |
| `descending` | `string` | нет | Text of the descending option. |
| `ascending` | `string` | нет | Text of the ascending option. |
| `rows` | `string` | нет | Prefix of the row counter; empty string hides the counter text. |

### `TreeProps`

[bso5-components/src/Tree.tsx](../packages/bso5-components/src/Tree.tsx)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `root` | `ReactiveSource<TreeData \| null>` | да | Data source: tree object, thunk, `Signal` or `$()`-bound value. |
| `searchPlaceholder` | `string` | нет | Search box placeholder. |
| `empty` | `string` | нет | Text shown when the tree is empty or filtered to nothing. Optional. |
| `nodeKey` | `(node: TreeData, path: string[]) => unknown` | нет | Stable node key for keyed rendering. Defaults to the node path. |
| `searchDebounce` | `number \| false` | нет | Search debounce in ms; applies from `searchDebounceMinItems` nodes up. `false` disables it. Default: 120. |
| `searchDebounceMinItems` | `number` | нет | Node count from which the debounce kicks in. Default: 200. |
| `showExpandAll` | `boolean` | нет | Show "expand all" / "collapse all" buttons in the toolbar. Default: false. |
| `labels` | `Partial<TreeLabels>` | нет | UI labels (placeholders, aria labels, counters, buttons). |
| `class` | `string` | нет | Extra class for the root element. |
| `renderLabel` | `(node: TreeData) => JsxChild` | нет | Node label renderer; defaults to `node.label`. |

### `TreeData`

[bso5-components/src/Tree.tsx](../packages/bso5-components/src/Tree.tsx)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `label` | `string` | да | Node label. |
| `meta` | `string` | нет | Secondary text rendered next to the label. Optional. |
| `children` | `readonly TreeData[] \| null` | нет | Child nodes; `null`/omitted — this node is a leaf. |
| `labelClass` | `string` | нет | Extra class for the label `span`. Optional. |

### `TreeLabels`

[bso5-components/src/Tree.tsx](../packages/bso5-components/src/Tree.tsx)

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `search` | `string` | нет | Accessible name of the search box. |
| `searchPlaceholder` | `string` | нет | Placeholder of the search box; defaults to `search`. |
| `matched` | `string` | нет | Prefix of the match counter; empty string hides it. |
| `expandAll` | `string` | нет | Text of the "expand all" button. |
| `collapseAll` | `string` | нет | Text of the "collapse all" button. |
