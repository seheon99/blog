import type { Code, Html, Root } from "mdast";
import type { Plugin } from "unified";
import { visit, SKIP } from "unist-util-visit";

// Astro highlights fenced code with Shiki, which knows nothing about
// Mermaid and would render the diagram source as a styled code block.
// Replace ```mermaid blocks with a raw <pre class="mermaid"> node so the
// Mermaid runtime can find and render them on the client. The class name
// matches Mermaid's default `querySelector`, so the runtime needs no
// custom selector.

const MERMAID_LANG = "mermaid";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const remarkMermaid: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "code", (node: Code, index, parent) => {
      if (parent == null || index == null) return;
      if (node.lang !== MERMAID_LANG) return;

      const html: Html = {
        type: "html",
        value: `<pre class="mermaid" data-mermaid-source>${escapeHtml(node.value)}</pre>`,
      };
      parent.children.splice(index, 1, html);
      return [SKIP, index + 1];
    });
  };
};

export default remarkMermaid;
export { escapeHtml };
