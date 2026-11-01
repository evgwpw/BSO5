Reference section 4 · Source: [API.en.md](../../API.en.md)

## Elements: `h()` and JSX

### `h(tag, attrs?, ...children): HTMLElementTagNameMap[tag]`

Universal factory, typed per HTML tag. The JSX transform calls the same implementation
(`hEl`), so the rules below are identical for both.

`attrs` may be an object or a function `(el) => void`:

```ts
h('input', el => el.focus());
```

**Attribute rules:**

| Key | Value | Behaviour |
| --- | --- | --- |
| `class`, `className` | string | `el.className = value` (synonyms; if both, the last one wins) |
| `class`, `className` | array | flattened list: `['card', isActive && 'active']`; nesting works, `false`/`null`/`undefined` are skipped |
| `class`, `className` | object | name → flag map: `{ card: true, 'card--active': isActive }` |
| `class`, `className` | empty result | the attribute is **not set** (no leftover `class=""`) |
| `style` | string | `setAttribute('style', value)` |
| `style` | object | per property: `el.style[prop] = value` |
| `style` value | number | **always** gains `px`: `{ width: 10 }` → `10px`; unitless props (`opacity`, `zIndex`) must be strings |
| `style` value | `$()` | the property becomes reactive |
| `onClick`, `onInput`, … | function | `addEventListener('click' / 'input' / …)`; camelCase required |
| `onDoubleClick` | function | the `dblclick` event |
| `onInputCapture` | function | capture phase (`{ capture: true }`) |
| `value`, `checked`, `selected`, `disabled` | any | assigned as a **property**, not a string |
| `value` on `<select>` | any | applied **after** its `<option>`s exist |
| `dataset` | object | `el.dataset[k] = String(v)` |
| `ref` | `(el) => void` | called with the created element (before children are appended) |
| `data-*`, `aria-*`, anything else | any | `setAttribute` when the element has no such property |
| any key | `null`/`undefined`/`false` | `removeAttribute(key)` |
| any key | `$()` | applied now and kept in sync with the source |

**Children rules:** `string`/`number` → text node; `null`/`undefined`/`true`/`false` →
nothing; array → recursive; `Node` → as is; `$()` → a live text node.

**Not supported:** object `ref` (`{ current }`), option-free `on*Capture` semantics,
`dangerouslySetInnerHTML`.

### `hEl(tag, attrs, children[]): HTMLElement`

Same, but `children` is an array (used by the JSX runtime; rarely useful publicly).

### Low-level exports

Used inside `h()` and `<For>`; public because custom renderers and wrappers need them.

| Export | Signature | What it does |
| --- | --- | --- |
| `flattenChildren` | `(children: Content[]) => Array<Node \| string \| number \| BoundValue>` | Flattens nested arrays, drops `null`/`undefined`/`true`/`false` |
| `appendChildren` | `(parent: Node, children: Content[]) => void` | Appends children by the §4 rules: strings → text nodes, `$()` → live text nodes, `Node` as is |
| `boundTextNode` | `(value: BoundValue) => Text` | Creates a text node with a binding; the binding is registered and released by `releaseBindings` |
| `applyAttr` | `(el: HTMLElement, key: string, value: unknown) => void` | Applies a single attribute by the §4 table, including `$()` values and `ref` |

### `parseEventProp(key): { event: string; capture: boolean }`

`'onDoubleClick'` → `{ event: 'dblclick', capture: false }`,
`'onInputCapture'` → `{ event: 'input', capture: true }`.

### JSX runtime

```ts
createElement(tag, props, ...children): Node
jsx / jsxs / jsxDEV(tag, props, key?): Node   // react-jsx entry points
Fragment({ children }): DocumentFragment
```

- A function tag is called with the props (including `children`) and must return a `Node`.
- `key` never lands in the props of intrinsic tags; for function components it is folded
  back into the props (needed by `<For key>`).
- Types: `JsxChild`, `JsxNode`, `Component<P>`, `DOMAttributes`, `namespace JSX`.
