/* eslint-disable */
// Regression tests for library-quality fixes: effect safety, nested-path
// unsubscription, dispose(), cross-instance proxies, DOM binding release,
// Show fallback and Fragment value stringification.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Reactive, effect, signal, $, watch, releaseBindings, h, boundTextNode, Show } from 'bso5';
import { Fragment } from 'bso5/jsx-runtime';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('effect() safety', () => {
  it('does not recurse infinitely when the effect writes to a signal it reads', () => {
    const s = signal(0);
    expect(() => {
      effect(() => { s.value++; });
    }).not.toThrow();
    expect(s.value).toBe(1);
  });

  it('does not recurse when writing to a Reactive property the effect reads', () => {
    const model = new Reactive({ count: 0 });
    expect(() => {
      effect(() => { model.value.count += 1; });
    }).not.toThrow();
    expect(model.value.count).toBe(1);
  });

  it('resumes reactivity after a guarded self-write', () => {
    const s = signal(10);
    effect(() => { s.value++; });
    expect(s.value).toBe(11);
    s.value = 20; // external change: effect re-runs once, +1 again — внешнее изменение: эффект перезапускается один раз, ещё +1
    expect(s.value).toBe(21);
  });

  it('isolates effect errors from the writer', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = signal(0);
    effect(() => {
      if (s.value > 0) throw new Error('boom');
      s.value;
    });
    expect(() => { s.value = 1; }).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
  });

  it('keeps other effects alive when one effect throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = signal(0);
    let okRuns = 0;
    effect(() => { s.value; okRuns++; });
    effect(() => { s.value; if (s.value > 0) throw new Error('boom'); });
    expect(() => { s.value = 1; }).not.toThrow();
    expect(okRuns).toBe(2);
  });
});

describe('Signal.update()', () => {
  it('computes from the current value', () => {
    const s = signal(5);
    s.update(n => n * 2);
    expect(s.value).toBe(10);
  });

  it('notifies subscribers on real change only', () => {
    const s = signal('a');
    let hits = 0;
    s.subscribe(() => hits++);
    s.update(x => x); // no change → no notify — нет изменения → нет уведомления
    expect(hits).toBe(0);
    s.update(x => x + '!');
    expect(hits).toBe(1);
  });

  it('reads the current value untracked (safe inside effects)', () => {
    const s = signal(1);
    let runs = 0;
    effect(() => {
      s.update(n => n + 1); // reads .current, not .value → no dependency — читает .current, а не .value → нет зависимости
      runs++;
    });
    expect(s.value).toBe(2);
    expect(runs).toBe(1);
  });
});

describe('Reactive nested-path subscriptions', () => {
  it('unsubscribe() stops nested-path callbacks entirely', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let hits = 0;
    const stop = model.watch(x => x.user.name, () => hits++);
    model.value.user.name = 'bob'; // hit #1 — срабатывание №1
    stop();
    model.value.user = { name: 'cat' }; // would re-bind + notify without the fix — без фикса перепривязалось бы и уведомило
    model.value.user.name = 'dee';      // was detached together with the entry — была отсоединена вместе с записью
    expect(hits).toBe(1);
  });

  it('unsubscribe() after re-binding detaches from the current owner', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let hits = 0;
    const stop = model.watch(x => x.user.name, () => hits++);
    model.value.user = { name: 'bob' }; // re-bind + notify → hits = 1 — перепривязка + уведомление → hits = 1
    stop();
    model.value.user.name = 'cat';
    expect(hits).toBe(1);
  });

  it('several subscribers over the same path unsubscribe independently', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let a = 0;
    let b = 0;
    const stopA = model.watch(x => x.user.name, () => a++);
    model.watch(x => x.user.name, () => b++);
    stopA();
    model.value.user.name = 'bob';
    expect(a).toBe(0);
    expect(b).toBe(1);
  });

  it('free watch() unsubscribe stops nested-path callbacks', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let hits = 0;
    const stop = watch(model.value, x => x.user.name, () => hits++);
    stop();
    model.value.user.name = 'bob';
    expect(hits).toBe(0);
  });

  it('unrelated nested paths keep notifying after one is unsubscribed', () => {
    const model = new Reactive({ user: { name: 'ann', city: 'Rome' } });
    let nameHits = 0;
    let cityHits = 0;
    const stopName = model.watch(x => x.user.name, () => nameHits++);
    model.watch(x => x.user.city, () => cityHits++);
    stopName();
    model.value.user.city = 'Milan';
    expect(nameHits).toBe(0);
    expect(cityHits).toBe(1);
  });
});

describe('Reactive.dispose()', () => {
  it('stops effects that read through the model', () => {
    const model = new Reactive({ count: 0 });
    let runs = 0;
    effect(() => { model.value.count; runs++; });
    expect(runs).toBe(1);
    model.dispose();
    model.value.count = 5;
    expect(runs).toBe(1);
  });

  it('stops $() DOM bindings driven by the model', () => {
    const model = new Reactive({ label: 'a' });
    const bound = $(model.value, x => x.label);
    let hits = 0;
    bound.subscribe(() => hits++);
    model.dispose();
    model.value.label = 'b';
    expect(hits).toBe(0); // notify() is a no-op after dispose() — notify() ничего не делает после dispose()
    expect(bound.value).toBe('b'); // the getter itself still resolves — сам геттер продолжает резолвиться
  });

  it('the proxy keeps working as a plain pass-through after dispose()', () => {
    const model = new Reactive({ count: 0 });
    model.dispose();
    model.value.count = 7;
    expect(model.value.count).toBe(7);
    model.value.count = 8;
    expect(model.target.count).toBe(8);
  });
});

describe('cross-instance proxies', () => {
  it('storing a proxy from another Reactive keeps raw storage', () => {
    const a = new Reactive({ slot: null as any });
    const b = new Reactive({ inner: { y: 2 } });
    a.value.slot = b.value.inner;
    expect((a.target as any).slot).toEqual({ y: 2 });
    expect(a.value.slot.y).toBe(2);
  });

  it('nested proxies of the same instance are unwrapped on write', () => {
    const model = new Reactive({ p: { v: 1 }, q: { v: 2 }, bridge: null as any });
    model.value.bridge = model.value.p;
    expect((model.target as any).bridge).toBe(model.target.p);
  });

  it('same raw object cannot be wrapped by two Reactives (registry guard)', () => {
    const obj: any = { a: 1 };
    new Reactive(obj);
    expect(() => new Reactive(obj)).toThrow(/already wrapped/);
  });
});

describe('releaseBindings()', () => {
  it('stops $() text bindings under a detached subtree', () => {
    const model = new Reactive({ msg: 'first' });
    const host = document.createElement('div');
    const inner = document.createElement('p');
    inner.appendChild(boundTextNode($(model.value, x => x.msg)));
    host.appendChild(inner);
    expect(host.textContent).toBe('first');
    releaseBindings(host);
    model.value.msg = 'second';
    expect(host.textContent).toBe('first');
  });

  it('stops $() attribute bindings of an element', () => {
    const model = new Reactive({ label: 'a' });
    const btn = h('button', { title: $(model.value, x => x.label) });
    expect(btn.title).toBe('a');
    releaseBindings(btn);
    model.value.label = 'b';
    expect(btn.title).toBe('a');
  });

  it('is idempotent', () => {
    const model = new Reactive({ msg: 'x' });
    const host = document.createElement('div');
    host.appendChild(boundTextNode($(model.value, x => x.msg)));
    releaseBindings(host);
    expect(() => releaseBindings(host)).not.toThrow();
  });
});

describe('Show fallback and Fragment values', () => {
  it('<Show> renders a static fallback while the condition is false', () => {
    const flag = signal(false);
    const el = (
      <div>
        <Show when={flag} fallback={<em>none</em>}>
          <span>yes</span>
        </Show>
        tail
      </div>
    ) as HTMLElement;
    expect(el.textContent).toBe('nonetail');
    flag.value = true;
    expect(el.textContent).toBe('yestail');
    flag.value = false;
    expect(el.textContent).toBe('nonetail');
  });

  it('<Show> supports a function fallback', () => {
    const model = new Reactive({ ok: false, err: 'no data' });
    const el = (
      <div>
        <Show when={() => model.value.ok} fallback={() => <p>{model.value.err}</p>}>
          <span>fine</span>
        </Show>
      </div>
    ) as HTMLElement;
    expect(el.textContent).toBe('no data');
    model.value.err = 'still nothing';
    expect(el.textContent).toBe('still nothing');
  });

  it('Fragment stringifies bound values consistently with h()', () => {
    const model = new Reactive({ obj: { a: 1 } as unknown });
    const frag = Fragment({
      children: [$(model.value, x => x.obj)],
    });
    expect(frag.textContent).toBe('{"a":1}');
    model.value.obj = { a: 2 };
    expect(frag.textContent).toBe('{"a":2}');
  });

  it('Fragment accepts a single (non-array) child', () => {
    const frag = Fragment({ children: 'solo' });
    expect(frag.textContent).toBe('solo');
  });
});

