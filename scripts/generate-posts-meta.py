#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path
import re


ROOT_DIR = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT_DIR / "src" / "content" / "posts"
META_PATH = ROOT_DIR / "src" / "content" / "posts.meta.json"
MARKDOWN_EXTENSIONS = {".md", ".mdx"}
IGNORE_DIRS = {"_templates"}
FRONTMATTER_REGEX = re.compile(r"^---\n([\s\S]*?)\n---\n?", re.MULTILINE)


def run_git(args: list[str]) -> str:
    return subprocess.check_output(
        ["git", "-C", str(POSTS_DIR), *args],
        text=True,
    ).strip()


def is_ignored(path_value: str) -> bool:
    return any(segment in IGNORE_DIRS for segment in path_value.split("/"))


def strip_quotes(value: str) -> str:
    return value.strip().strip("\"'").strip()


def parse_inline_array(value: str) -> list[str]:
    inner = value[1:-1].strip()
    if not inner:
        return []
    return [strip_quotes(item.strip()) for item in inner.split(",") if item.strip()]


def parse_frontmatter(block: str) -> dict[str, object]:
    data: dict[str, object] = {}
    lines = block.splitlines()
    index = 0

    while index < len(lines):
        line = lines[index]
        if not line.strip():
            index += 1
            continue

        match = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line)
        if not match:
            index += 1
            continue

        key = match.group(1)
        value = match.group(2)

        if value == "":
            items: list[str] = []
            cursor = index + 1
            while cursor < len(lines):
                list_match = re.match(r"^\s+-\s+(.+)$", lines[cursor])
                if not list_match:
                    break
                items.append(strip_quotes(list_match.group(1)))
                cursor += 1
            if items:
                data[key] = items
                index = cursor
                continue
            data[key] = ""
            index += 1
            continue

        if value.startswith("[") and value.endswith("]"):
            data[key] = parse_inline_array(value)
            index += 1
            continue

        data[key] = strip_quotes(value)
        index += 1

    return data


def extract_frontmatter(raw: str) -> dict[str, object]:
    match = FRONTMATTER_REGEX.search(raw)
    if not match:
        return {}
    return parse_frontmatter(match.group(1))


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

    metadata: dict[str, dict[str, object]] = {}
    for entry in files:
        file_path = POSTS_DIR / entry
        raw = file_path.read_text(encoding="utf-8")
        frontmatter = extract_frontmatter(raw)
        updated_at = run_git(["log", "-1", "--format=%cI", "--", entry])
        if not updated_at:
            raise SystemExit(f"Missing git timestamp for {entry}")
        metadata[entry] = {"updatedAt": updated_at, "frontmatter": frontmatter}

    META_PATH.parent.mkdir(parents=True, exist_ok=True)
    META_PATH.write_text(f"{json.dumps(metadata, indent=2, sort_keys=True)}\n")
    print(f"Wrote {META_PATH} with {len(files)} entries.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
