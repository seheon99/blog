import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import BaseLayout from "@/layouts/base-layout.astro";

async function render(): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(BaseLayout, {
    props: { title: "t", description: "d" },
    slots: { default: "<p>hello</p>" },
  });
}

describe("BaseLayout", () => {
  it("marks the scroll container with data-scroll-root", async () => {
    const html = await render();
    expect(html).toMatch(
      /<div[^>]*data-scroll-root[^>]*overflow-y-scroll[^>]*>/,
    );
  });

  it("scopes the scroll container to viewport height minus the 68px nav", async () => {
    const html = await render();
    expect(html).toMatch(
      /<div[^>]*data-scroll-root[^>]*md:h-\[calc\(100vh-68px\)\][^>]*>/,
    );
  });

  it("renders the default slot inside the scroll container", async () => {
    const html = await render();
    expect(html).toMatch(
      /<div[^>]*data-scroll-root[^>]*>\s*<p>hello<\/p>\s*<\/div>/,
    );
  });
});
