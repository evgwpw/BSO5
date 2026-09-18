# bso5 — монорепозиторий

> **bso5** — реактивный DOM без лишнего веса (~3.4 kB min+gzip, ноль зависимостей).
> **bso5-components** — переиспользуемые UI-компоненты поверх него (Grid, Tree).

```
packages/
  bso5/              # ядро: Signal, Reactive, effect, watch, $(), <For>, <Show>, h()
  bso5-components/   # Grid (фильтр/сортировка/группировка) и Tree (поиск/раскрытие)
examples/
  counter/           # счётчик — только ядро bso5
  dataview/          # грид и дерево — потребляет bso5-components
docs/
  COMPROMISES.md     # карта компромиссов DS-правок (keyed-<For>, Proxy-пути)
```

## Быстрый старт

```bash
npm install          # рабочие пространства: packages/*
npm test             # 135 тестов, зелёные
npm run typecheck    # строгий TS по обоим пакетам и examples
npm run build        # dist/ обоих пакетов
npm run example      # vite-дев-сервер examples/counter
npm run example:dataview  # vite-дев-сервер examples/dataview
```

## Пакеты

| Пакет | Что даёт | Версия |
| --- | --- | --- |
| [`bso5`](./packages/bso5) | Signal/Reactive-состояние, `effect()`/`watch()`/`$()`, JSX-рантайм, `<For>` (с keyed-режимом) и `<Show>` | 0.3.0 |
| [`bso5-components`](./packages/bso5-components) | Headless `<Grid>` и `<Tree>` с произвольным источником данных | 0.1.0 |

`bso5-components` зависит от `bso5` как peer — в бандле приложения всегда ровно
одна копия ядра (иначе `$()`-привязки между копиями молча ломаются: symbol
`REACTIVE_VALUE` у каждой копии свой).

## Документация

- [packages/bso5/README.md](./packages/bso5/README.md) — русский README ядра ([english](./packages/bso5/README.en.md))
- [packages/bso5-components/README.md](./packages/bso5-components/README.md) — русский README компонентов ([english](./packages/bso5-components/README.en.md))
- [docs/COMPROMISES.md](./docs/COMPROMISES.md) — осознанные компромиссы двух решений, перенятых из реализации DS
- [WHERE_DS_WAS_BETTER.md](./WHERE_DS_WAS_BETTER.md) — исходная задача на доработку

## Лицензия

MIT
