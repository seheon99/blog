import { cn } from "@/lib/utils";

export const proseClasses = cn(
  // Base
  "prose prose-neutral dark:prose-invert max-w-none",

  // Body text
  "prose-p:text-base md:prose-p:text-[1.0625rem]",
  "prose-p:leading-7 md:prose-p:leading-8",

  // Lead / emphasis
  "prose-lead:text-lg md:prose-lead:text-xl",
  "prose-lead:leading-8 md:prose-lead:leading-9",

  "prose-small:text-sm prose-small:leading-6",

  // Headings
  "prose-h1:text-3xl md:prose-h1:text-4xl prose-h1:leading-tight",
  "prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:leading-snug",
  "prose-h3:text-xl md:prose-h3:text-2xl prose-h3:leading-snug",
  "prose-h4:text-lg prose-h4:leading-snug",
  "prose-h5:text-base prose-h5:leading-normal",
  "prose-h6:text-sm prose-h6:leading-normal",

  "prose-headings:font-semibold prose-headings:tracking-tight",
  "prose-headings:scroll-mt-24",

  // Blockquote
  "prose-blockquote:text-lg md:prose-blockquote:text-xl",
  "prose-blockquote:leading-8 md:prose-blockquote:leading-9",
  "prose-blockquote:border-l-4 prose-blockquote:pl-6",
  "prose-blockquote:not-italic",

  // Lists
  "prose-ul:leading-8 prose-ol:leading-8",
  "prose-li:my-1.5",

  // Code
  "prose-code:text-sm prose-code:font-medium",
  "prose-code:before:content-none prose-code:after:content-none",

  // Links
  "prose-a:text-primary prose-a:underline-offset-4",
  "hover:prose-a:underline",

  // Tables
  "prose-table:text-sm",
  "prose-th:font-semibold",
  "prose-td:align-top",

  // ETC
  "prose-img:rounded-lg prose-img:my-10",
  "prose-hr:my-14",
);
