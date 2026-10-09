"""Compile source in memory only. No imports, eval, exec, platform calls or pyc files."""

import argparse
import json
import sys
from pathlib import Path

from platform_io import extract_artifacts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", type=Path, help="Python files or directories; directories select *.py recursively")
    parser.add_argument("--response", action="store_true", help="Inputs are answer files; extract and check Python artifacts")
    args = parser.parse_args()
    reports = []
    failed = False
    for target in args.paths:
        paths = sorted(target.rglob("*.py")) if target.is_dir() else [target]
        if not paths:
            reports.append({"file": str(target), "ok": False, "error": "No Python files found"})
            failed = True
        for filename in paths:
            try:
                text = filename.read_text(encoding="utf-8-sig")
                artifacts = extract_artifacts(text) if args.response else [{"language": "python", "code": text}]
                python_artifacts = [item for item in artifacts if item["language"] == "python"]
                if not python_artifacts:
                    raise ValueError("No Python artifact to compile; SQL is outside this check")
                for index, artifact in enumerate(python_artifacts):
                    label = f"{filename}:artifact-{index}" if args.response else str(filename)
                    try:
                        # Creating a code object validates syntax and compile-time rules without executing it.
                        compile(artifact["code"], label, "exec", dont_inherit=True)
                        reports.append({"file": label, "ok": True})
                    except SyntaxError as error:
                        failed = True
                        reports.append({"file": label, "ok": False, "line": error.lineno, "column": error.offset, "error": error.msg})
            except (OSError, ValueError) as error:
                failed = True
                reports.append({"file": str(filename), "ok": False, "error": str(error)})
    print(json.dumps({"ok": not failed, "scope": "python-syntax-only", "files": reports}, ensure_ascii=False, indent=2))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    raise SystemExit(main())
