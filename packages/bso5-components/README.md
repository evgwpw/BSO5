# bso5-components

> Переиспользуемые UI-компоненты для [bso5](https://www.npmjs.com/package/bso5) — грид с фильтром/сортировкой/группировкой и рекурсивное дерево с поиском. Без CSS-фреймворка: компоненты headless, стили за вами.

**~1.5 kB min+gzip** · ноль зависимостей (кроме peer `bso5`)

[English version](./README.en.md)

## Установка

```bash
npm install bso5 bso5-components
```

`bso5` — peer-зависимость: она должна быть установлена один раз в вашем
приложении (две копии в бандле = два разных символа `REACTIVE_VALUE` =
`$()`-привязки молча ломаются).

## Компоненты

### `<Grid>` — генерик-грид

```tsx
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

interface Issue { id: number; title: string; severity: 'critical' | 'high' | 'medium' | 'low'; }

const COLS: Column<Issue>[] = [
  { key: 'id',       label: 'ID',   cell: it => it.id },
  { key: 'title',    label: 'Title', cell: it => it.title },
  { key: 'severity', label: 'Sev',  cell: it => <span class="sev">{it.severity}</span> },
];

const issues = signal(ISSUES);

<Grid
  rows={issues}                        // массив | () => массив | Signal | $()
  columns={COLS}
  groupBy={it => it.project}           // группирует по project; опционально
  initialSort={{ key: 'updated', dir: 'desc' }}  // начальная сортировка; опционально
  rowKey={it => it.id}                 // keyed-режим <For>; опционально
  searchPlaceholder="Поиск…"
  empty="Ничего не найдено."
/>
```

**Возможности:** поиск по всем строкам, сортировка кликом по заголовку,
группировка с раскрывающимися группами, счётчик строк, пустое состояние.
Состояние (запрос/сортировка/схлопнутые группы) живёт **внутри** компонента —
экземпляры независимы.

**Props:**

| Проп | Тип | Описание |
| --- | --- | --- |
| `rows` | `ReactiveSource<readonly Row[]>` | Источник данных: массив, `() => массив` (перечитывается, автотрекается), `Signal` или `$()` |
| `columns` | `Column<Row>[]` | Определения колонок: `key`, `label`, `cell(row)` — рендер ячейки, `sort(row)` — значение сортировки, `class?` |
| `filter?` | `(row, query) => boolean` | Пользовательский матчер поиска; по умолчанию — подстрока по всем строковым/числовым полям |
| `groupBy?` | `(row) => string` | Группировка строк по ключу; не задано — без групп |
| `initialSort?` | `{ key, dir }` | Начальная сортировка |
| `rowKey?` | `(row) => unknown` | Стабильный ключ строки: включает keyed-`<For>` (сохраняет фокус ячеек при пересортировке) |
| `searchPlaceholder?` | `string` | Плейсхолдер поиска |
| `empty?` | `string \| JsxChild` | Пустое состояние |

### `<Tree>` — рекурсивное дерево

```tsx
import { Tree } from 'bso5-components';
import type { TreeData } from 'bso5-components';

// Дерево — просто данные: label + мета + дети.
const treeData = signal<TreeData>({
  label: 'bso5',
  meta: '7 items',
  children: [
    { label: 'src', meta: '6 items', children: [
      { label: 'index.ts', meta: '412 B', children: null },
    ]},
  ],
});

<Tree root={treeData} searchPlaceholder="Фильтр…" />
```

**Возможности:** поиск с автораскрытием совпадений и подсветкой, раскрытие
узлов, клики по узлам (через `renderLabel` вы можете повесить обработчик).
Данные любого вида адаптируются функцией `toTreeData`-подобным маппером (см.
[examples/dataview](../../examples/dataview)).

**Props:**

| Проп | Тип | Описание |
| --- | --- | --- |
| `root` | `ReactiveSource<TreeData \| null>` | Корень дерева (сигнал снапшота или любой источник) |
| `renderLabel?` | `(node: TreeData) => JsxChild` | Кастомный рендер метки (ссылки, иконки, обработчики) |
| `nodeKey?` | `(node: TreeData) => string` | Ключ узла для состояния раскрытия (по умолчанию — путь `label/label/…`) |
| `searchPlaceholder?` | `string` | Плейсхолдер поиска |
| `empty?` | `string` | Пустое состояние |

## Headless-подход и CSS

Компоненты рендерят семантический DOM со стабильными классами
(`toolbar/search/chip/grid/table/group-row/tree/node/row/caret/name/meta/kids/empty/highlight`).
CSS остаётся за вами — можно взять готовый из
[examples/dataview/style.css](../../examples/dataview/style.css).

## Разработка

```bash
npm install          # в корне монорепо
npm test             # 135 тестов (121 ядро + 14 компоненты)
npm run typecheck
npm run build        # оба пакета
```

## Лицензия

MIT
