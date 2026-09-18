/* eslint-disable */
// bso5-components Tree tests: compiled against "bso5-components/jsx-runtime".
import { describe, it, expect } from 'vitest';
import { signal } from 'bso5';
import { Tree } from 'bso5-components';
import type { TreeData } from 'bso5-components';

const TREE: TreeData = {
  label: 'root',
  children: [
    { label: 'src', children: [{ label: 'index.ts', meta: '412 B' }, { label: 'dom.ts', meta: '5.2 kB' }] },
    { label: 'tests', children: [{ label: 'reactive.test.ts' }] },
    { label: 'README.md', meta: '8.9 kB' },
  ],
};

function text(el: Element): string { return el.textContent ?? ''; }

describe('Tree', () => {
  it('renders root and collapsed children', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    expect(el.querySelector('.tree .node .name')!.textContent).toBe('root');
    // Kids are hidden by default (nothing expanded) — дети скрыты по умолчанию
    expect(el.querySelector('.kids')).toBeNull();
  });

  it('expands a node on row click', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    (el.querySelector('.node .row') as HTMLElement).click();
    const kids = el.querySelectorAll('.kids');
    expect(kids.length).toBe(1);
    const names = [...el.querySelectorAll('.kids .name')].map(n => text(n));
    expect(names).toContain('src');
    expect(names).toContain('tests');
    expect(names).toContain('README.md');
  });

  it('filters to matching nodes and auto-expands them', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    const search = el.querySelector<HTMLInputElement>('input.search')!;
    search.value = 'dom';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const names = [...el.querySelectorAll('.node .name')].map(n => text(n));
    expect(names).toContain('root'); // kept — has a matching descendant — оставлен: есть совпадающий потомок
    expect(names).toContain('src');  // kept — has a matching descendant
    expect(names).toContain('dom.ts');
    expect(names).not.toContain('tests');
    expect(names).not.toContain('reactive.test.ts');
    // While filtering, branches auto-expand — при фильтрации ветви авто-раскрыты
    expect(el.querySelectorAll('.kids').length).toBeGreaterThan(0);
  });

  it('re-renders when the source signal changes', () => {
    const src = signal<TreeData | null>(TREE);
    const el = Tree({ root: src });
    document.body.appendChild(el);
    expect(el.querySelectorAll('.node').length).toBe(1); // collapsed root — свёрнутый корень
    src.value = { label: 'other', children: null };
    expect(el.querySelector('.tree .node .name')!.textContent).toBe('other');
  });

  it('shows the empty state for a null root', () => {
    const el = Tree({ root: null, empty: 'no data' });
    document.body.appendChild(el);
    expect(el.querySelector('.empty')!.textContent).toBe('no data');
  });

  it('two instances keep independent expansion state', () => {
    const a = Tree({ root: TREE });
    const b = Tree({ root: TREE });
    document.body.append(a, b);
    (a.querySelector('.node .row') as HTMLElement).click(); // expand only A — раскрываем только A
    expect(a.querySelectorAll('.kids').length).toBe(1);
    expect(b.querySelectorAll('.kids').length).toBe(0); // B stays collapsed — остаётся свёрнутым
  });
});
