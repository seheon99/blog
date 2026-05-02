# blog

Static-first personal blog built with **Astro** and **React Islands**

This project focuses on:
- Markdown-based content workflow
- Minimal JavaScript by default
- Interactive visualizations isolated as client-side islands

The blog is designed to be fast, SEO-friendly, and easy to maintain over the long term.

## Tech Stack

- **Astro**: Static Site Generation (HTML-first)
- **React**: Used selectively via Islands architecture
- **GitHub Actions**: Automated build and deployment

## Architecture Overview

- Blog content is written in **Markdown** and stored in [blog-obsidian-vault](https://github.com/seheon99/blog-obsidian-vault)
- During build time, Astro fetches Markdown content and generates static pages
- Interactive features (like force-directed graphs) are implemented as **React Islands**
- Posts can embed **Mermaid** diagrams via fenced ```` ```mermaid ```` blocks; the runtime is lazy-loaded only on pages that contain a diagram

This keeps the site lightweight while still supporting rich visualizations.

## Development

```sh
pnpm install
pnpm dev        # local dev server on :3000
pnpm lint       # astro check
pnpm test       # vitest run
pnpm coverage   # vitest run --coverage
```

### Tests without the content vault

The post content lives in the private [blog-obsidian-vault](https://github.com/seheon99/blog-obsidian-vault) submodule mounted at `src/content/posts/`. Contributors and CI runs without vault access don't have any posts on disk, which would leave `getCollection("posts")` empty and break every test that renders a page.

To keep the suite self-contained, `tests/global-setup.ts` seeds the markdown files under `tests/fixtures/posts/` into `src/content/posts/` only when that directory has no posts of its own, runs `astro sync` to build the data store, and removes the seeded files on teardown. The fixtures are deliberately minimal — just enough to satisfy the page-rendering tests (one post per primary tag, one post with `h2`/`h3` headings for the TOC tests).

## Notes

This repository replaces a legacy [blog-nextjs](https://github.com/seheon99/blog-nextjs). The rewrite was intentional to reduce runtime complexity, improve performance and SEO, and adopt a static-first architecture better suited for long-form content
