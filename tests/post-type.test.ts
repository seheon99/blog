import { describe, expect, it } from "vitest";

import {
  DEFAULT_POST_TYPE,
  isNotePost,
  isListedWriting,
  POST_TYPES,
} from "../src/lib/post-type";

describe("post types", () => {
  it("matches the vault-authored content model", () => {
    expect(POST_TYPES).toEqual(["note", "write-up", "til"]);
    expect(DEFAULT_POST_TYPE).toBe("note");
  });

  it("identifies reference notes without aliasing them", () => {
    expect(isNotePost("note")).toBe(true);
    expect(isNotePost("write-up")).toBe(false);
  });

  it("lists published writing types on the home page", () => {
    expect(isListedWriting("write-up")).toBe(true);
    expect(isListedWriting("til")).toBe(true);
    expect(isListedWriting("note")).toBe(false);
  });
});
