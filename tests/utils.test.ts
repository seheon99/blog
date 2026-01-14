import { describe, expect, it } from "vitest";

import { normalizePath } from "../src/lib/utils";

describe("normalizePath", () => {
  it("removes trailing slashes for non-root paths", () => {
    expect(normalizePath("/graph/")).toBe("/graph");
    expect(normalizePath("/graph//")).toBe("/graph");
  });

  it("keeps the root path", () => {
    expect(normalizePath("/")).toBe("/");
  });

  it("normalizes empty or slash-only inputs to root", () => {
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("///")).toBe("/");
  });
});
