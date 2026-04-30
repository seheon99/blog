# ADR-003: Re-introduce a React island for the graph view

- Status: Accepted
- Date: 2026-04-30

## Context

[ADR-002](ADR-002-astro-first-drop-radix.md) made Astro-first the default
posture for the chrome, deleted the only React island in the project, and
removed the radix dependency tree. It left React, ReactDOM, and
`@astrojs/react` in `package.json` as dormant deps with no consumer. The
bar it set going forward was: "React/radix are not banned, but they need
a load-bearing reason; 'we have a UI primitive' is not enough."

Phase 5 of the v2 redesign ([docs/v2-redesign-progress.md](../v2-redesign-progress.md))
ships the graph view. The roadmap entry was resolved before ADR-002 was
finalized: "Astro page + a single inlined module script (no React
island), consistent with existing view-switch script." This ADR revisits
that resolution against the bar ADR-002 set.

The graph view is a force-directed visualisation of the posts collection.
It has runtime behaviour that the static list view does not:

1. A `d3-force` simulation with a clear lifecycle — start on mount,
   tick at ~60fps, stop on unmount. Over the simulation's lifetime the
   `<line>` and `<g>` SVG elements are mutated on every tick.
2. Pointer-event handlers on every node for drag-to-pin, with
   pointer-capture and a click-suppression flag so that "drag" does
   not become "navigate."
3. A `ResizeObserver` watching the container so the simulation
   re-centers on resize.
4. Future reuse: phases 6 (margin-rail mini-graph) and 7 (mobile
   collapse) will mount the same component in different layouts; the
   margin-rail in particular is a different mount point on a different
   page entirely.

## Decision

For **the graph view only**, re-introduce React via
`<PostGraph client:only="react" .../>`. No SSR — the graph is
meaningless without JS, so the hydration-shim flash that motivated
ADR-002 does not apply (`client:only` does not render anything on
the server, then mounts on the client). Astro-first remains the
default for everything else: header, list pane, post detail, all
static chrome.

Concretely:

- New component at `src/components/graph/post-graph.tsx`,
  imported by `src/pages/index.astro` and rendered inside the
  existing `data-view-pane="graph"` section, replacing the
  placeholder `<p>`.
- No re-introduction of radix or any UI-primitive library. The
  component renders its own `<svg>` with hand-rolled SVG nodes and
  links styled by Tailwind tokens.
- The pre-existing list/graph view-switch script
  ([src/pages/index.astro](../../src/pages/index.astro)) continues to
  flip `[hidden]` between panes; the React island is mounted at page
  load and stays mounted while hidden.

## Why this clears ADR-002's bar

1. **Lifecycle ownership.** `forceSimulation` returns an object that
   needs `.stop()` on unmount and `.on("tick", null)` cleanup.
   `useEffect` returns its cleanup function as part of the same
   reactive dependency contract; an inline `<script>` would need
   ad-hoc lifecycle bookkeeping (a global `currentSim` variable, a
   teardown listener on the view toggle, etc.).
2. **Ref-based imperative updates.** The tick handler mutates SVG
   element attributes directly (avoiding React state thrash at
   60fps). `useRef` + `querySelectorAll` inside an effect is the
   canonical React pattern for this. It composes — the same pattern
   works inside the margin rail in a future phase without rewriting
   the bridge to Astro.
3. **Pointer handlers per node.** JSX makes `onPointerDown`,
   `onPointerMove`, `onPointerUp` per-node trivial. The vanilla
   alternative is `addEventListener` on a constantly-mutating SVG
   that re-renders on simulation events, which means either event
   delegation through `data-id` attributes or re-attaching listeners
   on every render — both materially worse to maintain.
4. **Composability for phases 6–7.** The same component will mount in
   the post-detail margin rail (phase 6) at a different size and in a
   sticky context, and collapse on mobile (phase 7). The island form
   is portable; an inline `<script>` in `index.astro` is not.

## Alternatives considered

- **Inline `<script>` with `d3-force` as an ES module.** Workable —
  the simulation API is plain JS — but multiplies the lifecycle
  plumbing (manual cleanup on view-pane teardown, manual ResizeObserver
  setup, ad-hoc global state for the active simulation) and forces a
  second copy when the same widget is reused in the margin rail.
- **Web component wrapper.** Adds a custom-element layer for no real
  benefit over `client:only="react"`; the team is not currently
  authoring web components elsewhere, so this would introduce a new
  pattern for a single use case.
- **Astro's `<ClientRouter />` + island.** Solves a different problem
  (page-level transitions); the view switch is already client-side
  via the existing inline script and does not need rewriting.

## Consequences

Positive:

- Phases 6–7 inherit a portable component instead of duplicating
  imperative DOM code.
- The graph's lifecycle is cleanly bounded: mount → run → unmount,
  with no globals.
- Static chrome (header, list pane, post detail) remains zero-JS.
  `grep -r 'astro-island' dist/` after this change matches only
  `index.html`; every other built page is unchanged.

Trade-offs:

- React/ReactDOM ship to clients that visit `/` (the home page) — but
  only execute on `?view=graph`. The hydration cost is paid once per
  visit, not per view-toggle.
- `@astrojs/react`, `react`, `react-dom`, and `@types/react*` move
  from "dormant" back to "load-bearing." The follow-up captured in
  ADR-002 to remove the React integration is now off the table.
- The Astro-first bar must continue to be enforced going forward for
  this not to become a slippery slope; future React islands need
  their own ADR with their own load-bearing reason.

## Verification

- `pnpm test` passes, including new
  [tests/index-graph-pane.test.ts](../../tests/index-graph-pane.test.ts)
  which asserts the `<astro-island>` placeholder is present inside
  the graph pane and that `?view=graph` un-hides the right section.
- `pnpm build` produces a working static site.
- `grep -r 'astro-island' dist/` matches only `dist/index.html`. All
  other pages still ship zero JS.
- Manual smoke: `pnpm dev`, toggle list ↔ graph in the header pill —
  no network request (DevTools Network tab), graph state preserved
  on return.
