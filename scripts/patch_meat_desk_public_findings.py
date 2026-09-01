#!/usr/bin/env python3
"""Apply approved small publicFindings overrides after the normal Meat Desk source sync.

Review sidecars may optionally include a top-level publicFindingsPatch object. This
allows a source's presentation metadata to change without duplicating or replacing
its already-reviewed carry/watch/conflict arrays.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_DIR = ROOT / "research" / "season-previews" / "private"
MANIFEST_PATH = ROOT / "research" / "season-previews" / "manifest.json"


def main() -> None:
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    sources = manifest.get("sources")
    if not isinstance(sources, list):
        raise RuntimeError("Meat Desk manifest sources must be a list")

    changed = False
    for path in sorted(PRIVATE_DIR.glob("*-manifest.json")):
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
        patch = payload.get("publicFindingsPatch")
        if not isinstance(patch, dict) or not patch:
            continue

        source_id = payload.get("sourceId")
        filename = payload.get("file")
        matches = [
            source
            for source in sources
            if (
                source_id and source.get("id") == source_id
            ) or (
                filename and source.get("file") == filename
            )
        ]
        if len(matches) != 1:
            raise RuntimeError(
                f"publicFindingsPatch must match exactly one Meat Desk source: {path}"
            )

        target = matches[0]
        findings = target.get("publicFindings")
        if not isinstance(findings, dict):
            findings = {}
        before = json.dumps(findings, sort_keys=True)
        findings.update(patch)
        target["publicFindings"] = findings
        changed = changed or before != json.dumps(findings, sort_keys=True)

    if changed:
        with MANIFEST_PATH.open("w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2)
            handle.write("\n")


if __name__ == "__main__":
    main()
