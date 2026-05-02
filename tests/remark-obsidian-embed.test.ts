import path from "node:path";

import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import remarkObsidianEmbed from "../src/lib/remark-obsidian-embed";

const POST_PATH = path.resolve("src/content/posts/agentic-ai-stack.md");
const NESTED_POST_PATH = path.resolve("src/content/posts/Algorithms/segment-tree.md");

async function render(md: string, postPath = POST_PATH) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkObsidianEmbed)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process({ value: md, path: postPath });
  return String(file);
}

describe("remark-obsidian-embed", () => {
  it("converts a basic image embed to an <img> with a relative URL", async () => {
    const html = await render("![[diagram.svg]]");
    expect(html).toContain('src="./_resources/diagram.svg"');
    expect(html).toContain('alt="diagram.svg"');
  });

  it("encodes width-only size spec as a width attribute", async () => {
    const html = await render("![[diagram.svg|650]]");
    expect(html).toContain('width="650"');
    expect(html).not.toContain("height");
  });

  it("encodes width and height", async () => {
    const html = await render("![[diagram.svg|640x480]]");
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
  });

  it("uses the non-numeric pipe segment as alt text", async () => {
    const html = await render("![[diagram.svg|Architecture overview]]");
    expect(html).toContain('alt="Architecture overview"');
  });

  it("supports alt text combined with size", async () => {
    const html = await render("![[diagram.svg|Architecture|800x600]]");
    expect(html).toContain('alt="Architecture"');
    expect(html).toContain('width="800"');
    expect(html).toContain('height="600"');
  });

  it("computes a deeper relative path for posts in subdirectories", async () => {
    const html = await render("![[diagram.svg]]", NESTED_POST_PATH);
    expect(html).toContain('src="../_resources/diagram.svg"');
  });

  it("leaves non-image embeds untouched", async () => {
    const html = await render("![[some-note]]");
    expect(html).toContain("![[some-note]]");
    expect(html).not.toContain("<img");
  });

  it("preserves surrounding text in the same paragraph", async () => {
    const html = await render("before ![[diagram.svg]] after");
    expect(html).toMatch(/before\s*<img[^>]+>\s*after/);
  });

  it("ignores plain (non-embed) wikilinks", async () => {
    const html = await render("see [[Other Note]]");
    expect(html).not.toContain("<img");
    expect(html).toContain("[[Other Note]]");
  });
});
