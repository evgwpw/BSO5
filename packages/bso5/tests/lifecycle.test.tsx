/**
 * Приёмочные тесты владения реактивностью: scope, `<For>`/`<Show>`, `mount()`,
 * `batch()`/`untrack()`, проход `Map`/`Set` и мелкие фиксы `h()`.
 *
 * Каждый тест здесь закрывает конкретный дефект, найденный пробником
 * (внешний обзор 2026-11-01): утечка подписок при перерисовке, эффекты
 * снятых узлов, падение `Map.prototype.set` через прокси.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  Reactive, For, Show, signal, effect, batch, untrack, mount,
  createScope, dispose, runInScope, h, $,
} from 'bso5';

/* Подписки `Signal` живут в приватном поле — для замера читаем его в обход типов. */
const listeners = (sig: unknown): number => (sig as { listeners: Set<unknown> }).listeners.size;

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('scope: владение эффектами', () => {
  it('dispose() останавливает эффекты, созданные внутри области', () => {
    const scope = createScope();
    const v = signal(0);
    let runs = 0;
    runInScope(scope, () => { effect(() => { v.value; runs++; }); });
    expect(runs).toBe(1);

    v.value = 1;
    expect(runs).toBe(2);

    dispose(scope);
    v.value = 2;
    expect(runs).toBe(2); // эффект остановлен
  });

  it('dispose() идемпотентен и не принимает новые эффекты после сноса', () => {
    const scope = createScope();
    dispose(scope);
    expect(() => dispose(scope)).not.toThrow();

    let runs = 0;
    runInScope(scope, () => { effect(() => { runs++; }); });
    expect(runs).toBe(1); // эффект выполнился один раз, но областью не удерживается
  });
});

describe('<For> без key: перерисовка не оставляет подписок и эффектов', () => {
  it('подписки на сигнал не растут при 50 перерисовках', () => {
    const list = signal([1, 2, 3]);
    const cell = signal('x');
    const el = host();
    el.appendChild(
      <div>
        <For each={() => list.value}>{(i: number) => <span>{$(cell)}{i}</span>}</For>
      </div>,
    );
    expect(listeners(cell)).toBe(3);

    for (let n = 1; n <= 50; n++) list.value = [1, 2, 3].map(i => i + n);
    expect(listeners(cell)).toBe(3); // было 3 → 18 за пять проходов до правки
  });

  it('эффекты элементов снятого прохода не выполняются', () => {
    const list = signal([1]);
    const trigger = signal(0);
    let runs = 0;
    const el = host();
    el.appendChild(
      <div>
        <For each={() => list.value}>
          {(i: number) => {
            effect(() => { trigger.value; runs++; });
            return <i>{i}</i>;
          }}
        </For>
      </div>,
    );
    expect(runs).toBe(1);

    list.value = [2];
    list.value = [3];
    expect(runs).toBe(3); // по прогону на проход

    const before = runs;
    trigger.value = 1;
    expect(runs - before).toBe(1); // живёт только эффект текущего прохода
  });

  it('удалённые узлы перестают обновляться', () => {
    const list = signal([1]);
    const cell = signal('first');
    const el = host();
    el.appendChild(<div><For each={() => list.value}>{() => <b>{$(cell)}</b>}</For></div>);
    const stale = el.querySelector('b')!;
    expect(stale.textContent).toBe('first');

    list.value = [2]; // старый <b> снят
    cell.value = 'second';
    expect(stale.textContent).toBe('first'); // привязка освобождена
    expect(el.querySelector('b')!.textContent).toBe('second');
  });
});

describe('<For> c key: удаление ключа снимает его эффекты', () => {
  it('эффект удалённой группы больше не выполняется', () => {
    const list = signal([1, 2]);
    const trigger = signal(0);
    let runs = 0;
    const el = host();
    el.appendChild(
      <div>
        <For each={() => list.value} key={(i: number) => i}>
          {(i: number) => {
            effect(() => { trigger.value; runs++; });
            return <i>{i}</i>;
          }}
        </For>
      </div>,
    );
    expect(runs).toBe(2);

    list.value = [1]; // ключ 2 удалён
    const before = runs;
    trigger.value = 1;
    expect(runs - before).toBe(1);
  });
});

describe('<Show> с ребёнком-функцией', () => {
  it('переключение не накапливает подписки', () => {
    const on = signal(true);
    const v = signal(0);
    const el = host();
    el.appendChild(
      <div>
        <Show when={() => on.value}>{() => <b>{$(v)}</b>}</Show>
      </div>,
    );
    expect(listeners(v)).toBe(1);

    for (let i = 0; i < 20; i++) { on.value = false; on.value = true; }
    expect(listeners(v)).toBe(1);
  });
});

describe('mount(): ручка сноса вью', () => {
  it('dispose() снимает привязки, останавливает эффекты и убирает узел', () => {
    const v = signal(0);
    const target = document.createElement('div');
    const app = mount(target, () => <p>{$(v)}</p>);
    expect(target.querySelector('p')!.textContent).toBe('0');
    expect(listeners(v)).toBe(1);

    app.dispose();
    expect(target.querySelector('p')).toBeNull();
    expect(listeners(v)).toBe(0);

    v.value = 1; // после сноса запись безопасна
    expect(() => app.dispose()).not.toThrow(); // идемпотентно
  });

  it('принимает готовый узел', () => {
    const target = document.createElement('div');
    const node = h('span', null, 'ready');
    const app = mount(target, node);
    expect(app.node).toBe(node);
    expect(target.contains(node)).toBe(true);
    app.dispose();
    expect(target.contains(node)).toBe(false);
  });
});

describe('batch() и untrack()', () => {
  it('две записи дают один прогон эффекта', () => {
    const a = signal(1);
    const b = signal(2);
    let runs = 0;
    let seen = '';
    effect(() => { runs++; seen = `${a.value},${b.value}`; });
    expect(runs).toBe(1);

    batch(() => { a.value = 10; b.value = 20; });
    expect(runs).toBe(2);
    expect(seen).toBe('10,20');
  });

  it('слушатель сигнала вызывается один раз на батч', () => {
    const s = signal(0);
    let calls = 0;
    s.subscribe(() => { calls++; });
    batch(() => { s.value = 1; s.value = 2; });
    expect(calls).toBe(1);
  });

  it('untrack() не создаёт зависимость', () => {
    const tracked = signal(0);
    const ignored = signal(0);
    let runs = 0;
    effect(() => { runs++; tracked.value; untrack(() => ignored.value); });
    expect(runs).toBe(1);

    ignored.value = 1;
    expect(runs).toBe(1);
    tracked.value = 1;
    expect(runs).toBe(2);
  });
});

describe('Reactive пропускает встроенные объекты с внутренними слотами', () => {
  it('Map/Set/WeakMap/Date работают через прокси', () => {
    const state = new Reactive({
      m: new Map<string, number>([['a', 1]]),
      s: new Set<number>([1]),
      w: new WeakMap<object, number>(),
      d: new Date(0),
      p: Promise.resolve(1),
    });
    expect(() => state.value.m.set('b', 2)).not.toThrow();
    expect(state.value.m.get('b')).toBe(2);
    expect(() => state.value.s.add(2)).not.toThrow();
    expect(state.value.s.has(2)).toBe(true);
    expect(() => state.value.w.set({}, 1)).not.toThrow();
    expect(state.value.d.getTime()).toBe(0);
    expect(typeof state.value.p.then).toBe('function');
  });
});

describe('h(): мелкие фиксы', () => {
  it('onDoubleClick срабатывает как dblclick', () => {
    let fired = 0;
    const el = h('div', { onDoubleClick: () => { fired++; } });
    el.dispatchEvent(new MouseEvent('dblclick'));
    expect(fired).toBe(1);
  });

  it('value у <select> применяется после появления <option>', () => {
    const el = h('select', { value: 'b' },
      h('option', { value: 'a' }, 'A'),
      h('option', { value: 'b' }, 'B'),
    );
    expect((el as HTMLSelectElement).value).toBe('b');
  });
});
