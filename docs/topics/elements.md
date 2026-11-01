Раздел 4 справочника · Источник: [API.md](../API.md)

## Элементы: `h()` и JSX

### `h(tag, attrs?, ...children): HTMLElementTagNameMap[tag]`

Универсальная фабрика с типизацией по тегу. JSX-трансформ вызывает ту же реализацию
(`hEl`), поэтому правила ниже одинаковы.

`attrs` может быть объектом или функцией `(el) => void`:

```ts
h('input', el => el.focus());
```

**Правила атрибутов:**

| Ключ | Значение | Поведение |
| --- | --- | --- |
| `class`, `className` | строка | `el.className = value` (синонимы; при обоих побеждает последний) |
| `class`, `className` | массив | плоский список: `['card', isActive && 'active']`, вложенность поддерживается, `false`/`null`/`undefined` пропускаются |
| `class`, `className` | объект | карта «имя → флаг»: `{ card: true, 'card--active': isActive }` |
| `class`, `className` | пустой результат | атрибут **не ставится** (`class=""` не остаётся) |
| `style` | строка | `setAttribute('style', value)` |
| `style` | объект | по свойству: `el.style[prop] = value` |
| `style` значение-число | `number` | **всегда** `px`: `{ width: 10 }` → `10px`; безразмерные (`opacity`, `zIndex`) — строкой |
| `style` значение | `$()` | свойство становится реактивным |
| `onClick`, `onInput`, … | функция | `addEventListener('click' / 'input' / …)`; camelCase обязателен |
| `onDoubleClick` | функция | событие `dblclick` |
| `onInputCapture` | функция | фаза перехвата (`{ capture: true }`) |
| `value`, `checked`, `selected`, `disabled` | любое | присваивается **свойством**, не строкой |
| `value` у `<select>` | любое | применяется **после** появления `<option>` |
| `dataset` | объект | `el.dataset[k] = String(v)` |
| `ref` | `(el) => void` | вызывается с созданным элементом (до добавления детей) |
| `data-*`, `aria-*`, прочее | любое | `setAttribute`, если у элемента нет такого свойства |
| любой ключ | `null`/`undefined`/`false` | `removeAttribute(key)` |
| любой ключ | `$()` | применяется сейчас и обновляется при изменении источника |

**Правила детей:** `string`/`number` → текстовый узел; `null`/`undefined`/`true`/`false`
→ ничего; массив → рекурсивно; `Node` → как есть; `$()` → живой текстовый узел.

**Чего нет:** объект-`ref` (`{ current }`), `on*Capture` без суффикса-опции,
`dangerouslySetInnerHTML`.

### `hEl(tag, attrs, children[]): HTMLElement`

То же, но `children` — массив (используется JSX-рантаймом; публично полезен редко).

### Низкоуровневые экспорты

Используются внутри `h()` и `<For>`; публичны, потому что нужны для своих
рендереров и обёрток.

| Экспорт | Сигнатура | Что делает |
| --- | --- | --- |
| `flattenChildren` | `(children: Content[]) => Array<Node \| string \| number \| BoundValue>` | Раскрывает вложенные массивы, отбрасывает `null`/`undefined`/`true`/`false` |
| `appendChildren` | `(parent: Node, children: Content[]) => void` | Вставляет детей по правилам §4: строки → текстовые узлы, `$()` → живые текстовые узлы, `Node` — как есть |
| `boundTextNode` | `(value: BoundValue) => Text` | Создаёт текстовый узел с привязкой; привязка регистрируется и снимается `releaseBindings` |
| `applyAttr` | `(el: HTMLElement, key: string, value: unknown) => void` | Применяет один атрибут по таблице §4, включая `$()`-значения и `ref` |

### `parseEventProp(key): { event: string; capture: boolean }`

`'onDoubleClick'` → `{ event: 'dblclick', capture: false }`,
`'onInputCapture'` → `{ event: 'input', capture: true }`.

### JSX-рантайм

```ts
createElement(tag, props, ...children): Node
jsx / jsxs / jsxDEV(tag, props, key?): Node   // точки входа react-jsx
Fragment({ children }): DocumentFragment
```

- Тег-функция вызывается с пропсами (включая `children`) и должна вернуть `Node`.
- `key` не попадает в пропсы интринсик-тегов; у компонентов-функций он пробрасывается
  в пропсы (нужно для `<For key>`).
- Типы: `JsxChild`, `JsxNode`, `Component<P>`, `DOMAttributes`, `namespace JSX`.
