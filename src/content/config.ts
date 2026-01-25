import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({
    pattern: "**/[^_]*.md",
    base: "src/content/posts",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    createdAt: z.string().datetime({ offset: true }),
    tags: z.array(z.string()).optional(),
    thumbnail: z
      .object({
        url: z.string().url(),
        alt: z.string().default(""),
      })
      .optional(),
  }),
});

export const collections = { posts };
