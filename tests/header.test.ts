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
  it("renders a sticky <nav> above the graph", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    const nav = tagWith(html, "<nav");
    expect(nav).toContain("sticky top-0");
    expect(nav).toContain("z-100");
  });
});

describe("Header — brand mark", () => {
  it("renders the plain 'seheon' wordmark linked to /", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>\s*seheon\s*<\/a>/);
    expect(html).not.toContain("font-display");
    expect(html).not.toContain("-rotate-3");
  });

  it("keeps the simplified wordmark free of the old accent dot", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).not.toMatch(
      /<span[^>]*class="[^"]*absolute[^"]*rounded-full[^"]*bg-brand-600/,
    );
  });
});

describe("Header — center nav links", () => {
  it("includes writing and about links", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    expect(html).toContain(">writing<");
    expect(html).toContain(">about<");
    expect(html).not.toContain(">RSS<");
  });

  it("marks 'writing' active when the route is the home page", async () => {
    const html = await renderAt("https://blog.seheon.kr/");
    const writing = html.match(/<a[^>]*>writing</)?.[0] ?? "";
    expect(writing).toContain("font-semibold text-fg-1");
  });

  it("marks 'writing' muted on a post page", async () => {
    const html = await renderAt("https://blog.seheon.kr/posts/some-slug");
    const writing = html.match(/<a[^>]*>writing</)?.[0] ?? "";
    expect(writing).not.toContain("font-semibold text-fg-1");
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

    it("highlights 'graph' as active by default", () => {
      const listAnchor = tagWith(html, 'data-view-target="list"');
      const graphAnchor = tagWith(html, 'data-view-target="graph"');
      expect(listAnchor).toContain('data-current="false"');
      expect(graphAnchor).toContain('data-current="true"');
    });

    it("preserves data-view-target on anchor tags for the no-reload swap script", () => {
      expect(html).toMatch(/<a[^>]*data-view-target="list"/);
      expect(html).toMatch(/<a[^>]*data-view-target="graph"/);
    });
  });

  it("highlights 'list' when ?view=list", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=list");
    expect(tagWith(html, 'data-view-target="list"')).toContain(
      'data-current="true"',
    );
    expect(tagWith(html, 'data-view-target="graph"')).toContain(
      'data-current="false"',
    );
  });

  it("highlights 'graph' when ?view=graph", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=graph");
    const listAnchor = tagWith(html, 'data-view-target="list"');
    const graphAnchor = tagWith(html, 'data-view-target="graph"');
    expect(graphAnchor).toContain('data-current="true"');
    expect(listAnchor).toContain('data-current="false"');
  });

  it("treats unknown view values as the default (graph)", async () => {
    const html = await renderAt("https://blog.seheon.kr/?view=mystery");
    const listAnchor = tagWith(html, 'data-view-target="list"');
    const graphAnchor = tagWith(html, 'data-view-target="graph"');
    expect(listAnchor).toContain('data-current="false"');
    expect(graphAnchor).toContain('data-current="true"');
  });

  it("hides the toggle on a post page", async () => {
    const html = await renderAt("https://blog.seheon.kr/posts/some-slug");
    expect(html).not.toContain("data-view-target");
  });
});
