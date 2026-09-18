/* eslint-disable */
// bso5-components tests: compiled with the automatic runtime to
// "bso5-components/jsx-runtime" (which re-exports the bso5 runtime).
import { describe, it, expect } from 'vitest';
import { signal } from 'bso5';
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

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

function text(el: Element): string { return el.textContent ?? ''; }

describe('Grid', () => {
  it('renders rows from a plain array', () => {
    const el = Grid({ rows: ROWS, columns: COLS });
    document.body.appendChild(el);
    const cells = el.querySelectorAll('td');
    expect(cells.length).toBe(8);
    expect(text(cells[1])).toBe('gamma'); // initial order preserved — порядок сохранён
    expect(text(cells[3])).toBe('alpha');
  });

  it('sorts by a column on header click', () => {
    const el = Grid({ rows: ROWS, columns: COLS });
    document.body.appendChild(el);
    const idTh = el.querySelectorAll('th')[0] as HTMLElement;
    idTh.click(); // first click: sortKey = 'id', dir = desc — первый клик: по убыванию
    let titles = [...el.querySelectorAll('td:nth-child(2)')].map(td => text(td));
    expect(titles).toEqual(['delta', 'gamma', 'beta', 'alpha']);
    idTh.click(); // same column: flip to asc — та же колонка: разворот наверх
    titles = [...el.querySelectorAll('td:nth-child(2)')].map(td => text(td));
    expect(titles).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('filters rows via the search box', () => {
    const el = Grid({ rows: ROWS, columns: COLS });
    document.body.appendChild(el);
    const search = el.querySelector<HTMLInputElement>('input.search')!;
    search.value = 'alp';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    // 'alp' matches only 'alpha' — 'a' alone would match beta/delta/gamma too
    // РУС: 'alp' матчит только 'alpha' — одна 'a' матчила бы и beta/delta/gamma
    const titles = [...el.querySelectorAll('td:nth-child(2)')].map(td => text(td));
    expect(titles).toEqual(['alpha']);
  });

  it('groups rows by the groupBy label', () => {
    const el = Grid({ rows: ROWS, columns: COLS, groupBy: r => r.group });
    document.body.appendChild(el);
    const groupRows = el.querySelectorAll('tr.group-row');
    expect(groupRows.length).toBe(2);
    // Groups follow the first-occurrence order of the (unsorted) input:
    // ROWS starts with gamma(B), so B comes first.
    // РУС: Группы идут в порядке первого вхождения в (несортированный) вход:
    // ROWS начинается с gamma(B), поэтому B первая.
    expect(text(groupRows[0])).toContain('B');
    expect(text(groupRows[1])).toContain('A');
    const rows = [...el.querySelectorAll('tbody tr')].map(tr => tr.className);
    expect(rows[0]).toBe('group-row');
  });

  it('sorting reorders groups (sort composes with groupBy)', () => {
    const el = Grid({ rows: ROWS, columns: COLS, groupBy: r => r.group });
    document.body.appendChild(el);
    const titleTh = el.querySelectorAll('th')[1] as HTMLElement;
    // First click sorts desc; a second click flips to asc: alpha, beta, delta,
    // gamma — so group A (alpha, beta) is encountered before group B.
    // РУС: Первый клик сортирует по убыванию; второй разворачивает наверх:
    // alpha, beta, delta, gamma — группа A (alpha, beta) встречается раньше B.
    titleTh.click();
    titleTh.click();
    const labels = [...el.querySelectorAll('tr.group-row')].map(tr => text(tr));
    expect(labels[0]).toContain('A');
    expect(labels[1]).toContain('B');
  });

  it('re-renders when the source signal changes', () => {
    const src = signal(ROWS);
    const el = Grid({ rows: src, columns: COLS });
    document.body.appendChild(el);
    expect(el.querySelectorAll('tbody tr').length).toBe(4);
    src.value = [...ROWS, { id: 5, title: 'eps', group: 'C' }];
    expect(el.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('two instances keep independent state', () => {
    const a = Grid({ rows: ROWS, columns: COLS });
    const b = Grid({ rows: ROWS, columns: COLS });
    document.body.append(a, b);
    (a.querySelector('th') as HTMLElement).click(); // sort only A — сортируем только A
    const titlesA = [...a.querySelectorAll('td:nth-child(2)')].map(td => text(td));
    const titlesB = [...b.querySelectorAll('td:nth-child(2)')].map(td => text(td));
    expect(titlesA).toEqual(['delta', 'gamma', 'beta', 'alpha']);
    expect(titlesB).toEqual(['gamma', 'alpha', 'beta', 'delta']);
  });

  it('shows the empty state when nothing matches', () => {
    const el = Grid({ rows: ROWS, columns: COLS, empty: 'nothing' });
    document.body.appendChild(el);
    const search = el.querySelector<HTMLInputElement>('input.search')!;
    search.value = 'zzzz';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    const emptyEl = el.querySelector('.empty');
    expect(emptyEl).not.toBeNull();
    expect(text(emptyEl!)).toBe('nothing');
  });
});
