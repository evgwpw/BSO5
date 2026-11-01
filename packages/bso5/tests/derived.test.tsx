/**
 * Приёмочные тесты производных значений, обработки ошибок эффектов и
 * атрибутов-механизмов `h()`: `computed`, `onError`, `ref`, `on*Capture`,
 * освобождение привязок скрытой ветки `<Show>`.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  Show, computed, createScope, dispose, effect, h, runInScope,
  setEffectErrorHandler, signal, $,
} from 'bso5';

const listeners = (sig: unknown): number => (sig as { listeners: Set<unknown> }).listeners.size;

afterEach(() => {
  setEffectErrorHandler(null);
  document.body.innerHTML = '';
});

describe('computed()', () => {
  it('пересчитывается от зависимостей и читается как Signal', () => {
    const count = signal(1);
    const doubled = computed(() => count.value * 2);
    expect(doubled.value).toBe(2);

    let runs = 0;
    effect(() => { runs++; doubled.value; });
    expect(runs).toBe(1);

    count.value = 2;
    expect(doubled.value).toBe(4);
    expect(runs).toBe(2);
  });

  it('не уведомляет, если результат не изменился', () => {
    const count = signal(2);
    const parity = computed(() => count.value % 2);
    let runs = 0;
    effect(() => { runs++; parity.value; });
    expect(runs).toBe(1);

    count.value = 4; // 0 → 0: значение то же
    expect(runs).toBe(1);

    count.value = 5; // 1: изменилось
    expect(runs).toBe(2);
  });

  it('работает в атрибуте и ребёнке через $()', () => {
    const count = signal(3);
    const doubled = computed(() => count.value * 2);
    const el = h('span', { title: $(doubled) }, $(doubled));
    expect(el.title).toBe('6');
    expect(el.textContent).toBe('6');

    count.value = 4;
    expect(el.title).toBe('8');
    expect(el.textContent).toBe('8');
  });

  it('останавливается вместе с областью', () => {
    const scope = createScope();
    const v = signal(1);
    let derived: ReturnType<typeof computed<number>> | undefined;
    runInScope(scope, () => { derived = computed(() => v.value * 10); });
    expect(derived!.value).toBe(10);

    dispose(scope);
    v.value = 2;
    expect(derived!.value).toBe(10); // пересчёта больше нет
  });
});

describe('effect(): обработка ошибок', () => {
  it('onError конкретного эффекта получает исключение вместо проброса', () => {
    const err = new Error('boom');
    let caught: unknown;
    const stop = effect(() => { throw err; }, { onError: e => { caught = e; } });
    expect(caught).toBe(err);
    expect(() => stop()).not.toThrow();
  });

  it('глобальный обработчик ловит ошибки всех эффектов', () => {
    const seen: unknown[] = [];
    setEffectErrorHandler(e => { seen.push(e); });
    const s = signal(0);
    effect(() => { if (s.value > 0) throw new Error(`x${s.value}`); });

    expect(seen).toEqual([]);
    s.value = 1;
    expect(seen.length).toBe(1);
    expect(String(seen[0])).toContain('x1');

    setEffectErrorHandler(null); // возврат к console.error
  });

  it('сломанный обработчик не роняет реактивный граф', () => {
    const s = signal(0);
    let runs = 0;
    effect(() => {
      runs++;
      if (s.value === 1) throw new Error('boom');
      setEffectErrorHandler(() => { throw new Error('handler'); });
    });
    expect(() => { s.value = 1; }).not.toThrow();
    expect(runs).toBe(2);
  });
});

describe('h(): ref и фаза перехвата', () => {
  it('ref получает созданный элемент', () => {
    let captured: HTMLElement | null = null;
    const el = h('section', { ref: node => { captured = node; } });
    expect(captured).toBe(el);
  });

  it('ref работает в JSX', () => {
    let captured: HTMLElement | null = null;
    const el = <input ref={node => { captured = node; }} /> as HTMLElement;
    expect(captured).toBe(el);
    expect((captured as unknown as HTMLInputElement).tagName).toBe('INPUT');
  });

  it('on*Capture срабатывает в фазе перехвата, раньше обработчика цели', () => {
    const order: string[] = [];
    const parent = h('div', { onInputCapture: () => { order.push('capture'); } });
    const child = h('input', { onInput: () => { order.push('bubble'); } });
    parent.appendChild(child);

    child.dispatchEvent(new Event('input', { bubbles: true }));
    expect(order).toEqual(['capture', 'bubble']);
  });
});

describe('<Show>: скрытая ветка', () => {
  it('ветка-танка освобождает привязки при скрытии и собирается заново при показе', () => {
    const on = signal(true);
    const v = signal(0);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(<div><Show when={on}>{() => <b>{$(v)}</b>}</Show></div>);

    expect(listeners(v)).toBe(1);
    on.value = false;
    expect(host.querySelector('b')).toBeNull();
    expect(listeners(v)).toBe(0); // привязка снята, а не висит на отсоединённом узле

    on.value = true;
    expect(host.querySelector('b')!.textContent).toBe('0');
    expect(listeners(v)).toBe(1);
    v.value = 1;
    expect(host.querySelector('b')!.textContent).toBe('1');
  });

  it('готовый узел нельзя перепривязать — он кешируется и живёт до сноса Show', () => {
    // Граница контракта: узел построен до Show, его подписки лежат в WeakMap по
    // этому самому узлу, поэтому «снять и оживить» его невозможно — остаётся
    // держать привязки живыми. Для настоящего сноса передавайте танку.
    const on = signal(true);
    const v = signal(0);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(<div><Show when={on}>{<b>{$(v)}</b>}</Show></div>);

    expect(listeners(v)).toBe(1);
    on.value = false;
    expect(host.querySelector('b')).toBeNull();
    expect(listeners(v)).toBe(1); // узел в кеше, привязка жива

    on.value = true;
    v.value = 7;
    expect(host.querySelector('b')!.textContent).toBe('7'); // и значение актуально
  });

  it('не перестраивает узловую ветку, если решение не менялось', () => {
    const on = signal(true);
    const n = signal(0);
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(<div><Show when={() => on.value && n.value >= 0}>{<i>{'x'}</i>}</Show></div>);

    const first = host.querySelector('i');
    n.value = 1; // условие переоценивалось, но осталось истинным
    expect(host.querySelector('i')).toBe(first);
  });
});
