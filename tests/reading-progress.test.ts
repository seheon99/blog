import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";

import ReadingProgress from "@/components/post/reading-progress.astro";

describe("ReadingProgress", () => {
  it("renders a fixed 2px bar pinned under the 68px nav", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ReadingProgress);
    expect(html).toMatch(/<div[^>]*data-reading-progress/);
    expect(html).toMatch(/fixed/);
    expect(html).toMatch(/top-17/);
    expect(html).toMatch(/h-0\.5/);
    expect(html).toMatch(/bg-brand-600/);
  });

  it("starts with zero progress and uses scaleX for cheap updates", async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ReadingProgress);
    expect(html).toMatch(/origin-left/);
    expect(html).toContain("scaleX(0)");
  });
});
