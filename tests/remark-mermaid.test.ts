import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

import remarkMermaid from "../src/lib/remark-mermaid";

async function render(md: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(file);
}

describe("remark-mermaid", () => {
  it("converts a ```mermaid block into a <pre class=\"mermaid\"> node", async () => {
    const html = await render("```mermaid\nflowchart LR\n  A --> B\n```");
    expect(html).toContain('<pre class="mermaid"');
    expect(html).toContain("flowchart LR");
    expect(html).toContain("A --&gt; B");
  });

  it("tags the emitted node with data-mermaid-source so the client picks it up", async () => {
    const html = await render("```mermaid\ngraph TD\n  A-->B\n```");
    expect(html).toMatch(/<pre class="mermaid" data-mermaid-source>/);
  });

  it("escapes &, <, > inside the diagram source to keep the HTML well-formed", async () => {
    const html = await render('```mermaid\nA["a & b <c> d"]\n```');
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;c&gt;");
    // Raw chars must not leak through, which would break parsing.
    expect(html).not.toMatch(/A\["a & b <c> d"\]/);
  });

  it("leaves non-mermaid code blocks untouched", async () => {
    const html = await render("```ts\nconst x = 1\n```");
    expect(html).toContain("<code");
    expect(html).not.toContain('class="mermaid"');
  });

  it("leaves a fenced block with no language alone", async () => {
    const html = await render("```\nplain text\n```");
    expect(html).not.toContain('class="mermaid"');
  });

  it("renders multiple mermaid blocks independently", async () => {
    const html = await render(
      "```mermaid\nflowchart LR\n  A-->B\n```\n\n```mermaid\nflowchart TD\n  C-->D\n```",
    );
    const matches = html.match(/<pre class="mermaid"/g) ?? [];
    expect(matches.length).toBe(2);
  });
});
