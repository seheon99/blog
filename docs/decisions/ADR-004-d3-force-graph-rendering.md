# ADR-004: Use `d3-force` (only) for the graph view

- Status: Accepted
- Date: 2026-04-30

## Context

[ADR-003](ADR-003-graph-view-react-island.md) commits to a React island
for the graph view. That decision still leaves open *what library* runs
the force simulation and renders the result. The React/JS ecosystem
offers several options at very different points on the size /
ergonomics / customisability surface.

## Decision

Use **`d3-force` only** (~12 KB minified, ~5 KB gzipped). Render with
hand-rolled SVG inside the React island. No `d3` umbrella import, no
`d3-drag`, no `d3-zoom`, no prebuilt graph component.

Rationale, in priority order:

1. **Smallest dep that does the math.** `d3-force` ships only the
   physics primitives we need: `forceSimulation`, `forceLink`,
   `forceManyBody`, `forceCollide`, `forceCenter`. Velocity-Verlet
   integration is solid and well-tested; reimplementing it would be
   gratuitous.
2. **We own the SVG.** Nodes are real `<a>` elements wrapping
   `<circle>` + `<text>`, styled with the existing design tokens
   (`var(--brand-500)`, `var(--fg-1)`, `var(--border)`). Dark mode is
   automatic through CSS variables. Keyboard accessibility falls out
   for free (anchors are tab-focusable, `enter` activates them).
3. **Drag and pointer-capture are native APIs**, used directly with
   `setPointerCapture` and SVG `getScreenCTM().inverse()`. Pulling in
   `d3-drag` for ~3 functions worth of behaviour does not pay for
   itself.
4. **Tailwind stays the styling source of truth.** Adding a graph
   library with its own DSL would create a second styling system
   inside the same project, with separate dark-mode and tokens stories.

## Alternatives considered

- **`react-force-graph`** — drop-in component with built-in zoom,
  drag, labels, and 2D/3D variants. Convenient, but the package
  family is heavy (~200 KB+ across `react-force-graph-2d` and its
  rendering deps; the 3D variant pulls `three.js`). Styling is
  opaque to Tailwind; node/edge templates are awkward to override
  cleanly. We would be skinning someone else's component instead of
  owning the SVG.
- **`cytoscape.js`** — mature, full layout zoo, gesture support,
  excellent for arbitrary-size graphs. ~300 KB; styling lives in its
  own selector DSL outside Tailwind. Overkill for ~10–100 nodes.
- **`sigma.js` / `cosmograph`** — WebGL-rendered, designed for very
  large graphs (tens of thousands of nodes). Wrong end of the
  perf/complexity tradeoff for a personal blog.
- **Roll our own physics.** The "physics from scratch" path is fun
  but produces nothing the existing `forceLink` /
  `forceManyBody` / `forceCollide` primitives don't already deliver.
  Net cost only.

## Why this is the right tradeoff for this project

The graph today has 9 nodes. Even at 10× growth it stays comfortably
under 100, where SVG + a force simulation runs at 60fps with no
optimisations. The ceiling for this approach is well above the
realistic ceiling for the content. Trading our own ~150 lines of
component code for keeping the styling system unified and the bundle
small is a clear win at this scale.

When the corpus crosses ~500 nodes (or starts demanding richer
interactions like camera pan animations, ring-pulse highlights, or
panel-avoidance zones from the design handoff §Force Simulation Spec),
revisiting this ADR — possibly migrating to `cytoscape` or moving the
renderer to canvas — is reasonable. We are nowhere near that boundary.

## Consequences

Positive:

- Graph nodes inherit the design system (oklch palette, dark mode,
  typography) automatically.
- Bundle stays small. The `d3-force` chunk is on the order of 5 KB
  gzipped; no `three.js`, no `cytoscape` selector engine in the
  build.
- Styling, accessibility, and composability all live in the same
  React/SVG/Tailwind layer the rest of the project uses.

Trade-offs:

- More code in `post-graph.tsx` than a prebuilt component would
  need: drag handlers, resize wiring, label positioning,
  click-after-drag suppression — all by hand. ~150 lines of
  component code is the cost. Acceptable given the styling
  unification and bundle savings.
- We do not get pan/zoom for free. If the corpus grows past the
  point where one viewport fits all nodes, we will need to add it.

## Verification

- `package.json` lists exactly two new entries: `d3-force` and
  `@types/d3-force`. No `d3`, `d3-drag`, `d3-zoom`,
  `react-force-graph*`, `cytoscape*`, `sigma*`.
- `pnpm build` then inspect `dist/_astro/`. The `d3-force` chunk
  weighs in around 5 KB gzipped. `grep -r 'three' dist/_astro/`,
  `grep -r 'cytoscape' dist/_astro/` return nothing.
- The graph component imports only from `d3-force` and `react`.
