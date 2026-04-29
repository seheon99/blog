import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import ReadingProgress from "@/components/post/reading-progress.astro";
import MarginRail from "@/components/post/margin-rail.astro";
import PostHeader from "@/components/post/post-header.astro";
import FootNav from "@/components/post/foot-nav.astro";

async function render(
  Component: Parameters<AstroContainer["renderToString"]>[0],
  props: Record<string, unknown> = {},
): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Component, { props });
}

describe("ReadingProgress", () => {
  it("renders a sticky 2px bar offset under the 68px nav on mobile and at top of the wrapper on md+", async () => {
    const html = await render(ReadingProgress);
    expect(html).toMatch(/data-reading-progress(?!-)/);
    expect(html).toContain("sticky");
    expect(html).toContain("top-[68px]");
    expect(html).toContain("md:top-0");
    expect(html).toContain("h-0.5");
  });

  it("includes a fill element painted with the brand color", async () => {
    const html = await render(ReadingProgress);
    expect(html).toMatch(/data-reading-progress-fill[^>]*class="[^"]*bg-brand-600/);
  });

  it("ships an inline script that listens to both window and the layout scroll root", async () => {
    const html = await render(ReadingProgress);
    expect(html).toContain("data-scroll-root");
    expect(html).toMatch(/window\.addEventListener\("scroll"/);
    expect(html).toMatch(/wrapper\.addEventListener\("scroll"/);
  });
});

describe("MarginRail", () => {
  it("is hidden below lg and reserves 280px on lg+", async () => {
    const html = await render(MarginRail);
    expect(html).toContain("hidden");
    expect(html).toContain("lg:block");
    expect(html).toContain("w-[280px]");
  });

  it("renders the placeholder section labels in mono uppercase", async () => {
    const html = await render(MarginRail);
    expect(html).toContain("On this page");
    expect(html).toContain("Map");
    expect(html).toContain("Backlinks");
    expect(html).toMatch(/font-mono[^"]*uppercase/);
  });

  it("each section uses a 1px left rule per the handoff spec", async () => {
    const html = await render(MarginRail);
    const sectionMatches = html.match(/<section[^>]*class="[^"]*border-l[^"]*"/g);
    expect(sectionMatches?.length).toBe(3);
  });
});

describe("PostHeader", () => {
  const baseProps = {
    title: "Post detail shell",
    createdAt: new Date("2026-04-15T00:00:00Z"),
    body: "한글 본문과 some english words.",
    primaryTag: "design",
  };

  it("renders the title with display-scale typography", async () => {
    const html = await render(PostHeader, baseProps);
    expect(html).toMatch(/<h1[^>]*class="[^"]*font-extrabold/);
    expect(html).toMatch(/>\s*Post detail shell\s*</);
  });

  it("renders a tag pill linked to the home filter when a primary tag is present", async () => {
    const html = await render(PostHeader, baseProps);
    expect(html).toMatch(/<a[^>]*href="\/\?tag=design"[^>]*>\s*#design\s*</);
  });

  it("omits the tag pill when no primary tag is supplied", async () => {
    const html = await render(PostHeader, { ...baseProps, primaryTag: undefined });
    expect(html).not.toContain("#design");
    expect(html).not.toMatch(/href="\/\?tag=/);
  });

  it("renders the mono date · read-time meta line", async () => {
    const html = await render(PostHeader, baseProps);
    expect(html).toMatch(/APR \d{1,2}, 2026/);
    expect(html).toMatch(/\d+ MIN/);
  });
});

describe("FootNav", () => {
  const post = (id: string, title: string) =>
    ({ id, data: { title } }) as never;

  it("renders prev and next entries with mono eyebrows and titles", async () => {
    const html = await render(FootNav, {
      prevPost: post("a", "Earlier post"),
      nextPost: post("b", "Later post"),
    });
    expect(html).toMatch(/<a[^>]*href="\/posts\/a"[^>]*rel="prev"/);
    expect(html).toMatch(/<a[^>]*href="\/posts\/b"[^>]*rel="next"/);
    expect(html).toContain("Previous");
    expect(html).toContain("Next");
    expect(html).toContain("Earlier post");
    expect(html).toContain("Later post");
  });

  it("renders nothing when there is no neighbor on either side", async () => {
    const html = await render(FootNav, { prevPost: null, nextPost: null });
    expect(html).not.toContain("<nav");
  });

  it("renders only one column when only one neighbor exists", async () => {
    const html = await render(FootNav, {
      prevPost: null,
      nextPost: post("b", "Later post"),
    });
    expect(html).toMatch(/<nav[^>]*aria-label="post pagination"/);
    expect(html).toContain("Later post");
    expect(html).not.toContain("Earlier post");
  });
});
