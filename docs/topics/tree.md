Раздел 10 справочника · Источник: [API.md](../API.md)

## Компоненты: `<Tree>`

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
  перерисовывается целиком (осознанно, см. [COMPROMISES.md](.././COMPROMISES.md)).

**Клавиатура:** одна остановка `Tab` (корневая строка), `ArrowDown`/`ArrowUp` —
фокус по видимым строкам, `Enter`/`Space` — переключить, `ArrowRight`/`ArrowLeft` —
раскрыть/свернуть. Фокус возвращается на тот же узел после перерисовки.

**Доступность:** `role="tree"` + `aria-label` (метка корня), `role="treeitem"` +
`aria-expanded`, `role="group"` у детей.
