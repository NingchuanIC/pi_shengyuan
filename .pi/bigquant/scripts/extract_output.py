"""Export Python or SQL from a platform-style answer; does not execute it."""

import argparse
import json
import sys
from pathlib import Path

from platform_io import extract_artifacts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="UTF-8 answer file")
    parser.add_argument("--output", type=Path, help="Write one selected artifact; default returns a JSON catalog")
    parser.add_argument("--index", type=int, help="Zero-based artifact index; required when exporting multiple candidates")
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    try:
        artifacts = extract_artifacts(args.input.read_text(encoding="utf-8-sig"))
        if args.output:
            if len(artifacts) != 1 and args.index is None:
                raise ValueError("Multiple artifacts: select one with --index or omit --output to list all")
            index = args.index if args.index is not None else 0
            if not 0 <= index < len(artifacts):
                raise ValueError("Artifact index is out of range")
            artifact = artifacts[index]
            suffix = ".py" if artifact["language"] == "python" else ".sql"
            if args.output.suffix.lower() != suffix:
                raise ValueError(f"Selected artifact requires a {suffix} output file")
            with args.output.open("w" if args.overwrite else "x", encoding="utf-8", newline="\n") as handle:
                handle.write(artifact["code"] + "\n")
            print(json.dumps({"output": str(args.output.resolve()), "kind": artifact["kind"]}, ensure_ascii=False))
        else:
            print(json.dumps(artifacts, ensure_ascii=False, indent=2))
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
