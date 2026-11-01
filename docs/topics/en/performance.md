Reference section 7 · Source: [API.en.md](../../API.en.md)

## Resources and performance

| Operation | 1 000 | 10 000 | Environment |
| --- | --- | --- | --- |
| Build `Grid` (grouping + `rowKey`) | 64 ms | 1 480 ms | jsdom |
| Insert a ready grid | 5 ms | 44 ms | jsdom |
| Sort by click (2 clicks) | 96–102 ms | 7.6–9.3 s | jsdom |
| Keyed list update, same order | — | **1.8 ms** | jsdom |
| `Tree` search (filter + render) | 0.9 ms | 4.5 ms | jsdom |

jsdom moves nodes roughly 30× slower than a browser: absolute DOM numbers are inflated,
ratios are meaningful. Reproduce with `npm run build && npm run bench`
(or `BENCH_SIZES=1000`).

**Known performance limits:**

- `Tree` re-renders the whole tree on every snapshot (it is not keyed) — hence the
  default search debounce; 10k expanded nodes means 10k DOM nodes;
- there is no virtualization in `Grid` or `Tree`;
- `Reactive` tracks property reads through a `Proxy` — hot loops are better served by
  `Signal` or by `.target`.
