# ADR-001: Wiki vs Article Separation

- **Date:** 2026-05-05
- **Status:** Accepted
- **Repos:** [blog-obsidian-vault](https://github.com/seheon99/blog-obsidian-vault), [blog](https://github.com/seheon99/blog)

## Context

We needed to decide whether to separate content into two Astro collections:

- `wiki`: living reference notes
- `article`: timestamped narrative posts

The distinction is behavioral and editorial:

| Dimension | Wiki | Article |
|---|---|---|
| Purpose | Knowledge accumulation (reference) | Argument/narrative delivery |
| Temporality | Continuously updated | Fixed at publish time |
| Primary reader | Self-included | External audience |
| Typical examples | Tech notes, glossaries | Retrospectives, tutorials, opinions |

## Analysis

### Vault-level observations

From content in `blog-obsidian-vault`, both types already exist under one schema:

- **Wiki-like** notes where `createdAt` has little meaning (for example concept/reference pages).
- **Article-like** posts with a narrative arc where publish date matters.

At the time of analysis, the default article template did not include either `type` or `updatedAt` fields.

### Blog codebase constraints

A two-collection split would require broad rewrites:

1. `remark-obsidian-wikilink.ts` is built around a single posts root and `/posts/...` URLs.
2. `post-graph.ts` expects one flat post array and a single URL namespace.
3. Existing synchronization setup is oriented around a single content source.
4. Cross-linking already exists between article-like and wiki-like pages; splitting collections would complicate wikilink resolution and graph cohesion.

## Decision

Use **one collection** (`posts`) and add a frontmatter discriminator:

- `type: "article" | "wiki"` (default to `wiki`)
- `updatedAt?: Date` (primarily for wiki pages)

Do **not** split into separate Astro collections.

## Implementation summary

### Content schema

In `src/content/config.ts`:

- Add `type: z.enum(["wiki", "article"]).default("wiki")`
- Add `updatedAt: z.coerce.date().optional()`

### Index behavior (`src/pages/index.astro`)

- Build graph from all posts (articles + wikis).
- In **list view**, show only article posts.
- Keep tag filtering behavior.
- Keep graph view inclusive of all post types.

### Post detail behavior (`src/pages/posts/[...id].astro`)

- For wiki posts with `updatedAt`, display an updated date label.
- Otherwise display `createdAt`.

## Consequences

### Positive

- Minimal code change with low migration risk.
- Preserves existing `/posts/...` routes.
- Keeps wikilink resolution and graph connectivity intact.
- Enables UI separation by content intent without structural split.

### Trade-offs

- URL space remains unified (`/posts/...`) instead of `/wiki/...` and `/articles/...`.
- Type-specific behavior now depends on frontmatter correctness.

## Follow-up

1. Ensure source templates include `type` consistently.
2. Add a dedicated wiki template with `updatedAt` guidance.
3. Backfill `type` in existing content where appropriate.
4. Add content-level linting to enforce `type` for new posts.
