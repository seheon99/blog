import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import TagPill from "@/components/post/tag-pill.astro";

async function render(props: Record<string, unknown>): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(TagPill, { props });
}

describe("TagPill", () => {
  let html: string;
  beforeAll(async () => {
    html = await render({ tag: "javascript" });
  });

  it("renders the tag with a # prefix", () => {
    expect(html).toMatch(/#javascript/);
  });

  it("uses the rounded pill chrome with a tag-keyed inline background color", () => {
    expect(html).toMatch(/rounded-full/);
    expect(html).toMatch(/text-bg-1/);
    // Tag color is applied via inline style sourced from src/lib/tag-colors.
    expect(html).toMatch(/style="background-color:\s*oklch\(/);
  });

  it("derives a stable color per tag (different tags → different oklch)", async () => {
    const a = await render({ tag: "alpha" });
    const b = await render({ tag: "beta" });
    const colorA = a.match(/style="background-color:\s*([^"]+)"/)?.[1];
    const colorB = b.match(/style="background-color:\s*([^"]+)"/)?.[1];
    expect(colorA).toBeTruthy();
    expect(colorB).toBeTruthy();
    expect(colorA).not.toEqual(colorB);
  });

  it("uses mono uppercase typography", () => {
    expect(html).toMatch(/font-mono/);
    expect(html).toMatch(/uppercase/);
  });
});
