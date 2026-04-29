import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { remarkAlert } from "remark-github-blockquote-alert";

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
    remarkPlugins: [remarkAlert],
  },
});
