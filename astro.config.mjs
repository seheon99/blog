import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://blog.seheon.kr",
  base: "/",
  trailingSlash: "always",
  vite: {
    plugins: [tailwindcss()],
  },
});
