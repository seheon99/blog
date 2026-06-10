export const POST_TYPES = ["note", "write-up", "til"] as const;
export const DEFAULT_POST_TYPE = "note";

export type PostType = (typeof POST_TYPES)[number];

export function isNotePost(type: PostType): boolean {
  return type === "note";
}

export function isListedWriting(type: PostType): boolean {
  return type === "write-up" || type === "til";
}
