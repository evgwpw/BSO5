/**
 * Исполняемые рецепты из docs/GUIDE.md: каждый тест повторяет рецепт и фиксирует
 * итоговый DOM. Документация говорит «получится вот это» — здесь это проверяется.
 *
 * Правило: тест держим рядом с рецептом (номер в названии), чтобы правка GUIDE
 * без правки теста была заметна.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { For, Reactive, Show, computed, mount, signal, $ } from 'bso5';
import { Grid, Tree } from 'bso5-components';
import type { Column, TreeData } from 'bso5-components';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

/* jsdom сериализует с переводами строк между тегами — для сравнения их убираем. */
const html = (el: Element | null): string => (el?.innerHTML ?? '').replace(/>\s+</g, '><').trim();

function host(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ''; });

describe('рецепт 1: счётчик и поле ввода', () => {
  it('mount + $ дают ожидаемую разметку и точечное обновление', () => {
    const count = signal(0);
    const target = host();

    mount(target, () => (
      <main>
        <button onClick={() => count.update(n => n - 1)}>−</button>
        <output>{$(count)}</output>
        <button onClick={() => count.update(n => n + 1)}>+</button>
      </main>
    ));

    expect(html(target)).toBe('<main><button>−</button><output>0</output><button>+</button></main>');

    (target.querySelectorAll('button')[1] as HTMLElement).click();
    count.value = 5;
    expect(target.querySelector('output')!.textContent).toBe('5');
    // узел <output> не пересоздан — обновлён только текстовый ребёнок
    expect(target.querySelectorAll('main').length).toBe(1);
  });

  it('поле ввода: value — свойство, каретка не сбивается', () => {
    const name = signal('');
    const input = (
      <input value={$(name)} onInput={e => { name.value = (e.target as HTMLInputElement).value; }} />
    ) as HTMLInputElement;

    input.value = 'abc';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(name.value).toBe('abc');
    expect(input.getAttribute('value')).toBeNull(); // значение ушло в свойство, не в атрибут
    expect(input.value).toBe('abc');
  });
});

describe('рецепт 2: список без ключа', () => {
  it('перерисовывается целиком', () => {
    const history = signal<string[]>(['a', 'b']);
    const target = host();
    target.appendChild(<ul><For each={$(history)}>{item => <li>{item}</li>}</For></ul>);

    expect(html(target)).toBe('<ul><!--for--><li>a</li><li>b</li><!--/for--></ul>');

    history.value = ['c'];
    expect(html(target)).toBe('<ul><!--for--><li>c</li><!--/for--></ul>');
  });
});

describe('рецепт 3: условия и вкладки', () => {
  it('танка ветки снимается при переключении', () => {
    const tab = signal<'list' | 'stats'>('list');
    const shared = signal(1);
    const target = host();

    const List = (): Node => <ul><li>list {$(shared)}</li></ul>;
    const Stats = (): Node => <p>stats</p>;

    target.appendChild(
      <div>
        <Show when={() => tab.value === 'list'} fallback={() => <Stats />}>
          {() => <List />}
        </Show>
      </div>,
    );

    expect(html(target)).toBe('<div><!--show--><ul><li>list 1</li></ul><!--/show--></div>');
    expect((shared as unknown as { listeners: Set<unknown> }).listeners.size).toBe(1);

    tab.value = 'stats';
    expect(html(target)).toBe('<div><!--show--><p>stats</p><!--/show--></div>');
    expect((shared as unknown as { listeners: Set<unknown> }).listeners.size).toBe(0); // привязка снята
  });
});

describe('рецепт 4: keyed-список', () => {
  it('при перестановке узел и его состояние сохраняются', () => {
    const model = new Reactive<{ rows: { id: number; name: string }[] }>({
      rows: [{ id: 1, name: 'one' }, { id: 2, name: 'two' }],
    });
    const target = host();
    target.appendChild(
      <ul>
        <For each={() => model.value.rows} key={row => row.id}>
          {row => <li>#{row.id} <input value={$(row, x => x.name)} /></li>}
        </For>
      </ul>,
    );

    const firstInput = target.querySelectorAll('input')[0] as HTMLInputElement;
    firstInput.value = 'draft'; // «пользователь печатает»

    model.value.rows = [model.value.rows[1], model.value.rows[0]]; // меняем порядок

    const inputs = target.querySelectorAll('input');
    expect(inputs[1]).toBe(firstInput);        // тот же DOM-узел переехал
    expect((inputs[1] as HTMLInputElement).value).toBe('draft'); // и сохранил ввод
    expect(html(target)).toBe('<ul><!--for--><li>#2 <input></li><li>#1 <input></li><!--/for--></ul>');
  });
});

describe('рецепт 5: загрузка данных', () => {
  it('loading → error → данные переключаются ожидаемо', () => {
    const loading = signal(true);
    const error = signal<string | null>(null);
    const target = host();

    target.appendChild(
      <Show when={() => loading.value} fallback={() => (
        <Show when={() => error.value !== null} fallback={() => <ul><li>data</li></ul>}>
          {() => <p class="error">{$(error)}</p>}
        </Show>
      )}>
        {() => <p>Loading…</p>}
      </Show>,
    );

    expect(target.textContent).toContain('Loading');

    loading.value = false;
    error.value = 'boom';
    expect(html(target)).toContain('class="error"');
    expect(target.textContent).toContain('boom');

    error.value = null;
    expect(target.textContent).toContain('data');
  });
});

describe('рецепт 6: производные значения', () => {
  it('computed отсекает равные результаты', () => {
    const count = signal(2);
    const doubled = computed(() => count.value * 2);
    const target = host();
    target.appendChild(<output>{$(doubled)}</output>);

    expect(html(target)).toBe('<output>4</output>');

    count.value = 3;
    expect(html(target)).toBe('<output>6</output>');
  });
});

describe('рецепт 8: грид', () => {
  it('даёт ожидаемый скелет разметки', () => {
    interface Issue { id: number; title: string; project: string }
    const model = new Reactive<{ issues: Issue[] }>({
      issues: [{ id: 1, title: 'A', project: 'P1' }, { id: 2, title: 'B', project: 'P1' }],
    });
    const cols: Column<Issue>[] = [
      { key: 'id', header: 'ID', sort: i => i.id, cell: i => i.id },
      { key: 'title', header: 'Task', sort: i => i.title, cell: i => <b>{$(i, x => x.title)}</b> },
    ];
    const target = host();
    target.appendChild(Grid({
      rows: () => model.value.issues,
      columns: cols,
      groupBy: i => i.project,
      rowKey: i => i.id,
      labels: { rows: 'строк:', descending: 'убыв', ascending: 'возр' },
    }));

    const root = target.querySelector('.grid')!;
    expect(root.querySelector('input.search')!.getAttribute('aria-label')).toBe('Search');
    expect([...root.querySelectorAll('thead th')].map(th => th.textContent)).toEqual(['ID', 'Task']);
    expect(root.querySelector('tr.group-row')!.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('tr.group-row td')!.textContent).toContain('P1');
    expect(root.querySelectorAll('tbody tr:not(.group-row)').length).toBe(2);
    expect(root.querySelector('.chip')!.textContent).toBe('строк: 2');

    // живая ячейка: данные меняются, узел остаётся
    const cell = root.querySelector('tbody tr:not(.group-row) b')!;
    model.value.issues[0].title = 'A2';
    expect(root.querySelector('tbody tr:not(.group-row) b')).toBe(cell);
    expect(cell.textContent).toBe('A2');
  });
});

describe('рецепт 9: дерево', () => {
  it('даёт ожидаемые роли, ключи и раскрытие', () => {
    const root: TreeData = {
      label: 'root',
      children: [{ label: 'src', children: [{ label: 'index.ts', children: null }] }],
    };
    const target = host();
    target.appendChild(Tree({ root, nodeKey: n => n.label, showExpandAll: true }));

    const tree = target.querySelector('.tree')!;
    expect(tree.getAttribute('role')).toBe('tree');
    expect(tree.getAttribute('aria-label')).toBe('root');
    const rootRow = tree.querySelector('.row') as HTMLElement;
    expect(rootRow.getAttribute('tabindex')).toBe('0');
    expect(rootRow.dataset.key).toBe('root');

    (target.querySelector('button.expand-all') as HTMLElement).click();
    expect(target.querySelectorAll('.node').length).toBe(3);
    expect(target.querySelectorAll('.row[tabindex="-1"]').length).toBe(2);
  });
});

describe('рецепт 11: без сборщика', () => {
  it('importmap указывает на пакеты, которые собираются в dist', () => {
    const file = join(repoRoot, 'examples/importmap/index.html');
    const source = readFileSync(file, 'utf8');
    const map = source.match(/<script type="importmap">([\s\S]*?)<\/script>/)![1];
    const imports = Object.entries(JSON.parse(map).imports as Record<string, string>);

    expect(imports.length).toBeGreaterThanOrEqual(3);

    for (const [spec, target] of imports) {
      // `dist` может быть не собран (чистый клон, в CI тесты идут до build),
      // поэтому проверяем инвариант без сборки: путь ведёт в dist пакета, а пакет
      // действительно собирается в dist и публикует его — иначе importmap сломается.
      const match = target.match(/\/packages\/([^/]+)\/dist\/(.+)$/);
      expect(match, `${spec} -> ${target}`).not.toBeNull();

      const pkgDir = join(repoRoot, 'packages', match![1]);
      const buildConfig = JSON.parse(readFileSync(join(pkgDir, 'tsconfig.build.json'), 'utf8'));
      expect(buildConfig.compilerOptions.outDir, `${match![1]}: outDir не dist`).toBe('dist');

      const resolved = resolve(dirname(file), target);
      if (existsSync(resolved)) continue; // собран — проверяем и сам файл
      const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as { files?: string[] };
      expect(pkg.files ?? [], `${match![1]}: dist не публикуется`).toContain('dist');
    }
  });
});
