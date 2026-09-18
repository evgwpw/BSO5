# Задача на доработку GLM: перенять два решения из реализации DS

Этот файл — **инструкция для переписывания кода GLM**. По итогам сравнения двух
реализаций `bso5` GLM выиграла в целом, но проиграла DS в двух местах. Ниже — что
именно менять, в каких файлах, с готовым кодом под текущие типы и хелперы GLM.

Затрагиваемые файлы: `src/control.ts`, `src/reactive.ts`.
Оба изменения **обратно совместимы** (публичный API не ломается).

---

## Изменение 1 — keyed-`<For>` с переиспользованием DOM-узлов

**Файл:** `src/control.ts` · **Функция:** `For` + интерфейс `ForProps`

### Проблема
Сейчас `For` на любое изменение списка сносит и строит заново ВСЁ содержимое:

```ts
// src/control.ts — как сейчас
effect(() => {
  const items = resolveSource(props.each) ?? [];
  const nodes: Node[] = [];
  for (let i = 0; i < items.length; i++) nodes.push(...toNodes(render(items[i], i)));
  clearBetween(start, end);   // снести всё
  insertAll(nodes, end);      // построить заново
});
```

Полный ре-рендер **теряет идентичность DOM-узлов** между обновлениями: сбрасывается
фокус в `<input>`, позиция каретки, выделение текста, состояние `<video>`/`<canvas>`,
прерываются CSS-transition'ы. И это лишняя работа для браузера на больших списках.

DS вместо этого держит `Map<key, Node>` и **переставляет существующие узлы** через
`insertBefore` (он сам перемещает уже смонтированный узел), удаляя только выбывшие
ключи. Идентичность узлов сохраняется.

### Что сделать
Добавить необязательный проп `key`. Если он **не задан** — оставить текущий полный
ре-рендер (он корректен). Если `key` **задан** — включать keyed-реконсиляцию.

### Готовый код (drop-in замена `ForProps` и `For` в `src/control.ts`)

```ts
/** Props of {@link For}. */
export interface ForProps<T> {
  /** Список: массив, `() => array`, `Signal` или `$()`-значение. */
  each: ReactiveSource<readonly T[]>;
  /**
   * Необязательный стабильный ключ элемента. Если задан — включается
   * keyed-реконсиляция: узлы переиспользуются и перемещаются, а не
   * пересоздаются (сохраняются фокус/каретка/выделение/медиа/transition'ы).
   * Ключ идентифицирует ЭЛЕМЕНТ; при том же ключе узлы не перерисовываются —
   * для реактивных полей внутри элемента используйте `$()`.
   */
  key?: (item: T, index: number) => unknown;
  /** Рендер элемента, вызывается как `(item, index)`. */
  children: (item: T, index: number) => JsxChild;
}

/**
 * Реактивный рендер списка между комментариями-анкорами (без обёртки).
 * Без `key` — полный ре-рендер на изменение. С `key` — keyed-реконсиляция
 * (переиспользование и перестановка узлов вместо пересборки).
 */
export function For<T>(props: ForProps<T>): DocumentFragment {
  const start = document.createComment('for');
  const end = document.createComment('/for');
  const frag = document.createDocumentFragment();
  frag.append(start, end);
  const render = childFn<[T, number], JsxChild>(unwrapChild(props.children), 'For');
  const keyOf = props.key;

  // Без ключа — прежнее поведение: корректно и просто.
  if (!keyOf) {
    effect(() => {
      const items = resolveSource(props.each) ?? [];
      const nodes: Node[] = [];
      for (let i = 0; i < items.length; i++) nodes.push(...toNodes(render(items[i], i)));
      clearBetween(start, end);
      insertAll(nodes, end);
    });
    return frag;
  }

  // Keyed: одна ГРУППА узлов на ключ (элемент может рендерить несколько узлов).
  let prev = new Map<unknown, Node[]>();
  effect(() => {
    const items = resolveSource(props.each) ?? [];
    const host = end.parentNode;
    if (!host) return;

    // Собираем новый порядок групп, переиспользуя узлы по ключу.
    const next = new Map<unknown, Node[]>();
    for (let i = 0; i < items.length; i++) {
      const k = keyOf(items[i], i);
      next.set(k, prev.get(k) ?? toNodes(render(items[i], i)));
    }

    // Расставляем группы в порядке списка перед `end`. insertBefore ПЕРЕМЕЩАЕТ
    // уже смонтированные узлы — переиспользуемые группы переставляются, а не
    // пересоздаются. Новые группы монтируются здесь же.
    for (const nodes of next.values()) {
      for (const n of nodes) host.insertBefore(n, end);
    }

    // Удаляем группы, чьи ключи исчезли из списка.
    for (const [k, nodes] of prev) {
      if (!next.has(k)) for (const n of nodes) if (n.parentNode === host) host.removeChild(n);
    }

    prev = next;
  });
  return frag;
}
```

### Ключевые отличия от DS, которые нужно понимать
- В GLM элемент рендерится в **несколько** узлов (`toNodes` → `Node[]`), поэтому
  ключ отображается в **группу** узлов (`Map<key, Node[]>`), а не в один узел, как
  у DS (`Map<key, Node>`). Расстановка перед `end` вставляет всю группу подряд.
- Оставляем анкоры `start`/`end` — это стиль GLM (DS использует один анкор).
  `clearBetween` в keyed-ветке не нужен: узлами управляем поимённо.

### Компромиссы (задокументировать в README рядом с `<For>`)
- **Дубликаты ключей** схлопываются (`Map`) → ключ должен быть уникальным. Как у DS.
- **При том же ключе и новых данных** узлы не перерисовываются (это семантика
  «ключ = идентичность», как в SolidJS/React). Для реактивных полей внутри
  элемента используйте `$()`.

### Тесты (добавить в `tests/`, vitest + jsdom)
1. Переиспользование узла: сохранить ссылку на `<li>` первого элемента, изменить
   порядок массива с тем же `key` → это тот же DOM-узел (`toBe`), не пересозданный.
2. Фокус переживает reorder: поставить фокус в `<input>` внутри элемента,
   переставить список → `document.activeElement` остаётся тем же узлом.
3. Добавление/удаление: push/splice → добавляется/удаляется только затронутая
   группа, остальные узлы те же по ссылке.

---

## Изменение 2 — разбор пути аксессора через Proxy (индексная нотация)

**Файл:** `src/reactive.ts` · **Функция:** `getPropertyName`

### Проблема
`getPropertyName` парсит `fn.toString()` **регуляркой** и принимает только простую
точечную цепочку:

```ts
// src/reactive.ts — как сейчас
const normalized = body.replace(new RegExp(`\\b${head[1]}\\b`, 'g'), 'ROOT');
if (!/^ROOT(?:\.[\w$]+)+$/.test(normalized)) return null;  // x => x.items[0].title → null
return normalized.slice('ROOT.'.length);
```

Из-за этого **скобочная/индексная нотация не работает**: `x => x.items[0].title`,
`x => x.map['k']` отвергаются. Также разбор хрупок к тексту функции.

Важно: остальной код GLM (`splitPath`, `resolveOwner`, `pathSubs`, `notify`) уже
работает со **строковым** путём вида `"user.name"` и доступом `current[seg]`, где
`obj['0']` корректно индексирует массив. То есть **достаточно починить только
`getPropertyName`**, чтобы он умел возвращать `"items.0.title"` — остальная система
подхватит индексы без изменений.

### Что сделать
Заменить регулярку на трейсинг аксессора через Proxy-маркер (подход DS): прогнать
функцию над маркером, который записывает фактические обращения к свойствам, включая
индексы, и вернуть их через `.` в виде строки (сохраняем текущий тип `string | null`).

### Готовый код (drop-in замена `getPropertyName` в `src/reactive.ts`)

```ts
/**
 * Извлекает путь свойства из аксессора вида `x => x.user.name` или
 * `x => x.items[0].title`, ПРОГОНЯЯ функцию над Proxy-маркером (без парсинга
 * текста). Возвращает точечную строку ("items.0.title") либо `null`, если это
 * не чистая цепочка обращений (вычисления, вызовы методов — отбрасываются).
 *
 * Аксессор должен быть чистым и без побочных эффектов: он реально выполняется.
 */
export function getPropertyName(fn: Function): string | null {
  const segments: string[] = [];
  let touched = false;
  const marker: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (typeof prop === 'symbol') return marker; // toPrimitive и пр. — не путь
      touched = true;
      segments.push(String(prop));                 // индексы попадают как '0','1'
      return marker;
    },
    apply() { return marker; },
    has() { return true; },
  });
  try {
    fn(marker);
  } catch {
    return null; // вычисления над маркером (`x => x.a + 1`) бросают → отвергаем
  }
  return touched ? segments.join('.') : null;
}
```

### Почему это безопасно для остального кода GLM
- `watch()` берёт `getPropertyName(path)` → `splitPath('items.0.title')` даёт
  `['items','0','title']`; `resolveOwner`/`notify` работают со строковыми ключами,
  а `arr['0']` корректно обращается к массиву. Правки в этих функциях не нужны.
- `$()` читает значение вызовом `path(reactor.value)` на живом прокси — индексы там
  и так уже работали; чинится именно подписка (через `watch` → `getPropertyName`).
- Числовые ключи остаются строками — это совпадает со стилем GLM (`String(prop)` в
  `notify`). Не переводите их в `number` (в отличие от DS), иначе разъедется
  сравнение с сегментами.

### Компромиссы (осознанный сдвиг поведения)
- Подход **выполняет** аксессор → он должен быть чистым (без сайд-эффектов) и не
  бросать на маркере. У регулярки этого требования не было — это её единственный
  плюс. Если он важен, можно оставить старую регулярку как быстрый предварительный
  фильтр, а Proxy-трейсинг использовать как основной разбор.
- Ветвления вроде `x => cond ? x.a : x.b` теперь дадут частичный путь вместо `null`.
  Требуйте в доке «аксессор — простая цепочка свойств».

### Тесты (добавить в `tests/reactive.test.ts`)
1. `getPropertyName(x => x.user.name)` === `'user.name'`.
2. `getPropertyName(x => x.items[0].title)` === `'items.0.title'` (**новая фича**).
3. `watch(state.value, x => x.list[1].done, cb)` срабатывает при
   `state.value.list[1].done = true`.
4. `getPropertyName(x => x.a + 1)` === `null` (вычисление отвергается).

---

## Чек-лист

- [ ] `src/control.ts`: добавить `key?` в `ForProps`, реализовать keyed-ветку в `For`.
- [ ] `src/reactive.ts`: заменить тело `getPropertyName` на Proxy-трейсинг.
- [ ] README: описать `key` у `<For>` и семантику «ключ = идентичность»; отметить
      поддержку индексной нотации в путях и требование «чистый аксессор».
- [ ] Тесты: 3 на keyed-`<For>` + 4 на разбор путей (см. выше).
- [ ] `npm run typecheck` и `npm test` — зелёные.

## Итог
После этих двух правок GLM закроет оба места, где DS была объективно сильнее, и
станет строго лучше по всем осям: ядро/тесты/фичи GLM + keyed-`<For>` и
Proxy-трейсинг путей.
