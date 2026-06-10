# ADR-001: Content type separation

- **Date:** 2026-05-05
- **Status:** Accepted
- **Repos:** [blog-obsidian-vault](https://github.com/seheon99/blog-obsidian-vault), [blog](https://github.com/seheon99/blog)

## Context

We needed to decide whether to separate content into multiple Astro
collections:

- `note`: living reference notes
- `write-up`: timestamped narrative posts
- `til`: short Today-I-Learned entries

The distinction is behavioral and editorial:

| Dimension | Note | Write-up | TIL |
|---|---|---|---|
| Purpose | Knowledge accumulation | Argument/narrative delivery | Short learning log |
| Temporality | Continuously updated | Fixed at publish time | Fixed at capture time |
| Primary reader | Self-included | External audience | Self-included, sometimes external |
| Typical examples | Tech notes, glossaries | Retrospectives, tutorials, opinions | Daily implementation notes |

## Analysis

### Vault-level observations

`blog-obsidian-vault` is the source of truth for content shape. From that
content, the current published type values are:

- **Note-like** entries where `createdAt` has little meaning (for example concept/reference pages).
- **Write-up** posts with a narrative arc where publish date matters.
- **TIL** entries for shorter learning logs.

Entries without an explicit type are treated as notes.

### Blog codebase constraints

A two-collection split would require broad rewrites:

1. `remark-obsidian-wikilink.ts` is built around a single posts root and `/posts/...` URLs.
2. `post-graph.ts` expects one flat post array and a single URL namespace.
3. Existing synchronization setup is oriented around a single content source.
4. Cross-linking already exists between content types; splitting collections would complicate wikilink resolution and graph cohesion.

## Decision

Use **one collection** (`posts`) and add a frontmatter discriminator:

- `type: "note" | "write-up" | "til"` (default to `note`)
- `updatedAt?: Date` (primarily for note pages)

Do **not** split into separate Astro collections.

## Implementation summary

### Content schema

In `src/content/config.ts`:

- Add `type: z.enum(["note", "write-up", "til"]).default("note")`
- Add `updatedAt: z.coerce.date().optional()`
- Accept blank `title`, `description`, `topics`, and `createdAt` fields from
  vault-authored templates or lightweight entries.

### Index behavior (`src/pages/index.astro`)

- Build graph from all posts.
- In **list view**, show `write-up` and `til` posts.
- Keep tag filtering behavior.
- Keep graph view inclusive of all post types.

### Post detail behavior (`src/pages/posts/[...id].astro`)

- For note posts with `updatedAt`, display an updated date label.
- Otherwise display `createdAt`.

## Consequences

### Positive

- Minimal code change with low migration risk.
- Preserves existing `/posts/...` routes.
- Keeps wikilink resolution and graph connectivity intact.
- Enables UI separation by content intent without structural split.

### Trade-offs

- URL space remains unified (`/posts/...`) instead of type-specific route roots.
- Type-specific behavior now depends on frontmatter correctness.

## Follow-up

1. Ensure source templates include `type` consistently.
2. Add a dedicated note template with `updatedAt` guidance.
3. Backfill `type` in existing content where appropriate.
4. Add content-level linting to enforce `type` for new posts.
