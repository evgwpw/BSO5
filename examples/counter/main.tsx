/**
 * BSO5 counter example: a self-contained reactive app.
 *
 * Demonstrates:
 * - `Reactive<T>` deep reactive state with nested objects and arrays;
 * - `$()` bindings in JSX children and attributes (live updates);
 * - function components with children props;
 * - fragments, lists, conditional rendering.
 *
 * РУС: Пример BSO5 counter: самодостаточное реактивное приложение.
 *
 * РУС: Демонстрирует:
 * РУС: - `Reactive<T>` глубокое реактивное состояние с вложенными объектами и массивами;
 * РУС: - `$()`-привязки в детях и атрибутах JSX (живые обновления);
 * РУС: - функциональные компоненты с пропсами детей;
 * РУС: - фрагменты, списки, условный рендеринг.
 */
import { Reactive, $, For } from 'bso5';

// ── State ────────────────────────────────────────────────────────────────────
// РУС: Состояние
// ────────────────────────────────────────────────────────────────────────────

interface Model {
  count: number;
  step: number;
  user: { name: string };
  history: number[];
}

const state = new Reactive<Model>({
  count: 0,
  step: 1,
  user: { name: 'World' },
  history: [],
});

// ── Components ───────────────────────────────────────────────────────────────
// РУС: Компоненты
// ────────────────────────────────────────────────────────────────────────────

function Button(props: { label: string; onClick: () => void; kind?: string }) {
  return (
    <button class={`btn ${props.kind ?? ''}`} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

function HistoryList() {
  return (
    <ul class="history">
      <For each={() => state.value.history}>
        {(value, i) => <li>step {i + 1}: {value}</li>}
      </For>
    </ul>
  );
}

function App() {
  return (
    <main class="card">
      <h1>Hello, {$(state.value, x => x.user.name)}!</h1>

      <p class="count">
        Count: <strong>{$(state.value, x => x.count)}</strong>
        <small> (step: {$(state.value, x => x.step)})</small>
      </p>

      <div class="row">
        <Button label="+" onClick={() => {
          state.value.count += state.value.step;
          state.value.history.push(state.value.count);
        }} />
        <Button label="−1" onClick={() => {
          state.value.count -= 1;
          state.value.history.push(state.value.count);
        }} />
        <Button label="Reset" kind="danger" onClick={() => {
          state.value.count = 0;
          state.value.history = [];
        }} />
      </div>

      <div class="row">
        <label>
          Step{' '}
          <select
            value={$(state.value, x => x.step)}
            onChange={(e: Event) => {
              state.value.step = Number((e.target as HTMLSelectElement).value);
            }}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="5">5</option>
          </select>
        </label>
      </div>

      {/* Mounted unconditionally: its own effect decides when to render items. */}
      {/* РУС: Монтируется безусловно: его собственный эффект решает, когда рендерить элементы. */}
      <HistoryList />
    </main>
  );
}

document.getElementById('app')!.appendChild(<App />);
