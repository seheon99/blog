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

This keeps the site lightweight while still supporting rich visualizations.

## Notes

This repository replaces a legacy [blog-nextjs](https://github.com/seheon99/blog-nextjs). The rewrite was intentional to reduce runtime complexity, improve performance and SEO, and adopt a static-first architecture better suited for long-form content
