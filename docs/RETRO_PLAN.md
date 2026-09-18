# Retro tool на bso5 — план (handoff для новой сессии)

> Доска ретроспективы: колонки «прошло хорошо / не прошло / идеи / action items»,
> карточки, голосование, фазы с таймером, экспорт.
>
> **Жёсткое ограничение: единственная зависимость — `bso5` (+ `bso5-components`).**
> Никаких сторонних DnD-библиотек (sortablejs / @formkit/drag-and-drop
> рассматривались и отвергнуты — см. «Отвергнутые альтернативы» в конце).
> Всё остальное — нативные API платформы (HTML5 DnD / Pointer Events).

Проверено в сессии 2026-09-17 (сверкой по коду):

1. **Событийная поверхность bso5 уже покрывает DnD.** `DOMAttributes`
   (`packages/bso5/src/jsx-runtime.ts`) имеет индексную сигнатуру
   `` [key: `on${string}`]: (event: Event) => void `` — `onDragstart`,
   `onDragover`, `onDrop`, `onDragend`, `onPointerdown`/`move`/`up`
   типизированы и работают в рантайме без правок ядра (тот же механизм,
   что `onClick`/`onInput` в examples).
2. **Нюанс типизации:** обработчик получает `Event`; для `e.dataTransfer`
   / `e.pointerId` нужен каст `e as DragEvent` / `e as PointerEvent` —
   тем же паттерном, что `e.target as HTMLInputElement` в examples.
3. **keyed-`<For>` сохраняет идентичность узлов** → FLIP-анимации работают,
   `<textarea>` карточки держит фокус/каретку при чужих апдейтах (Reactive
   уведомляет точечно, полный ре-рендер не сносит доску).

---

## Архитектурное правило: transient ≠ committed

- **Transient** (позиция курсора, ghost, точка вставки — 60 Гц): обычные
  переменные / `el.style.transform` / прямые DOM-записи. **Вне реактивности.**
- **Committed** (карточка переехала в колонку B на позицию 3): **одно
  дискретное поле модели**, одна запись на drop.

DOM — функция состояния; DnD-слой только докладывает о жесте.

## Модель (плоский массив, не вложенные колонки)

```ts
import { Reactive } from 'bso5';

interface Card  { id: string; colId: string; text: string; votes: number; }
interface Model {
  cards: Card[];
  phase: 'collect' | 'discuss' | 'act';
  timerEndsAt: number | null;   // epoch ms
}

const model = new Reactive<Model>({ cards: [], phase: 'collect', timerEndsAt: null });
```

- перемещение = правка `card.colId` + splice → точечный `notify`;
- колонки — деривация: `() => model.value.cards.filter(c => c.colId === col.id)`
  внутри keyed-`<For each>` (`key={c => c.id}`);
- компактный патч `{cardId, colId, index}` — готовое WS-сообщение на будущее.

## Этап 1 — HTML5 Drag and Drop (десктоп, ~120 строк)

```tsx
<article
  draggable="true"
  onDragstart={e => {
    const d = e as DragEvent;
    dragId.value = card.id;                      // committed: кто тащим
    d.dataTransfer!.effectAllowed = 'move';
    d.dataTransfer!.setData('text/plain', card.id);
  }}
  onDragend={() => { dragId.value = null; dropAt.value = ''; }}
>

<section
  onDragover={e => {
    (e as DragEvent).preventDefault();           // без этого drop не сработает
    const hit = hitTest(e as DragEvent);         // 'colId:index' — строка!
    if (hit !== dropAt.peek()) dropAt.value = hit;  // писать ТОЛЬКО при смене
  }}
  onDrop={e => {
    (e as DragEvent).preventDefault();
    moveCard(dragId.peek(), dropAt.peek());
  }}
>
```

```ts
function moveCard(cardId: string, at: string): void {
  const [colId, index] = at.split(':');
  const cards = model.value.cards;
  const from = cards.findIndex(c => c.id === cardId);
  const [card] = cards.splice(from, 1);
  card.colId = colId;      // keyed-<For> сам переставит узлы
  cards.splice(Number(index), 0, card);
}
```

Индикатор вставки — декларация поверх `dropAt`:

```tsx
<Show when={() => dropAt.value === `${col.id}:${i}`}>
  <div class="drop-indicator" />
</Show>
```

### Грабли (все закрыты скетчем)

1. **Шторм `dragover`**: событие летит каждые несколько мс. Хранить в
   `dropAt` **примитив** (`'b:3'`), не объект — новые объекты обходят
   дедупликацию Signal (`Object.is`), эффекты перезапускались бы каждый кадр.
   Писать только при изменении значения.
2. **`dragleave`-мерцание** на детях: CSS `pointer-events: none` на детях
   карточек во время драга (класс вешается через `$()` от `dragId`).
3. **`getData()` недоступен в `dragover`** (только `types`) — id тащимой
   карточки живёт в сигнале `dragId`, не в dataTransfer.
4. iOS Safari не поддерживает HTML5 DnD — для тача нужен этап 2.


## Клавиатурная доступность (равноправный путь, не фолбэк)

Кнопки-стрелки на карточке: «← колонка влево / → вправо / ↑ ↓ по порядку»
(те же `moveCard`-мутации). ARIA drag-роли официально не рекомендуются;
клавиатурные команды — канонический паттерн.

## FLIP-анимации (~20 строк, бесплатно от keyed-`<For>`)

```ts
function flip(container: HTMLElement, mutate: () => void): void {
  const els = [...container.children] as HTMLElement[];
  const first = new Map(els.map(el => [el, el.getBoundingClientRect()]));
  mutate();                                    // запись в модель → For переставил ТЕ ЖЕ узлы
  for (const el of els) {
    const f = first.get(el)!, l = el.getBoundingClientRect();
    const dx = f.left - l.left, dy = f.top - l.top;
    if (!dx && !dy) continue;
    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      el.style.transform = '';
      el.style.transition = 'transform .18s ease';
    });
  }
}
// drop: flip(boardEl, () => moveCard(...))
```

Работает **только** при сохранении идентичности узлов (keyed-`<For>`);
`style.transform` императивно — документированный escape-hatch bso5.

## Этап 2 — Pointer Events (тач, ~200–300 строк)

`pointerdown` → `setPointerCapture` → `pointermove` (ghost через
`style.transform`, без реактивных записей) → `pointerup` (коммит в модель).
Единый код мышь+тач, длинный тап, авто-скролл у краёв (~20 строк).
Движок — императивный plain-DOM; реактивность только на входе
(pointerdown → `dragId`) и выходе (drop → модель).

## Остальная доска (всё — готовые примитивы bso5)

- фазы: `phase` в модели + `<Show>`; таймер: `setInterval` + `effect()`-деривация
  остатка, `$()` в разметке;
- голосование: `card.votes++` (точечный notify);
- счётчики колонок: `effect()`-деривации (паттерн `itemCount` из dataview);
- action items таблицей: `Grid` из `bso5-components`;
- персистентность: `effect(() => localStorage.setItem('retro', JSON.stringify(model.target)))`
  + гидрация при старте; экспорт в markdown — чистая функция над `model.target`.

## Multiuser (этап 3, потом)

WS-сервер рассылает снапшоты → `model.value` = снапшот на верхнем уровне;
конфликт голосов — last-write-wins на MVP.
**Грабля:** чужой апдейт мид-драг — сигнал `isDragging` + очередь входящих
снапшотов, применяется после drop.

## Отвергнутые альтернативы (проверены 2026-09-17)

- `@formkit/drag-and-drop` (~4 kB gzip, data-first, TS) — архитектурно идеально,
  но чужая зависимость → против ограничения «только bso5».
- `sortablejs` 1.15.7 (MIT, ~2.9M загрузок/нед, DOM-first, тач) — рабочий
  вариант с конвергенцией по `onEnd` + keyed-`<For>`, но +10 kB и данные
  приходится догонять по индексам. Отвергнут по тому же ограничению.

Что даём вверх: multi-drag и встроенные индикаторы (пишем ~20 строк сами).
Что сохраняем: философию «no bloat», один peer в package.json, полный контроль.

## Definition of done (этап 1)

- [ ] `examples/retro/`: модель, 4 колонки, keyed-`<For>`, HTML5 DnD, стрелки
- [ ] голосование (точечный notify), фазы + таймер, localStorage, экспорт .md
- [ ] `npm run typecheck` + `npm test` зелёные; vite build example
- [ ] клавиатурные перемещения работают без мыши
