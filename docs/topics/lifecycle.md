Раздел 5 справочника · Источник: [API.md](../API.md)

## Жизненный цикл и владение эффектами

### `mount(target, view): { node, dispose }`

```ts
function mount(target: Element | DocumentFragment, view: Node | (() => Node)): Mounted;
interface Mounted { readonly node: Node; readonly dispose: () => void; }
```

- Принимает **танку** (`() => <App />`) — тогда эффекты вью принадлежат области
  монтирования и снимаются вместе с ней. Готовый узел тоже принимается, но его
  эффекты уже созданы вне области.
- `dispose()`: `releaseBindings` по поддереву → `dispose(scope)` → удаление узла.
  Идемпотентна.

### Области владения

```ts
interface Scope { readonly stops: Set<() => void>; disposed: boolean }
createScope(): Scope
dispose(scope): void                       // идемпотентна, запрещает новые регистрации
runInScope<T>(scope, fn: () => T): T       // эффекты внутри fn принадлежат scope
onScopeDispose(fn): void                   // очистка при dispose; вне области — no-op
getCurrentScope(): Scope | null
```

`effect()`, вызванный внутри `runInScope`, регистрирует в области свою остановку.
`<For>`, `<Show>` и `mount()` строят области сами.

**Граница контракта:** владение появляется только там, где есть `mount()`, `<For>`
или `<Show>`. `effect()` на верхнем уровне модуля владельца не имеет — его нужно
останавливать вручную.

### `releaseBindings(root: Node): void`

Останавливает все `$()`-привязки (текст, атрибуты, style) внутри поддерева.
Идемпотентна; эффекты не трогает — для них область.
