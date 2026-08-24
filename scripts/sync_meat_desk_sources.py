#!/usr/bin/env python3
"""Keep the Meat Desk manifest synchronized with source-pdfs/*.pdf.

The PDF folder is the active-library source of truth. Existing manifest metadata is
preserved for files that remain present. Newly added PDFs are registered as
available but not analyzed. Entries whose PDF has been removed disappear from the
active manifest. This script registers sources only; it never analyzes document
content.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "research" / "season-previews" / "source-pdfs"
MANIFEST_PATH = ROOT / "research" / "season-previews" / "manifest.json"

DEFAULT_POLICY = {
    "mode": "ONE-TIME FULL SOURCE REVIEW",
    "publication": "PUBLISH AFTER REVIEW",
    "runtimeUse": "SAVED RESEARCH INDEX ONLY",
    "decisionPolicy": "REFERENCE CONTEXT ONLY // EXISTING BETTING EDGE ENGINE MAKES BET DECISIONS",
    "analysisTrigger": "MANUAL CHATGPT UPLOAD ONLY",
    "sourceAccess": "PRIVATE // NO PUBLIC DOCUMENT ACCESS",
}


def slugify(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value or "meat-desk-source"


def human_title(filename: str) -> str:
    stem = Path(filename).stem
    text = re.sub(r"[_-]+", " ", stem)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def infer_metadata(filename: str) -> dict:
    lower = filename.lower()
    year_match = re.search(r"\b(20\d{2})\b", filename)
    year = year_match.group(1) if year_match else "CURRENT"

    if "fantasy" in lower:
        desk = "FANTASY"
        kind = "FANTASY FOOTBALL SOURCE"
        season = f"{year} NFL"
        tags = ["NFL", "FANTASY", year]
    elif "cfb" in lower or "college-football" in lower or "college football" in lower:
        desk = "CFB"
        kind = "COLLEGE FOOTBALL BETTING SOURCE"
        season = f"{year} CFB"
        tags = ["CFB", year]
    elif "nfl" in lower:
        desk = "NFL"
        kind = "NFL BETTING SOURCE"
        season = f"{year} NFL"
        tags = ["NFL", year]
    elif "nhl" in lower or "hockey" in lower:
        desk = "NHL"
        kind = "NHL BETTING SOURCE"
        season = f"{year} NHL"
        tags = ["NHL", year]
    elif "ncaab" in lower or "ncaamb" in lower or "college-basketball" in lower or "college basketball" in lower or "cbb" in lower:
        desk = "CBB"
        kind = "COLLEGE BASKETBALL BETTING SOURCE"
        season = f"{year} CBB"
        tags = ["CBB", year]
    elif "nba" in lower or "basketball" in lower:
        desk = "NBA"
        kind = "NBA BETTING SOURCE"
        season = f"{year} NBA"
        tags = ["NBA", year]
    elif "derby" in lower or "racing" in lower or "horse" in lower:
        desk = "RACING"
        kind = "HORSE RACING BETTING SOURCE"
        season = year
        tags = ["RACING", year]
    else:
        desk = "GENERAL"
        kind = "MEAT DESK SOURCE"
        season = year
        tags = [year] if year != "CURRENT" else []

    return {
        "desk": desk,
        "kind": kind,
        "season": season,
        "tags": tags,
    }


def new_entry(pdf: Path) -> dict:
    inferred = infer_metadata(pdf.name)
    return {
        "id": slugify(pdf.stem),
        "title": human_title(pdf.name),
        "file": pdf.name,
        "format": "PDF SOURCE",
        "kind": inferred["kind"],
        "season": inferred["season"],
        "desk": inferred["desk"],
        "bytes": pdf.stat().st_size,
        "tags": inferred["tags"],
        "status": "SOURCE AVAILABLE // PENDING REVIEW",
        "reviewMode": "ONE-TIME FULL SOURCE REVIEW",
        "publicationStatus": "PRIVATE // NOT PUBLISHED",
        "reviewedAt": None,
        "publishedAt": None,
        "use": "Private Meat Desk reference source. Existing Betting Edge engine remains the betting-decision layer.",
        "notes": "Registered from source-pdfs. No automatic analysis. Full-source review is triggered only after the source is manually uploaded to ChatGPT and approved for analysis.",
    }


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        return {}
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    manifest = load_manifest()

    existing_sources = manifest.get("sources", [])
    existing_by_file = {
        source.get("file"): source
        for source in existing_sources
        if isinstance(source, dict) and source.get("file")
    }

    pdfs = sorted(
        (path for path in SOURCE_DIR.iterdir() if path.is_file() and path.suffix.lower() == ".pdf"),
        key=lambda path: path.name.lower(),
    )
    present_names = {pdf.name for pdf in pdfs}

    # Preserve the current desk ordering for surviving sources, then append new
    # PDFs alphabetically. This avoids reshuffling the registry on every sync.
    sources = []
    used = set()
    for source in existing_sources:
        filename = source.get("file") if isinstance(source, dict) else None
        if not filename or filename not in present_names:
            continue
        pdf = SOURCE_DIR / filename
        kept = dict(source)
        kept["bytes"] = pdf.stat().st_size
        sources.append(kept)
        used.add(filename)

    for pdf in pdfs:
        if pdf.name in used:
            continue
        source = existing_by_file.get(pdf.name)
        if source:
            kept = dict(source)
            kept["bytes"] = pdf.stat().st_size
            sources.append(kept)
        else:
            sources.append(new_entry(pdf))

    manifest["schema"] = max(int(manifest.get("schema", 0) or 0), 3)
    manifest["title"] = manifest.get("title") or "Meat Desk Source Library"
    manifest["updatedAt"] = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    manifest["sourceFolder"] = "research/season-previews/source-pdfs/"
    policy = dict(DEFAULT_POLICY)
    policy.update(manifest.get("analysisPolicy") or {})
    manifest["analysisPolicy"] = policy
    manifest["sources"] = sources

    with MANIFEST_PATH.open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    removed = [source.get("file") for source in existing_sources if isinstance(source, dict) and source.get("file") not in present_names]
    added = [pdf.name for pdf in pdfs if pdf.name not in existing_by_file]
    print(f"Meat Desk sync complete: {len(sources)} active source(s)")
    if added:
        print("Added: " + ", ".join(added))
    if removed:
        print("Removed: " + ", ".join(name for name in removed if name))


if __name__ == "__main__":
    main()
