import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import IndexPage from "@/pages/index.astro";

// The React island itself (drag, force simulation tick math) is not exercised
// here — Astro Container renders client:only islands as <astro-island>
// placeholders. Visual / interactive behavior is verified via manual smoke.
async function renderAt(url: string): Promise<string> {
  const container = await AstroContainer.create();
  container.addServerRenderer({
    name: "@astrojs/react",
    renderer: (await import("@astrojs/react/server.js")).default,
  });
  container.addClientRenderer({
    name: "@astrojs/react",
    entrypoint: "@astrojs/react/client.js",
  });
  return container.renderToString(IndexPage, {
    request: new Request(url),
  });
}

function paneAttrs(html: string, view: string): string {
  const idx = html.indexOf(`data-view-pane="${view}"`);
  if (idx === -1) return "";
  const start = html.lastIndexOf("<", idx);
  const end = html.indexOf(">", idx);
  return html.slice(start, end + 1);
}

describe("home page — graph pane", () => {
  it("hides the graph pane and shows the list pane by default", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(paneAttrs(html, "list")).not.toMatch(/\bhidden\b/);
    expect(paneAttrs(html, "graph")).toMatch(/\bhidden\b/);
  });

  it("shows the graph pane when ?view=graph is present", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    expect(paneAttrs(html, "graph")).not.toMatch(/\bhidden\b/);
    expect(paneAttrs(html, "list")).toMatch(/\bhidden\b/);
  });

  it("renders the PostGraph React island inside the graph pane", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    expect(html).toContain("<astro-island");
    expect(html).toMatch(/component-export\s*=\s*"default"/);
  });
});

describe("home page — list view tag filter", () => {
  it("renders the tag chips row inside the list pane", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).toMatch(/data-tag-chip/);
    // The 'all' chip is always there; at least one tag chip should be too.
    const chipCount = (html.match(/data-tag-chip/g) ?? []).length;
    expect(chipCount).toBeGreaterThan(1);
  });

  it("marks 'all' as the active chip when no ?tag= is present", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    const allChip = html.match(/<a[^>]*>\s*all\s*<\/a>/)?.[0] ?? "";
    expect(allChip).toContain('data-current="true"');
  });

  it("marks the matching tag chip as active when ?tag= is present", async () => {
    const html = await renderAt("https://blog.seheon.kr/?tag=JavaScript");
    const allChip = html.match(/<a[^>]*>\s*all\s*<\/a>/)?.[0] ?? "";
    const jsChip =
      html.match(/<a[^>]*data-tag="JavaScript"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? "";
    expect(allChip).toContain('data-current="false"');
    expect(jsChip).toContain('data-current="true"');
  });

  it("filters the writing rows down to the active tag's posts", async () => {
    const allHtml = await renderAt("https://blog.seheon.kr/");
    const filteredHtml = await renderAt(
      "https://blog.seheon.kr/?tag=JavaScript",
    );
    const countRows = (s: string) =>
      (s.match(/<a[^>]*href="\/posts\//g) ?? []).length;
    expect(countRows(filteredHtml)).toBeGreaterThan(0);
    expect(countRows(filteredHtml)).toBeLessThan(countRows(allHtml));
  });
});

describe("home page — graph view chrome", () => {
  it("renders the featured panel above the graph", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    expect(html).toContain("data-featured-panel");
    expect(html).toMatch(/>\s*latest\s*</);
  });

  it("renders the tag-chips filter card on the graph pane", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    expect(html).toContain("data-graph-tag-chips");
    expect(html).toMatch(/>\s*filter by tag\s*</);
  });

  it("renders the hint pill with 'hover to preview · click to read'", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    expect(html).toMatch(/hover to preview/);
    expect(html).toMatch(/click to read/);
  });

  it("forwards the activeTag prop to the PostGraph island when ?tag= is set", async () => {
    const html = await renderAt(
      "https://blog.seheon.kr/?view=graph&tag=JavaScript",
    );
    expect(html).toContain(
      "&quot;activeTag&quot;:[0,&quot;JavaScript&quot;]",
    );
  });
});
