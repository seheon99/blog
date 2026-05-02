// Runs in the browser only. Lazy-loads the Mermaid runtime so it ships
// solely on pages that actually contain a `<pre class="mermaid">` node
// (emitted by `remarkMermaid`). The runtime mutates each node in place,
// replacing the raw diagram source with the rendered SVG.

const SELECTOR = "pre.mermaid[data-mermaid-source]";

export async function renderMermaidDiagrams(
  root: ParentNode = document,
): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>(SELECTOR);
  if (nodes.length === 0) return;

  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: prefersDark() ? "dark" : "default",
  });
  await mermaid.run({ nodes: Array.from(nodes) });
}

function prefersDark(): boolean {
  if (document.documentElement.classList.contains("dark")) return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}
