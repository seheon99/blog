# Code review — `post-graph-mini.tsx` and `posts/[...id].astro`

**Branch:** `feature/graph-view`
**Reviewer perspective:** senior engineer, CS-aspect (complexity, correctness, lifecycle, concurrency, types). Visual/UX polish is out of scope.
**Files:**
- [src/components/graph/post-graph-mini.tsx](../../src/components/graph/post-graph-mini.tsx)
- [src/pages/posts/[...id].astro](../../src/pages/posts/[...id].astro)

The change adds hover/pin interaction with a preview card to the mini neighborhood graph, and rewires the TOC scroll-spy in the post page to handle a non-window scroll root. Overall the design is sound; below are the issues worth addressing, ordered by impact.

---

## 1. Hot-path DOM queries inside the simulation tick — high impact

[post-graph-mini.tsx:160-179](../../src/components/graph/post-graph-mini.tsx#L160-L179)

```ts
const tick = () => {
  const svg = svgRef.current;
  if (!svg) return;
  const lineEls = svg.querySelectorAll<SVGLineElement>("line[data-link]");
  lineEls.forEach((el, i) => { ... el.setAttribute("x1", String(s.x ?? 0)); ... });
  const groupEls = svg.querySelectorAll<SVGGElement>("g[data-node]");
  groupEls.forEach((el, i) => { ... });
  updateCardPosition();
};
```

`querySelectorAll` runs on **every simulation tick** (≈60 fps until `alpha` decays). For each tick this is O(N) DOM traversal **plus** O(N + E) `setAttribute` calls — and the queries themselves are not free, they walk the live tree. With a few dozen posts it's fine; the cost grows linearly with `nodes.length + links.length`.

**Recommendation:** populate two arrays via React `ref` callbacks (`ref={(el) => (lineRefs.current[i] = el)}`) once at render, then iterate those arrays in `tick`. This removes both the query cost and the index-alignment fragility called out in §3.

A secondary win: each `setAttribute` invalidates the SVG's geometry cache. For lines you can keep them as a single `<path>` with a `d` attribute updated once per tick, or render via `<g transform>` for endpoints — both reduce the mutation count. Optional; not required at current scale.

---

## 2. `find()` per tick when the preview card is open — medium impact

[post-graph-mini.tsx:90-107](../../src/components/graph/post-graph-mini.tsx#L90-L107)

```ts
function updateCardPosition() {
  const id = cardTargetIdRef.current;
  ...
  const node = simNodesRef.current.find((n) => n.id === id);
  ...
}
```

`updateCardPosition` is called from `tick`, so while the card is visible we do an O(N) linear scan of `simNodesRef.current` per frame. The card itself also resolves its node via `rawNodes.find(...)` ([line 331](../../src/components/graph/post-graph-mini.tsx#L331)) on every render.

**Recommendation:** build a `Map<string, SimNode>` once at the top of the simulation effect and stash it in a ref. Lookup becomes O(1). Same for the render-side preview-card lookup — `useMemo` a `Map<id, InputNode>` keyed on `rawNodes`.

---

## 3. Order-coupling between React-rendered children and `links`/`nodes` arrays — correctness risk

[post-graph-mini.tsx:163-177](../../src/components/graph/post-graph-mini.tsx#L163-L177)

```ts
lineEls.forEach((el, i) => {
  const link = links[i];
  ...
});
```

The tick assumes `lineEls[i]` corresponds to `links[i]` (same for nodes). Today this holds because React renders them in array order with stable keys. It will break the moment someone:

- Adds a conditional render inside the `<g aria-hidden="true">` block (e.g. hide self-loops),
- Adds another element with `data-link` for any reason,
- Filters/sorts `rawLinks` between input and the simulation copy.

The bug would be silent — wrong endpoints painted on the wrong lines.

**Recommendation:** key the lookup by identity, not index. Either store element refs in arrays you also build (so the link object and its element are co-indexed by construction), or read `data-id` / a `data-link-id` attribute and look up the link in a Map.

---

## 4. Mutable refs assigned in render body — React rule-of-thumb violation

[post-graph-mini.tsx:73-80](../../src/components/graph/post-graph-mini.tsx#L73-L80)

```tsx
const hoveredIdRef = useRef<string | null>(null);
hoveredIdRef.current = hoveredId;
const pinnedIdRef = useRef<string | null>(null);
pinnedIdRef.current = pinnedId;
...
cardTargetIdRef.current = cardTargetId;
```

Mutating refs during render is technically tolerated but disallowed by React's concurrent-mode model — under StrictMode or future concurrent rendering, render can be invoked, discarded, and re-invoked. The ref will momentarily disagree with the committed state. In this component the refs are read in event handlers (post-commit), so it works today. It's still a brittle pattern.

**Recommendation:** assign the refs in a `useEffect(() => { ref.current = state; })` or simply read state directly in the handler closures (re-renders give them up-to-date values anyway). The "ref-shadow-of-state" pattern is only really needed when the closure is captured *outside* the render (e.g. the `tick` callback), which is the case for `simNodesRef` / `cardTargetIdRef` but not for `hoveredIdRef` / `pinnedIdRef`.

---

## 5. Simulation thrash on resize — medium impact

[post-graph-mini.tsx:140-152](../../src/components/graph/post-graph-mini.tsx#L140-L152), [L222](../../src/components/graph/post-graph-mini.tsx#L222)

The simulation effect lists `size.width` and `size.height` in its dependency array. `ResizeObserver` fires on every layout change, so a window resize tears down and rebuilds the entire `forceSimulation` continuously while the user drags the corner — including reheating from `alpha=1`, which restarts the visible animation each time.

**Recommendation:**
- Don't recreate the simulation on resize. Update the existing forces in place: `sim.force("center", forceCenter(w/2, h/2))`, same for `forceX`/`forceY`, then `sim.alpha(0.3).restart()`.
- Optionally debounce the `setSize` callback or coalesce equal-rounded values, so trivial sub-pixel changes are ignored.

---

## 6. Redundant centering forces

[post-graph-mini.tsx:206-208](../../src/components/graph/post-graph-mini.tsx#L206-L208)

```ts
.force("center", forceCenter(size.width / 2, size.height / 2))
.force("x", forceX(size.width / 2).strength(0.08))
.force("y", forceY(size.height / 2).strength(0.08))
```

`forceCenter` translates the centroid each tick; `forceX`/`forceY` apply per-node positional forces toward the same point. Stacking both is a known anti-pattern that produces over-damped, slightly stiff layouts. Pick one — for a small fixed-viewport graph, `forceX/Y` alone usually gives nicer results.

Not a correctness bug, just unnecessary work and odd dynamics.

---

## 7. Background `<rect>` and pinned-node click ordering — works, but by luck

[post-graph-mini.tsx:127-129](../../src/components/graph/post-graph-mini.tsx#L127-L129), [L237-242](../../src/components/graph/post-graph-mini.tsx#L237-L242), [L113-125](../../src/components/graph/post-graph-mini.tsx#L113-L125)

The bg `<rect>` listens for `pointerup` to clear pin, and each node's `<g>` listens for `click`. When the user taps a pinned node the sequence is:

1. `pointerup` bubbles from the circle → reaches the rect → `setPinnedId(null)` is **scheduled**.
2. `click` fires on the group. It reads `pinnedIdRef.current`, which still holds the *old* pin (refs are updated in render body in the *next* commit, after state flush).
3. Therefore the navigation branch runs.

This works today only because React doesn't synchronously flush `setPinnedId(null)` before the click handler reads the ref. If anyone migrates the ref-update to a `useEffect` (per §4) or React's behavior changes around event batching, the behavior silently breaks (second tap deselects instead of navigating).

**Recommendation:** make the intent explicit. Either:
- `e.stopPropagation()` on the group's `pointerup` (prevents the rect from clearing the pin in the first place), or
- gate the rect's handler on `e.target === e.currentTarget` so only true background events clear the pin.

The second option is cleaner and matches what the rect is actually for.

---

## 8. Non-null assertion on a derived lookup — runtime crash risk

[post-graph-mini.tsx:331](../../src/components/graph/post-graph-mini.tsx#L331)

```tsx
node={rawNodes.find((n) => n.id === cardTargetId)!}
```

`cardTargetId` is set from user interaction, so it should always be valid. But:
- Hover sets `hoveredId` to a node id; if `rawNodes` is replaced (e.g. parent re-renders with a different graph) between hover and the next paint, `find` returns `undefined` and the `!` throws when the card tries to render.
- The Map suggested in §2 sidesteps this anyway; defensively, render `null` when the lookup misses.

---

## 9. Keyboard accessibility hole

[post-graph-mini.tsx:267-299](../../src/components/graph/post-graph-mini.tsx#L267-L299)

The pin/preview interaction is mouse/touch only. The inner `<a href={n.href}>` is keyboard-focusable, but pressing Enter follows the link directly — keyboard users never see the preview card. Tabbing also moves through every node anchor in DOM order, which on a 50-post graph is a long tab-stop chain with no visible focus indicator on the circle.

This isn't a regression of the diff, but the diff entrenches the pattern. Worth tracking even if not fixed here:
- Add `:focus-visible` styling on the circle.
- Consider opening the preview on focus (mirroring hover) and a separate keyboard affordance to "pin" (Space?) before navigating.

---

## 10. TOC scroll-spy: per-event O(H) `getBoundingClientRect` — minor

[posts/[...id].astro:238-249](../../src/pages/posts/%5B...id%5D.astro#L238-L249)

```ts
function update() {
  const top = 80;
  let active: string | null = null;
  for (const { el } of headings) {
    if (el.getBoundingClientRect().top - top <= 0) {
      active = el.id;
    } else {
      break;
    }
  }
  ...
}
```

`getBoundingClientRect` triggers layout and is called per heading per scroll event, on a `passive` listener that fires at scroll cadence. With many headings this adds up.

**Recommendation:** an `IntersectionObserver` with a top-band rootMargin is the canonical tool here — O(1) work per scroll, the browser tracks intersection edges for you. Lower priority since long posts rarely have dozens of H2/H3 headings.

The early `break` is correct (headings are in DOM order), so the logic itself is fine.

---

## 11. `getScroller()` reflow per click — trivial

[posts/[...id].astro:225-230](../../src/pages/posts/%5B...id%5D.astro#L225-L230)

```ts
function getScroller(): HTMLElement {
  if (scrollRoot && scrollRoot.scrollHeight - scrollRoot.clientHeight > 1) {
    return scrollRoot;
  }
  return document.documentElement;
}
```

Reading `scrollHeight`/`clientHeight` forces layout. Called once per TOC click — negligible. The comment above it ([L222-224](../../src/pages/posts/%5B...id%5D.astro#L222-L224)) is a good "why" comment; keep it.

If you want to be tidy: cache the resolved scroller after the first non-zero measurement, since it can't change at runtime without a viewport break.

---

## 12. Dead state — `simRef`

[post-graph-mini.tsx:69, 215, 220](../../src/components/graph/post-graph-mini.tsx#L69)

`simRef.current = sim` is written but never read. Either remove it, or use it for the resize-update path suggested in §5 (which is what it looks like it was meant for).

---

## Things that are good

- Cleanup paths are tight: ResizeObserver disconnects, simulation `stop()` + `on("tick", null)`, `matchMedia` listener removed. No leaks I can see.
- `prefers-reduced-motion` is honored both in the pulse animation and TOC smooth-scroll.
- The "anchor card opposite the half it's in" heuristic ([L100-105](../../src/components/graph/post-graph-mini.tsx#L100-L105)) is a nice cheap way to keep the card on-screen without a real collision step.
- `getBacklinks` / `buildPostGraph` are called in the Astro frontmatter — these run **at build time**, not per request. The O(P²) cost across all post pages is paid once during `astro build`. Fine at current scale; revisit if the post count exceeds a few hundred.
- The `cardTargetId = pinnedId ?? hoveredId` derivation is the right shape — a single source of truth for "what is the card showing", with pin taking precedence.

---

## Suggested priority

| # | Issue | Priority |
|---|-------|----------|
| 1 | DOM query per tick | **High** — perf and a fix is cheap |
| 3 | Index-coupling fragility | **High** — silent-corruption potential |
| 5 | Simulation rebuild on resize | **High** — UX-visible jank |
| 2 | `find()` per tick / per render | Medium |
| 7 | Pin-click ordering | Medium — works today, fragile |
| 8 | Non-null assertion | Medium |
| 4 | Refs assigned in render body | Low |
| 6 | Redundant centering forces | Low |
| 9 | Keyboard a11y | Low (pre-existing) |
| 10 | Scroll-spy uses `getBoundingClientRect` | Low |
| 11 | `getScroller()` reflow per click | Trivial |
| 12 | Dead `simRef` | Trivial |
