import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import PostFootNav from "@/components/post/post-foot-nav.astro";

type StubPost = {
  id: string;
  data: { title: string };
};

const prev: StubPost = { id: "older-one", data: { title: "Older post" } };
const next: StubPost = { id: "newer-one", data: { title: "Newer post" } };

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(PostFootNav, { props });
}

describe("PostFootNav", () => {
  it("renders prev and next links to opposite ends", async () => {
    const html = await render({ prevPost: prev, nextPost: next });
    expect(html).toMatch(/<nav[^>]*aria-label="post pagination"/);
    expect(html).toMatch(/justify-between/);
    expect(html).toContain('href="/posts/older-one"');
    expect(html).toContain('href="/posts/newer-one"');
    expect(html).toContain("Older post");
    expect(html).toContain("Newer post");
  });

  it("uses mono '← previous' and 'next →' eyebrows", async () => {
    const html = await render({ prevPost: prev, nextPost: next });
    expect(html).toMatch(/font-mono[^"]*"[^>]*>\s*← previous/);
    expect(html).toMatch(/font-mono[^"]*"[^>]*>\s*next →/);
  });

  it("right-aligns the next link", async () => {
    const html = await render({ prevPost: prev, nextPost: next });
    expect(html).toMatch(
      /<a[^>]*href="\/posts\/newer-one"[^>]*class="[^"]*items-end[^"]*"/,
    );
  });

  it("renders an empty placeholder when prev is missing", async () => {
    const html = await render({ prevPost: null, nextPost: next });
    expect(html).not.toContain("← previous");
    expect(html).toContain("next →");
  });

  it("renders an empty placeholder when next is missing", async () => {
    const html = await render({ prevPost: prev, nextPost: null });
    expect(html).toContain("← previous");
    expect(html).not.toContain("next →");
  });
});
