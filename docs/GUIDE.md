# bso5 — рецепты

Задачи, а не API: как сделать типичную вещь и почему именно так. Каждый рецепт
самодостаточен — можно копировать целиком. Полные сигнатуры — в [API.md](./API.md).

English version: [GUIDE.en.md](./GUIDE.en.md).

- [1. Счётчик и поле ввода](#1-счётчик-и-поле-ввода)
- [2. Список: без ключа и с ключом](#2-список-без-ключа-и-с-ключом)
- [3. Условия и вкладки](#3-условия-и-вкладки)
- [4. Список с keyed-режимом: живые данные](#4-список-с-keyed-режимом)
- [5. Загрузка данных](#5-загрузка-данных)
- [6. Производные значения](#6-производные-значения)
- [7. Своя вью с жизненным циклом](#7-своя-вью-с-жизненным-циклом)
- [8. Грид](#8-грид)
- [9. Дерево](#9-дерево)
- [10. Ошибки в эффектах](#10-ошибки-в-эффектах)
- [11. Без сборщика](#11-без-сборщика)
- [12. Грабли](#12-грабли)

---

## 1. Счётчик и поле ввода

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

Поле ввода — состояние живёт в сигнале, значение приходит в DOM через `value`:

```tsx
const name = signal('');

const field = (
  <input
    value={$(name)}
    onInput={e => { name.value = (e.target as HTMLInputElement).value; }}
  />
);
```

Почему так: `$()` обновляет **свойство** `value`, не атрибут, поэтому каретка не
сбивается, пока пользователь печатает сам. `count.update(fn)` читает текущее
значение без трекинга — безопасно внутри обработчика.

## 2. Список: без ключа и с ключом

**Без `key`** — просто и предсказуемо, весь список перерисовывается:

```tsx
const history = signal<string[]>([]);

<ul>
  <For each={$(history)}>{item => <li>{item}</li>}</For>
</ul>
```

**С `key`** — узлы переиспользуются и перемещаются (сохраняются фокус, каретка,
CSS-transition'ы):

```tsx
<For each={() => model.value.rows} key={row => row.id}>
  {row => <li>#{row.id} <input value={$(row, x => x.name)} /></li>}
</For>
```

Выбор: если элементы содержат ввод, медиа или анимацию — `key`; если это
одноразовый список из строк — можно без него.

## 3. Условия и вкладки

```tsx
const tab = signal<'list' | 'stats'>('list');

<nav>
  <button onClick={() => { tab.value = 'list'; }}>Список</button>
  <button onClick={() => { tab.value = 'stats'; }}>Статистика</button>
</nav>

<Show when={() => tab.value === 'list'} fallback={() => <Stats />}>
  {() => <List />}
</Show>
```

Обе ветки — **танки**: при переключении старая снимается целиком (её эффекты и
привязки освобождаются). Если передать готовый узел (`fallback={<Stats />}`), он
будет кеширован и продолжит жить при скрытии — иногда это плюс, но подписки
остаются активными.

## 4. Список с keyed-режимом

Ключ — идентичность. Пока ключ в списке, узел **не перерисовывается**. Значит,
изменённые данные сами не появятся. Три рабочих варианта:

```tsx
// а) поле обновляется точечно; строка должна быть реактивным прокси
{cell: row => <b>{$(row, x => x.title)}</b>}

// б) ключ с отпечатком: узел пересоздаётся при реальном изменении
<For each={() => model.value.rows} key={row => `${row.id}:${row.updated}`}>…</For>

// в) отказаться от keyed-режима и мириться с полной перерисовкой
<For each={() => model.value.rows}>…</For>
```

Порядок предпочтения: (а) — дешевле и сохраняет фокус; (б) — проще, но теряет
состояние узла; (в) — только для мелких списков.

Для `Grid` то же самое: `rowKey` включает keyed-режим, `cell` с `$()` делает
ячейки живыми.

## 5. Загрузка данных

Рецепт: одно поле-сигнал на каждое состояние, ошибки — в отдельный сигнал,
`finally` снимает загрузку. Никаких «магических» состояний.

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
  {() => <p>Загрузка…</p>}
</Show>
```

Форма вложенных `<Show>` выглядит громоздко, зато читается сверху вниз и не требует
новых абстракций: «загружается → ошибка → данные».

## 6. Производные значения

```ts
import { computed, signal } from 'bso5';

const items = signal<number[]>([]);
const total = computed(() => items.value.reduce((s, n) => s + n, 0));
const isEmpty = computed(() => items.value.length === 0);
```

`computed` — обычный `Signal`: его можно положить в `$()`, в `each`, в `<Show when>`,
прочитать в `effect()`. Если результат не изменился, подписчики не перезапускаются
(сравнение через `Object.is`) — поэтому `isEmpty` не дёргает DOM на каждое добавление.

## 7. Своя вью с жизненным циклом

```tsx
import { effect, mount, onScopeDispose, signal, $ } from 'bso5';

const target = document.getElementById('app')!;

const app = mount(target, () => {
  const seconds = signal(0);
  const timer = setInterval(() => seconds.update(n => n + 1), 1000);

  // эффект принадлежит области mount(): остановится вместе с вью
  effect(() => console.log('тик', seconds.value));

  // своя очистка — тоже через область
  onScopeDispose(() => clearInterval(timer));

  return <p>{$(seconds)}</p>;
});

app.dispose(); // таймер снят, эффект остановлен, узел удалён
```

Почему танка: всё, что создано **внутри** `() => …`, получает владельца. Узел,
построенный до `mount()`, уже создал эффекты вне области, и снять их нечем.

## 8. Грид

```tsx
import { Reactive, signal } from 'bso5';
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

interface Issue { id: number; title: string; project: string; severity: string }

const model = new Reactive<{ issues: Issue[] }>({ issues: [] });
const query = signal('');

const COLS: Column<Issue>[] = [
  { key: 'id', header: 'ID', sort: i => i.id, cell: i => i.id },
  // ячейка живая: строка — прокси Reactive, поэтому $() обновляется точечно
  { key: 'title', header: 'Задача', sort: i => i.title, cell: i => <b>{$(i, x => x.title)}</b> },
  { key: 'severity', header: 'Важность', sort: i => i.severity, cell: i => i.severity },
];

<Grid
  rows={() => model.value.issues}
  columns={COLS}
  groupBy={i => i.project}
  rowKey={i => i.id}
  searchPlaceholder="Поиск по задачам"
  labels={{ rows: 'строк:', descending: 'убыв', ascending: 'возр' }}
  empty="Ничего не найдено"
/>
```

- `rows` — танка, чтобы замена массива целиком подхватывалась.
- `rowKey` + `$()` в `cell` — данные обновляются, фокус и выделение сохраняются.
- `filter` нужен, когда стандартный поиск по `sort(row)` не подходит:
  `filter={(row, q) => row.title.toLowerCase().includes(q) || row.assignee.toLowerCase().includes(q)}`.
- `initialSort={{ key: 'id', dir: 'desc' }}` отражается и в списке, и в контроле направления.

## 9. Дерево

Плоский список → дерево → компонент:

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
  nodeKey={node => node.label}          // ключ раскрытия: по метке, а не по пути
  showExpandAll
  labels={{ matched: 'найдено:', expandAll: 'Развернуть', collapseAll: 'Свернуть' }}
  searchPlaceholder="Фильтр по имени или размеру"
/>
```

- Сортировка и построение — до компонента: он рисует то, что дали.
- `meta` участвует в поиске: складывайте туда то, что должно находиться.
- `nodeKey` обязателен, если метки могут повторяться или переставляться.

## 10. Ошибки в эффектах

```ts
import { effect, setEffectErrorHandler } from 'bso5';

// локально
effect(() => riskyRendering(), { onError: err => toast(String(err)) });

// глобально (например, в дев-режиме — в консоль с контекстом)
setEffectErrorHandler(err => console.error('[bso5]', err));
```

Исключение в эффекте не пробрасывается в код, записавший сигнал: одна сломанная вью
не должна ронять модель. В тестах обработчик удобен, чтобы падать по факту ошибки:

```ts
setEffectErrorHandler(err => { throw err; });  // в тесте — «падение» на месте
```

## 11. Без сборщика

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

`npm run build` собирает `dist`; дальше достаточно статического сервера
(`py -3 -m http.server 8080`). По `file://` Chrome блокирует ES-модули — это
ограничение браузера, а не библиотеки. Живой пример: [`examples/importmap`](../examples/importmap/index.html).

## 12. Грабли

| Симптом | Причина | Что делать |
| --- | --- | --- |
| В тексте `[object Object]` | `$()` вставлен в шаблонную строку | привязывайте ребёнка/атрибут, а не строку |
| Данные в строке не обновляются | keyed-режим: ключ = идентичность | `$()` в ячейке или ключ с отпечатком (§4) |
| `watch()` бросил «requires a plain property path» | в аксессоре выражение или вызов метода | только цепочка свойств: `x => x.a.b`, `x => x.rows[0].c` |
| `TypeError: Method Map.prototype.set called on incompatible receiver` | `Map`/`Set` внутри `Reactive` не проксируются, а метод вызывается через прокси | такого не случится с 0.4.0; если видите — объект обёрнут вручную |
| Привязка «замерла» на первом значении | `$()` от обычного объекта (не `Reactive`) | оберните модель в `Reactive` или используйте `Signal` |
| Эффект не срабатывает после удаления строки | узел снят, эффект остановлен областью | это ожидаемо: создавайте эффект внутри живого рендера |
| Обработчик `onDoubleClick` молчит | старое ядро (до 0.4.0) отправляло `doubleclick` | обновите bso5 |
| В `<select>` не выставляется `value` | значение применено до появления `<option>` | в 0.4.0 учтено; при ручной сборке ставьте `value` после детей |
| Утечка памяти на больших списках | не остановленные эффекты вне области | создавайте эффекты внутри `mount()`/`<For>`/`<Show>` |
| Скрытая вкладка продолжает реагировать | ветка `<Show>` передана готовым узлом | передавайте танку: `{() => <Tab />}` |
