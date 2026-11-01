Reference section 10 · Source: [API.en.md](../../API.en.md)

## Components: `<Tree>`

```ts
function Tree(props: TreeProps): HTMLElement;

interface TreeData {
  label: string;
  meta?: string;                          // secondary text; also searched
  children?: readonly TreeData[] | null;  // null/absent — a leaf
  labelClass?: string;
}

interface TreeProps {
  root: ReactiveSource<TreeData | null>;
  searchPlaceholder?: string;
  searchDebounce?: number | false;        // 120 ms
  searchDebounceMinItems?: number;        // 200 nodes
  showExpandAll?: boolean;                // bulk expand/collapse buttons, default false
  nodeKey?: (node: TreeData, path: string[]) => unknown;  // expansion key, path by default
  renderLabel?: (node: TreeData) => JsxChild;
  empty?: string;
  labels?: Partial<TreeLabels>;
  class?: string;                         // extra `.tree` class
}

interface TreeLabels {
  search?: string;           // 'Search'
  searchPlaceholder?: string;// 'Search…'
  matched?: string;          // counter prefix, 'matched:'; '' hides it
  expandAll?: string;        // 'Expand all'
  collapseAll?: string;      // 'Collapse all'
}
```

**Behaviour:**

- Search: a substring over `label` **and** `meta`; nodes with a matching descendant are
  kept; while the query is non-empty everything is expanded and matches get the `match`
  class.
- Expansion is stored by `nodeKey(node, path)` (the `label/label/…` path by default).
- `children: []` counts as a folder (renders a toggle with no children); `null` is a leaf.
- The snapshot is rebuilt on every data/query/expansion change and the tree re-renders
  as a whole (deliberate, see [COMPROMISES.md](../.././COMPROMISES.md)).

**Keyboard:** a single `Tab` stop (the root row), `ArrowDown`/`ArrowUp` move focus over
visible rows, `Enter`/`Space` toggles, `ArrowRight`/`ArrowLeft` expands/collapses. Focus
is restored to the same node after a re-render.

**Accessibility:** `role="tree"` + `aria-label` (the root label), `role="treeitem"` +
`aria-expanded`, `role="group"` on children.
