# ADR-002: Drop `@radix-ui/*` and go Astro-first

- Status: Accepted
- Date: 2026-04-30

## Context

The blog is an Astro site, but the chrome was built around a single React
island, `src/components/islands/header-island.tsx`. The island used
`useEffect` + `location.pathname` to decide whether to show a "switch to
list" or "switch to graph" toggle. Around it sat four shadcn-style
primitives — `avatar.tsx`, `button.tsx`, `tooltip.tsx`, `spinner.tsx` —
each wrapping `@radix-ui/react-avatar`, `@radix-ui/react-slot`, or
`@radix-ui/react-tooltip`. None of these primitives were used anywhere
else: `header-island` was their only consumer.

This created an awkward shape: the entire React + radix toolchain
(`@astrojs/react`, `react`, `react-dom`, three radix packages,
`lucide-react`, `class-variance-authority`) shipped purely to power one
component whose only dynamic input — the current pathname — Astro
already resolves at SSR via `Astro.url.pathname`. The resulting build
emitted an `astro-island` element on every page that hydrated to
re-derive a value the server already knew, with a brief spinner state
solely as a hydration shim.

We also wanted a richer header (Catalyst-style navbar with brand,
nav links, and the view toggle) and a no-reload list/graph switch.
Both can be done in pure Astro: the navbar is static markup; the view
toggle can render both panes server-side and flip `hidden` via a tiny
inline script.

## Decision

Adopt **Astro-first** as the default rendering posture for the chrome
and eliminate the entire `@radix-ui/*` surface area.

Concretely:

- Replace `header-island.tsx` with `src/components/ui/header.astro`,
  computing the current view from `Astro.url.pathname` /
  `Astro.url.searchParams` at SSR.
- Port Tailwind Catalyst's `Navbar` family to pure-Astro components in
  `src/components/ui/navbar/` (six files, one per Catalyst export).
- Delete `avatar.tsx`, `button.tsx`, `tooltip.tsx`, `spinner.tsx`, and
  `header-island.tsx` — all orphans once the header is rewritten.
- Remove `@radix-ui/react-avatar`, `@radix-ui/react-slot`,
  `@radix-ui/react-tooltip`, `lucide-react`, and
  `class-variance-authority` from `package.json`. Icons in the new
  header come from `@lucide/astro`, which was already installed.
- For the list/graph view switch, render both panes on `/` and flip
  `[hidden]` via a small inlined module script that uses
  `history.pushState` to keep `?view=` in sync. The old `/graph` route
  becomes a redirect to `/?view=graph`.

For *static* UI we ship zero JS. For *interactive* UI we reach for the
smallest mechanism that fits — an inline script over a hydrated
component. React/radix are not banned, but they need a load-bearing
reason; "we have a UI primitive" is not enough.

## Alternatives considered

- **Keep React + radix; rewrite the components locally without radix.**
  Removes the radix packages but still ships the React runtime for a
  single non-interactive header. Same hydration shim, smaller
  dependency win.
- **Replace radix with `@headlessui/react` or another React component
  library.** Trades one React component library for another; the
  underlying problem (React runtime for a server-renderable view) is
  unchanged.
- **Keep radix only for the tooltip.** The only tooltip in the app was
  the `defaultOpen` hint on the view-toggle button — essentially a
  permanent label. Replaceable with a native `title=""` (or just
  removed, given the icon is self-explanatory) at zero cost.
- **Use Astro's `<ClientRouter />` for the view switch instead of
  `pushState` + `hidden`.** Smoother transitions, but still goes over
  the network on each switch and bundles ~10 KB of router JS. The
  current data is cheap enough to ship both panes server-side; the
  no-network path is faster and simpler.

## Consequences

Positive:

- The built HTML contains zero `astro-island` markers — verified via
  `grep` on `dist/`. Static pages truly ship zero JS.
- Dependency graph shrinks by three radix packages, `lucide-react`,
  and `class-variance-authority`. The `node_modules` tree is smaller
  and the lockfile cleaner.
- The header's view-state is computed at SSR, so there is no flash
  while a hydration boundary catches up. The spinner-while-undefined
  state is gone.
- The list ↔ graph switch is instant (no fetch) and the URL stays
  shareable.
- The view layer has one paradigm. Future contributors do not have
  to choose between "is this an island or an Astro component."

Trade-offs:

- The Catalyst navbar's animated current-indicator (`motion.span` +
  `LayoutGroup`) is dropped. The indicator now toggles via a CSS
  opacity transition keyed off `[data-current="true"]`. This is a
  fade rather than a morph; for full-page navigations it's
  imperceptible, and for the SPA-like view switch it still feels
  smooth.
- Radix's `<Avatar>` showed a text fallback only when the image
  failed to load. The inlined `<img>` shows the browser's broken-image
  state plus the alt text instead. Acceptable for a single, stable
  GitHub avatar URL.
- `@astrojs/react`, `react`, `react-dom`, and `@types/react*` remain
  in `package.json`. They have no consumer today, but removing the
  React integration is a separate, larger change (it touches
  `astro.config.mjs` and would require re-adding it for any future
  React island). Captured as a follow-up; not done in this ADR's scope.
- Adding a new client-side feature now starts from "do I need JS at
  all?" rather than "which React component lib?". Most of the time
  this is the right default; occasionally it requires writing a few
  lines of vanilla JS instead of reaching for a prebuilt component.

## Verification

- `pnpm build` completes cleanly. `grep -r 'astro-island' dist/`
  returns nothing.
- `pnpm test` passes (`tests/utils.test.ts`,
  `tests/remark-alert.test.ts`). The deleted
  `tests/header-island.test.tsx` was removed deliberately — it tested
  React state plumbing around `normalizePath`, which is now exercised
  by `tests/utils.test.ts` and consumed directly by `header.astro`.
- `pnpm lint` (astro check) — net errors decreased from 8 to 2. The
  remaining two (`Property 'ratio' does not exist on type` in
  `src/pages/index.astro` and `src/pages/posts/index.astro`) are
  pre-existing and unrelated.
- Manual smoke test on `pnpm dev`: `/`, `/?view=list`, `/?view=graph`
  render the correct pane; clicking list/graph swaps without a
  network request (verified in DevTools); `/graph` redirects to
  `/?view=graph`.
