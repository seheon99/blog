# ADR-001: GitHub-flavored Markdown alerts

- Status: Accepted
- Date: 2026-04-27

## Context

Authors want to use GitHub's alert syntax inside posts:

```
> [!NOTE]
> ...

> [!TIP]
> ...

> [!IMPORTANT]
> ...

> [!WARNING]
> ...

> [!CAUTION]
> ...
```

The Astro markdown pipeline previously used defaults (`remark-parse`,
`remark-gfm`, `remark-rehype`, `remark-smartypants`) with no custom plugins, so
this syntax rendered as a plain blockquote with `[!TYPE]` shown as literal
text. Posts are authored in `.md` (not `.mdx`) and sourced from the
`blog-obsidian-vault` git submodule, so JSX/Astro components cannot be used
inline.

## Decision

Add `remark-github-blockquote-alert` to `astro.config.mjs` under
`markdown.remarkPlugins`. Style the generated `.markdown-alert*` classes in
`src/styles/global.css` using Tailwind utilities via `@apply`, leveraging the
existing `.dark` variant for theme support.

## Alternatives considered

- **`remark-directive` + custom handler.** More flexible, but introduces a
  custom syntax (`:::note`) that does not match what authors paste from
  GitHub. We do not need other directive types right now.
- **Custom remark plugin.** Reimplementing what `remark-github-blockquote-alert`
  already does is unnecessary maintenance.
- **Migrate posts to `.mdx`.** Would let us write `<Alert />` JSX, but breaks
  the obsidian-vault authoring flow (the submodule is plain markdown) and is
  a much larger change.

## Consequences

Positive:

- Authors can paste GitHub alert syntax directly into posts.
- No change to the obsidian-vault authoring flow.
- All styling lives in Tailwind tokens, so the design system stays consistent
  and dark mode works automatically through the existing `.dark` variant.

Trade-offs:

- One additional remark plugin in the build pipeline (negligible perf impact).
- The CSS class names (`.markdown-alert*`) are dictated by the plugin and not
  prefixed under our design system; if we ever swap plugins we need to keep
  the class names compatible or update the stylesheet.

## Verification

`pnpm test` runs `tests/remark-alert.test.ts`, which asserts the plugin emits
`.markdown-alert-{note,tip,important,warning,caution}` for the five alert
types and leaves plain blockquotes untouched. Visual verification is via
`pnpm dev` against a fixture post.
