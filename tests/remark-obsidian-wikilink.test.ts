import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import remarkObsidianWikilink, {
  _resetWikilinkIndexCache,
  parseInner,
  slugifyHeading,
} from "../src/lib/remark-obsidian-wikilink";

const POST_PATH = path.resolve("src/content/posts/javascript-symbol.md");

async function render(md: string, postPath = POST_PATH) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkObsidianWikilink)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process({ value: md, path: postPath });
  return String(file);
}

beforeEach(() => {
  _resetWikilinkIndexCache();
});

describe("remark-obsidian-wikilink", () => {
  it("resolves a bare [[id]] to /posts/id by filename", async () => {
    const html = await render("see [[typescript-narrowing]] for context");
    expect(html).toContain('href="/posts/typescript-narrowing"');
    expect(html).toContain(">typescript-narrowing<");
    expect(html).not.toContain("[[typescript-narrowing]]");
  });

  it("resolves a [[Title]] by case-insensitive frontmatter title match", async () => {
    const html = await render("see [[TypeScript narrowing]]");
    expect(html).toContain('href="/posts/typescript-narrowing"');
    expect(html).toContain(">TypeScript narrowing<");
  });

  it("renders the alias text when [[target|alias]] is used", async () => {
    const html = await render("see [[typescript-narrowing|narrowing notes]]");
    expect(html).toContain('href="/posts/typescript-narrowing"');
    expect(html).toContain(">narrowing notes<");
    expect(html).not.toContain(">typescript-narrowing<");
  });

  it("appends a slugified anchor for [[target#heading]]", async () => {
    const html = await render("see [[javascript-symbol#Creating Symbols]]");
    expect(html).toContain('href="/posts/javascript-symbol#creating-symbols"');
  });

  it("keeps the original text and warns when the target is unresolved", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = await render("see [[no-such-post]]");
    expect(html).toContain("[[no-such-post]]");
    expect(html).not.toContain("<a ");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[[no-such-post]]"),
    );
    warn.mockRestore();
  });

  it("does not touch image embeds (![[image.svg]])", async () => {
    const html = await render("![[diagram.svg]]");
    expect(html).not.toContain("<a ");
    expect(html).toContain("![[diagram.svg]]");
  });

  it("ignores wikilinks inside fenced code blocks", async () => {
    const html = await render("```\n[[typescript-narrowing]]\n```\n");
    expect(html).not.toContain("<a ");
    expect(html).toContain("[[typescript-narrowing]]");
  });

  it("ignores wikilinks inside inline code", async () => {
    const html = await render("the syntax is `[[foo]]` — fyi");
    expect(html).not.toContain("<a ");
    expect(html).toContain("[[foo]]");
  });

  it("rewrites multiple links in one paragraph and preserves surrounding text", async () => {
    const html = await render(
      "before [[typescript-narrowing]] middle [[javascript-symbol]] after",
    );
    expect(html).toMatch(
      /before\s*<a[^>]+href="\/posts\/typescript-narrowing"[^>]*>typescript-narrowing<\/a>\s*middle\s*<a[^>]+href="\/posts\/javascript-symbol"[^>]*>javascript-symbol<\/a>\s*after/,
    );
  });

  it("emits the wikilink class on the rendered <a>", async () => {
    const html = await render("see [[typescript-narrowing]]");
    expect(html).toMatch(/<a[^>]+class="wikilink"/);
  });
});

describe("parseInner", () => {
  it("parses a bare target", () => {
    expect(parseInner("foo")).toEqual({ target: "foo" });
  });

  it("parses a target + alias", () => {
    expect(parseInner("foo|bar")).toEqual({ target: "foo", alias: "bar" });
  });

  it("parses a target + heading", () => {
    expect(parseInner("foo#heading")).toEqual({
      target: "foo",
      heading: "heading",
    });
  });

  it("parses target + heading + alias", () => {
    expect(parseInner("foo#heading|alias")).toEqual({
      target: "foo",
      heading: "heading",
      alias: "alias",
    });
  });

  it("returns null for empty input", () => {
    expect(parseInner("")).toBeNull();
    expect(parseInner("  ")).toBeNull();
  });
});

describe("slugifyHeading", () => {
  it("lowercases and joins spaces with hyphens", () => {
    expect(slugifyHeading("Some Heading")).toBe("some-heading");
  });

  it("strips ASCII punctuation", () => {
    expect(slugifyHeading("Hello, World!")).toBe("hello-world");
  });

  it("collapses runs of whitespace", () => {
    expect(slugifyHeading("a   b   c")).toBe("a-b-c");
  });
});
