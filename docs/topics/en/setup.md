Reference section 0 · Source: [API.en.md](../../API.en.md)

## Install and requirements

```bash
npm install bso5                 # core only
npm install bso5 bso5-components # core + components
```

| What | Requirement |
| --- | --- |
| Browser | ES2020, native ES modules |
| Build | anything with the `react-jsx` transform (tsc, esbuild, vite) — or nothing at all: `dist` is already ESM |
| Package development | Node ≥ 22.12 (vitest 5), npm ≥ 10 (lockfile v3) |
| TypeScript | ≥ 5.0 |

`tsconfig.json` for JSX:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "bso5"          // or "bso5-components" — same runtime
  }
}
```

Export map of `bso5`: `"."`, `"./jsx-runtime"`, `"./jsx-dev-runtime"`, `"./package.json"`.
`bso5-components` has the same plus its own runtime re-export.

Without a bundler:

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

Runnable example — [`examples/importmap`](../../../examples/importmap/index.html).
