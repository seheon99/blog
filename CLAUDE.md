# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (`packageManager: pnpm@10.28.1`). Use `pnpm`, not `npm`.

```sh
pnpm install
pnpm dev          # astro dev on 0.0.0.0:3000
pnpm build        # astro build → ./dist
pnpm preview      # serve ./dist
pnpm lint         # astro check (TS + .astro diagnostics)
pnpm test         # vitest run
pnpm coverage     # vitest run --coverage

# Single test file / pattern
pnpm vitest run tests/post-graph.test.ts
pnpm vitest run -t "resolves wikilink by title"

# Benchmarks (e.g. tests/post-graph.bench.ts)
pnpm vitest bench
```

`pnpm install` only builds `sharp` from source; other postinstall scripts are blocked via `pnpm.onlyBuiltDependencies`.

## Repository layout

- `src/pages/` — Astro routes. `index.astro` renders both list and graph panes (toggled by `?view=`); `posts/[...id].astro` is the post detail.
- `src/layouts/base-layout.astro` — single layout. Wraps content in `<div data-scroll-root>` which is the desktop scroll container (mobile falls back to body scroll). Code that listens to scroll must respect this — see `setupTocScrollSpy` and the `getScroller()` helper in `posts/[...id].astro`.
- `src/components/{ui,post,graph}/` — `ui/` is generic chrome (header, card, divider, tag chips), `post/` is post-detail/list pieces, `graph/` is the two React islands.
- `src/lib/` — pure modules. Keep these framework-agnostic so they can be unit-tested under Vitest's `happy-dom` env without an Astro runtime.
- `src/content/posts/` — **git submodule** pointing at the private [`blog-obsidian-vault`](https://github.com/seheon99/blog-obsidian-vault). May not be checked out locally or in CI.
- `src/content/config.ts` — Astro content collection schema for posts.
- `tests/` — Vitest. Each test file renders Astro components via the container API (`experimental_AstroContainer`).
- `docs/decisions/ADR-*.md` — architectural decisions; read these before changing the rendering posture, the graph implementation, or the wikilink edge model.
- `docs/v2-redesign-progress.md` — phase-by-phase status of the design v2 rollout.

Path alias: `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`).

## Architecture

### Astro-first; React islands need a load-bearing reason

[ADR-002](docs/decisions/ADR-002-astro-first-drop-radix.md) made Astro-first the default and removed the radix dependency tree. The bar going forward: **React islands need an explicit, load-bearing reason** (lifecycle ownership, imperative DOM updates, per-element handlers, cross-page reuse). "We have a UI primitive" is not enough. Today only two islands exist: `PostGraph` and `PostGraphMini`, both justified by [ADR-003](docs/decisions/ADR-003-graph-view-react-island.md). The list/graph view switch on `/` deliberately ships both panes server-rendered and flips `[hidden]` via an inline `<script>` that calls `history.pushState` — do not replace it with a router or an island.

Both islands mount via `client:only="react"` (no SSR) — the graph is meaningless without JS, so there is no hydration-shim flash to worry about.

### Content pipeline

Posts are Markdown in the `src/content/posts` submodule. The content collection (`src/content/config.ts`) accepts either `tags` or `topics` in frontmatter and normalizes to `tags` via `.transform()` — Obsidian historically used `topics`. `tags[0]` is the **primary tag** by convention (drives the pill color, list eyebrow, graph node color).

Three custom remark plugins run at build time (wired in `astro.config.mjs`):

- `src/lib/remark-obsidian-embed.ts` — converts Obsidian image embeds (`![[file.png|alt|320x240]]`) into mdast `image` nodes pointing at `src/content/posts/_resources/`. Non-image embeds are left as text.
- `src/lib/remark-obsidian-wikilink.ts` — converts Obsidian `[[wikilink]]` references (with optional `|alias` and `#heading`) into `<a class="wikilink" href="/posts/{id}">` nodes. Resolves by post id first, then by case-insensitive frontmatter title; unresolved targets are left as raw `[[text]]` with a `console.warn`. Mirrors `buildPostGraph`'s exclusions: `![[…]]` embeds and content inside fenced/inline code do not become links. See [ADR-005](docs/decisions/ADR-005-wikilink-edges-obsidian-workflow.md).
- `remark-github-blockquote-alert` — GitHub-flavored alert blockquotes ([ADR-001](docs/decisions/ADR-001-github-flavored-markdown-alerts.md)).

### Post graph (build-time derived)

`src/lib/wikilinks.ts` + `src/lib/post-graph.ts` build the graph from `[[wikilink]]` references in post bodies (see [ADR-005](docs/decisions/ADR-005-wikilink-edges-obsidian-workflow.md)). Run on every page render that calls `buildPostGraph(allPosts)`:

- Wikilinks inside fenced code blocks and inline backticks are ignored.
- `![[image]]` embeds are explicitly excluded (they are images, not edges).
- Targets resolve by post `id` first, then by case-insensitive title; ambiguous titles pick the lexicographically first match with a `console.warn`.
- Unresolved targets are dropped with a `console.warn` from `buildPostGraph` — these warnings appear in `pnpm build` output and are expected when the vault references a draft.
- `getBacklinks(posts, targetId)` reuses the same resolver and powers the post-detail backlinks rail.

`src/components/graph/post-graph.tsx` and `post-graph-mini.tsx` are the two consumers. Both use `d3-force` ([ADR-004](docs/decisions/ADR-004-d3-force-graph-rendering.md)) and **mutate SVG element attributes directly** in the tick handler via `runTick` in `src/lib/post-graph-tick.ts` — do not route per-tick updates through React state, that path is intentional for frame budget.

### Styling

Tailwind v4 (`@tailwindcss/vite`) with the typography plugin. Global styles in `src/styles/global.css` define brand tokens (`--brand-*`), foreground/background scales (`--fg-*`, `--bg-*`), and self-host Pretendard from `src/styles/fonts/`. Caveat + JetBrains Mono are loaded via `<link>` in `base-layout.astro` for parallel fetch.

- `src/lib/utils.ts` — `cn()` is `twMerge(clsx(...))`.
- `src/lib/prose.ts` — `proseClasses` is the canonical set of `prose-*` classes for rendered Markdown bodies; reuse it instead of redefining typography.
- `src/lib/tag-colors.ts` — `tagColor(tag)` deterministically maps a tag string to one of 8 oklch hues by hashing. Used by graph nodes, tag pills, tag chips, and the featured-panel mention. Do not introduce a parallel mapping.

`components.json` is shadcn's manifest (`new-york` style, `slate` base, `cssVariables: true`). Aliases: `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Icons come from `@lucide/astro` (Astro components), not `lucide-react`.

Canonical class-merge + tag-color usage:

```tsx
import { cn } from "@/lib/utils";
import { tagColor } from "@/lib/tag-colors";

<span
  class={cn("rounded-full px-2 py-1 text-xs", isActive && "ring-2")}
  style={{ color: tagColor(primaryTag) }}
/>
```

## Testing

Vitest uses `astro/config` `getViteConfig` so Astro components can be rendered via the container API. Two non-default settings matter:

- `fileParallelism: false` — needed because tests share the on-disk `.astro/data-store.json` produced by `astro sync`.
- `globalSetup: ./tests/global-setup.ts` — when `src/content/posts/` is empty (no submodule), copies `tests/fixtures/posts/*.md` into it and runs `npx astro sync` to populate the data store. The seeded files and the synced store are removed on teardown. The fixtures are deliberately minimal — one post per primary tag plus one with `h2`/`h3` headings for TOC tests.

When adding a test that depends on specific frontmatter (a tag, a thumbnail, a `wikilink`), prefer adding a small fixture under `tests/fixtures/posts/` over relying on real vault content, so contributors without submodule access can run the suite.

Component tests render with `experimental_AstroContainer` and assert on the resulting HTML string. React-island tests render the `.tsx` directly and rely on `happy-dom`.

## Conventions

### Commits

Conventional Commits are **required** (see `AGENTS.md`):

```
<type>(scope): <subject>

<body>
```

- `<type>` ∈ `feat | fix | refactor | perf | test | docs | chore | cicd`.
- `<subject>` ≤ 50 chars, imperative, no trailing period.
- One commit = one logical change. Body explains *why*, not what.

### PRs

One PR = one logical goal. Every PR must state *why* the change exists; reviewers must understand intent without opening code. Avoid pasting commit logs and avoid vague labels like "refactor" or "cleanup" without context.

### ADRs

When a change pivots architecture (rendering posture, a new dependency category, swapping the graph engine, changing the edge model), add a numbered ADR under `docs/decisions/` and link it from the relevant phase row in `docs/v2-redesign-progress.md`. Existing ADRs explain *why* the current shape is what it is — read them before proposing a structural change.

## Deployment

- `Dockerfile` — multi-stage build, `pnpm build` then nginx serving `/dist`.
- `.github/workflows/releaser.yml` — on push to `main` or `v*.*.*` tag, builds and deploys via `seheon99/build-and-deploy@v1`. PRs run with `dry-run: true`.
- `.github/workflows/synchronizer.yml` — listens for `repository_dispatch` `content_updated` from the vault repo, updates the submodule, validates the build, and fast-forwards `main`.

## Boundaries

- **Don't author or commit post markdown from this repo.** `src/content/posts/` is owned by the `blog-obsidian-vault` submodule; the `synchronizer.yml` workflow is the only writer. New fixtures for tests go under `tests/fixtures/posts/`, not into the submodule.
- **Don't push to `automation/content-sync`.** That branch is force-pushed by the synchronizer workflow on every vault update.
- **Don't relax `pnpm.onlyBuiltDependencies`.** Postinstall scripts are blocked by design; only `sharp` is whitelisted. Adding a dep that requires postinstall needs an explicit decision.
- **Don't enable `fileParallelism` in vitest.** Tests share `.astro/data-store.json`; parallel files race the seeder in `tests/global-setup.ts`.
- **Don't add a React island without an ADR.** ADR-002's bar (lifecycle, imperative DOM, per-element handlers, cross-page reuse) must be cleared and recorded.
