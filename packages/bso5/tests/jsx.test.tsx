/* eslint-disable */
// JSX tests: compiled with the automatic runtime to "bso5/jsx-runtime".
import { describe, it, expect } from 'vitest';
import { Reactive, $, For, Show, signal } from 'bso5';
import { Fragment, createElement } from 'bso5/jsx-runtime';

function App(props: { name: string; children?: any }) {
  return (
    <div class="app">
      <h1>Hello {props.name}</h1>
      {props.children}
    </div>
  );
}

describe('JSX runtime', () => {
  it('renders intrinsic elements', () => {
    const el = <div id="root">text</div> as HTMLElement;
    expect(el.tagName).toBe('DIV');
    expect(el.id).toBe('root');
    expect(el.textContent).toBe('text');
  });

  it('renders nested elements', () => {
    const el = (
      <ul>
        <li>a</li>
        <li>b</li>
      </ul>
    ) as HTMLElement;
    expect(el.querySelectorAll('li').length).toBe(2);
  });

  it('renders function components with children', () => {
    const el = <App name="World"><p>child</p></App> as HTMLElement;
    expect(el.className).toBe('app');
    expect(el.querySelector('h1')!.textContent).toBe('Hello World');
    expect(el.querySelector('p')!.textContent).toBe('child');
  });

  it('renders fragments', () => {
    const frag = (
      <>
        <span>a</span>
        <span>b</span>
      </>
    ) as DocumentFragment;
    expect(frag.nodeType).toBe(Node.DOCUMENT_FRAGMENT_NODE);
    expect(frag.childNodes.length).toBe(2);
  });

  it('skips nullish/boolean children', () => {
    const el = <div>{null}{undefined}{true}{false}x</div> as HTMLElement;
    expect(el.textContent).toBe('x');
  });

  it('binds reactive children via $()', () => {
    const model = new Reactive({ count: 0 });
    const el = (
      <p>
        Count: {$(model.value, x => x.count)}
      </p>
    ) as HTMLElement;
    expect(el.textContent).toBe('Count: 0');
    model.value.count = 3;
    expect(el.textContent).toBe('Count: 3');
  });

  it('binds reactive attributes via $()', () => {
    const model = new Reactive({ label: 'a' });
    const el = <button title={$(model.value, x => x.label)}>go</button> as HTMLElement;
    expect(el.title).toBe('a');
    model.value.label = 'b';
    expect(el.title).toBe('b');
  });

  it('applies event handlers', () => {
    let clicked = 0;
    const el = <button onClick={() => clicked++}>x</button> as HTMLElement;
    el.click();
    expect(clicked).toBe(1);
  });

  it('supports style objects', () => {
    const el = <div style={{ color: 'red' }} /> as HTMLElement;
    expect(el.style.color).toBe('red');
  });

  it('createElement works directly', () => {
    const el = createElement('span', { class: 's' }, 'hi');
    expect(el.nodeName).toBe('SPAN');
    expect((el as HTMLElement).className).toBe('s');
  });

  it('Fragment works directly', () => {
    const frag = Fragment({ children: [document.createTextNode('a'), document.createTextNode('b')] });
    expect(frag.textContent).toBe('ab');
  });
});

describe('<For> and <Show>', () => {
  it('<For> renders items from a plain array', () => {
    const host = <ul><For each={['a', 'b']}>{(s: string, i: number) => <li>{i}:{s}</li>}</For></ul> as HTMLElement;
    expect(host.textContent).toBe('0:a1:b');
  });

  it('<For> re-renders when a Reactive array changes', () => {
    const model = new Reactive({ items: ['x'] });
    const host = <ul><For each={() => model.value.items}>{(s: string) => <li>{s}</li>}</For></ul> as HTMLElement;
    expect(host.textContent).toBe('x');
    model.value.items.push('y');
    expect(host.textContent).toBe('xy');
    model.value.items = ['z'];
    expect(host.textContent).toBe('z');
  });

  it('<For> renders nothing for an empty list', () => {
    const model = new Reactive({ items: [] as string[] });
    const host = <div><For each={() => model.value.items}>{(s: string) => <span>{s}</span>}</For></div> as HTMLElement;
    expect(host.textContent).toBe('');
    model.value.items.push('a');
    expect(host.textContent).toBe('a');
  });

  it('<For> accepts a $()-bound array', () => {
    const model = new Reactive({ items: ['1', '2'] });
    const host = <div><For each={$(model.value, x => x.items)}>{(s: string) => <b>{s}</b>}</For></div> as HTMLElement;
    expect(host.textContent).toBe('12');
    model.value.items.push('3');
    expect(host.textContent).toBe('123');
  });

  it('<For> re-renders from a Signal array', () => {
    const list = signal(['a']);
    const host = <div><For each={list}>{(s: string) => <i>{s}</i>}</For></div> as HTMLElement;
    expect(host.textContent).toBe('a');
    list.value = ['b', 'c'];
    expect(host.textContent).toBe('bc');
  });

  it('<For> requires a function child', () => {
    // Bypass JSX typing on purpose: the runtime must throw a helpful error.
    // РУС: Намеренно обходим JSX-типизацию: рантайм должен бросить понятную ошибку.
    expect(() => createElement(For, { each: ['a'], children: 'static' })).toThrow(/function child/);
  });

  it('<For key> reuses DOM nodes across reorders', () => {
    const model = new Reactive({ items: ['a', 'b', 'c'] });
    const host = (
      <ul><For each={() => model.value.items} key={(s: string) => s}>{(s: string) => <li>{s}</li>}</For></ul>
    ) as HTMLElement;
    expect(host.textContent).toBe('abc');
    const [la, lb, lc] = Array.from(host.querySelectorAll('li'));
    model.value.items = ['c', 'b', 'a'];
    const now = Array.from(host.querySelectorAll('li'));
    expect(host.textContent).toBe('cba');
    expect(now[0]).toBe(lc); // same nodes, new order — moved, not recreated
    // РУС: те же узлы, новый порядок — перемещены, а не пересозданы
    expect(now[1]).toBe(lb);
    expect(now[2]).toBe(la);
  });

  it('<For key> moves reused nodes without disconnecting them', () => {
    const model = new Reactive({ items: ['a', 'b'] });
    const host = (
      <div><For each={() => model.value.items} key={(s: string) => s}>{(s: string) => <input value={s} />}</For></div>
    ) as HTMLElement;
    document.body.appendChild(host); // isConnected only holds for attached trees
    // РУС: isConnected выполняется только для присоединённых деревьев
    const input = host.querySelector('input')!;
    expect(input.isConnected).toBe(true);
    model.value.items = ['b', 'a'];
    const now = Array.from(host.querySelectorAll('input'));
    expect(now.length).toBe(2);
    expect(now[1]).toBe(input); // the 'a' input moved to the end — same node
    // РУС: инпут 'a' перемещён в конец — тот же узел
    expect(input.isConnected).toBe(true); // move, not remove+reinsert
    // РУС: перемещение, а не remove+reinsert
    host.remove();
    // Focus survival across reorder is real-browser behavior; jsdom drops it
    // on insertBefore, so identity + connectedness is what we assert here
    // (see docs/COMPROMISES.md B5).
    // РУС: Сохранение фокуса при пересортировке — поведение реальных браузеров;
    // jsdom теряет его на insertBefore, поэтому здесь ассертим идентичность +
    // connectedness (см. docs/COMPROMISES.md B5).
  });

  it('<For key> adds and removes only the affected groups', () => {
    const model = new Reactive({ items: ['a', 'b', 'c'] });
    const host = (
      <ul><For each={() => model.value.items} key={(s: string) => s}>{(s: string) => <li>{s}</li>}</For></ul>
    ) as HTMLElement;
    const lis = () => Array.from(host.querySelectorAll('li'));
    const [la, , lc] = lis();
    model.value.items = ['a', 'c'];
    let now = lis();
    expect(now.length).toBe(2); // the 'b' group removed, others untouched
    // РУС: группа 'b' удалена, остальные не тронуты
    expect(now[0]).toBe(la);
    expect(now[1]).toBe(lc);
    model.value.items.push('d');
    now = lis();
    const ld = now[2];
    expect(ld.textContent).toBe('d'); // new group appended
    // РУС: новая группа добавлена в конец
    model.value.items = ['d', 'a'];
    now = lis();
    expect(now[0]).toBe(ld); // pure moves again — no re-creation
    // РУС: снова чистые перемещения — без пересоздания
    expect(now[1]).toBe(la);
  });

  it('<Show> toggles static children', () => {
    const flag = signal(true);
    const host = <div><Show when={flag}><p>on</p></Show>tail</div> as HTMLElement;
    expect(host.textContent).toBe('ontail');
    flag.value = false;
    expect(host.textContent).toBe('tail');
    flag.value = true;
    expect(host.textContent).toBe('ontail');
  });

  it('<Show> re-evaluates a function child on each show', () => {
    const model = new Reactive({ ok: true, msg: 'one' });
    const host = <div><Show when={() => model.value.ok}>{() => <p>{model.value.msg}</p>}</Show></div> as HTMLElement;
    expect(host.textContent).toBe('one');
    model.value.msg = 'two';
    expect(host.textContent).toBe('two');
    model.value.ok = false;
    expect(host.textContent).toBe('');
    model.value.msg = 'three';
    model.value.ok = true;
    expect(host.textContent).toBe('three');
  });

  it('<Show> accepts a plain boolean', () => {
    const host = <div><Show when={true}><span>yes</span></Show></div> as HTMLElement;
    expect(host.textContent).toBe('yes');
  });

  it('<Show> renders nothing when the condition is initially false', () => {
    const host = <div><Show when={false}><span>no</span></Show>end</div> as HTMLElement;
    expect(host.textContent).toBe('end');
  });

  it('nested control flow works', () => {
    const model = new Reactive({ on: true, items: ['a', 'b'] });
    const host = (
      <div>
        <Show when={() => model.value.on}>
          <ul>
            <For each={() => model.value.items}>{(s: string) => <li>{s}</li>}</For>
          </ul>
        </Show>
      </div>
    ) as HTMLElement;
    expect(host.textContent).toBe('ab');
    model.value.items.push('c');
    expect(host.textContent).toBe('abc');
    model.value.on = false;
    expect(host.textContent).toBe('');
  });
});
