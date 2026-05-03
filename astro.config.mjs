import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { remarkAlert } from "remark-github-blockquote-alert";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import remarkObsidianEmbed from "./src/lib/remark-obsidian-embed.ts";
import remarkObsidianWikilink from "./src/lib/remark-obsidian-wikilink.ts";
import remarkMermaid from "./src/lib/remark-mermaid.ts";

export default defineConfig({
  site: "https://blog.seheon.kr",
  base: "/",
  redirects: {
    "/graph": "/?view=graph",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
  markdown: {
    remarkPlugins: [
      remarkObsidianEmbed,
      remarkObsidianWikilink,
      remarkAlert,
      remarkMermaid,
      remarkMath,
    ],
    rehypePlugins: [rehypeKatex],
  },
});
