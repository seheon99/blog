import { describe, expect, it } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkAlert } from "remark-github-blockquote-alert";

const sample = `
> [!NOTE]
> Highlights information that users should take into account, even when skimming.

> [!TIP]
> Optional information to help a user be more successful.

> [!IMPORTANT]
> Crucial information necessary for users to succeed.

> [!WARNING]
> Critical content demanding immediate user attention due to potential risks.

> [!CAUTION]
> Negative potential consequences of an action.
`;

async function render(md: string) {
  const file = await unified()
    .use(remarkParse)
    .use(remarkAlert)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(md);
  return String(file);
}

describe("remark-github-blockquote-alert", () => {
  it("renders all five GitHub alert types with the expected classes", async () => {
    const html = await render(sample);
    for (const type of ["note", "tip", "important", "warning", "caution"]) {
      expect(html).toContain(`markdown-alert-${type}`);
    }
    expect(html).toContain("markdown-alert-title");
  });

  it("leaves plain blockquotes untouched", async () => {
    const html = await render("> just a regular quote");
    expect(html).not.toContain("markdown-alert");
    expect(html).toContain("<blockquote>");
  });
});
