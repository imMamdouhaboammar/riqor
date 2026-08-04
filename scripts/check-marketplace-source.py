#!/usr/bin/env python3
import json
import os
import sys


def normalized(path):
    return os.path.realpath(os.path.expanduser(path)) if isinstance(path, str) else ""


def main():
    if len(sys.argv) != 3:
        print("usage: check-marketplace-source.py <name> <root>", file=sys.stderr)
        return 2
    name, expected_root = sys.argv[1], normalized(sys.argv[2])
    try:
        data = json.load(sys.stdin)
    except Exception as error:
        print("unable to parse Codex marketplace inventory: %s" % error, file=sys.stderr)
        return 2
    matches = [entry for entry in data.get("marketplaces", []) if entry.get("name") == name]
    if not matches:
        print("absent")
        return 3
    entry = matches[0]
    source = entry.get("marketplaceSource") or {}
    root_matches = normalized(entry.get("root")) == expected_root
    source_matches = source.get("sourceType") == "local" and normalized(source.get("source")) == expected_root
    if root_matches and source_matches:
        print("match")
        return 0
    print(
        "marketplace %s points to a different source; remove or rename the conflicting marketplace before installing\n"
        "expected: %s\nactual root: %s\nactual source: %s" % (
            name,
            expected_root,
            entry.get("root"),
            source.get("source"),
        ),
        file=sys.stderr,
    )
    return 4


if __name__ == "__main__":
    sys.exit(main())
