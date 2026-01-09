import { defineCollection, z } from "astro:content";

const posts = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishedAt: z
      .string()
      .datetime()
      .or(z.date().transform((date) => date.toISOString())),
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

