import { describe, it, expect } from 'vitest';
import { h } from '../src/dom.js';
import { Reactive, $ } from '../src/reactive.js';

describe('h()', () => {
  it('creates an element with a tag', () => {
    const el = h('div');
    expect(el.tagName).toBe('DIV');
  });

  it('applies class', () => {
    const el = h('div', { class: 'a b' });
    expect(el.className).toBe('a b');
  });

  it('applies className', () => {
    const el = h('div', { className: 'x' });
    expect(el.className).toBe('x');
  });

  it('normalizes class from arrays, objects and nesting', () => {
    const active = true;
    const off = false;

    expect(h('div', { class: ['card', off, null, undefined, 'big'] }).className).toBe('card big');
    expect(h('div', { class: ['card', ['x', [active && 'y']]] }).className).toBe('card x y');
    expect(h('div', { class: { card: true, 'card--active': active, 'card--off': off } }).className)
      .toBe('card card--active');
    expect(h('div', { class: { card: undefined } }).hasAttribute('class')).toBe(false);
    expect(h('div', { class: [] }).hasAttribute('class')).toBe(false);
    expect(h('div', { class: '  spaced  ' }).className).toBe('spaced');
  });

  it('keeps class reactive when bound with $()', () => {
    const state = new Reactive({ on: false });
    const el = h('div', { class: $(state.value, x => (x.on ? 'a' : 'b')) });
    expect(el.className).toBe('b');

    state.value.on = true;
    expect(el.className).toBe('a');
  });

  it('applies style object', () => {
    const el = h('div', { style: { color: 'red', paddingTop: '4px' } });
    expect(el.style.color).toBe('red');
    expect(el.style.paddingTop).toBe('4px');
  });

  it('applies style string', () => {
    const el = h('div', { style: 'color: blue' });
    expect(el.style.color).toBe('blue');
  });

  it('applies DOM properties', () => {
    const el = h('input', { type: 'text', id: 'my-input', value: 'abc' } as any);
    expect(el.type).toBe('text');
    expect(el.id).toBe('my-input');
    expect(el.value).toBe('abc');
  });

  it('applies event handlers', () => {
    let clicked = 0;
    const el = h('button', { onClick: () => clicked++ });
    el.click();
    expect(clicked).toBe(1);
  });

  it('renders text children', () => {
    const el = h('p', null, 'Hello ', 'world');
    expect(el.textContent).toBe('Hello world');
  });

  it('renders numeric children', () => {
    const el = h('p', null, 1, 2);
    expect(el.textContent).toBe('12');
  });

  it('skips null/undefined/boolean children', () => {
    const el = h('p', null, 'a', null, undefined, true, false, 'b');
    expect(el.textContent).toBe('ab');
  });

  it('renders nested node children', () => {
    const strong = h('strong', null, 'x');
    const el = h('p', null, strong);
    expect(el.firstChild).toBe(strong);
  });

  it('flattens nested arrays', () => {
    const el = h('ul', null, [h('li', null, '1'), [h('li', null, '2'), h('li', null, '3')]]);
    expect(el.querySelectorAll('li').length).toBe(3);
  });

  it('supports the attrs-as-function form', () => {
    const el = h('div', (el: HTMLDivElement) => { el.title = 'fn'; });
    expect(el.title).toBe('fn');
  });

  it('sets data-* and aria-* attributes', () => {
    const el = h('div', { 'data-id': '7', 'aria-label': 'close' } as any);
    expect(el.getAttribute('data-id')).toBe('7');
    expect(el.getAttribute('aria-label')).toBe('close');
  });

  it('sets dataset object', () => {
    const el = h('div', { dataset: { role: 'main' } } as any);
    expect(el.dataset.role).toBe('main');
  });

  it('returns properly typed elements', () => {
    const input = h('input', { type: 'checkbox', checked: true } as any);
    expect(input.checked).toBe(true);
  });
});

describe('h() reactivity', () => {
  it('binds $() children to live text nodes', () => {
    const model = new Reactive({ count: 0 });
    const el = h('p', null, 'Count: ', $(model.value, x => x.count));
    expect(el.textContent).toBe('Count: 0');
    model.value.count = 5;
    expect(el.textContent).toBe('Count: 5');
  });

  it('binds $() attributes', () => {
    const model = new Reactive({ label: 'first' });
    const el = h('button', { title: $(model.value, x => x.label) });
    expect(el.title).toBe('first');
    model.value.label = 'second';
    expect(el.title).toBe('second');
  });

  it('binds $() inside style objects', () => {
    const model = new Reactive({ color: 'red' });
    const el = h('div', { style: { color: $(model.value, x => x.color) } } as any);
    expect(el.style.color).toBe('red');
    model.value.color = 'blue';
    expect(el.style.color).toBe('blue');
  });

  it('binds $() to input value', () => {
    const model = new Reactive({ name: 'ann' });
    const el = h('input', { value: $(model.value, x => x.name) } as any);
    expect(el.value).toBe('ann');
    model.value.name = 'bob';
    expect(el.value).toBe('bob');
  });
});
