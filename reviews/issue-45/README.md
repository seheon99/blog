# Issue #45 — warm reading palette

The selected page background is candidate B, `#FAF8F3`. It gives MaruBuri a subtle paper tone while keeping the indigo accents. This is a visual design choice, not a claim that serif fonts require a particular background or that white is inaccessible.

## Background comparison

These captures isolate the background change on the original foreground/surface tokens. All three use the same content, 1440×1000 viewport and MaruBuri font weights. The final captures below include the contrast fixes.

| Page | Original white `#FFFFFF` | A `#FCFAF7` | B `#FAF8F3` |
| --- | --- | --- | --- |
| List | ![White list](list-white.png) | ![Candidate A list](list-a.png) | ![Candidate B list](list-b.png) |
| Article | ![White article](post-white.png) | ![Candidate A article](post-a.png) | ![Candidate B article](post-b.png) |

The original secondary text (`oklch(0.556 0 0)`) has approximately 4.73:1, 4.54:1 and 4.46:1 contrast on white, A and B respectively. B therefore needs darker secondary text; it cannot be adopted by changing the background alone.

## Final tokens and component behavior

| Role | Light palette |
| --- | --- |
| Page, card, popover (`bg-1`) | `#FAF8F3` |
| Recessed surface, image placeholder, mini graph (`bg-2`) | `#F4F1EA` |
| Secondary, muted, accent/hover (`bg-3`) | `#EEEBE4` |
| Secondary text (`fg-3`, `fg-4`) | `#64615B` |
| Decorative borders | `#D8D3C8` |
| Input boundary | `#827C70` |
| Card focus ring | `fg-3` |

Primary/body text keeps the existing neutral tokens. Dark reading surfaces and foreground tokens keep their separate neutral palette. Link text and hover states now use the existing theme-aware `link`/`link-hover` aliases throughout the list, Featured Panel, footer navigation and graph previews. Colored metadata uses readable foreground tokens rather than graph node hues.

Filled tag labels retain a light foreground in both themes, with each tag color mixed with 20% black in OKLab. This avoids the former dark-mode use of a dark page color as the label. The teal graph color changes to `oklch(0.56 0.12 195)` so its fill exceeds 3:1 on both graph surfaces in both themes. Tag hashing and all other palette entries are preserved.

Cards use semantic borders and hover surfaces rather than fixed white highlights. The card image placeholder follows `bg-2`. Backlink counts no longer attenuate secondary text with opacity.

## Contrast and interaction checks

WCAG contrast was calculated from Chromium's sRGB canvas conversion of computed CSS colors, including transparent background composition. The regression tests independently check CSS tokens and graph colors using sRGB luminance and OKLCH conversion.

| Foreground / indicator | Light minimum across `bg-1`/`bg-2`/`bg-3` | Dark minimum across the same surfaces | Requirement |
| --- | ---: | ---: | ---: |
| Primary text (`fg-1`) | 16.63:1 | 16.50:1 | 4.5:1 |
| Body/secondary text (`fg-2`) | 8.71:1 | 11.62:1 | 4.5:1 |
| Muted text (`fg-3`) | 5.18:1 | 6.67:1 | 4.5:1; test target 5:1 |
| Link | 4.75:1 | 8.63:1 | 4.5:1 |
| Link hover | 6.41:1 | 11.09:1 | 4.5:1 |
| Brand keyboard outline | 3.55:1 | 4.07:1 | 3:1 |
| Card keyboard ring | 5.18:1 | 3.63:1 | 3:1 |

Checks cover list, article, card grid and graph at 1440px and 390px, in light and dark mode. MaruBuri files were fetched from the configured font URLs and served to the browser locally with their corresponding weights. Unrelated Google display/mono font requests were blocked; those fonts used their existing fallbacks.

Keyboard focus was checked with Tab and `:focus-visible`. Cards retain a 2px ring with a 2px page-colored offset; ordinary links retain the 2px brand outline. Hover states and pinned graph preview links were exercised in both themes. All eight tag badge and graph node colors were measured separately. The minimum badge text ratio is 5.80:1; graph fills reach at least 3.20:1 in light mode and 3.51:1 in dark mode. Decorative dividers, graph grids and edges do not carry the text/nontext contrast claim. Dark input borders remain the existing translucent token; there are no form inputs in these inspected pages.

| Final view | Light | Dark |
| --- | --- | --- |
| Article, desktop | ![Light article](post-light-1440.png) | ![Dark article](post-dark-1440.png) |
| Article, mobile | ![Light mobile article](post-light-390.png) | ![Dark mobile article](post-dark-390.png) |
| Graph and Featured Panel | ![Light graph](graph-light-1440.png) | ![Dark graph](graph-dark-1440.png) |
| Card grid | ![Light cards](cards-light-1440.png) | ![Dark cards](cards-dark-1440.png) |
| Card keyboard focus | ![Light focus](focus-light-cards.png) | ![Dark focus](focus-dark-cards.png) |
| Pinned graph preview | ![Light pinned graph](graph-pinned-light.png) | ![Dark pinned graph](graph-pinned-dark.png) |
| Article code, mobile | ![Light mobile code](post-code-light-390.png) | ![Dark mobile code](post-code-dark-390.png) |

The warm surface maintains the article/list hierarchy and reduces the visual difference between page and UI surfaces. Cards, code blocks and graph labels remain distinct. This is a visual inspection, not a reader study proving reduced eye strain.

## Verification and existing limitations

Commands use `ASTRO_TELEMETRY_DISABLED=1` because the execution environment does not expose Astro's default user configuration directory.

- `npm run lint`: no diagnostics.
- `npm run build`: production build succeeds.
- `npm test`: 179 pass, 15 fail; all 15 failures also occurred before production changes. The six new palette tests pass, including two text/focus checks and the teal graph check observed failing before their fixes.
- Browser text audit: no detected text contrast failures in the sixteen inspected page/theme/viewport combinations. See `browser-contrast.json`; color checks alone are not a complete WCAG audit.
- All graph fills exceed 3:1 on both graph backgrounds in both themes, and all filled tag labels exceed 4.5:1. See `graph-colors.json`.
- Mobile article overflow is preexisting: a 390px viewport has a 486px document width with both original and proposed tokens, caused by an unbroken reference URL. The palette change does not increase it.

The preexisting failures are in header expectations, default home-view expectations, navigation typography and wikilink fixtures. Their exact names are recorded below rather than changing unrelated behavior to make this styling change's suite green.

- `tests/header.test.ts > Header — brand mark > includes the absolutely-positioned brand-blue accent dot`
- `tests/header.test.ts > Header — brand mark > renders the rotated 'seheon' wordmark linked to /`
- `tests/header.test.ts > Header — center nav links > includes writing / about / RSS`
- `tests/header.test.ts > Header — sticky chrome > renders a sticky <nav> with backdrop blur and a bottom border`
- `tests/header.test.ts > Header — view toggle > on the home page > highlights 'list' as active by default`
- `tests/header.test.ts > Header — view toggle > treats unknown view values as the default (list)`
- `tests/index-graph-pane.test.ts > home page — graph pane > hides the graph pane and shows the list pane by default`
- `tests/post-foot-nav.test.ts > PostFootNav > uses mono '← previous' and 'next →' eyebrows`
- `tests/remark-obsidian-wikilink.test.ts > remark-obsidian-wikilink > appends a slugified anchor for [[target#heading]]`
- `tests/remark-obsidian-wikilink.test.ts > remark-obsidian-wikilink > emits the wikilink class on the rendered <a>`
- `tests/remark-obsidian-wikilink.test.ts > remark-obsidian-wikilink > renders the alias text when [[target|alias]] is used`
- `tests/remark-obsidian-wikilink.test.ts > remark-obsidian-wikilink > resolves a [[Title]] by case-insensitive frontmatter title match`
- `tests/remark-obsidian-wikilink.test.ts > remark-obsidian-wikilink > resolves a bare [[id]] to /posts/id by filename`
- `tests/remark-obsidian-wikilink.test.ts > remark-obsidian-wikilink > rewrites multiple links in one paragraph and preserves surrounding text`
- `tests/tag-pill.test.ts > TagPill > uses mono uppercase typography`
