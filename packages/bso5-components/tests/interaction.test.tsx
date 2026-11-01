/* eslint-disable */
/**
 * Приёмочные тесты компонентов: закрывают дефекты из docs/REVIEW-2026-11-01.html
 * — застывшая стрелка группы в keyed-режиме, `initialSort` мимо селекта,
 * пересоздание узлов при сортировке, мёртвый `nodeKey`, a11y, дебаунс.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Tree } from 'bso5-components';
import { Grid } from 'bso5-components';
import type { Column, TreeData } from 'bso5-components';

interface Row { id: number; title: string; group: string }

const ROWS: Row[] = [
  { id: 3, title: 'gamma', group: 'B' },
  { id: 1, title: 'alpha', group: 'A' },
  { id: 2, title: 'beta', group: 'A' },
  { id: 4, title: 'delta', group: 'B' },
];

const COLS: Column<Row>[] = [
  { key: 'id', header: 'ID', sort: r => r.id, cell: r => r.id },
  { key: 'title', header: 'Title', sort: r => r.title, cell: r => r.title },
];

const TREE: TreeData = {
  label: 'root',
  children: [{ label: 'src', children: [{ label: 'index.ts' }] }],
};

const text = (el: Element | null): string => el?.textContent ?? '';

afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); });

describe('Grid: состояние групп и сортировки', () => {
  it('в keyed-режиме стрелка группы меняется при схлопывании', () => {
    const el = Grid({ rows: ROWS, columns: COLS, groupBy: r => r.group, rowKey: r => r.id });
    document.body.appendChild(el);
    const arrow = () => text(el.querySelector('tr.group-row .toggle'));
    expect(arrow()).toBe('▾');

    (el.querySelector('tr.group-row td') as HTMLElement).click();
    expect(arrow()).toBe('▸'); // до правки символ застывал на ▾

    (el.querySelector('tr.group-row td') as HTMLElement).click();
    expect(arrow()).toBe('▾');
  });

  it('initialSort.dir отражается в контроле направления', () => {
    const el = Grid({ rows: ROWS, columns: COLS, initialSort: { key: 'title', dir: 'asc' } });
    document.body.appendChild(el);
    const select = el.querySelector('select.dir') as HTMLSelectElement;
    expect(select.value).toBe('asc');
  });

  it('клик по заголовку обновляет контроль направления', () => {
    const el = Grid({ rows: ROWS, columns: COLS });
    document.body.appendChild(el);
    const select = el.querySelector('select.dir') as HTMLSelectElement;
    expect(select.value).toBe('desc');
    (el.querySelectorAll('th')[0] as HTMLElement).click(); // первый клик — по убыванию
    expect(select.value).toBe('desc');
    (el.querySelectorAll('th')[0] as HTMLElement).click(); // второй — по возрастанию
    expect(select.value).toBe('asc');
  });

  it('сортировка переставляет узлы, а не пересоздаёт их', () => {
    const el = Grid({ rows: ROWS, columns: COLS, rowKey: r => r.id });
    document.body.appendChild(el);
    const first = el.querySelectorAll('tbody tr')[0] as HTMLTableRowElement; // id 3
    expect(text(first.children[0])).toBe('3');

    const idTh = el.querySelectorAll('th')[0] as HTMLElement;
    idTh.click();
    idTh.click(); // по возрастанию: 1, 2, 3, 4

    const rowsAfter = [...el.querySelectorAll('tbody tr')];
    expect(rowsAfter[2]).toBe(first); // тот же DOM-узел, переставленный в середину (id 3)
  });

  it('ARIA: aria-sort у активной колонки, aria-expanded у группы', () => {
    const el = Grid({ rows: ROWS, columns: COLS, groupBy: r => r.group });
    document.body.appendChild(el);
    const ths = [...el.querySelectorAll('th')];
    (ths[1] as HTMLElement).click();
    expect(ths[1].getAttribute('aria-sort')).toBe('descending');
    expect(ths[0].hasAttribute('aria-sort')).toBe(false);

    const groupRow = el.querySelector('tr.group-row') as HTMLElement;
    expect(groupRow.getAttribute('aria-expanded')).toBe('true');
    groupRow.click();
    expect(el.querySelector('tr.group-row')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('группа схлопывается с клавиатуры', () => {
    const el = Grid({ rows: ROWS, columns: COLS, groupBy: r => r.group });
    document.body.appendChild(el);
    const groupRow = el.querySelector('tr.group-row') as HTMLElement;
    groupRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(el.querySelector('tr.group-row')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('дебаунс включается только на крупных источниках', () => {
    vi.useFakeTimers();
    const big: Row[] = Array.from({ length: 250 }, (_, i) => ({ id: i, title: `row-${i}`, group: 'G' }));
    const el = Grid({ rows: big, columns: COLS });
    document.body.appendChild(el);
    const search = el.querySelector('input.search') as HTMLInputElement;

    search.value = 'row-1';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.querySelectorAll('tbody tr').length).toBe(250); // ещё не отфильтровано

    vi.advanceTimersByTime(150);
    expect(el.querySelectorAll('tbody tr').length).toBeLessThan(250);
  });
});

describe('Grid: подписи и настройка поиска', () => {
  it('labels перекрывают умолчания и старый searchPlaceholder', () => {
    const el = Grid({
      rows: ROWS,
      columns: COLS,
      searchPlaceholder: 'legacy',
      labels: {
        search: 'Поиск по задачам',
        searchPlaceholder: 'искать…',
        sortDirection: 'Направление',
        descending: 'убыв',
        ascending: 'возр',
        rows: 'строк:',
      },
    });
    document.body.appendChild(el);

    const input = el.querySelector('input.search') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Поиск по задачам');
    expect(input.placeholder).toBe('искать…');

    const select = el.querySelector('select.dir') as HTMLSelectElement;
    expect(select.getAttribute('aria-label')).toBe('Направление');
    expect([...select.options].map(o => o.textContent)).toEqual(['убыв', 'возр']);
    expect(text(el.querySelector('.chip'))).toBe('строк: 4');
  });

  it('пустой префикс счётчика скрывает текст, оставляя число', () => {
    const el = Grid({ rows: ROWS, columns: COLS, labels: { rows: '' } });
    document.body.appendChild(el);
    expect(text(el.querySelector('.chip'))).toBe('4');
  });

  it('searchDebounce: false отключает задержку даже на большом источнике', () => {
    const big: Row[] = Array.from({ length: 250 }, (_, i) => ({ id: i, title: `row-${i}`, group: 'G' }));
    const el = Grid({ rows: big, columns: COLS, searchDebounce: false });
    document.body.appendChild(el);

    const search = el.querySelector('input.search') as HTMLInputElement;
    search.value = 'row-1';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.querySelectorAll('tbody tr').length).toBeLessThan(250); // сразу, без таймера
  });

  it('searchDebounceMinItems задаёт свой порог', () => {
    vi.useFakeTimers();
    const el = Grid({ rows: ROWS, columns: COLS, searchDebounce: 50, searchDebounceMinItems: 2 });
    document.body.appendChild(el);

    const search = el.querySelector('input.search') as HTMLInputElement;
    search.value = 'alp';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(el.querySelectorAll('tbody tr').length).toBe(4); // порог 2 < 4 строк → ждём

    vi.advanceTimersByTime(60);
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });
});

describe('Tree: подписи, expand-all и клавиатура', () => {
  it('labels задают подписи счётчика и кнопок', () => {
    const el = Tree({
      root: TREE,
      showExpandAll: true,
      labels: { matched: 'найдено:', expandAll: 'Развернуть', collapseAll: 'Свернуть' },
    });
    document.body.appendChild(el);
    expect(text(el.querySelector('.chip'))).toContain('найдено:');
    expect(text(el.querySelector('button.expand-all'))).toBe('Развернуть');
    expect(text(el.querySelector('button.collapse-all'))).toBe('Свернуть');
  });

  it('expand-all раскрывает все папки, collapse-all сворачивает', () => {
    const el = Tree({ root: TREE, showExpandAll: true });
    document.body.appendChild(el);
    expect(el.querySelectorAll('.node').length).toBe(1); // свёрнуто

    (el.querySelector('button.expand-all') as HTMLElement).click();
    expect(el.querySelectorAll('.node').length).toBe(3); // root, src, index.ts
    expect(el.querySelectorAll('.kids').length).toBe(2);

    (el.querySelector('button.collapse-all') as HTMLElement).click();
    expect(el.querySelectorAll('.node').length).toBe(1);
  });

  it('без showExpandAll кнопок нет', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    expect(el.querySelector('button.expand-all')).toBeNull();
  });

  it('только корневая строка в Tab-порядке, остальные — по стрелкам', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    const rootRow = el.querySelector('.row') as HTMLElement;
    expect(rootRow.getAttribute('tabindex')).toBe('0');

    rootRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const rows = () => [...el.querySelectorAll<HTMLElement>('.row')];
    expect(rows().length).toBe(2);
    expect(rows()[1].getAttribute('tabindex')).toBe('-1');
    // после перерисовки фокус возвращается на тот же узел
    expect(document.activeElement).toBe(rows()[0]);
    expect(rows()[0].dataset.key).toBe('root');

    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(rows()[1]);
    expect(text(document.activeElement)).toContain('src');

    (document.activeElement as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(rows()[0]);
  });

  it('клик по узлу тоже возвращает фокус после перерисовки', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    (el.querySelector('.row') as HTMLElement).click();
    expect(document.activeElement).toBe(el.querySelector('.row'));
  });
});

describe('Tree: nodeKey и доступность', () => {
  it('nodeKey вызывается и определяет ключ раскрытия', () => {
    let calls = 0;
    const el = Tree({
      root: TREE,
      nodeKey: (node) => { calls++; return node.label; },
    });
    document.body.appendChild(el);
    expect(calls).toBeGreaterThan(0);

    (el.querySelector('.node .row') as HTMLElement).click(); // раскрыть root
    expect(el.querySelectorAll('.kids').length).toBe(1);
  });

  it('ARIA: роль дерева, aria-expanded и группа', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    expect(el.querySelector('[role="tree"]')).not.toBeNull();
    const rootNode = el.querySelector('.node') as HTMLElement;
    expect(rootNode.getAttribute('role')).toBe('treeitem');
    expect(rootNode.getAttribute('aria-expanded')).toBe('false');

    (rootNode.querySelector('.row') as HTMLElement).click();
    const reopened = el.querySelector('.node') as HTMLElement;
    expect(reopened.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('[role="group"]')).not.toBeNull();
  });

  it('раскрывается с клавиатуры (ArrowRight / ArrowLeft)', () => {
    const el = Tree({ root: TREE });
    document.body.appendChild(el);
    const row = el.querySelector('.node .row') as HTMLElement;

    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(el.querySelectorAll('.kids').length).toBe(1);

    (el.querySelector('.node .row') as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(el.querySelectorAll('.kids').length).toBe(0);
  });

  it('фильтр ищет и по meta', () => {
    const el = Tree({ root: { label: 'root', children: [{ label: 'x', meta: '5.2 kB' }] } });
    document.body.appendChild(el);
    const search = el.querySelector('input.search') as HTMLInputElement;
    search.value = 'kB';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(text(el.querySelector('.name'))).toBe('root');
    expect(el.querySelectorAll('.node').length).toBe(2);
  });
});
