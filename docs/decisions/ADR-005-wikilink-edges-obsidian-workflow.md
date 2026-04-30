# ADR-005: Graph edges come from `[[wikilinks]]`, mirroring the Obsidian vault

- Status: Accepted
- Date: 2026-04-30

## Context

The graph view ([ADR-003](ADR-003-graph-view-react-island.md),
[ADR-004](ADR-004-d3-force-graph-rendering.md)) needs an edge model.
The original handoff said edges come from `[[wikilink]]`-style
references in post bodies, parsed at build time. Mid-planning we
considered an alternative: deriving edges from *shared tags* across
posts, since 9 posts already share tags but zero wikilinks currently
exist between posts. Shared-tag edges would have made the graph
visibly populated on day one.

This ADR records the decision to ship wikilinks anyway.

## Decision

Edges in the graph view are derived from `[[wikilinks]]` parsed out
of post bodies at build time. Shared-tag edges are out of scope.

Implementation:

- [`src/lib/wikilinks.ts`](../../src/lib/wikilinks.ts) parses
  `[[Target]]`, `[[Target|alias]]`, and `[[Target#heading]]` (the
  fragment is dropped). It explicitly **excludes** `![[image.ext]]`
  (Obsidian image embeds, already used for SVGs in
  `agentic-ai-stack.md`) and content inside fenced code blocks /
  inline backticks (so syntax examples in posts do not become edges).
- [`src/lib/post-graph.ts`](../../src/lib/post-graph.ts) resolves a
  wikilink target by trying the post's `id` first (`[[JavaScript/Symbol]]`
  matches `JavaScript/Symbol`), then by case-insensitive title match.
  Ambiguous titles fall back to the lexicographically first id with
  a `console.warn`. Unresolved targets are dropped silently with a
  warn. Self-links and duplicate edges are deduped.

## Why this is the right call

**The author manages posts in Obsidian.** `[[wikilink]]` is Obsidian's
native cross-note syntax. Every link the author types while drafting
in Obsidian is automatically a graph edge in the published site, with
zero extra metadata to maintain and zero risk of drift between the
editing tool's graph view and the published one. The blog's graph
becomes a published mirror of the vault graph. This is the strongest
possible alignment between authoring tool and presentation — the
author edits in their preferred environment and gets the published
graph "for free."

By contrast, **shared-tag edges** would conflate two different
concepts. Tags are already used for chips on the list rows and for
the primary-tag pill on the post detail header (and will drive node
or edge color in future polish phases). Reusing them as a second
edge signal dilutes their meaning — a shared `JavaScript` tag is
"these posts are about the same broad topic," not "the author
considers these posts related." The graph should reserve itself for
the latter.

## Tradeoffs accepted

- **The graph initially renders 9 isolated nodes.** Today no
  post-to-post wikilinks exist. The empty-state hint in the
  component handles this in-product ("no links yet — add `[[wikilinks]]`
  between posts to connect them"). The graph becomes meaningful
  as posts evolve. This is a one-time, transient cost.
- **Authoring discipline matters.** If the author stops writing
  wikilinks, the graph stops getting denser. This is a feature, not
  a bug — the graph reflects the author's actual reference behaviour.

## Alternatives considered

- **Shared-tag edges.** Visible today, but author cannot control them
  from inside Obsidian, and tags would carry double semantics. Not
  ruled out forever — could land later as a *second* edge type,
  styled distinctly from wikilink edges, if proven useful.
- **Both edge types simultaneously, styled differently.** Possible
  later. Costs styling logic and a second resolution path now for
  value that arrives only once wikilinks exist, at which point the
  shared-tag edges add visual noise.
- **A frontmatter `related: [...]` field.** Explicit, but redundant
  the moment wikilinks are parsed, and divergent from Obsidian's
  conventions — every related-link write would happen in the
  frontmatter instead of where the author naturally references the
  other post mid-prose.
- **Defer the graph until wikilinks exist.** Considered, rejected:
  shipping the infrastructure with a graceful empty state lets the
  graph come to life as posts evolve, instead of requiring a
  synchronised content + code rollout.

## Implementation notes

- Wikilink resolution is **build-time** (Astro SSR for the home
  page). The graph data is fully computed before the React island
  hydrates. No runtime markdown parsing in the browser.
- The parser is regex-based, not AST-based. This is appropriate for
  the scope: we need to identify wikilink references, not transform
  the markdown. A future remark plugin could promote the same
  wikilinks to inline prose links, unifying the author experience
  further — that is a separate concern and out of scope here.
- Image embed exclusion (`![[file.ext]]`) is handled by a negative
  lookbehind in the regex. JS lookbehind is ES2018, supported
  everywhere this project runs.

## Consequences

Positive:

- The blog graph reflects author intent, not statistical inference.
- Authoring stays in Obsidian; no new "edit graph" workflow.
- A future remark plugin can reuse the same parser to render
  wikilinks as inline prose links, completing the round-trip.

Trade-offs:

- The graph is empty on day one. Mitigated by the in-product
  empty-state hint.
- The parser must keep pace with Obsidian's wikilink syntax if it
  evolves. Today's surface (`[[Target]]`, `[[Target|alias]]`,
  `[[Target#heading]]`, `![[embed]]`) is stable.

## Verification

- [tests/wikilinks.test.ts](../../tests/wikilinks.test.ts) covers
  basic, aliased, fragmented, image-embed, code-block, and
  multi-link cases.
- [tests/post-graph.test.ts](../../tests/post-graph.test.ts) covers
  empty input, title and id resolution, self-link / duplicate /
  unresolved drop, lexicographic ordering, and ambiguous-title
  warning.
- Manual smoke: `pnpm dev`, open `/?view=graph`, verify the empty
  state appears. Add a temporary `[[JS Iteration]]` to
  `src/content/posts/JavaScript/Symbol.md`, reload, verify the
  edge appears between the two JS posts. Revert the test edit.
