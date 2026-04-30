import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getCollection } from "astro:content";
import { beforeAll, describe, expect, it } from "vitest";

import PostDetailPage from "@/pages/posts/[...id].astro";

let html: string;

beforeAll(async () => {
  const posts = await getCollection("posts");
  const sorted = posts.sort(
    (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
  );
  // Pick a middle post so we exercise both prev and next.
  const idx = Math.min(1, sorted.length - 1);
  const post = sorted[idx];
  const prevPost = sorted[idx + 1] ?? null;
  const nextPost = sorted[idx - 1] ?? null;

  const container = await AstroContainer.create();
  html = await container.renderToString(PostDetailPage, {
    props: { post, prevPost, nextPost },
  });
});

describe("Post detail shell", () => {
  it("mounts the reading-progress bar and the margin-rail container", () => {
    expect(html).toContain("data-reading-progress");
    expect(html).toContain("data-margin-rail");
  });

  it("uses the minmax(0,1fr) 280px grid that collapses below lg", () => {
    expect(html).toMatch(
      /grid-cols-1[^"]*lg:grid-cols-\[minmax\(0,1fr\)_280px\]/,
    );
  });

  it("caps prose to 720px", () => {
    expect(html).toMatch(/max-w-\[720px\]/);
  });

  it("renders the '← all writing' back-link to /", () => {
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>\s*← all writing\s*<\/a>/);
  });

  it("uses a 44px / 32px H1 with -0.04em tracking", () => {
    expect(html).toMatch(
      /<h1[^>]*text-\[44px\][^>]*tracking-\[-0\.04em\][^>]*max-md:text-\[32px\]/,
    );
  });

  it("renders the date · MIN · WORDS meta line", () => {
    expect(html).toMatch(/[A-Z]{3} \d{1,2}, \d{4}/);
    expect(html).toMatch(/\d+ MIN/);
    expect(html).toMatch(/\d+ WORDS/);
  });

  it("wires both prev and next foot-nav links", () => {
    expect(html).toContain("← previous");
    expect(html).toContain("next →");
  });

  it("renders the rendered markdown body inside the prose wrapper", () => {
    // proseClasses pulls in the `prose` token from @tailwindcss/typography.
    expect(html).toMatch(/class="[^"]*\bprose\b[^"]*"/);
  });
});
