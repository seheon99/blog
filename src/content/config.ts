import { defineCollection, z } from "astro:content";
import { gitPostsLoader } from "./loaders/git-posts-loader";

const posts = defineCollection({
  loader: gitPostsLoader({
    baseDir: "src/content/posts",
    ignoreDirs: ["_templates"],
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    updatedAt: z.string().datetime({ offset: true }),
    tags: z.array(z.string()).optional(),
    thumbnail: z
      .object({
        url: z.string().url(),
        alt: z.string().default(""),
        ratio: z.number().positive().optional(),
      })
      .optional(),
  }),
});

export const collections = { posts };
