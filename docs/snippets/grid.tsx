/**
 * Компилируемая копия примера `Grid` из packages/bso5-components/README.md.
 *
 * Файл включён в `npm run typecheck`: если API изменится, а README — нет,
 * проверка типов упадёт. Это защита от расхождения документации и кода.
 */
import { Reactive, $, signal } from 'bso5';
import { Grid } from 'bso5-components';
import type { Column } from 'bso5-components';

interface Issue {
  id: number;
  title: string;
  severity: string;
  project: string;
}

const COLS: Column<Issue>[] = [
  { key: 'id', header: 'ID', sort: it => it.id, cell: it => it.id },
  { key: 'title', header: 'Title', sort: it => it.title, cell: it => it.title },
  {
    key: 'severity',
    header: 'Sev',
    sort: it => it.severity,
    cell: it => <span class="sev">{it.severity}</span>,
    class: 'sev-cell',
  },
];

const issues = signal<Issue[]>([]);

export function catalogGrid(): HTMLElement {
  return Grid({
    rows: issues,
    columns: COLS,
    groupBy: it => it.project,
    initialSort: { key: 'id', dir: 'desc' },
    rowKey: it => it.id,
    searchPlaceholder: 'Поиск…',
    empty: 'Ничего не найдено.',
  });
}

/*
 * Keyed-режим: «ключ = идентичность». Чтобы ячейка обновлялась при том же
 * ключе, строка должна быть реактивным прокси — тогда `$()` внутри `cell`
 * получает живой путь. С обычным массивом `$()` вернёт значение один раз
 * (объект не реактивен), и ячейка останется статичной.
 */
const model = new Reactive<{ issues: Issue[] }>({ issues: [] });

export const boundCell: Column<Issue> = {
  key: 'title',
  header: 'Title',
  sort: r => r.title,
  cell: r => <b>{$(r, x => x.title)}</b>,
};

export function gridWithLiveCells(): HTMLElement {
  return Grid({
    rows: () => model.value.issues,
    columns: [boundCell],
    rowKey: r => r.id,
  });
}

/** Второй рецепт: ключ с отпечатком — узел пересоздаётся при смене данных. */
export const fingerprintKey = (r: Issue): string => `${r.id}:${r.title}`;
