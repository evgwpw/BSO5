# bso5 — монорепозиторий

> **bso5** — реактивный DOM без лишнего веса (~4.7 kB min+gzip, ноль зависимостей).
> **bso5-components** — переиспользуемые headless-компоненты поверх него (Grid, Tree).

```
packages/
  bso5/              # ядро: Signal, Reactive, effect, watch, $(), <For>, <Show>, h(), mount
  bso5-components/   # Grid (фильтр/сортировка/группировка) и Tree (поиск/раскрытие)
examples/
  counter/           # счётчик — только ядро bso5
  dataview/          # грид и дерево — потребляет bso5-components
  importmap/         # без сборщика: <script type="importmap"> на dist обоих пакетов
docs/
  TREE_GRID.md       # разметка, классы и минимальный CSS компонентов
  COMPROMISES.md     # карта компромиссов DS-правок (keyed-<For>, Proxy-пути)
  snippets/          # компилируемые копии примеров из README (входят в typecheck)
```

## Быстрый старт

Нужен **Node ≥ 22.12** (требование vitest 5) и npm ≥ 10 (lockfile v3).

```bash
npm ci               # строгая установка по package-lock
npm test             # 200 тестов (jsdom), включая исполняемые рецепты документации
npm run typecheck    # строгий TS по обоим пакетам, examples и docs/snippets
npm run build        # dist/ обоих пакетов (ESM + .d.ts + sourcemaps)
npm run bench        # замеры грида и дерева (после build)
npm run docs:check   # актуальность сгенерированных файлов, ссылок и якорей
npm run docs:llm     # пересобрать llms-full.txt и llms-full.en.txt
npm run docs:props   # пересобрать PROPS.md из типов
npm run docs:topics  # пересобрать docs/topics/*
npm run docs:html    # одностраничный HTML-справочник (.qwen/tmp, в git не попадает)
npm run pack:check   # состав публикуемых tarball
npm run example            # vite-дев-сервер examples/counter
npm run example:dataview   # vite-дев-сервер examples/dataview
```

Без сборщика (сценарий `file://`/офлайн): `npm run build`, затем из корня
`py -3 -m http.server 8080` и открыть `/examples/importmap/` — там обе библиотеки
подключены картой импортов прямо на `dist`.

## Пакеты

| Пакет | Что даёт | Версия |
| --- | --- | --- |
| [`bso5`](./packages/bso5) | Signal/Reactive-состояние, `effect()`/`watch()`/`$()`, `batch()`/`untrack()`, `mount()` и scope, JSX-рантайм, `<For>` (с keyed-режимом) и `<Show>` | 0.4.0 |
| [`bso5-components`](./packages/bso5-components) | Headless `<Grid>` и `<Tree>` с произвольным источником данных | 0.2.0 |

`bso5-components` зависит от `bso5` как peer — в бандле приложения всегда ровно
одна копия ядра (иначе `$()`-привязки между копиями молча ломаются: symbol
`REACTIVE_VALUE` у каждой копии свой).

## Документация

- [docs/README.md](./docs/README.md) — навигация: что читать под какую задачу
- [docs/API.md](./docs/API.md) — полный справочник API (сигнатуры, семантика, ограничения) · [english](./docs/API.en.md)
- [docs/GUIDE.md](./docs/GUIDE.md) — рецепты по задачам и таблица грабель · [english](./docs/GUIDE.en.md)
- [docs/PROPS.md](./docs/PROPS.md) — пропсы и опции, сгенерированные из TypeScript-типов
- [docs/topics/](./docs/topics/index.md) — короткие темы для точечного чтения · [english](./docs/topics/en/index.md)
- [docs/TREE_GRID.md](./docs/TREE_GRID.md) — разметка, карта классов и минимальный CSS для `Grid`/`Tree`
- [packages/bso5/README.md](./packages/bso5/README.md) — вводный README ядра: концепции, справочник `h()`, жизненный цикл ([english](./packages/bso5/README.en.md))
- [packages/bso5-components/README.md](./packages/bso5-components/README.md) — вводный README компонентов ([english](./packages/bso5-components/README.en.md))
- [docs/COMPROMISES.md](./docs/COMPROMISES.md) — осознанные компромиссы реализаций
- [CHANGELOG.md](./CHANGELOG.md) — изменения по версиям
- [WHERE_DS_WAS_BETTER.md](./WHERE_DS_WAS_BETTER.md) — исходная задача на доработку

Для LLM и агентов: [`llms.txt`](./llms.txt) — карта документации, [`llms-full.txt`](./llms-full.txt) —
вся документация одним файлом, [`llms-full.en.txt`](./llms-full.en.txt) — то же по-английски
(`npm run docs:llm` пересобирает, `npm run docs:check` сверяет в CI).

## Лицензия

MIT
