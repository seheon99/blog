import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeKatex from "rehype-katex";
import rehypeStringify from "rehype-stringify";

async function render(md: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe("remark-math + rehype-katex", () => {
  it("renders inline $…$ math as a KaTeX inline span", async () => {
    const html = await render("The lookup is $O(n)$ in the worst case.");
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("$O(n)$");
  });

  it("renders block $$…$$ math as a KaTeX display span", async () => {
    const html = await render("$$\nH(p, q) = -\\sum_{i} p_i \\log q_i\n$$");
    expect(html).toContain("katex-display");
    expect(html).not.toContain("$$");
  });

  it("leaves non-math dollar signs alone in regular prose", async () => {
    const html = await render("Costs about $5 to run.");
    expect(html).not.toContain('class="katex"');
    expect(html).toContain("$5");
  });
});
