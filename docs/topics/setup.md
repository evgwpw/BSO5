Раздел 0 справочника · Источник: [API.md](../API.md)

## Установка и требования

```bash
npm install bso5                 # только ядро
npm install bso5 bso5-components # ядро + компоненты
```

| Что | Требование |
| --- | --- |
| Браузер | ES2020, нативные ES-модули |
| Сборка | любая с JSX-трансформом `react-jsx` (tsc, esbuild, vite) — или никакой: `dist` уже ESM |
| Разработка пакета | Node ≥ 22.12 (vitest 5), npm ≥ 10 (lockfile v3) |
| TypeScript | ≥ 5.0 |

`tsconfig.json` для JSX:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bso5"          // или "bso5-components" — рантайм тот же
  }
}
```

Карта экспортов пакета `bso5`: `"."`, `"./jsx-runtime"`, `"./jsx-dev-runtime"`,
`"./package.json"`. У `bso5-components` — те же плюс собственный реэкспорт рантайма.

Без сборщика:

```html
<script type="importmap">
{ "imports": {
    "bso5": "./packages/bso5/dist/index.js",
    "bso5/jsx-runtime": "./packages/bso5/dist/jsx-runtime.js",
    "bso5-components": "./packages/bso5-components/dist/index.js"
} }
</script>
<script type="module">import { h, signal } from 'bso5'; /* … */</script>
```

Готовый пример — [`examples/importmap`](../../examples/importmap/index.html).
