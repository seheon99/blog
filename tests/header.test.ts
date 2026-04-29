import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import Header from "@/components/ui/header.astro";

async function renderAt(url: string): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Header, {
    request: new Request(url),
  });
}

function tagWith(html: string, attr: string): string {
  const idx = html.indexOf(attr);
  if (idx === -1) return "";
  const start = html.lastIndexOf("<", idx);
  const end = html.indexOf(">", idx);
  return html.slice(start, end + 1);
}

describe("Header — sticky chrome", () => {
  it("renders a sticky <nav> with backdrop blur and a bottom border", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    const nav = tagWith(html, "<nav");
    expect(nav).toContain("sticky top-0");
    expect(nav).toContain("backdrop-blur");
    expect(nav).toContain("border-b border-border");
  });
});

describe("Header — brand mark", () => {
  it("renders the rotated 'seheon' wordmark linked to /", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*-rotate-3[\s\S]*?>\s*seheon/);
    expect(html).toContain("font-display");
  });

  it("includes the absolutely-positioned brand-blue accent dot", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).toMatch(/h-\[7px\] w-\[7px\] rounded-full bg-brand-600/);
  });
});

describe("Header — center nav links", () => {
  it("includes writing / about / RSS", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).toContain(">writing<");
    expect(html).toContain(">about<");
    expect(html).toContain(">RSS<");
  });

  it("marks 'writing' active when the route is the home page", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    const writing = html.match(/<a[^>]*>writing</)?.[0] ?? "";
    expect(writing).toContain("font-medium text-fg-1");
  });

  it("marks 'writing' muted on a post page", async () => {
    const html = await renderAt("https://blog.seheon.kr/posts/some-slug");
    const writing = html.match(/<a[^>]*>writing</)?.[0] ?? "";
    expect(writing).not.toContain("font-medium text-fg-1");
    expect(writing).toContain("text-fg-3");
  });
});

describe("Header — view toggle", () => {
  describe("on the home page", () => {
    let html: string;
    beforeAll(async () => {
      html = await renderAt("https://blog.seheon.kr/");
    });

    it("renders both list and graph anchors", () => {
      expect(html).toContain('data-view-target="list"');
      expect(html).toContain('data-view-target="graph"');
    });

    it("highlights 'list' as active by default", () => {
      const listAnchor = tagWith(html, 'data-view-target="list"');
      const graphAnchor = tagWith(html, 'data-view-target="graph"');
      expect(listAnchor).toContain("bg-fg-1 text-bg-1");
      expect(graphAnchor).not.toContain("bg-fg-1 text-bg-1");
    });

    it("preserves data-view-target on anchor tags for the no-reload swap script", () => {
      expect(html).toMatch(/<a[^>]*data-view-target="list"/);
      expect(html).toMatch(/<a[^>]*data-view-target="graph"/);
    });
  });

  it("highlights 'graph' when ?view=graph", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    const listAnchor = tagWith(html, 'data-view-target="list"');
    const graphAnchor = tagWith(html, 'data-view-target="graph"');
    expect(graphAnchor).toContain("bg-fg-1 text-bg-1");
    expect(listAnchor).not.toContain("bg-fg-1 text-bg-1");
  });

  it("treats unknown view values as the default (list)", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=mystery");
    const listAnchor = tagWith(html, 'data-view-target="list"');
    expect(listAnchor).toContain("bg-fg-1 text-bg-1");
  });

  it("hides the toggle on a post page", async () => {
    const html = await renderAt("https://blog.seheon.kr/posts/some-slug");
    expect(html).not.toContain("data-view-target");
  });
});
