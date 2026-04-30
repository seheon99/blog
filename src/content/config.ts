import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({
    pattern: ["**/!(_*)/**/*.md", "!(_*).md"],
    base: "src/content/posts",
  }),
  schema: z
    .object({
      title: z.string(),
      description: z.string(),
      createdAt: z.coerce.date(),
      // Posts authored in Obsidian historically used `topics`; site code
      // standardizes on `tags`. Accept both, normalize via transform below.
      tags: z.array(z.string()).optional(),
      topics: z.array(z.string()).optional(),
      thumbnail: z
        .object({
          url: z.string().url(),
          alt: z.string().default(""),
        })
        .optional(),
    })
    .transform(({ topics, ...rest }) => ({
      ...rest,
      tags: rest.tags ?? topics,
    })),
});

export const collections = { posts };
