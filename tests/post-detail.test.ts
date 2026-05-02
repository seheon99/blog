import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { getCollection, type CollectionEntry } from "astro:content";
import { beforeAll, describe, expect, it } from "vitest";

import PostDetailPage from "@/pages/posts/[...id].astro";

let html: string;
let post: CollectionEntry<"posts">;

beforeAll(async () => {
  const posts = await getCollection("posts");
  const sorted = posts.sort(
    (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
  );
  // Pick a middle post so we exercise both prev and next.
  const idx = Math.min(1, sorted.length - 1);
  post = sorted[idx];
  const prevPost = sorted[idx + 1] ?? null;
  const nextPost = sorted[idx - 1] ?? null;

  const container = await AstroContainer.create();
  container.addServerRenderer({
    name: "@astrojs/react",
    renderer: (await import("@astrojs/react/server.js")).default,
  });
  container.addClientRenderer({
    name: "@astrojs/react",
    entrypoint: "@astrojs/react/client.js",
  });
  html = await container.renderToString(PostDetailPage, {
    props: { post, prevPost, nextPost },
  });
});

function marginRailFragment(source: string): string {
  const start = source.indexOf("data-margin-rail");
  if (start === -1) return "";
  const end = source.indexOf("</aside>", start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

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

  it("keeps the margin rail visible on <lg by stacking it below prose", () => {
    // Phase 7: the rail used to carry `hidden ... lg:block`; now it must stay
    // visible at every breakpoint and only become sticky at lg.
    const aside = html.match(/<aside[^>]*data-margin-rail[^>]*>/)?.[0] ?? "";
    expect(aside).not.toMatch(/\bclass="[^"]*\bhidden\b/);
    expect(aside).toMatch(/\blg:sticky\b/);
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

describe("Post detail — margin rail neighborhood graph", () => {
  // The React island itself (force simulation, click handlers, dim states)
  // is not exercised here — Astro Container renders client:only islands as
  // <astro-island> placeholders. Visual / interactive behavior is verified
  // via manual smoke.

  it("renders the 'neighborhood' label inside the margin rail", () => {
    const rail = marginRailFragment(html);
    expect(rail).toMatch(/>\s*neighborhood\s*</);
  });

  it("mounts the PostGraphMini React island inside the margin rail", () => {
    const rail = marginRailFragment(html);
    expect(rail).toContain("<astro-island");
    expect(rail).toMatch(/post-graph-mini/);
  });

  it("passes the current post id as activeId to the island", () => {
    const rail = marginRailFragment(html);
    // props are HTML-entity-encoded JSON inside the astro-island attribute.
    expect(rail).toContain(
      `&quot;activeId&quot;:[0,&quot;${post.id}&quot;]`,
    );
  });

  it("forwards graph nodes and links props to the island", () => {
    const rail = marginRailFragment(html);
    expect(rail).toContain("&quot;nodes&quot;");
    expect(rail).toContain("&quot;links&quot;");
  });

  it("places the rail's neighborhood section under a 1px left border", () => {
    const rail = marginRailFragment(html);
    expect(rail).toMatch(/border-l\b/);
  });
});

describe("Post detail — table of contents", () => {
  // Uses a separate render with a post that has h2/h3 headings.
  let tocHtml: string;

  beforeAll(async () => {
    const posts = await getCollection("posts");
    const sorted = posts.sort(
      (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
    );
    const withHeadings = sorted.find((p) =>
      /^#{2,3} /m.test(p.body ?? ""),
    );
    if (!withHeadings) throw new Error("no test post has h2/h3 headings");

    const idx = sorted.findIndex((p) => p.id === withHeadings.id);
    const prev = sorted[idx + 1] ?? null;
    const next = sorted[idx - 1] ?? null;

    const container = await AstroContainer.create();
    container.addServerRenderer({
      name: "@astrojs/react",
      renderer: (await import("@astrojs/react/server.js")).default,
    });
    container.addClientRenderer({
      name: "@astrojs/react",
      entrypoint: "@astrojs/react/client.js",
    });
    tocHtml = await container.renderToString(PostDetailPage, {
      props: { post: withHeadings, prevPost: prev, nextPost: next },
    });
  });

  it("renders the TOC section with the 'on this page' label", () => {
    const rail = marginRailFragment(tocHtml);
    expect(rail).toContain("data-toc");
    expect(rail).toMatch(/>\s*on this page\s*</);
  });

  it("emits a TOC link with data-toc-slug for each heading", () => {
    const rail = marginRailFragment(tocHtml);
    const matches = rail.match(/data-toc-slug=/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
  });

  it("indents h3 entries deeper than h2 entries via padding", () => {
    const rail = marginRailFragment(tocHtml);
    // h2 → pl-3, h3 → pl-7. We need the post to have at least one of each
    // for this assertion to be meaningful; assert both classes are present.
    expect(rail).toMatch(/\bpl-3\b/);
    expect(rail).toMatch(/\bpl-7\b/);
  });

  it("hides the TOC section when the post has no h2/h3 headings", () => {
    // The outer beforeAll picks sorted[1]; in the current fixture set that
    // post has no h2/h3 headings, so the TOC must not render.
    const rail = marginRailFragment(html);
    expect(rail).not.toContain("data-toc");
  });
});

describe("Post detail — mermaid blocks", () => {
  let mermaidHtml: string;

  beforeAll(async () => {
    const posts = await getCollection("posts");
    const sorted = posts.sort(
      (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
    );
    const withMermaid = sorted.find((p) =>
      /^```mermaid/m.test(p.body ?? ""),
    );
    if (!withMermaid) throw new Error("no test post contains a mermaid block");

    const idx = sorted.findIndex((p) => p.id === withMermaid.id);
    const prev = sorted[idx + 1] ?? null;
    const next = sorted[idx - 1] ?? null;

    const container = await AstroContainer.create();
    container.addServerRenderer({
      name: "@astrojs/react",
      renderer: (await import("@astrojs/react/server.js")).default,
    });
    container.addClientRenderer({
      name: "@astrojs/react",
      entrypoint: "@astrojs/react/client.js",
    });
    mermaidHtml = await container.renderToString(PostDetailPage, {
      props: { post: withMermaid, prevPost: prev, nextPost: next },
    });
  });

  it("emits a <pre class=\"mermaid\"> block for ```mermaid fences", () => {
    expect(mermaidHtml).toMatch(/<pre class="mermaid"[^>]*data-mermaid-source/);
  });

  it("preserves the diagram source inside the mermaid pre", () => {
    const mermaidPre = mermaidHtml.match(
      /<pre class="mermaid"[^>]*>([\s\S]*?)<\/pre>/,
    )?.[1];
    expect(mermaidPre).toBeTruthy();
    expect(mermaidPre).toContain("flowchart LR");
    expect(mermaidPre).toContain("A --> B");
  });

  it("does not emit a syntax-highlighted code block for the mermaid fence", () => {
    // If Shiki had highlighted the block we'd see an `astro-code` pre wrapping
    // the diagram source instead of `<pre class="mermaid">`.
    const mermaidPre = mermaidHtml.match(
      /<pre class="mermaid"[^>]*>[\s\S]*?<\/pre>/,
    )?.[0];
    expect(mermaidPre).toBeTruthy();
    expect(mermaidPre).not.toContain("astro-code");
  });
});

describe("Post detail — backlinks", () => {
  it("renders the backlinks section with an empty-state hint when no other posts reference this one", () => {
    const rail = marginRailFragment(html);
    expect(rail).toContain("data-backlinks");
    expect(rail).toMatch(/no backlinks yet/);
  });

  it("emits the 'backlinks' label", () => {
    const rail = marginRailFragment(html);
    expect(rail).toMatch(/>\s*backlinks\s*</);
  });

  it("getBacklinks resolves an injected [[Title]] reference", async () => {
    const posts = await getCollection("posts");
    const sorted = posts.sort(
      (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
    );
    // Mutate a copy in memory so the on-disk content stays unchanged.
    const target = sorted[0];
    const referer = sorted[1];
    const fakeReferer = {
      ...referer,
      body: `${referer.body ?? ""}\n\nsee [[${target.data.title}]]`,
    };
    const fakePosts = sorted.map((p) =>
      p.id === referer.id ? fakeReferer : p,
    );

    const { getBacklinks } = await import("@/lib/post-graph");
    const backlinks = getBacklinks(fakePosts, target.id);
    expect(backlinks.map((b) => b.id)).toEqual([referer.id]);
  });
});
