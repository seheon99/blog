# Principles review — `post-graph-mini.tsx` and `posts/[...id].astro`

**Branch:** `feature/graph-view`
**Reviewer perspective:** senior engineer assessing adherence to common software-development principles. Focused on the diff but considers the file as a whole where the diff entrenches a pattern.
**Files:**
- [src/components/graph/post-graph-mini.tsx](../../src/components/graph/post-graph-mini.tsx)
- [src/pages/posts/[...id].astro](../../src/pages/posts/[...id].astro)

The principles assessed:

| Principle | Stands for |
|---|---|
| **SOLID** | Single Responsibility · Open/Closed · Liskov Substitution · Interface Segregation · Dependency Inversion |
| **DRY** | Don't Repeat Yourself |
| **KISS** | Keep It Simple, Stupid |
| **YAGNI** | You Aren't Gonna Need It |
| **CoC** | Convention over Configuration |
| **CoI** | Composition over Inheritance |
| **LoD** | Law of Demeter (principle of least knowledge) |

---

## SOLID

### Single Responsibility — **Weak**

`PostGraphMini` is doing far too much for one component:

1. Owning the d3 simulation lifecycle ([L154-222](../../src/components/graph/post-graph-mini.tsx#L154-L222))
2. Observing container resize ([L140-152](../../src/components/graph/post-graph-mini.tsx#L140-L152))
3. Tracking `prefers-reduced-motion` ([L82-88](../../src/components/graph/post-graph-mini.tsx#L82-L88))
4. Managing hover/pin interaction state ([L70-76](../../src/components/graph/post-graph-mini.tsx#L70-L76))
5. Computing card position ([L90-107](../../src/components/graph/post-graph-mini.tsx#L90-L107))
6. Click-vs-modifier-key navigation rules ([L113-125](../../src/components/graph/post-graph-mini.tsx#L113-L125))
7. Rendering the SVG and the preview card

That's at least seven reasons-to-change in a single 340-line component. Any of these can be lifted into a custom hook with no loss of clarity:

- `useGraphSimulation(nodes, links, size)` → returns refs and a `tick` callback
- `useReducedMotion()` → returns boolean
- `useElementSize(ref)` → returns `{ width, height }`
- `usePreviewCard()` → owns hover/pin/cardRef and returns handlers

[posts/[...id].astro](../../src/pages/posts/%5B...id%5D.astro)'s page-level `<script>` ([L205-274](../../src/pages/posts/%5B...id%5D.astro#L205-L274)) similarly mixes scroll-root resolution, scroll-spy, and smooth-scroll-on-click. Less egregious because page scripts are inherently grab-bags, but the same factoring (`scrollSpy()`, `bindTocClicks()`) would help.

`MiniPreviewCard` itself is well-scoped — purely presentational. ✓

### Open/Closed — **Adequate, with caveats**

The component is closed to extension by design — every behavior is hardcoded:

- Force tunings: `distance(40)`, `strength(0.5)`, `strength(-80)`, `strength(0.08)` are scattered as magic numbers ([L202-208](../../src/components/graph/post-graph-mini.tsx#L202-L208)).
- The card-placement strategy (`placeRight = node.x < size.width / 2`, [L101](../../src/components/graph/post-graph-mini.tsx#L101)) is one branch baked into `updateCardPosition`.
- `radiusFor` ([L54-57](../../src/components/graph/post-graph-mini.tsx#L54-L57)) hardcodes the read-time → radius curve.

For a leaf component with one consumer, hardcoding is fine. If a second graph variant ever appears (e.g. a full-page graph at `/graph`), the simulation parameters and placement logic will need to be parameterized then. **Today: acceptable. Watch this when a second consumer materializes.**

### Liskov Substitution — **N/A**

No meaningful subtyping in this code. `SimNode extends SimulationNodeDatum` is a TS interface extension that adds fields; `forceSimulation`'s consumers expect `SimulationNodeDatum`-shaped objects, and `SimNode` honors that contract. No violations because no real hierarchy.

### Interface Segregation — **Weak**

`SimNode` ([L32-41](../../src/components/graph/post-graph-mini.tsx#L32-L41)) carries `description`, `createdAt`, `tags`, `primaryTag`, `title`, `href` — none of which the **simulation** uses. The simulation cares about `id`, position (`x/y/vx/vy`), and `readMinutes` (for the collide radius). Display fields are only consumed by the preview card, which already reads from `rawNodes`, not `simNodes`.

The fat type forces every consumer of "a simulation node" to know about display fields they don't use. Cleaner split:

```ts
interface GeometryNode extends SimulationNodeDatum {
  id: string;
  readMinutes: number;
}
```

…and let the card lookup keep using `rawNodes` (or a `Map<id, InputNode>` per the prior review). The simulation's working set shrinks, and the model gets honest about what it needs.

### Dependency Inversion — **Adequate**

The component depends directly on `d3-force` and `tagColor`. For a UI leaf, that's fine — DIP pays off where you have multiple implementations or want test seams. There are no test seams here (and the d3 simulation is not unit-tested), so introducing an abstraction layer would be ceremony without payoff. **Pragmatic non-violation.**

---

## DRY — **Mild violations**

1. **Type duplication.** [`InputNode`](../../src/components/graph/post-graph-mini.tsx#L16-L25) and [`SimNode`](../../src/components/graph/post-graph-mini.tsx#L32-L41) repeat six fields verbatim. Once §ISP above is fixed by slimming `SimNode`, the duplication disappears naturally. Today, `SimNode` should just be `SimulationNodeDatum & InputNode`.

2. **Date formatting.** The exact same `Intl.DateTimeFormat` options live in two places:
   - [post-graph-mini.tsx:344-350](../../src/components/graph/post-graph-mini.tsx#L344-L350) (preview card)
   - [posts/[...id].astro:51-57](../../src/pages/posts/%5B...id%5D.astro#L51-L57) (post header)

   Both produce `MAY 1, 2026`-style labels. Worth a `formatPostDate(date)` helper in [src/lib/](../../src/lib/) — co-located with `read-time.ts`.

3. **Stroke / radius decision tables.** The `isActive ? ... : isPinned ? ... : ...` ladders for `r`, `stroke`, and `strokeWidth` ([L288-298](../../src/components/graph/post-graph-mini.tsx#L288-L298)) are three independent ternaries computing one logical "node visual state." A small `nodeStyle({ isActive, isPinned })` returning `{ r, stroke, strokeWidth }` would centralize the decision and make adding a new state (e.g. `isHoveredNeighbor`) a one-line edit instead of a three-place edit.

4. **Scroll-spy click targets.** Inside the Astro `<script>`, every link gets its own click listener ([L260-272](../../src/pages/posts/%5B...id%5D.astro#L260-L272)). Event delegation on the parent `<ul>` would be DRYer and lighter, though the difference is academic for ten or twenty headings.

---

## KISS — **Mostly good, with isolated complexity hot-spots**

The component's overall shape is straightforward: one effect for resize, one for the simulation, plus event handlers. That's KISS-compatible.

The non-KISS bits:

1. **Ref-shadowing-state pattern.** ([L73-80](../../src/components/graph/post-graph-mini.tsx#L73-L80))

   ```ts
   const hoveredIdRef = useRef<string | null>(null);
   hoveredIdRef.current = hoveredId;
   ```

   This trick is needed only when a closure captured *outside* React's render lifecycle (the `tick` callback) needs the latest value. For `hoveredId`/`pinnedId`, those are read in event handlers that React re-binds on every render — the ref shadow is unnecessary and adds cognitive overhead. Reading state directly would be simpler.

2. **Manual DOM mutation in `tick`.** ([L160-179](../../src/components/graph/post-graph-mini.tsx#L160-L179)) `querySelectorAll` + `setAttribute` is not the simple React way. The simple version is "let React render `x1/y1/x2/y2` from state on every tick." That's also slow at scale, which is *why* the manual path exists — but the optimization should be commented as such, or the rationale documented in an ADR. Right now it reads as "the developer reached for the DOM for no reason."

3. **`forceCenter` + `forceX`/`forceY`** ([L206-208](../../src/components/graph/post-graph-mini.tsx#L206-L208)) all targeting the same point is two mechanisms for one job. KISS says pick one. (See prior review §6.)

4. **Astro `getScroller()` heuristic** ([L225-230](../../src/pages/posts/%5B...id%5D.astro#L225-L230)) is necessary complexity — it's solving a real cross-platform problem and the comment above it explains why. Good KISS: simple as it can be without being simpler.

---

## YAGNI — **Speculative fields, but contained**

1. `tags?: string[]` is on both `InputNode` and `SimNode` ([L24, L40](../../src/components/graph/post-graph-mini.tsx#L24)) but the only consumer is `primaryTag`. The full tag list is unused inside this component. Either drop it or actually render it in the card (e.g. show secondary tags).

2. `description?: string` and `createdAt?: string` on `SimNode` ([L38-39](../../src/components/graph/post-graph-mini.tsx#L38-L39)) are never read off `simNodes` — only off `rawNodes` via the card. Dead weight inside the simulation model. (Same root cause as ISP above.)

3. The pulse animation on the pinned node ([L300-322](../../src/components/graph/post-graph-mini.tsx#L300-L322)) is gated on `!reducedMotion` — that's not YAGNI, it's correct accessibility behavior. ✓

4. `cardWidth = 240` ([L100](../../src/components/graph/post-graph-mini.tsx#L100)) is hardcoded to match `w-60` in [L354](../../src/components/graph/post-graph-mini.tsx#L354). Two places to update if the card resizes — but it's not speculation, both are needed today. Borderline DRY rather than YAGNI.

Overall the code does not invent flexibility for hypothetical futures. The unused fields are byproducts of a slightly-too-fat type, not premature abstraction. **Mostly good.**

---

## Convention over Configuration — **Strong**

The Astro + Tailwind + React-island stack is convention-heavy and the diff respects every one of them:

- File names are kebab-case, matching the rest of [src/components/](../../src/components/).
- Default export for the React component, named export from helper modules — matches existing convention.
- Astro frontmatter does data fetching; client interactivity goes in `<script>` or a `client:only` island — matches the project's pattern (see [ADR-003](../decisions/ADR-003-graph-view-react-island.md) for the explicit decision).
- Tailwind utility classes are used for all styling; no ad-hoc CSS modules.
- `aria-*` attributes are present where expected.

No CoC violations. ✓

---

## Composition over Inheritance — **Strong**

React functional composition throughout. `MiniPreviewCard` is composed into `PostGraphMini` by element nesting, not subclassed. `forwardRef` is used for ref-forwarding rather than a class component with imperative methods. The d3 force config uses `.force(name, behaviour)` — composition of forces, not extension of a base simulation.

The one missed *opportunity* is composing the simulation behavior out into hooks (per §SRP) — but that's an SRP issue, not a CoI one. There's no inheritance to argue with here. ✓

---

## Law of Demeter — **Adequate, with one notable chain**

LoD asks: don't reach through your collaborators to talk to *their* collaborators.

Mostly fine — the code accesses fields, not nested objects:

- `n.x`, `n.y`, `n.readMinutes` — direct property access on the node you were handed. ✓
- `entry.contentRect.width` ([L145](../../src/components/graph/post-graph-mini.tsx#L145)) — documented `ResizeObserver` API. ✓
- `el.dataset.tocSlug` ([L212](../../src/pages/posts/%5B...id%5D.astro#L212)) — documented DOM API. ✓

The only chain worth flagging:

```ts
post.data.createdAt.toLocaleDateString(...)   // [...id].astro:51
new Date(node.createdAt).toLocaleDateString(...)  // post-graph-mini.tsx:345
```

Both reach through `post.data` / `node` to format a date. That's a textbook LoD signal — and the fix (a `formatPostDate(post)` helper) is the same as the DRY fix in §DRY-2. Two principles, one refactor.

---

## Summary scorecard

| Principle | Verdict | Action item if any |
|---|---|---|
| **SRP** | Weak | Extract `useGraphSimulation`, `useReducedMotion`, `usePreviewCard` hooks |
| **OCP** | Adequate | No change unless a second graph variant appears |
| **LSP** | N/A | — |
| **ISP** | Weak | Slim `SimNode` to geometry-only fields |
| **DIP** | Adequate | No change |
| **DRY** | Mild violations | Extract `formatPostDate`; collapse `SimNode`/`InputNode`; central node-style table |
| **KISS** | Mostly good | Drop unnecessary ref shadowing; comment the manual-DOM-mutation rationale |
| **YAGNI** | Mostly good | Drop unused `tags` / `description` / `createdAt` from `SimNode` (same as ISP) |
| **CoC** | Strong | — |
| **CoI** | Strong | — |
| **LoD** | Adequate | One chain (date access), folded into the `formatPostDate` extraction |

## How to address

The findings cluster into **two high-leverage refactors**, **two localized cleanups**, and **one set of deferred extractions**. Sequence them so each landing has standalone value — none need to ship together.

### 1. Slim `SimNode` to geometry-only fields — *fixes ISP + DRY-1 + YAGNI in one diff*

**Change:**

```ts
type SimNode = SimulationNodeDatum & { id: string; readMinutes: number };
```

Update the simulation effect's projection to copy only what the simulation reads:

```ts
const nodes: SimNode[] = rawNodes.map((n) => ({
  id: n.id,
  readMinutes: n.readMinutes,
}));
```

**Why this is safe:** grep confirms the only `simNode` field reads inside `tick` and `updateCardPosition` are `id`, `x`, `y`, and `readMinutes`. The preview card already looks display fields up via `rawNodes.find(...)`, not `simNodes`.

**Risk:** if an unmerged branch adds a `tick` callback that reads `n.title` or similar, it'll break — but TS catches it at compile time.

**Effort:** ~10 minutes, one file, ~12 lines deleted.

### 2. Extract `formatPostDate(date)` into `src/lib/` — *fixes DRY-2 + the LoD chain*

**New file** `src/lib/format-date.ts`:

```ts
export function formatPostDate(
  date: Date | string | null | undefined,
): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
```

**Call sites:**
- [post-graph-mini.tsx:344-350](../../src/components/graph/post-graph-mini.tsx#L344-L350) → `formatPostDate(node.createdAt)`
- [posts/[...id].astro:51-57](../../src/pages/posts/%5B...id%5D.astro#L51-L57) → `formatPostDate(post.data.createdAt)?.toUpperCase()`

Keep `.toUpperCase()` at the Astro call site — uppercase is presentation, not formatting; baking it into the helper would force every consumer to opt out.

**Effort:** ~15 minutes, two files modified + one created.

### 3. Drop ref-shadowing for `hoveredId` / `pinnedId` — *fixes KISS-1*

`hoveredIdRef` and `pinnedIdRef` ([L73-76](../../src/components/graph/post-graph-mini.tsx#L73-L76)) are only read inside React event handlers, which are re-bound every render — the closures already see the latest state. Delete the refs; replace `pinnedIdRef.current` reads with `pinnedId`, same for hover.

**Keep `cardTargetIdRef`** ([L79-80](../../src/components/graph/post-graph-mini.tsx#L79-L80)) — it's read inside `updateCardPosition`, which is called from the d3 `tick` callback. That callback is captured outside React's render lifecycle, so the ref shadow is load-bearing there.

**Sanity check:** pin a node, then hover a different one — the hover should be ignored while pinned. The behavior is preserved because the handler closure captures the same `pinnedId` value the ref would have held.

**Effort:** ~5 minutes. Bundle this with #2 in a single PR.

### 4. Document the manual-DOM-mutation rationale — *fixes KISS-2*

The `tick` callback at [L160](../../src/components/graph/post-graph-mini.tsx#L160) bypasses React rendering for performance reasons (a 60fps `setState` would re-render the whole tree per tick). That intent is invisible in the code today.

**Two options, pick one:**
- Add a two-line comment above the `tick` callback explaining why React rendering is bypassed.
- Fold the rationale into [ADR-004](../decisions/ADR-004-d3-force-graph-rendering.md), which already documents the rendering-strategy decision for the full-page graph — same decision, two consumers — and add a one-line comment in code pointing to the ADR.

ADR is preferable; the comment-only path is acceptable.

**Effort:** ~10 minutes.

### 5. SRP hook extractions — *defer most; do two if cross-component reuse exists*

| Hook | Extract now? |
|---|---|
| `useReducedMotion()` | **Maybe.** ~10 LOC. Worth doing if [post-graph.tsx](../../src/components/graph/post-graph.tsx) also needs it (likely yes for animation gating). One grep tells you. |
| `useElementSize(ref)` | **Maybe.** ~15 LOC around `ResizeObserver`. Same logic — extract if a second consumer exists. |
| `useGraphSimulation(...)` | **No.** Tightly coupled to the SVG rendering shape. Designing an API for one consumer is wasted work; the full-page graph will need a different shape anyway. |
| `usePreviewCard(...)` | **No.** Card-positioning math is bound to the SVG coordinate system. Wait for a second card. |

This is the YAGNI test in action: extract on the second use, not the first.

**Effort if you do the two `Maybe`s:** ~30 minutes.

---

### Suggested sequencing

| Order | Change | Lands as | Notes |
|---|---|---|---|
| 1 | Slim `SimNode` | Standalone PR | Self-contained, fixes ISP + DRY-1 + YAGNI |
| 2 | Extract `formatPostDate` + drop ref shadows | Single PR | Both small, both KISS/DRY cleanups |
| 3 | Manual-DOM comment / ADR pointer | Squash into next graph-related PR | Pure docs |
| 4 | `useReducedMotion` / `useElementSize` (only if a second consumer needs them) | Cross-component PR | Verify reuse first |
| — | `useGraphSimulation` / `usePreviewCard` | **Skip** | YAGNI |

After steps 1–3, every "Weak" verdict in the scorecard moves to "Adequate" or better, with no residual principle violations. Step 4 is opportunistic; everything below the line is correctly deferred.
