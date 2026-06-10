import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

import { DEFAULT_POST_TYPE, POST_TYPES } from "../lib/post-type";

const posts = defineCollection({
  loader: glob({
    pattern: ["**/!(_*)/**/*.md", "!(_*).md"],
    base: "src/content/posts",
  }),
  schema: z
    .object({
      title: z.string().nullish().transform((title) => title ?? ""),
      description: z
        .string()
        .nullish()
        .transform((description) => description ?? ""),
      type: z.enum(POST_TYPES).default(DEFAULT_POST_TYPE),
      createdAt: z
        .preprocess((value) => value ?? undefined, z.coerce.date().optional())
        .transform((date) => date ?? new Date(0)),
      updatedAt: z.coerce.date().optional(),
      // Posts authored in Obsidian historically used `topics`; site code
      // standardizes on `tags`. Accept both, normalize via transform below.
      tags: z.array(z.string()).nullish(),
      topics: z.array(z.string()).nullish(),
      thumbnail: z
        .object({
          url: z.string().url(),
          alt: z.string().default(""),
        })
        .optional(),
    })
    .transform(({ topics, ...rest }) => ({
      ...rest,
      tags: rest.tags ?? topics ?? [],
    })),
});

export const collections = { posts };
