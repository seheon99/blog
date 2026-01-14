#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT_DIR / "src" / "content" / "posts"
META_PATH = ROOT_DIR / "src" / "content" / "posts.meta.json"
MARKDOWN_EXTENSIONS = {".md", ".mdx"}
IGNORE_DIRS = {"_templates"}


def run_git(args: list[str]) -> str:
    return subprocess.check_output(
        ["git", "-C", str(POSTS_DIR), *args],
        text=True,
    ).strip()


def is_ignored(path_value: str) -> bool:
    return any(segment in IGNORE_DIRS for segment in path_value.split("/"))


def main() -> int:
    if not POSTS_DIR.exists():
        raise SystemExit(f"Posts directory not found: {POSTS_DIR}")

    entries = [
        entry.strip()
        for entry in run_git(["ls-files"]).splitlines()
        if entry.strip()
    ]
    files = [
        entry
        for entry in entries
        if Path(entry).suffix in MARKDOWN_EXTENSIONS and not is_ignored(entry)
    ]
    files.sort()

    metadata: dict[str, dict[str, str]] = {}
    for entry in files:
        updated_at = run_git(["log", "-1", "--format=%cI", "--", entry])
        if not updated_at:
            raise SystemExit(f"Missing git timestamp for {entry}")
        metadata[entry] = {"updatedAt": updated_at}

    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(f"{json.dumps(metadata, indent=2, sort_keys=True)}\n")
    print(f"Wrote {META_PATH} with {len(files)} entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
