import { describe, it, expect } from 'vitest';
import {
  Signal,
  signal,
  effect,
  Reactive,
  getPropertyName,
  watch,
  $,
  isBoundValue,
} from '../src/reactive.js';

describe('getPropertyName', () => {
  it('extracts a simple property path', () => {
    expect(getPropertyName((x: any) => x.count)).toBe('count');
  });

  it('extracts a nested property path', () => {
    expect(getPropertyName((x: any) => x.user.name)).toBe('user.name');
  });

  it('extracts deeply nested paths', () => {
    expect(getPropertyName((x: any) => x.a.b.c.d)).toBe('a.b.c.d');
  });

  it('rejects computed expressions', () => {
    expect(getPropertyName((x: any) => x.count + 1)).toBeNull();
  });

  it('rejects method calls', () => {
    expect(getPropertyName((x: any) => Object.keys(x))).toBeNull();
  });

  it('returns a partial path for object literals reading one property', () => {
    // Documented shift: the marker records the actual read, so `({ a: x.a })`
    // now resolves to 'a' instead of being rejected (see docs/COMPROMISES.md A2).
    // РУС: Задокументированный сдвиг: маркер фиксирует фактическое чтение, поэтому
    // `({ a: x.a })` теперь резолвится в 'a', а не отвергается (см. docs/COMPROMISES.md A2).
    expect(getPropertyName((x: any) => ({ a: x.a }))).toBe('a');
  });

  it('extracts indexed paths', () => {
    expect(getPropertyName((x: any) => x.items[0].title)).toBe('items.0.title');
  });

  it('rejects method calls over the marker', () => {
    expect(getPropertyName((x: any) => x.items.map((i: any) => i))).toBeNull();
  });

  it('rejects async accessors', () => {
    expect(getPropertyName(async (x: any) => x.a)).toBeNull();
  });
});

describe('Signal', () => {
  it('holds an initial value', () => {
    const s = new Signal(42);
    expect(s.value).toBe(42);
  });

  it('notifies subscribers on change', () => {
    const s = new Signal(0);
    let seen = 0;
    s.subscribe(() => seen++);
    s.value = 1;
    expect(seen).toBe(1);
  });

  it('does not notify when the value does not change', () => {
    const s = new Signal('a');
    let seen = 0;
    s.subscribe(() => seen++);
    s.value = 'a';
    expect(seen).toBe(0);
  });

  it('supports unsubscribe', () => {
    const s = new Signal(0);
    let seen = 0;
    const stop = s.subscribe(() => seen++);
    stop();
    s.value = 1;
    expect(seen).toBe(0);
  });

  it('peek() reads without tracking', () => {
    const s = new Signal(1);
    expect(s.peek()).toBe(1);
  });

  it('signal() factory works', () => {
    const s = signal('x');
    expect(s).toBeInstanceOf(Signal);
    expect(s.value).toBe('x');
  });
});

describe('effect', () => {
  it('runs immediately', () => {
    let runs = 0;
    effect(() => { runs++; });
    expect(runs).toBe(1);
  });

  it('re-runs when a read signal changes', () => {
    const s = signal(0);
    let runs = 0;
    effect(() => { s.value; runs++; });
    s.value = 1;
    expect(runs).toBe(2);
  });

  it('tracks only signals actually read', () => {
    const a = signal(0);
    const b = signal(0);
    let runs = 0;
    effect(() => { a.value; runs++; });
    b.value = 1;
    expect(runs).toBe(1);
    a.value = 1;
    expect(runs).toBe(2);
  });

  it('stops after the stop function is called', () => {
    const s = signal(0);
    let runs = 0;
    const stop = effect(() => { s.value; runs++; });
    stop();
    s.value = 1;
    expect(runs).toBe(1);
  });

  it('handles conditional dependencies', () => {
    const flag = signal(true);
    const a = signal('a0');
    const b = signal('b0');
    const seen: string[] = [];
    effect(() => { seen.push(flag.value ? a.value : b.value); });
    a.value = 'a1';
    b.value = 'b1'; // not tracked yet — пока не отслеживается
    expect(seen).toEqual(['a0', 'a1']);
    flag.value = false;
    expect(seen).toEqual(['a0', 'a1', 'b1']);
    a.value = 'a2'; // no longer tracked — больше не отслеживается
    expect(seen).toEqual(['a0', 'a1', 'b1']);
  });
});

describe('Reactive', () => {
  it('proxies property reads', () => {
    const model = new Reactive({ count: 5 });
    expect(model.value.count).toBe(5);
  });

  it('notifies watchers of direct properties', () => {
    const model = new Reactive({ count: 0 });
    let hits = 0;
    model.watch(x => x.count, () => hits++);
    model.value.count = 1;
    expect(hits).toBe(1);
  });

  it('does not notify when value is identical', () => {
    const model = new Reactive({ count: 0 });
    let hits = 0;
    model.watch(x => x.count, () => hits++);
    model.value.count = 0;
    expect(hits).toBe(0);
  });

  it('notifies nested path watchers', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let hits = 0;
    model.watch(x => x.user.name, () => hits++);
    model.value.user.name = 'bob';
    expect(hits).toBe(1);
  });

  it('re-binds nested watchers when an intermediate object is replaced', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let hits = 0;
    model.watch(x => x.user.name, () => hits++);
    model.value.user = { name: 'cat' };
    expect(hits).toBe(1);
    model.value.user.name = 'dee';
    expect(hits).toBe(2);
  });

  it('supports string paths in watch()', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    let hits = 0;
    model.watch('user.name', () => hits++);
    model.value.user.name = 'bob';
    expect(hits).toBe(1);
  });

  it('throws on unresolvable paths', () => {
    const model = new Reactive({ user: null as any });
    expect(() => model.watch(x => x.user.name, () => {})).toThrow();
  });

  it('throws when the accessor is not a plain path', () => {
    const model = new Reactive({ count: 0 });
    expect(() => model.watch(x => x.count + 1, () => {})).toThrow();
  });

  it('refuses to wrap the same object twice', () => {
    const target = { a: 1 };
    new Reactive(target);
    expect(() => new Reactive(target)).toThrow();
  });

  it('raw target never stores nested proxies', () => {
    const model = new Reactive({ inner: { a: 1 }, other: null as any });
    model.value.other = model.value.inner;
    expect(model.value.other.a).toBe(1);
    expect((model.target as any).other).toBe((model.target as any).inner);
  });

  it('notifies array length watchers on push', () => {
    const model = new Reactive({ items: ['a'] });
    let hits = 0;
    model.watch(x => x.items.length, () => hits++);
    model.value.items.push('b');
    expect(hits).toBe(1);
    expect(model.value.items.length).toBe(2);
  });

  it('notifies array reference watchers on replacement', () => {
    const model = new Reactive({ items: ['a'] });
    let hits = 0;
    model.watch(x => x.items, () => hits++);
    model.value.items = ['x'];
    expect(hits).toBe(1);
  });

  it('dispose() stops all notifications', () => {
    const model = new Reactive({ count: 0 });
    let hits = 0;
    model.watch(x => x.count, () => hits++);
    model.dispose();
    model.value.count = 1;
    expect(hits).toBe(0);
  });

  it('deleteProperty notifies watchers', () => {
    const model = new Reactive({ count: 0 as number | undefined });
    let hits = 0;
    model.watch(x => x.count, () => hits++);
    delete model.value.count;
    expect(hits).toBe(1);
  });
});

describe('$() and watch()', () => {
  it('$() binds a reactive path', () => {
    const model = new Reactive({ count: 0 });
    const bound = $(model.value, x => x.count);
    expect(isBoundValue(bound)).toBe(true);
    expect(bound.value).toBe(0);
    let hits = 0;
    bound.subscribe(() => hits++);
    model.value.count = 3;
    expect(hits).toBe(1);
    expect(bound.value).toBe(3);
  });

  it('$() binds a nested reactive path', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    const bound = $(model.value, x => x.user.name);
    let hits = 0;
    bound.subscribe(() => hits++);
    model.value.user.name = 'bob';
    expect(hits).toBe(1);
    expect(bound.value).toBe('bob');
  });

  it('$() binds a Signal', () => {
    const s = signal('hi');
    const bound = $(s);
    let hits = 0;
    bound.subscribe(() => hits++);
    s.value = 'yo';
    expect(hits).toBe(1);
    expect(bound.value).toBe('yo');
  });

  it('$() on a plain object resolves once without updates', () => {
    const obj = { a: 1 };
    const bound = $(obj, x => x.a);
    expect(bound.value).toBe(1);
    let hits = 0;
    const stop = bound.subscribe(() => hits++);
    (obj as any).a = 2;
    stop();
    expect(hits).toBe(0);
  });

  it('free watch() subscribes to reactive proxies', () => {
    const model = new Reactive({ count: 0 });
    let hits = 0;
    watch(model.value, x => x.count, () => hits++);
    model.value.count = 1;
    expect(hits).toBe(1);
  });

  it('watch() supports index notation in accessor paths', () => {
    const model = new Reactive({ list: [{ done: false }, { done: false }] });
    let hits = 0;
    watch(model.value, (x: any) => x.list[1].done, () => hits++);
    model.value.list[0].done = true; // sibling index — not the watched path
    // РУС: соседний индекс — не отслеживаемый путь
    expect(hits).toBe(0);
    model.value.list[1].done = true;
    expect(hits).toBe(1);
  });

  it('free watch() subscribes to signals', () => {
    const s = signal(0);
    let hits = 0;
    watch(s, '', () => hits++);
    s.value = 1;
    expect(hits).toBe(1);
  });

  it('free watch() rejects plain objects', () => {
    expect(() => watch({ a: 1 }, 'a', () => {})).toThrow();
  });
});

describe('effect + Reactive integration', () => {
  it('re-runs when a reactive property read inside changes', () => {
    const model = new Reactive({ count: 0 });
    let runs = 0;
    effect(() => { model.value.count; runs++; });
    expect(runs).toBe(1);
    model.value.count = 1;
    expect(runs).toBe(2);
  });

  it('tracks nested reactive paths', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    const seen: string[] = [];
    effect(() => { seen.push(model.value.user.name); });
    model.value.user.name = 'bob';
    expect(seen).toEqual(['ann', 'bob']);
  });

  it('re-binds when an intermediate object is replaced', () => {
    const model = new Reactive({ user: { name: 'ann' } });
    const seen: string[] = [];
    effect(() => { seen.push(model.value.user.name); });
    model.value.user = { name: 'bob' };
    expect(seen).toEqual(['ann', 'bob']);
    model.value.user.name = 'cat';
    expect(seen).toEqual(['ann', 'bob', 'cat']);
  });

  it('tracks array reads (indices and length)', () => {
    const model = new Reactive({ items: ['a'] });
    let runs = 0;
    effect(() => { model.value.items.length; model.value.items[0]; runs++; });
    model.value.items.push('b');
    expect(runs).toBe(2);
  });

  it('reads outside effects do not throw or track', () => {
    const model = new Reactive({ count: 0 });
    expect(() => model.value.count).not.toThrow();
    model.value.count = 1;
    expect(model.value.count).toBe(1);
  });

  it('stop() detaches reactive dependencies', () => {
    const model = new Reactive({ count: 0 });
    let runs = 0;
    const stop = effect(() => { model.value.count; runs++; });
    stop();
    model.value.count = 1;
    expect(runs).toBe(1);
  });

  it('re-tracks only properties read in the latest run', () => {
    const model = new Reactive({ a: 1, b: 1, flag: true });
    let runs = 0;
    effect(() => {
      if (model.value.flag) model.value.a;
      else model.value.b;
      runs++;
    });
    model.value.b = 2; // not tracked in the first run — не отслеживалось в первом прогоне
    expect(runs).toBe(1);
    model.value.flag = false; // branch switch, now reads b — смена ветки, теперь читает b
    expect(runs).toBe(2);
    model.value.a = 99; // no longer tracked — больше не отслеживается
    expect(runs).toBe(2);
    model.value.b = 3; // tracked now — теперь отслеживается
    expect(runs).toBe(3);
  });

  it('effects and path watchers coexist on the same model', () => {
    const model = new Reactive({ count: 0 });
    let effectRuns = 0;
    let watcherHits = 0;
    effect(() => { model.value.count; effectRuns++; });
    model.watch(x => x.count, () => watcherHits++);
    model.value.count = 1;
    expect(effectRuns).toBe(2);
    expect(watcherHits).toBe(1);
  });
});

