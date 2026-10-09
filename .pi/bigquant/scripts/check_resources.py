"""Check skill metadata, reference integrity and links; no strategy execution."""

import argparse
import hashlib
import json
import re
from pathlib import Path

from platform_io import ROOT, SKILLS_ROOT, read_agents


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, help="Optionally compare snapshots with original prompt files")
    args = parser.parse_args()
    errors = []
    try:
        agents = read_agents()
    except (OSError, ValueError, KeyError) as error:
        print(json.dumps({"ok": False, "errors": [str(error)]}, ensure_ascii=False))
        return 1
    names = set()
    aliases = set()
    for agent in agents:
        name = agent["skill"]
        folder = SKILLS_ROOT / name
        try:
            if name in names:
                raise ValueError(f"Duplicate skill: {name}")
            names.add(name)
            for alias in [agent["id"], name, *agent["aliases"]]:
                normalized = alias.casefold()
                if normalized in aliases:
                    raise ValueError(f"Duplicate agent alias: {alias}")
                aliases.add(normalized)
            skill = (folder / "SKILL.md").read_text(encoding="utf-8")
            match = re.match(r"^---\nname: ([^\n]+)\ndescription: ([^\n]+)\n---\n", skill)
            if not match or match[1] != name or not 1 <= len(match[2]) <= 1024:
                raise ValueError(f"Invalid SKILL.md frontmatter: {name}")
            source = folder / "references/source.md"
            raw = source.read_bytes()
            if hashlib.sha256(raw).hexdigest() != agent["sha256"]:
                raise ValueError(f"Source snapshot hash mismatch: {name}")
            if args.source_dir and raw != (args.source_dir / agent["source"]).read_bytes():
                raise ValueError(f"Original source differs: {name}")
            source_text = raw.decode("utf-8-sig")
            for key in agent["placeholders"]:
                if f"__{key}__" not in source_text:
                    raise ValueError(f"Declared placeholder absent: {name}/{key}")
            for target in re.findall(r"\]\(([^)]+)\)", skill):
                if "://" not in target and not (folder / target.split("#", 1)[0]).exists():
                    raise ValueError(f"Broken skill reference: {name}/{target}")
            index = (folder / "references/index.md").read_text(encoding="utf-8")
            total = len(source_text.splitlines())
            if any(not 1 <= int(line) <= total for line in re.findall(r"第 (\d+) 行", index)):
                raise ValueError(f"Reference index line out of bounds: {name}")
        except (OSError, ValueError, KeyError) as error:
            errors.append(str(error))
    for filename in ("common.md", "MIGRATION.md", "README.md"):
        if not (ROOT / filename).is_file():
            errors.append(f"Missing {filename}")
    print(json.dumps({"ok": not errors, "skills": len(agents), "scope": "resources-only", "errors": errors}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
