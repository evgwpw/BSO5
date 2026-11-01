# bso5 — справочник API

Полное описание публичного API обоих пакетов: сигнатуры, семантика, крайние случаи
и известные границы. Написан так, чтобы его можно было читать и человеку, и агенту:
одна единица знания — один раздел с явной сигнатурой.

English version: [API.en.md](./API.en.md).

Версии: `bso5` **0.4.0**, `bso5-components` **0.2.0**. Размеры: 4.2 и 2.5 kB min+gzip,
зависимостей нет (кроме peer `bso5` у компонентов).

- Пошаговые рецепты — [GUIDE.md](./GUIDE.md).
- Разметка, классы и CSS компонентов — [TREE_GRID.md](./TREE_GRID.md).
- Осознанные компромиссы — [COMPROMISES.md](./COMPROMISES.md).

---

## 0. Установка и требования

```bash
npm install bso5                 # только ядро
npm install bso5 bso5-components # ядро + компоненты
```

| Что | Требование |
| --- | --- |
| Браузер | ES2020, нативные ES-модули |
| Сборка | любая с JSX-трансформом `react-jsx` (tsc, esbuild, vite) — или никакой: `dist` уже ESM |
| Разработка пакета | Node ≥ 22.12 (vitest 5), npm ≥ 10 (lockfile v3) |
| TypeScript | ≥ 5.0 |

`tsconfig.json` для JSX:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bso5"          // или "bso5-components" — рантайм тот же
  }
}
```

Карта экспортов пакета `bso5`: `"."`, `"./jsx-runtime"`, `"./jsx-dev-runtime"`,
`"./package.json"`. У `bso5-components` — те же плюс собственный реэкспорт рантайма.

Без сборщика:

```html
<script type="importmap">
{ "imports": {
    "bso5": "./packages/bso5/dist/index.js",
    "bso5/jsx-runtime": "./packages/bso5/dist/jsx-runtime.js",
    "bso5-components": "./packages/bso5-components/dist/index.js"
} }
</script>
<script type="module">import { h, signal } from 'bso5'; /* … */</script>
```

Готовый пример — [`examples/importmap`](../examples/importmap/index.html).

---

## 1. Состояние

### `Signal<T>`

Атомарное реактивное значение.

```ts
class Signal<T> {
  constructor(initial: T);
  get value(): T;                 // чтение; внутри effect() регистрирует зависимость
  set value(next: T);             // запись; уведомляет только при изменении (Object.is)
  peek(): T;                      // чтение без трекинга
  update(fn: (current: T) => T): void;   // запись от текущего значения, без трекинга чтения
  subscribe(cb: () => void): () => void; // ручная подписка; возвращает отписку
}
```

- `set` сравнивает через `Object.is`: `signal(0); s.value = 0` — уведомления не будет.
- `subscribe` вызывает колбэк **синхронно** сразу после записи (внутри `batch` — один раз в конце).
- Подписки хранятся в `Set`, повторная подписка того же колбэка не дублируется.

### `signal<T>(initial: T): Signal<T>`

```ts
const count = signal(0);
```

### `Reactive<T extends object>`

Глубокий реактивный прокси над обычным объектом или экземпляром класса.

```ts
class Reactive<T extends object> {
  constructor(raw: T);            // бросит, если объект уже обёрнут другим Reactive
  get value(): T;                 // прокси-дерево; вложенные объекты оборачиваются лениво
  get target(): T;                // сырой объект: чтения/записи не трекаются
  watch(path: ((t: T) => any) | string, cb: () => void): () => void;
  dispose(): void;                // останавливает подписки и трекинг эффектов
}
```

- `watch(x => x.user.name, cb)` срабатывает и на `x.user.name = …`, и на `x.user = { … }`
  (вложенный путь перепривязывается к новому объекту).
- Индексная нотация работает: `x => x.rows[0].done`, `'rows.0.done'`.
- Аксессор обязан быть **простой чистой цепочкой свойств**: он выполняется один раз
  для трассировки пути. Выражения (`x => x.a + 1`), вызовы методов и `async` отвергаются —
  `watch()` бросит ошибку, `$()` вернёт нереактивное значение.
- `dispose()` делает прокси инертным для реактивности: чтения и записи работают,
  подписчики больше не уведомляются.

**Что не оборачивается** (проходит насквозь, без прокси и без реактивности):
`Map`, `Set`, `WeakMap`, `WeakSet`, `Promise`, `Date`, `RegExp`, `Error`,
`ArrayBuffer` и типизированные массивы, `Blob`/`File`, `AbortController`/`AbortSignal`,
`FormData`, `URL`/`URLSearchParams`, любые DOM-узлы.

```
model.value.cache.set(k, v);   // работает, но НЕ уведомляет подписчиков
model.value.cache = new Map(…); // уведомляет — меняйте значение целиком
```

Причина: метод встроенного объекта, вызванный через прокси, получает прокси как
`receiver` и бросает `TypeError: Method Map.prototype.set called on incompatible receiver`.

### `watch(source, path, cb): () => void`

Свободная форма подписки: `source` — `Signal` (тогда `path` игнорируется) или
`Reactive`-значение/прокси (тогда `path` — аксессор или строка).

```ts
const stop = watch(model.value, x => x.user.name, () => { /* … */ });
```

### `getPropertyName(fn): string | null`

Трассирует путь аксессора (`x => x.items[0].title` → `'items.0.title'`).
Возвращает `null`, если аксессор не является простой цепочкой свойств.
Экспортируется для инструментов; в обычном коде не нужен.

### `Reactive` vs `Signal`: что выбирать

| Нужно | Берите |
| --- | --- |
| одно значение, простые обновления | `Signal` |
| объект/модель с вложенными полями и точечными подписками на пути | `Reactive` |
| производное значение от нескольких источников | `computed` |
| значение, которое можно положить и в атрибут, и в текст | `$()` |

---

## 2. Реактивные вычисления

### `effect(fn, options?): () => void`

Выполняет `fn` сразу и перезапускает при изменении любого `Signal`/свойства
`Reactive`, прочитанного внутри (синхронно, если не в `batch`).

```ts
interface EffectOptions {
  onError?: (error: unknown) => void;
}
```

- Возвращает функцию остановки (идемпотентна).
- Перед каждым прогоном зависимости сбрасываются: непрочитанные больше не триггерят.
- Исключение внутри эффекта **не пробрасывается** в код, записавший сигнал.
  Приёмник по умолчанию — `console.error`; переопределяется `onError` эффекта или
  `setEffectErrorHandler`.
- Эффект, читающий и пишущий один и тот же сигнал, не зацикливается: защита от
  синхронной рекурсии (`rec.running`) — но лучше читать через `peek()`/`update()`.
- Вложенные эффекты поддерживаются; эффект, созданный внутри области владения,
  останавливается вместе с ней (см. §5).

### `setEffectErrorHandler(handler: ((error: unknown) => void) | null): void`

Глобальный приёмник ошибок эффектов. `null` возвращает `console.error`.
Приоритет: `onError` эффекта → глобальный обработчик → `console.error`.
Если сам обработчик бросит, ошибка уйдёт в `console.error` и граф продолжит работу.

### `computed<T>(fn): Signal<T>`

Производное значение: пересчитывается при изменении зависимостей, уведомляет
читателей только если результат изменился (`Object.is`).

```ts
const count = signal(2);
const doubled = computed(() => count.value * 2);   // Signal<number>
doubled.value;                                      // 4
```

- Пересчёт **энергичный** (на изменение зависимости, не на чтение): ленивого кеша нет.
- Возвращает `Signal`, поэтому годится для `$()`, `each`, `<Show when>` и чтения в `effect()`.
- Внутри области (`mount()`, `<For>`, `<Show>`) останавливается вместе с ней.

### `batch<T>(fn: () => T): T`

Группирует записи: зависимые эффекты и слушатели выполняются один раз в конце блока.
Вложенные `batch` схлопываются в один. Слушатели дедуплицируются по идентичности,
эффекты — по записи.

```ts
batch(() => { a.value = 10; b.value = 20; });  // один прогон эффекта
```

### `untrack<T>(fn: () => T): T`

Выполняет `fn`, не регистрируя прочитанное как зависимость текущего эффекта.

```ts
effect(() => { render(tracked.value, untrack(() => ignored.value)); });
```

---

## 3. Привязка к DOM: `$()`

### `$(source, path?): BoundValue<T>`

Мост между состоянием и разметкой. Принимает `Signal` (`$(countSignal)`) или
`Reactive`-значение/прокси с аксессором (`$(model.value, x => x.user.name)`).
Результат используется как ребёнок или значение атрибута — DOM обновляется точечно.

```tsx
<p>Счёт: {$(count)}</p>
<input value={$(model.value, x => x.name)} />
<div style={{ color: $(model.value, x => x.color) }} />
```

- `BoundValue<T>` — объект с маркером `REACTIVE_VALUE`, геттером `value` и `subscribe`.
  Проверка — `isBoundValue(v)`.
- `$()` на **обычном** объекте (не `Reactive`) резолвится один раз и никогда не обновляется.
- Нельзя интерполировать в строку: `` `всего: ${$(count)}` `` даст `[object Object]`.
  Привязывайте ребёнка/атрибут, а не строку вокруг них.
- Аксессор — простая чистая цепочка (см. `Reactive.watch`).
- Внутри области владения привязка снимается вместе с узлом (`releaseBindings`).

---

## 4. Элементы: `h()` и JSX

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
автоматическая нормализация `class` из массива/объекта, `dangerouslySetInnerHTML`.

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

---

## 5. Жизненный цикл и владение эффектами

### `mount(target, view): { node, dispose }`

```ts
function mount(target: Element | DocumentFragment, view: Node | (() => Node)): Mounted;
interface Mounted { readonly node: Node; readonly dispose: () => void; }
```

- Принимает **танку** (`() => <App />`) — тогда эффекты вью принадлежат области
  монтирования и снимаются вместе с ней. Готовый узел тоже принимается, но его
  эффекты уже созданы вне области.
- `dispose()`: `releaseBindings` по поддереву → `dispose(scope)` → удаление узла.
  Идемпотентна.

### Области владения

```ts
interface Scope { readonly stops: Set<() => void>; disposed: boolean }
createScope(): Scope
dispose(scope): void                       // идемпотентна, запрещает новые регистрации
runInScope<T>(scope, fn: () => T): T       // эффекты внутри fn принадлежат scope
onScopeDispose(fn): void                   // очистка при dispose; вне области — no-op
getCurrentScope(): Scope | null
```

`effect()`, вызванный внутри `runInScope`, регистрирует в области свою остановку.
`<For>`, `<Show>` и `mount()` строят области сами.

**Граница контракта:** владение появляется только там, где есть `mount()`, `<For>`
или `<Show>`. `effect()` на верхнем уровне модуля владельца не имеет — его нужно
останавливать вручную.

### `releaseBindings(root: Node): void`

Останавливает все `$()`-привязки (текст, атрибуты, style) внутри поддерева.
Идемпотентна; эффекты не трогает — для них область.

---

## 6. Списки и условия

### `<For each={…} key={…?}>{(item, index) => …}</For>`

```ts
interface ForProps<T> {
  each: ReactiveSource<readonly T[]>;
  key?: (item: T, index: number) => unknown;
  children: (item: T, index: number) => JsxChild;
}
type ReactiveSource<T> = T | (() => T) | Signal<T> | BoundValue<T>;
```

Рендерит между комментариями-анкорами, без обёртки.

**Без `key`** — полная перерисовка при любом изменении списка; функции элементов
должны быть дешёвыми; эффекты и привязки предыдущего прохода освобождаются.

**С `key`** — keyed-реконсиляция:

- DOM-узлы переиспользуются и перемещаются (`insertBefore`), двигаются только
  узлы не на своём месте;
- пока ключ в списке, узлы элемента **не перерисовываются** (ключ = идентичность):
  изменённые данные сами не появятся — привязывайте поля через `$()` или меняйте ключ
  (рецепт с отпечатком — в [GUIDE.md](./GUIDE.md#4-список-с-keyed-режимом));
- индекс фиксируется при первом рендере;
- дубликаты ключей схлопываются в одну группу (побеждает первое вхождение);
- при уходе ключа из списка эффекты группы останавливаются, привязки снимаются.

### `<Show when={…} fallback={…?}>{…}</Show>`

```ts
interface ShowProps {
  when: ReactiveSource<boolean>;
  fallback?: JsxChild | (() => JsxChild);
  children: JsxChild | (() => JsxChild);
}
```

- Тоже без обёртки (комментарии-анкоры).
- `children`/`fallback` — **танка** или готовый `JsxChild`.
- Танка строится заново при каждом показе и снимается при скрытии: скрытая ветка
  перестаёт реагировать на изменения модели.
- Готовый узел перепривязать нельзя (подписки лежат в `WeakMap` по самому узлу),
  поэтому он кешируется и живёт до сноса всего `<Show>`. Нужен настоящий снос —
  передавайте танку.
- Узловая ветка не перестраивается, если решение не изменилось
  (`when={() => count > 10}` не дёргает DOM на каждую запись `count`).
- Танка перевычисляется на каждом прогоне эффекта — она может читать реактивные
  значения сама.

### `resolveSource(src): T`

Читает значение `ReactiveSource` (значение, танка, `Signal`, `$()`); внутри
`effect()` автотрекается. Полезен при написании своих компонентов.

---

## 7. Ресурсы и производительность

| Операция | 1 000 | 10 000 | Среда |
| --- | --- | --- | --- |
| Построить `Grid` (группировка + `rowKey`) | 64 мс | 1 480 мс | jsdom |
| Вставить готовый грид | 5 мс | 44 мс | jsdom |
| Сортировка кликом (2 клика) | 96–102 мс | 7.6–9.3 с | jsdom |
| Обновление keyed-списка без смены порядка | — | **1.8 мс** | jsdom |
| Поиск по `Tree` (фильтр + рендер) | 0.9 мс | 4.5 мс | jsdom |

jsdom перемещает узлы примерно в 30 раз дороже браузера: абсолютные значения
DOM-операций завышены, отношения корректны. Замеры воспроизводятся:
`npm run build && npm run bench` (или `BENCH_SIZES=1000`).

**Известные ограничения производительности:**

- `Tree` перерисовывает всё дерево на каждый снапшот (не keyed) — отсюда дебаунс
  поиска по умолчанию; 10k раскрытых узлов — это 10k DOM-узлов;
- виртуализации нет ни в `Grid`, ни в `Tree`;
- `Reactive` трекает чтения свойств через `Proxy` — горячие циклы лучше писать на
  `Signal` или через `.target`.

---

## 8. Ограничения и отсутствующие возможности

| Чего нет | Следствие / обход |
| --- | --- |
| SSR / гидратация | `h()` и `<For>` используют глобальный `document`; серверный рендер невозможен |
| Портал | монтируйте в нужный узел через `mount()` |
| Объект-`ref` | `ref={el => …}`, ссылку храните сами |
| `class` из объекта/массива | соберите строку вручную |
| Ленивый `computed` | пересчёт энергичный; для тяжёлого — кешируйте сами |
| Мультиколоночная сортировка | `Grid` сортирует по одной колонке |
| Виртуализация | окно рендера не поддерживается |
| Error boundary | ошибки эффектов идут в `console.error`/`onError`, рендер не перехватывается |
| Автобатчинг | синхронные записи гоняют эффекты по одной; группируйте через `batch()` |

---

## 9. Компоненты: `<Grid>`

```ts
function Grid<Row>(props: GridProps<Row>): HTMLElement;
```

Грид: фильтр → сортировка → группировка, состояние внутри экземпляра.

```ts
interface GridProps<Row> {
  rows: ReactiveSource<readonly Row[]>;
  columns: readonly Column<Row>[];
  filter?: (row: Row, loweredQuery: string) => boolean;
  groupBy?: (row: Row) => string | null;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  rowKey?: (row: Row) => unknown;
  searchPlaceholder?: string;
  searchDebounce?: number | false;      // по умолчанию 120 мс
  searchDebounceMinItems?: number;      // по умолчанию 200 строк
  empty?: string;
  labels?: Partial<GridLabels>;
  class?: string;                       // корень, по умолчанию 'grid'
}

interface Column<Row> {
  key: string;                          // id колонки, запоминается сортировка
  header: string;
  cell: (row: Row) => JsxChild;
  sort: (row: Row) => string | number;  // значение сортировки и текст для поиска
  sortable?: boolean;                   // по умолчанию true
  class?: string;                       // класс td
  headerClass?: string;                 // класс th
}

interface GridLabels {
  search?: string;           // aria-label поиска, 'Search'
  searchPlaceholder?: string;// 'Search…'
  sortDirection?: string;    // aria-label контрола, 'Sort direction'
  descending?: string;       // '↓ desc'
  ascending?: string;        // '↑ asc'
  rows?: string;             // префикс счётчика, 'rows:'; '' — только число
}
```

**Поведение:**

- Поиск по умолчанию — подстрока (без учёта регистра) в `String(sort(row))` любой
  колонки; свой матчер задаётся `filter(row, loweredQuery)` (`loweredQuery` уже в нижнем регистре).
- Сортировка: клик по `th` → по убыванию; повторный клик по той же колонке меняет
  направление; `sortable: false` отключает. Колонка одна.
- Группировка: порядок групп — по первому вхождению в отсортированном списке;
  `groupBy` → `null` даёт негруппированный бакет перед группами.
- `rowKey` включает keyed-режим: при сортировке узлы переставляются, а не пересоздаются.
  **Ячейки существующих строк не обновляются** — см. §11 «ключ = идентичность».
- Счётчик показывает число строк после фильтра (свёрнутые группы всё равно считаются).
- Дебаунс поиска включается только от `searchDebounceMinItems` строк; `searchDebounce: false`
  отключает его целиком.

**Доступность:** `th[scope=col]`, `aria-sort` у активной колонки, строка группы —
`tabindex="0"` + `aria-expanded`, переключение по Enter/Space, `aria-label` у поиска
и контрола направления.

---

## 10. Компоненты: `<Tree>`

```ts
function Tree(props: TreeProps): HTMLElement;

interface TreeData {
  label: string;
  meta?: string;                          // вторичный текст; участвует в поиске
  children?: readonly TreeData[] | null;  // null/нет — лист
  labelClass?: string;
}

interface TreeProps {
  root: ReactiveSource<TreeData | null>;
  searchPlaceholder?: string;
  searchDebounce?: number | false;        // 120 мс
  searchDebounceMinItems?: number;        // 200 узлов
  showExpandAll?: boolean;                // кнопки массового раскрытия, по умолчанию false
  nodeKey?: (node: TreeData, path: string[]) => unknown;  // ключ раскрытия, по умолчанию путь
  renderLabel?: (node: TreeData) => JsxChild;
  empty?: string;
  labels?: Partial<TreeLabels>;
  class?: string;                         // доп. класс .tree
}

interface TreeLabels {
  search?: string;           // 'Search'
  searchPlaceholder?: string;// 'Search…'
  matched?: string;          // префикс счётчика, 'matched:'; '' — скрыть
  expandAll?: string;        // 'Expand all'
  collapseAll?: string;      // 'Collapse all'
}
```

**Поведение:**

- Поиск: подстрока по `label` **и** `meta`; узлы с совпадающим потомком сохраняются;
  при непустом запросе всё раскрыто, совпадения помечаются классом `match`.
- Раскрытие хранится по ключу `nodeKey(node, path)` (по умолчанию `label/label/…`).
- `children: []` — узел считается папкой (рисует раскрытие без детей); `null` — лист.
- Снапшот пересобирается на каждое изменение данных/запроса/раскрытия, дерево
  перерисовывается целиком (осознанно, см. [COMPROMISES.md](./COMPROMISES.md)).

**Клавиатура:** одна остановка `Tab` (корневая строка), `ArrowDown`/`ArrowUp` —
фокус по видимым строкам, `Enter`/`Space` — переключить, `ArrowRight`/`ArrowLeft` —
раскрыть/свернуть. Фокус возвращается на тот же узел после перерисовки.

**Доступность:** `role="tree"` + `aria-label` (метка корня), `role="treeitem"` +
`aria-expanded`, `role="group"` у детей.

---

## 11. Ключ = идентичность (важнейшая ловушка)

В keyed-режиме `<For>` и в `Grid` с `rowKey` узел, чей ключ остался в списке,
**не перерисовывается**. Поэтому:

```tsx
// ❌ значение застынет на первом рендере
{ key: 'title', header: 'Title', sort: r => r.title, cell: r => r.title }

// ✅ точечная привязка: поле обновляется, узел (и фокус) живут
{ key: 'title', header: 'Title', sort: r => r.title, cell: r => <b>{$(r, x => x.title)}</b> }

// ✅ или ключ с отпечатком: узел пересоздаётся при реальном изменении
rowKey={r => `${r.id}:${r.updated}`}
```

`$()` внутри `cell` работает, только если строка — реактивный прокси (`Reactive`);
на обычном массиве привязка резолвится один раз.

---

## 12. Классы разметки компонентов

- `Grid`: `grid`, `toolbar`, `search`, `dir`, `chip`, `arrow`, `group-row`, `toggle`,
  `count`, `empty` (+ `class`/`headerClass` колонок).
- `Tree`: `tree`, `toolbar`, `search`, `bulk`, `expand-all`, `collapse-all`, `chip`,
  `node`, `row`, `caret`, `leaf`, `name`, `dir`, `match`, `meta`, `kids`, `empty`.

Разметка, атрибуты и минимальный CSS — [TREE_GRID.md](./TREE_GRID.md).
