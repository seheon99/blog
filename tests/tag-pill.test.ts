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

  it("uses the rounded brand-bg pill chrome", () => {
    expect(html).toMatch(/rounded-full/);
    expect(html).toMatch(/bg-brand-600/);
    expect(html).toMatch(/text-bg-1/);
  });

  it("uses mono uppercase typography", () => {
    expect(html).toMatch(/font-mono/);
    expect(html).toMatch(/uppercase/);
  });
});
