# `<Grid>` и `<Tree>`: разметка, классы, CSS

Компоненты **headless**: они дают семантический DOM и стабильные имена классов, а
внешний вид целиком ваш. Здесь — полная карта того, что они рендерят, минимальный
рабочий CSS и рецепты адаптации данных.

## `<Grid>`

### Разметка

```html
<div class="grid">
  <div class="toolbar">
    <input class="search" type="text" aria-label="Search" placeholder="Search…">
    <select class="dir" aria-label="Sort direction">
      <option value="desc">↓ desc</option>
      <option value="asc">↑ asc</option>
    </select>
    <span class="chip">rows: <b>42</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th scope="col" aria-sort="descending">ID<span class="arrow">↓</span></th>
        <th scope="col">Title</th>
      </tr>
    </thead>
    <tbody>
      <!-- группа: <tr> фокусируется, Enter/Space переключает -->
      <tr class="group-row" data-group="Web App" tabindex="0" aria-expanded="true">
        <td colspan="2">
          <span class="toggle">▾</span>Web App<span class="count">(2)</span>
        </td>
      </tr>
      <tr><td>4101</td><td>Login fails on Safari 17</td></tr>
      <tr><td>4102</td><td>Flaky e2e: checkout flow</td></tr>
    </tbody>
  </table>
  <div class="empty">No rows match the current filter.</div>
</div>
```

### Классы

| Класс | Где | Что это |
| --- | --- | --- |
| `grid` | корень | задаётся пропом `class` (по умолчанию `grid`) |
| `toolbar` | панель | строка поиска + контрол направления + счётчик |
| `search` | `input` | поиск; `aria-label` = `searchPlaceholder` |
| `dir` | `select` | направление сортировки, реактивно в обе стороны |
| `chip` | `span` | счётчик строк |
| `arrow` | `span` в `th` | стрелка направления у активной колонки |
| `group-row` | `tr` | строка группы: `data-group`, `tabindex`, `aria-expanded` |
| `toggle` | `span` в группе | `▾` развёрнуто / `▸` свёрнуто |
| `count` | `span` в группе | число строк в группе |
| `empty` | `div` | пустое состояние |

Колонки получают свои классы через `class` (у `td`) и `headerClass` (у `th`).

### Минимальный CSS

```css
.grid { font: 14px/1.45 system-ui, sans-serif; }
.grid .toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
.grid .search { flex: 1; padding: 4px 8px; }
.grid .chip { color: #888; font-size: 12px; white-space: nowrap; }

.grid table { border-collapse: collapse; width: 100%; }
.grid th, .grid td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #e6e6e6; }
.grid th { cursor: pointer; user-select: none; background: #fafafa; white-space: nowrap; }
.grid th[aria-sort] { background: #eef2fb; }
.grid .arrow { margin-left: 4px; color: #456; }

.grid tr.group-row { background: #f4f6fa; font-weight: 600; cursor: pointer; }
.grid tr.group-row:focus-visible { outline: 2px solid #6ea8fe; outline-offset: -2px; }
.grid tr.group-row .toggle { display: inline-block; width: 1.2em; color: #666; }
.grid tr.group-row .count { color: #888; font-weight: 400; margin-left: 6px; }

.grid .empty { color: #888; font-style: italic; padding: 8px 0; }
```

## `<Tree>`

### Разметка

```html
<div>
  <div class="toolbar">
    <input class="search" type="text" aria-label="Search" placeholder="Search…">
    <!-- только при showExpandAll -->
    <span class="bulk">
      <button type="button" class="expand-all">Expand all</button>
      <button type="button" class="collapse-all">Collapse all</button>
    </span>
    <span class="chip">matched: <b>7</b></span>
  </div>
  <div class="tree " role="tree" aria-label="bso5">
    <div class="node" role="treeitem" aria-expanded="true">
      <div class="row" data-key="root" tabindex="0">
        <span class="caret ">▾</span>
        <span class="name dir ">bso5</span>
        <span class="meta">7 items</span>
      </div>
      <div class="kids" role="group">
        <div class="node" role="treeitem">
          <div class="row" data-key="root/index.ts" tabindex="-1">
            <span class="caret leaf">·</span>
            <span class="name  match">index.ts</span>
            <span class="meta">412 B</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

`data-key` — ключ раскрытия (для `nodeKey` берётся из него), по нему же
восстанавливается фокус после перерисовки. `tabindex="0"` только у корневой
строки: Tab входит в дерево один раз, дальше — стрелки.

### Классы

| Класс | Где | Что это |
| --- | --- | --- |
| `toolbar`, `search`, `chip` | панель | как в `Grid` |
| `bulk` | `span` в панели | контейнер кнопок «развернуть/свернуть всё» |
| `expand-all` / `collapse-all` | `button` | массовое раскрытие, при `showExpandAll` |
| `tree` | корень дерева | `role="tree"`; доп. класс через проп `class` |
| `node` | узел | `role="treeitem"`, `aria-expanded` у папок |
| `row` | строка узла | `data-key` — ключ узла; `tabindex="0"` только у корня, остальные `-1` |
| `caret` | маркер | `▾` открыто / `▸` закрыто / `·` лист (`leaf`) |
| `name` | метка | `dir` у папок, `match` у совпадений с запросом |
| `meta` | вторичный текст | размеры, счётчики |
| `kids` | дети | `role="group"`, отступ задаётся CSS |
| `empty` | заглушка | когда дерева нет или фильтр всё отсёк |

### Минимальный CSS

```css
.tree { font: 14px/1.5 system-ui, sans-serif; }
.tree .node { display: block; }
.tree .row { display: flex; gap: 6px; align-items: center; padding: 1px 4px; cursor: pointer; border-radius: 4px; }
.tree .row:hover { background: #f2f5fa; }
.tree .row:focus-visible { outline: 2px solid #6ea8fe; outline-offset: -2px; }
.tree .caret { width: 1ch; color: #888; flex: none; }
.tree .name.dir { font-weight: 600; }
.tree .name.match { background: #fff3c4; border-radius: 3px; }
.tree .meta { color: #888; font-size: 12px; margin-left: auto; }
.tree .kids { padding-left: 16px; }
```

Отступ делается только на `.kids`: узлы не дублируют отступ, поэтому глубокая
ветка стоит ровно `16px × уровень`.

## Как адаптировать свои данные

Компоненты не знают, откуда данные: они принимают `ReactiveSource` (массив,
танку, `Signal`, `$()`). Трансформация — на стороне владельца данных.

```tsx
import { effect, signal } from 'bso5';
import type { TreeData } from 'bso5-components';

interface FileNode { name: string; size?: number; children?: FileNode[] }

// 1) плоское или чужое дерево → TreeData
const toTree = (nodes: FileNode[]): TreeData[] => nodes
  .slice()
  .sort((a, b) => Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name))
  .map(n => ({
    label: n.name,
    meta: n.size === undefined ? undefined : `${n.size} B`,
    children: n.children ? toTree(n.children) : null,
  }));

// 2) сортировка/фильтрация источника — тоже ваша: компонент рисует то, что дали
const files = signal<FileNode[]>([]);
const view = signal<TreeData | null>(null);
effect(() => {
  view.value = files.value.length ? { label: 'root', children: toTree(files.value) } : null;
});

<Tree root={view} />;
```

Правила, которые экономят время:

1. **Дерево — данные, а не компонент.** Сортировка, свёртка из плоского списка,
   асинхронная загрузка — всё до входа в `Tree`.
2. **`children: null` означает лист**, `undefined` — то же самое; пустой массив
   листом не считается и рисует раскрывающийся узел без детей.
3. **Ключ раскрытия** по умолчанию — путь из меток. Если метки повторяются или
   меняются местами, задайте `nodeKey` (например, по `id`).
4. **`rowKey` в `Grid` не должен включать индекс**: индекс меняется при
   сортировке, и keyed-режим превращается в полную пересборку.
5. **Поиск смотрит в `label` и `meta`**, а не в ваши исходные поля — кладите
   искомое в `meta`, иначе поиск его не увидит.
