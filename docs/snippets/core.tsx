/**
 * Компилируемая копия примеров из README: `Tree`, справочник `h()`,
 * жизненный цикл (`mount`, scope, `batch`, `untrack`).
 *
 * Файл включён в `npm run typecheck` — документация не может разойтись с API.
 */
import {
  Reactive, batch, computed, createScope, dispose, effect, h, mount,
  onScopeDispose, runInScope, setEffectErrorHandler, signal, untrack, $,
} from 'bso5';
import type { BoundValue, EffectOptions } from 'bso5';
import { Tree } from 'bso5-components';
import type { TreeData } from 'bso5-components';

/* ── Tree ──────────────────────────────────────────────────── */

const tree = signal<TreeData>({
  label: 'bso5',
  meta: '7 items',
  children: [
    {
      label: 'src',
      meta: '6 items',
      children: [{ label: 'index.ts', meta: '412 B', children: null }],
    },
  ],
});

export function fileTree(): HTMLElement {
  return Tree({ root: tree, searchPlaceholder: 'Фильтр…' });
}

export function fileTreeWithKeys(): HTMLElement {
  return Tree({
    root: tree,
    nodeKey: (node, path) => [...path, node.label].join('/'),
    renderLabel: node => <code>{node.label}</code>,
    empty: 'Ничего не найдено.',
    showExpandAll: true,
    labels: { matched: 'найдено:', expandAll: 'Развернуть', collapseAll: 'Свернуть' },
  });
}

/* ── h(): справочник атрибутов ─────────────────────────────── */

export function searchField(): HTMLInputElement {
  return h('input', {
    type: 'text',
    class: 'field',
    style: { width: 200, color: 'tomato' },   // число → px
    disabled: false,                          // атрибут не ставится
    dataset: { role: 'query' },               // data-role="query"
    'aria-label': 'Поиск',
    onInput: e => console.log((e.target as HTMLInputElement).value),
  });
}

/** `attrs` можно передать функцией — единственный способ получить узел без `ref`. */
export function autofocused(): HTMLInputElement {
  return h('input', el => el.focus());
}

export function selectWithValue(): HTMLSelectElement {
  // value применяется после появления <option> — иначе браузер его отбросит.
  return h('select', { value: 'b' },
    h('option', { value: 'a' }, 'A'),
    h('option', { value: 'b' }, 'B'),
  );
}

/* ── Жизненный цикл ────────────────────────────────────────── */

export function mountApp(target: Element): { node: Node; dispose: () => void } {
  // Танка, а не готовый узел: иначе эффекты вью создадутся вне области.
  return mount(target, () => h('main', null, h('h1', null, 'Привет')));
}

export function scopedComponent(): () => void {
  const scope = createScope();
  runInScope(scope, () => {
    effect(() => { untrack(() => void 0); });
  });
  onScopeDispose(() => { /* очистка */ });
  return () => dispose(scope);
}

export function batchedWrites(): void {
  const a = signal(1);
  const b = signal(2);
  effect(() => { void `${a.value},${b.value}`; });
  batch(() => { a.value = 10; b.value = 20; });
}

/* ── $() ───────────────────────────────────────────────────── */

const state = new Reactive({ count: 0 });

export function countBinding(): BoundValue<number> {
  return $(state.value, x => x.count);
}

/* ── computed(): производное значение ──────────────────────── */

export function parityOf(count: ReturnType<typeof signal<number>>): string {
  const parity = computed(() => (count.value % 2 === 0 ? 'чётное' : 'нечётное'));
  return parity.value;
}

export function derivedLabel(): HTMLElement {
  const count = signal(2);
  const doubled = computed(() => count.value * 2);
  // `computed` — это Signal, поэтому работает в `$()` и в `each`.
  return h('output', null, $(doubled));
}

/* ── ошибки эффектов ───────────────────────────────────────── */

export const withPerEffectHandler: EffectOptions = {
  onError: error => { console.error('effect failed', error); },
};

export function guardedEffect(): void {
  effect(() => { /* … */ }, withPerEffectHandler);
  setEffectErrorHandler(error => { console.error('any effect failed', error); });
  setEffectErrorHandler(null); // назад в console.error
}

/* ── ref и фаза перехвата ──────────────────────────────────── */

export function withRef(): HTMLInputElement {
  let input: HTMLInputElement | null = null;
  const el = h('input', { ref: node => { input = node as HTMLInputElement; } });
  return input ?? el;
}

export function capturePhaseHandler(): HTMLElement {
  return h('div', {
    // Фаза перехвата: обработчик сработает до обработчика цели.
    onInputCapture: e => { console.error('captured', (e.target as HTMLInputElement).value); },
  });
}
