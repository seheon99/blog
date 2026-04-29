# Blog redesign — progress tracker

Living document for the design handoff at
[`references/design_handoff/`](../references/design_handoff/README.md).
Update this file whenever a phase ships, splits, or changes scope.

## Status legend

- ⬜ Queued
- 🟡 In progress
- ✅ Shipped
- 🚫 Out of scope

## Phases

| # | Phase | Status | PR / Commit | Notes |
|---|---|---|---|---|
| 1 | **Foundation — tokens + fonts** | ✅ | [`a3511b1`](../) | Token system migrated; Pretendard self-hosted under `src/styles/fonts/`; Caveat + JetBrains Mono loaded via `<link>` in `base-layout.astro` for parallel fetch. Brand-blue scale ships as `--brand-*` (Tailwind `bg-brand-600`) to avoid colliding with shadcn's semantic `--accent`. Unused `--chart-*` and `--sidebar-*` tokens dropped. |
| 2 | **Navbar** | ✅ | [`77b3bf0`](../) | Handoff navbar shipped: 68px sticky bar, frosted blur, rotated Caveat `seheon` mark with accent dot, segmented list/graph pill on `/` only. Catalyst `NavbarItem` primitives kept in `src/components/ui/navbar/` for future use elsewhere — this header uses raw markup to avoid fighting their defaults. `about` and `RSS` link to `#` until those routes exist. |
| 3 | **List view** | ✅ | [`1c9c6e5`](../) | `WritingRow` shipped with mono eyebrow + 24px title + 15px excerpt + 6px hover shift; reading-time util handles mixed Korean/English content. Tag chips and filter UI deferred to a later tag-system phase (they're shared with graph view, builds better alongside it). H1 + count subtitle render Korean (`글` / `N개의 글`) — bilingual EN/KO toggle stays out-of-scope. Side cleanups in [`06bb521`](../) (fix toggle click behavior) and dropping the unused `thumbnailRatio` reference from both index pages cleared all pre-existing lint errors on the branch. |
| 4 | **Post detail shell** | ✅ | [`8afe9dd`](../) | Shell shipped: 2px brand reading-progress bar (`top-[68px]` on mobile to clear the sticky nav, `md:top-0` against the wrapper scroll context — `data-scroll-root` added to the layout wrapper so the inline script can find the right scroll source); `lg:grid-cols-[minmax(0,1fr)_280px]` page grid with `MarginRail` rendering three labeled placeholder sections (TOC / Map / Backlinks) for phases 5–6; `PostHeader` extracted with tag pill (links to `/?tag=…`, the future tag-filter route from phase 3 carry-over), 40px display title, and the same mono `DATE · MIN` meta as `WritingRow`; prose clamped to `max-w-[720px]`; `FootNav` replaces the old card-style `PostNavigation` with mono-eyebrow prev/next that picks up the same hover-shift idiom as the writing rows. Old `src/components/islands/post-navigation*.astro` deleted (no other consumers); the `islands/` folder is empty and removed too. |
| 5 | **Graph view** | ⬜ | — | Force simulation per handoff §"Force Simulation Spec" — run synchronously on mount, memoize by nodes/edges. Camera pan + ring-pulse + hover/pinned cards + panel-avoidance zones + tag filter. Astro page + a single inlined module script (no React island), consistent with existing view-switch script. |
| 6 | **Margin rail content** | ⬜ | — | Mini graph in `mode="margin"` (depends on phase 5), scroll-spy TOC, backlinks. Each rail section: 1px left border, mono uppercase label, optional count badge. |
| 7 | **Mobile + polish** | ⬜ | — | `<1080px` collapses post-detail rail below prose; `<720px` collapses graph panels into a scrolling column, hides hover preview cards, hides nav links. Focus-visible states across all interactives. `prefers-reduced-motion` for ring pulse + camera pan. |

## Out of scope (this redesign)

- 🚫 **Tweaks panel** — design tool implementation detail per handoff §6 ("do not ship this in production").
- 🚫 **Bilingual EN/KO toggle** — handoff exposes via Tweaks. Current content is Korean only; no EN copy exists yet. Defer until there's a real settings story and parallel content.

## Open questions

- **Tag → color mapping**: introduce `TAG_COLORS` in phase 1 (foundation) or phase 3 (when list view starts rendering chips)? Phase 3 is more honest — no consumer in phase 1 — but defining the palette upfront avoids a second touch on `global.css`.
- **Tag schema migration**: current post frontmatter has `tags: string[]`. Handoff assumes one *primary* tag per post (used for node color, hero pill). Decide whether to add a `primaryTag` field, or treat `tags[0]` as primary by convention.
- **Graph JS approach** — *resolved*: Astro page + vanilla JS module script, no React island. Mirrors the view-switch pattern shipped in [commit `ea2f68a`](#).
- **Edge derivation**: handoff says edges come from `[[wikilink]]`-style references in post bodies, parsed at build time. We don't currently parse wikilinks. Need a remark plugin or a build-time scanner — file as part of phase 5 prep.

## Decisions log

- [ADR-001](decisions/ADR-001-github-flavored-markdown-alerts.md) — GitHub alert blockquotes via `remark-github-blockquote-alert`.
- [ADR-002](decisions/ADR-002-astro-first-drop-radix.md) — Astro-first; React island and `@radix-ui/*` removed.
- New ADRs for token migration, edge derivation, and graph rendering will be added as phases land.

## Update protocol

When a phase ships:

1. Flip its status to ✅.
2. Link the merged PR (or commit SHA on `main`).
3. Append any concessions or carry-overs under **Notes**.
4. If the phase produced a new architectural decision (a token-system pivot, dropping a feature, choosing one rendering strategy over another), file an ADR and link it from **Decisions log**.

When a phase changes scope mid-flight:

1. Update **Notes** with the new shape.
2. If the change is large enough that the original phase doesn't make sense anymore, split it into two rows rather than rewriting history.
