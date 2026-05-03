# ADR-006: KaTeX math rendering

- Status: Accepted
- Date: 2026-05-03

## Context

Authors want to write inline and block math inside posts using the
dollar-sign LaTeX syntax that Obsidian also uses:

```
The lookup is $O(n)$ in the worst case.

$$
H(p, q) = -\sum_{i} p_i \log q_i
$$
```

The Astro markdown pipeline did not understand this syntax, so `$O(n)$`
rendered as the literal characters `$O(n)$`. Posts are authored in `.md`
(not `.mdx`) inside the `blog-obsidian-vault` git submodule, so JSX
components cannot be embedded inline — the fix has to live in the remark
/ rehype pipeline.

## Decision

Add `remark-math` and `rehype-katex` to `astro.config.mjs`:

- `remark-math` recognizes `$…$` (inline) and `$$…$$` (block) as math
  nodes in the mdast.
- `rehype-katex` renders those nodes to KaTeX HTML at build time, so the
  rendered pages ship as static HTML with no client-side math runtime.

Load `katex/dist/katex.min.css` from the base layout so the rendered HTML
gets the right glyph metrics. Astro/Vite bundles the stylesheet with the
rest of the site CSS — no external CDN dependency.

KaTeX self-hosts its own fonts inside the package; they are emitted to
`/dist/_astro/` along with the rest of the build assets.

## Alternatives considered

- **MathJax via `rehype-mathjax`.** Comparable feature coverage but
  larger payload (the SVG output is heavier than KaTeX's HTML+CSS) and
  slower at build time. KaTeX covers the LaTeX subset this blog needs.
- **Client-side rendering with `katex/contrib/auto-render`.** Would push
  parsing to the browser and add a flash of unrendered `$…$` text on
  first paint. Build-time rendering keeps the page static.
- **Custom remark plugin.** Reimplementing dollar-delimited math parsing
  is unnecessary maintenance — `remark-math` is the canonical plugin in
  the unified ecosystem and is what Obsidian-flavored math expects.
