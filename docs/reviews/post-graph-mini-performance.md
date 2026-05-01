# Performance baseline — `post-graph-mini.tsx` and TOC scroll-spy

**Targets the hotspots flagged in:** [post-graph-mini-review.md](./post-graph-mini-review.md)
**Branch:** `feature/graph-view`
**Apparatus:** vitest `bench` against [tests/post-graph.bench.ts](../../tests/post-graph.bench.ts) for the CPU-bound paths, plus one manual `console.count` probe for the resize/sim-rebuild question and one Lighthouse navigation audit as a CWV regression-detector.

The four hotspots called out as High priority in the review:

1. **§1** `runTick` — `querySelectorAll` per tick + N `setAttribute`
2. **§2** `find()` per tick when the preview card is open
3. **§5** Full simulation rebuild on every ResizeObserver firing
4. **§10** TOC scroll-spy `getBoundingClientRect` per heading per scroll event

---

## Predictions (written before measuring)

The point of writing these first: if measurements diverge from predictions by more than ~2×, the diagnosis in the original review is suspect — flag in the "Findings" section rather than rationalize the fix.

### §1 `runTick` at N=200

- 2× `querySelectorAll` on an SVG with ~400 children: ~0.1 ms each in happy-dom (negligible in real Blink — happy-dom traverses children in JS).
- ~400 `setAttribute` calls: ~5 µs each → ~2 ms.
- **Predicted total:** ~2.2 ms/tick.
- **After §1 fix (cached refs):** querySelectorAll cost gone → ~2.0 ms/tick. ~10 % faster; `setAttribute` dominates. Slope vs N stays O(N) but with a smaller constant.

### §2 `find` vs `Map.get` at N=200

- `Array.find`: ~5 µs (linear scan, ~100 ops × ~50 ns each).
- `Map.get`: ~50 ns.
- **Predicted ratio:** ~100×. Per-call cost negligible in absolute terms (sub-ms anywhere); the value of the fix is *cleanliness* not *runtime*.

### §5 `sim:rebuild` during a 3-second corner-drag

- ResizeObserver coalesces to next animation frame at most → expect **10–30 firings** during a 3 s drag (60 fps × 3 s = 180 frames, but the user can't drag at frame rate; realistically ~10–30 distinct sizes).
- Today: each firing tears down + rebuilds the whole `forceSimulation` (alpha=1).
- **Predicted today:** 10–30 rebuilds.
- **After §5 fix (in-place force update):** 1 rebuild + 10–30 cheap force updates.

### §10 Scroll-spy `update` at H=20

- 20× `getBoundingClientRect`: ~5 µs each in real Blink (forces layout, but layout is cached if nothing dirty); higher in happy-dom (no layout engine, returns 0). Bench measures the loop overhead, not the layout cost.
- **Predicted today (real browser, H=20):** ~0.1 ms/call. Called per scroll event (~60 Hz) → ~6 ms/sec scrolling.
- **After §10 fix (IntersectionObserver):** invocation rate drops to intersection-edge events only (single digits per scroll), per-call cost ~0. Total scroll-time CPU drops to ~0.

### Lighthouse Performance score

- **Predicted today:** >95. Static blog with islands; nothing in the review is large enough to move LCP/TBT/CLS.
- **After fixes:** unchanged. The review's items live below CWV's noise floor at realistic scale. The baseline run exists only as a regression-detector — if the post-fix score drops, the fix introduced something accidental.

---

## Measured baseline

### Bench (vitest `bench tests/post-graph.bench.ts`, happy-dom env)

Captured 2026-05-01 on Linux 6.19.12-200.fc43.x86_64. Re-run with `pnpm exec vitest bench tests/post-graph.bench.ts --run`.

#### `runTick` — current implementation

| N    | ops/sec  | mean µs/op | p99 µs/op |
|------|---------:|-----------:|----------:|
| 6    |    5,609 |        178 |     3,217 |
| 50   |      937 |      1,068 |     6,453 |
| 200  |      202 |      4,959 |    17,849 |
| 500  |       89 |     11,194 |    22,710 |

Slope is roughly linear: N=50→200 (4×) gives 4.6× cost; N=200→500 (2.5×) gives 2.3× cost. At realistic N=6 the mean tick is **0.18 ms ≈ 1% of a 16.67 ms frame budget** — invisible. At N=200 it's ~30% of frame budget; at N=500, ~67%.

#### find vs Map.get

| N    | Array.find ops/sec | Map.get ops/sec | ratio  |
|------|-------------------:|----------------:|-------:|
| 50   |          3,159,545 |      10,517,331 |   3.3× |
| 200  |          2,109,886 |       5,042,900 |   2.4× |
| 500  |            470,284 |       9,308,513 | **20×**|

V8 JITs `find` over arrays-of-objects much better than my prediction (mean 0.5 µs at N=200 vs predicted 5 µs). The ratio stays modest at small N — the win is at N=500 where `find` degrades sharply (cache effects) while `Map.get` stays flat.

#### Scroll-spy `update` — current implementation

| H    | ops/sec   | mean µs/op |
|------|----------:|-----------:|
| 6    | 1,811,771 |      0.55  |
| 20   |   680,610 |      1.47  |
| 50   |   286,893 |      3.49  |

> Caveat: happy-dom's `getBoundingClientRect` returns 0 without doing layout work. The bench measures the *loop overhead* in JS — not the real-browser layout-flush cost, which is what makes this hotspot matter in practice. Use slope (~linear in H) and the post-fix delta as the meaningful comparisons. A real-browser microbench is the only way to capture the layout-flush cost; out of scope here.

### Manual probe — `sim:rebuild` count during corner-drag

> _Probe was removed in the §5 fix without being captured. See "§5 fix" below — the structural change makes the count provably 1 (initial build) + 0 per resize, by construction of the effect's dependency array._

- Realistic page (`/posts/agentic-ai-stack`), drag bottom-right corner left/right for ~3 s.
- `console.count("PostGraphMini:sim-rebuild")` total at end of drag: **N/A (probe removed)**

### Lighthouse navigation audit

> _Filled in by following the procedure in [Appendix A](#appendix-a--manual-procedures)._

- URL: `http://localhost:4321/posts/agentic-ai-stack`
- Performance score: **TBD**
- LCP: **TBD**
- TBT: **TBD**
- CLS: **TBD**
- Speed Index: **TBD**

HTML report at `docs/reviews/baselines/lighthouse-realistic-before.html` (gitignored).

---

## Post-fix measured

Re-run with `pnpm exec vitest bench tests/post-graph.bench.ts --run` after the fix. Numbers below captured 2026-05-01 on the same machine as the baseline.

### §1 + §3 fix — `runTick` ref-Map vs `querySelectorAll`

The fix replaces the two per-tick `svg.querySelectorAll` calls (§1) with element refs collected once at render time, and keys those refs by **node id / link key** rather than render-order index (§3) — see [src/lib/post-graph-tick.ts](../../src/lib/post-graph-tick.ts), [src/components/graph/post-graph-mini.tsx](../../src/components/graph/post-graph-mini.tsx). The bench measures both paths side-by-side so the comparison is in-run (same machine, same JIT state):

| N    | qSA ops/sec | ref-Map ops/sec | mean µs/op (qSA → ref) | Speedup |
|------|------------:|----------------:|-----------------------:|--------:|
| 50   |         511 |             943 |        1,956 → 1,060   |   1.85× |
| 200  |         220 |             265 |        4,543 → 3,768   |   1.21× |
| 500  |        89.9 |            99.4 |       11,124 → 10,060  |   1.11× |

The win is real but bounded. As the baseline predicted, **`setAttribute` dominates** — the ref-Map fix eliminates the two `querySelectorAll` calls per tick (a meaningful chunk at N=50 in happy-dom) but the ~`O(N+E)` attribute-mutation cost is untouched. On a real Blink engine the live-DOM `querySelectorAll` traversal is more expensive than happy-dom shows, so the production win should be at least this size, likely more.

§3's contribution to the runtime is roughly nil — `Map.get(key)` instead of `arr[i]` is a few extra ns per element. **§3's value is correctness, not perf:** before the fix, `lineEls[i]` ↔ `links[i]` coupling held by render-order convention, and would silently paint wrong endpoints if anyone added a conditional render, sort, or filter. After the fix, the lookup is keyed by `link.key` (= `${source}->${target}-${i}` stamped at sim-copy time) so the JSX-to-tick mapping is decoupled from render order.

### §2 fix — `Map.get` at the production call sites

The fix replaces `simNodesRef.current.find(...)` (per-tick) and `rawNodes.find(...)` (per-render) with `Map.get` lookups (see [src/components/graph/post-graph-mini.tsx](../../src/components/graph/post-graph-mini.tsx) — `simNodesByIdRef` and `rawNodesById`). The data-structure microbench was already in place; it benches both alternatives regardless of which the production code uses. **The §2 fix doesn't change the bench numbers — it changes which side of the bench production runs on.**

| N    | Array.find ops/sec | Map.get ops/sec | Speedup |
|------|-------------------:|----------------:|--------:|
| 50   |          3,348,527 |       9,639,547 |   2.88× |
| 200  |          2,093,225 |       9,294,141 |   4.44× |
| 500  |            479,245 |       4,542,099 |   9.48× |

Re-confirms the baseline finding: V8 JITs `Array.find` over arrays-of-objects far better than the original prediction. Per-call cost is sub-microsecond at every realistic N, so the **production runtime impact is negligible at current scale** (N≈6 for this blog). The fix's value is structural — O(1) instead of O(N) lookup at hot call sites — and pays off if the post graph ever grows past a few dozen neighbors.

### §5 fix — sim rebuild on resize → in-place force updates

The fix splits the monolithic sim `useEffect` into two:

1. **Build effect** — deps `[rawNodes, rawLinks]`. Creates the simulation (or the empty-links circular fallback) once per graph identity. Resize no longer triggers it.
2. **Resize effect** — deps `[size.width, size.height]`. Updates `forceCenter` / `forceX` / `forceY` on the existing sim in place, then calls `sim.alpha(0.3).restart()` for a gentle re-cool. Skips its first run via `lastAppliedSizeRef` so the brand-new sim's natural alpha=1 cool-down isn't dampened. For the empty-links case (no sim), recomputes circular positions and re-ticks.

The structural guarantee is what matters: with `size` removed from the build effect's deps, resize can no longer rebuild the sim — by construction, not by debouncing. The `console.count("PostGraphMini:sim-rebuild")` probe (and its `// REMOVE BEFORE MERGE` comment) were dropped — the dependency-array shape now proves the property.

A small helper `placeNodesCircular(nodes, w, h)` was extracted from the original effect since the empty-links layout logic now runs in two places (build + resize).

**Visual effect:**

- *Before:* every ResizeObserver tick during a corner-drag tore down the simulation and rebuilt from `alpha=1`, restarting the layout animation each time. Nodes "shake" as the sim repeatedly re-cooks at full heat.
- *After:* a single rebuild on graph identity change; subsequent resizes update three force centers and reheat to `alpha=0.3`. Nodes ease to the new bounding box.

The fix is verifiable by code inspection — `useEffect(..., [rawNodes, rawLinks])` deps array contains no `size` — so the original `console.count` probe was removed without being captured.

**Microbench** ([tests/post-graph.bench.ts](../../tests/post-graph.bench.ts) — `sim resize: rebuild vs in-place force update`):

| N    | rebuild ops/sec | in-place ops/sec | mean µs/op (rebuild → in-place) | Speedup |
|------|----------------:|-----------------:|--------------------------------:|--------:|
| 6    |         185,006 |        1,568,583 |                  5.4 → 0.6      |   8.48× |
| 50   |          66,698 |          937,817 |                 15.0 → 1.1      |  14.06× |
| 200  |          19,491 |          457,830 |                 51.3 → 2.2      |  23.49× |

This is the **per-resize-event setup cost** alone — the construction work that runs each time `setSize` fires. The actual user-facing cost is multiplied two further ways:

1. **Frequency:** ResizeObserver fires ~10–30 times during a 3-second drag (one per coalesced layout tick). Pre-fix that's 10–30 full rebuilds; post-fix it's 1 rebuild + 9–29 in-place updates.
2. **Tick saturation:** a fresh sim from `alpha=1` runs ~60–80 ticks before settling. `alpha(0.3).restart()` takes ~12–20. Each tick calls `runTick` (the hot path measured in §1). At N=200, that's roughly **6.7s of cumulative tick CPU pre-fix vs 1.8s post-fix** for a 3-second drag — i.e. main-thread saturation pre-fix vs comfortable headroom post-fix. (Extrapolation; the realistic blog scale is N=6 where both fit easily.)

At current N=6 the absolute numbers are sub-millisecond and the user-perceived effect is the *visual smoothness*, not the CPU savings. The fix matters most when the post graph eventually scales.

### §4 fix — refs out of render body (no perf delta)

The fix removes two redundant ref-shadows (`hoveredIdRef`, `pinnedIdRef`) — both were only read inside event handlers, where the inline closures already see fresh state from each commit, so the ref-shadow was pure overhead and a concurrent-mode footgun. The remaining `cardTargetIdRef` is **structurally necessary** because the sim `tick` callback is captured outside render (in the build effect, which does *not* re-run on `cardTargetId` changes). Its write moved from the render body into the existing `useEffect(() => …, [cardTargetId])` so concurrent or discarded renders can't desync the ref from committed state.

This is a **React-correctness change, not a perf change** — no bench applies. The component now matches the pattern *"refs only bridge state into closures captured outside render; assigned in effects, never in render body."*

Net diff: -2 refs, -2 lines in render body, +1 line moved into the existing effect.

### §10 fix — TOC scroll-spy: per-scroll loop → IntersectionObserver

The fix replaces the scroll-event-driven `getBoundingClientRect` loop in [src/pages/posts/[...id].astro](../../src/pages/posts/[...id].astro) with a single IntersectionObserver. The observer's root rect is collapsed to a 0-height line at `y=80` via `rootMargin: "-80px 0px -100% 0px"`. For each heading we maintain an `aboveLine` set; when an entry fires, the heading is added or removed based on whether its `boundingClientRect.top < rootBounds.top`. Active heading = last in document order that's in `aboveLine`.

The structural change shifts the cost model:

- *Before:* O(H) `getBoundingClientRect` calls per scroll event, ~60 Hz on touch devices. For H=20 headings during a 5-second scroll: ~6,000 layout-flushing calls.
- *After:* the browser fires the IO callback only when a heading crosses the activation line — typically O(1) entries per firing, and the total firings during a full-page scroll is ~O(H) (each heading crosses the line once). For H=20: ~20–40 callback invocations across the entire scroll.

That's a ~150–300× reduction in event volume at H=20, before counting the per-call cost. Each invocation is also cheaper: no layout flush (IO uses precomputed compositor data), no per-call iteration over all headings.

The existing scroll/resize listeners and the `update()` function are removed. The click-to-scroll handlers still call `getBoundingClientRect` once per click (review §11 — trivial), unchanged.

**No microbench post-fix:** the pre-fix bench (kept as `scroll-spy update — review §10 (historical pre-fix: …)` in [tests/post-graph.bench.ts](../../tests/post-graph.bench.ts)) measures per-event cost in JS — IO has no equivalent per-event path; its work happens off the main thread inside the browser's intersection-tracking pipeline. The post-fix value is **eliminating the call entirely**, not making it faster.

happy-dom doesn't implement `getBoundingClientRect`-driven layout, so the original bench under-reports the real-browser cost regardless. The IO fix is right by structure: it removes a known scroll-listener anti-pattern even if the absolute pre-fix cost was small.

### §6 fix — redundant centering forces

`forceCenter` was stacking with `forceX`/`forceY` toward the same point, producing slightly over-damped, stiff dynamics. Per the review's recommendation for a small fixed-viewport graph, dropped `forceCenter` (and its import) from both the build and resize effects. Pure cleanup, not a perf change — the per-tick force evaluation cost is fractionally lower, but the visible effect is *better* layout dynamics, not a benchmark number.

### §7 fix — background-rect pin-clear ordering

The bg `<rect>` listens for `pointerup` to clear pin; each node `<g>` listens for `click` to navigate when its node is already pinned. Pre-fix, a `pointerup` bubbling from a node would *also* hit the rect's handler, potentially clearing `pinnedId` before the click handler read it — making "tap pinned node to navigate" silently break depending on React's batching.

The fix gates the rect's handler on `e.target === e.currentTarget` so only events that genuinely target the bg rect clear the pin. Behavior was correct today by accident (React doesn't synchronously flush state updates between bubbling handlers); now it's correct by construction.

### §8 fix — drop non-null assertion on derived lookup

The preview-card JSX previously used `node={rawNodesById.get(cardTargetId)!}`. If `rawNodes` were ever replaced between hover and the next paint, `find`/`get` would return `undefined` and the `!` would throw at render. Replaced with an IIFE that early-returns `null` on lookup miss, matching the §2 pattern of "render nothing rather than assert."

### §9 fix — keyboard focus indicator (cheap subset only)

The base `:focus-visible { outline … }` rule renders inconsistently on SVG `<a>` across browsers (Chrome OK, older Firefox not). Added a `.post-graph-mini-node` className on each node anchor + a CSS rule in [src/styles/global.css](../../src/styles/global.css) that mirrors the focus indicator onto the inner `<circle>` via `stroke` change. Now keyboard users can see which node is currently focused.

The review's larger item — "open the preview on focus, separate Space-to-pin affordance before navigating" — is **not addressed**. That's a feature change, not a defect; warrants its own design pass. Tab-stop chain length isn't a problem at the current N=6 scale.

### §11 fix — cache `getScroller()` after first measurement

The active scroller is determined by viewport class (desktop scrollable rail vs. mobile body-scroll) and can't change at runtime without a viewport-class break. Added a `cachedScroller` slot that's populated on the first non-zero measurement; subsequent TOC clicks skip the layout flush. Defensively keeps falling back through the original logic on early measurements where `scrollHeight === 0`.

### §12 — already obsoleted by §5

The review flagged `simRef` as dead state (assigned but never read). The §5 fix made it load-bearing — the resize effect reads `simRef.current` to patch forces in place on the existing simulation. No action needed.

---

## Findings — post-fix

| Hotspot                  | Predicted-after | Measured-after | Verdict |
|--------------------------|-----------------|----------------|---------|
| §1 `runTick` mean N=200  | ~2.0 ms (~10 % faster) | **3.8 ms (21 % faster vs in-run qSA)** | Direction matches; magnitude in-line. happy-dom under-counts `qSA` cost vs Blink, so production gap is likely larger. |
| §2 `find` → `Map` at call sites | runtime-negligible at small N | **Confirmed negligible at N≤200** | Structural correctness (O(1) lookup), not a runtime win at the current scale. |
| §3 ref index → identity-keyed Map | runtime-neutral | **Within rme of §1 ref-array numbers** | Correctness fix: removes silent-corruption risk if JSX render order ever desyncs from `links`/`nodes` arrays. No measurable perf cost. |
| §4 refs out of render body | runtime-neutral | **N/A — React-correctness only** | Removed two redundant ref-shadows (`hoveredIdRef`, `pinnedIdRef`); moved `cardTargetIdRef` write into the existing `useEffect`. Eliminates a concurrent-mode footgun without changing behavior. |
| §5 sim rebuild on resize | 1 rebuild + ~10–30 in-place updates per drag | **Structural; in-place update 8–23× faster than rebuild per resize tick** | Build deps narrowed to `[rawNodes, rawLinks]`; resize deps `[size.width, size.height]` patch forces in place + `alpha(0.3).restart()`. Per-event setup cost: 5.4 → 0.6 µs at N=6; 51.3 → 2.2 µs at N=200. Compounding effect via reduced post-resize tick count (~60→~16) makes the user-facing CPU win 3–4× larger than the setup-only number. Visually: graph eases to new bounds instead of restarting layout each ResizeObserver tick. |
| §10 scroll-spy per scroll-event | IO drops invocation rate to edge crossings | **Structural; ~150–300× fewer invocations at H=20 over a 5s scroll** | Scroll/resize listeners + `getBoundingClientRect` loop replaced with a single `IntersectionObserver` whose root collapses to a line at y=80. Pre-fix: ~6,000 layout-flushing calls per 5s scroll at H=20. Post-fix: ~20–40 callback invocations across the entire scroll, no layout flush. Real-browser benefit larger than happy-dom suggests since pre-fix's actual cost includes a layout flush per call. |
| §6 redundant centering forces | force evaluation slightly cheaper | **Pure cleanup; better layout dynamics** | Dropped `forceCenter` — stacking it with `forceX`/`forceY` toward the same point produced over-damped layouts. |
| §7 pin-click ordering | navigation works regardless of React event batching | **Structural correctness** | Gated `onBgPointerUp` on `e.target === e.currentTarget`. Was correct today by accident, now by construction. |
| §8 non-null assertion on lookup | no runtime crash on stale `cardTargetId` | **Structural correctness** | IIFE renders `null` on lookup miss instead of throwing on `undefined!`. |
| §9 keyboard focus indicator (subset) | visible focus on every browser | **A11y polish** | `.post-graph-mini-node:focus-visible > circle` mirrors the global focus indicator onto the SVG circle via stroke change. Larger interaction redesign (open-preview-on-focus, Space-to-pin) deferred. |
| §11 `getScroller` reflow per click | one layout flush per page lifecycle, not per click | **Trivial** | `cachedScroller` populated on first non-zero measurement. |
| §12 dead `simRef` | n/a | **Already obsoleted by §5** | The resize effect reads `simRef.current` to patch forces in place — the ref is now load-bearing. |

**Headline:** every review item is now addressed (§1–§12). The high-impact wins are §1/§3 (runtime — strict speedup at every N), §5 (visible resize jank gone), and §10 (cumulative scroll cost). The medium items §7/§8 fix latent silent-failure modes that would have surfaced under React event-batching changes or stale-state edge cases. §9's larger interaction redesign (open-preview-on-focus, Space-to-pin) is deferred — needs its own design pass. The component is now the right shape to scale to N=200+ neighbors and H=20+ headings without revisiting.

---

## Findings

| Hotspot                       | Predicted | Measured     | Divergence | Verdict |
|-------------------------------|-----------|--------------|-----------:|---------|
| `runTick` mean at N=200       | ~2.2 ms   | **4.96 ms**  |     2.25×  | Predictions undershot. happy-dom's `setAttribute` cost is higher than the 5 µs estimate (closer to ~12 µs at this scale). The diagnosis is unaffected — it just means the §1 fix has a *larger* potential payoff than predicted. |
| `find` vs `Map.get` at N=200  | ~100×     | **2.4×**     |    ~40×    | V8 optimizes `find` over arrays-of-objects far better than predicted; per-call cost is sub-microsecond at this N. The fix is justified at scale (20× at N=500) but the case for N≤200 is *cleanliness*, not runtime. Worth de-prioritizing relative to §1/§5. |
| Scroll-spy at H=20            | ~0.1 ms   | **0.0015 ms**|    ~70×    | Expected: happy-dom returns 0 from `getBoundingClientRect` without doing layout work. The bench captures only loop overhead. The structural §10 fix (IntersectionObserver) is still right — it eliminates the per-scroll-event invocation, not just per-call cost — but a real-browser bench is needed to quantify the layout-flush savings. |

**Headline:** at the current blog's realistic scale (N=6 nodes, H=4–8 headings) all three measured hotspots are well below the perception threshold. The review's High-priority items pay off **only** if the post count grows toward ~50+ neighbors per article or if a single article's TOC grows past ~20 headings. Today, this is future-proofing.

The §5 sim-rebuild question is the one item where a *user-visible* effect is plausible at current scale — the manual probe (below) is the load-bearing measurement.

---

## Appendix A — Manual procedures

### A.1 — `sim:rebuild` count (historical)

This procedure was scaffolding for the §5 diagnosis. The probe was removed in the §5 fix without being captured — by then the structural fix (deps array narrowed to `[rawNodes, rawLinks]`) made the count provably 1+0 by construction. Kept here only as a record of the original plan.

Original procedure:

1. `pnpm dev`
2. Open `http://localhost:3000/posts/agentic-ai-stack` in the browser, open DevTools console.
3. Resize the window: drag the bottom-right corner left and right continuously for ~3 seconds.
4. Read the final `PostGraphMini:sim-rebuild` count from the console.

### A.2 — Lighthouse navigation audit

**Prerequisite:** a Chromium-compatible browser. Lighthouse cannot drive Firefox. If none is installed:

```sh
sudo dnf install google-chrome-stable
```

Then:

1. `pnpm build && pnpm preview` (preview server defaults to port 4321).
2. In another terminal:

   ```sh
   lighthouse http://localhost:4321/posts/agentic-ai-stack \
     --only-categories=performance \
     --output=html \
     --output-path=docs/reviews/baselines/lighthouse-realistic-before.html
   ```

3. Open the generated HTML, copy Performance score + LCP + TBT + CLS + Speed Index into the table above.
4. The HTML stays gitignored (see `.gitignore`); only the markdown numbers are tracked.

---

## What this baseline will and will not tell us

**Will tell us**, with concrete numbers:

- Slope of `runTick` cost vs node count (relative before/after is valid).
- Direct cost of `find` vs `Map.get`.
- Scroll-spy loop overhead vs heading count.
- A real number for sim rebuilds during a real resize gesture.
- One Lighthouse snapshot of CWV at realistic scale (regression detector).

**Will not tell us**:

- Real-browser absolute performance — happy-dom's `getBoundingClientRect` is fake; absolute numbers are in the wrong units. Use slopes and ratios.
- Subjective jank — manual probe captures it qualitatively.
- Memory growth — out of scope; review §12 (`simRef` dead state) is a code-cleanliness item, not a leak.
