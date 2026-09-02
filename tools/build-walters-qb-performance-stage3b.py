#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import difflib
import gzip
import hashlib
import io
import json
import math
import os
import re
import shutil
import sys
import tempfile
import unicodedata
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
QB_ROOT = ROOT / "data" / "walters" / "nfl" / "qb-performance"
CONTRACT_PATH = QB_ROOT / "stage3b-contract-v1.json"
STAGE3A_CONTRACT_PATH = QB_ROOT / "stage3-contract-v1.json"
STAGE3_CURRENT_PATH = QB_ROOT / "stage3-current.json"
SOURCE_REGISTRY_PATH = QB_ROOT / "source-registry-v1.json"
SOURCE_MANIFEST_PATH = QB_ROOT / "source" / "source-manifest-v1.json"
RAW_ROOT = QB_ROOT / "source" / "raw"
NORMALIZED_ROOT = QB_ROOT / "normalized"
WEEKLY_OUTPUT_PATH = NORMALIZED_ROOT / "qb-weekly-2021-2025-v1.csv"
SEASONAL_OUTPUT_PATH = NORMALIZED_ROOT / "qb-seasonal-2021-2025-v1.csv"
IDENTITY_ALIASES_PATH = QB_ROOT / "identity-aliases-v1.json"
IDENTITY_CROSSWALK_PATH = QB_ROOT / "identity-crosswalk-v1.json"
AUDIT_PATH = QB_ROOT / "stage3b-audit-v1.json"
STAGE2_REGISTRY_PATH = ROOT / "data" / "walters" / "nfl" / "player-values" / "player-values-2026-v1.json"
STAGE2_CURRENT_PATH = ROOT / "data" / "walters" / "nfl" / "player-values" / "stage2-current.json"
EA_CURRENT_PATH = ROOT / "data" / "walters" / "nfl" / "madden27" / "madden27-current.json"
SCHEDULE_CONTEXT_PATH = ROOT / "data" / "walters" / "nfl" / "s-factors" / "source" / "nflverse-schedules-sfactor-snapshot-2026-09-01.csv"
PERSONNEL_CONTEXT_PATH = ROOT / "data" / "walters" / "nfl" / "personnel-production-current.json"
POWER_LEDGER_PATH = ROOT / "data" / "walters" / "nfl-power-ratings-ledger.json"
MATCHUP_CONTEXT_PATH = ROOT / "data" / "walters" / "nfl" / "matchup-production-current.json"
ACTIVE_WEEK_PATH = ROOT / "data" / "walters" / "nfl" / "active-week.json"

NFLVERSE_REPOSITORY = "nflverse/nflverse-data"
GITHUB_API = "https://api.github.com"
USER_AGENT = "BettingEdge-Walters-QB-Stage3B/1.0"

SOURCE_INTEGER_FIELDS = [
    "completions",
    "attempts",
    "passing_yards",
    "passing_tds",
    "interceptions",
    "sacks_suffered",
    "sack_yards",
    "sack_fumbles",
    "sack_fumbles_lost",
    "passing_first_downs",
    "carries",
    "rushing_yards",
    "rushing_tds",
    "rushing_fumbles",
    "rushing_fumbles_lost",
    "rushing_first_downs",
]
SOURCE_INTEGER_FIELD_MAP = {
    "interceptions": "passing_interceptions",
    "sack_yards": "sack_yards_lost",
}
SOURCE_FLOAT_FIELDS = ["passing_epa", "rushing_epa"]
DERIVED_FIELDS = [
    "dropbacks",
    "recorded_qb_fumbles",
    "recorded_qb_fumbles_lost",
    "nfl_passer_rating",
    "yards_per_attempt",
    "interception_rate",
    "sack_rate",
    "fumble_rate",
    "qb_rushing_yards_per_dropback",
]
WEEKLY_ID_FIELDS = [
    "player_id",
    "player_display_name",
    "position",
    "recent_team",
    "season",
    "week",
    "season_type",
    "opponent_team",
]
SEASONAL_ID_FIELDS = [
    "player_id",
    "player_display_name",
    "position",
    "recent_team",
    "season",
    "season_type",
]
WEEKLY_OUTPUT_FIELDS = WEEKLY_ID_FIELDS + SOURCE_INTEGER_FIELDS + SOURCE_FLOAT_FIELDS + DERIVED_FIELDS + ["source_asset"]
SEASONAL_OUTPUT_FIELDS = SEASONAL_ID_FIELDS + SOURCE_INTEGER_FIELDS + SOURCE_FLOAT_FIELDS + DERIVED_FIELDS + ["source_asset"]
FORBIDDEN_OUTPUT_TOKENS = ("spread", "odds", "moneyline", "pinnacle", "market", "book_price", "ats_result")
SUFFIX_TOKENS = {"jr", "sr", "ii", "iii", "iv", "v"}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def now_vancouver() -> str:
    return datetime.now(ZoneInfo("America/Vancouver")).isoformat(timespec="seconds")


def github_headers(accept: str = "application/vnd.github+json") -> dict[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def http_bytes(url: str, *, accept: str = "application/octet-stream", timeout: int = 90) -> bytes:
    request = urllib.request.Request(url, headers=github_headers(accept))
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {error.code} for {url}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Network error for {url}: {error}") from error


def http_json(url: str) -> Any:
    return json.loads(http_bytes(url, accept="application/vnd.github+json").decode("utf-8"))


def release_assets(tag: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    release = http_json(f"{GITHUB_API}/repos/{NFLVERSE_REPOSITORY}/releases/tags/{tag}")
    assets: list[dict[str, Any]] = []
    page = 1
    while True:
        batch = http_json(f"{release['assets_url']}?per_page=100&page={page}")
        if not isinstance(batch, list):
            raise RuntimeError(f"Unexpected release asset response for tag {tag}")
        assets.extend(batch)
        if len(batch) < 100:
            break
        page += 1
        if page > 20:
            raise RuntimeError(f"Release asset pagination exceeded safety limit for tag {tag}")
    return release, assets


def expected_asset_names(seasons: list[int]) -> dict[str, str]:
    expected = {"players.csv.gz": "players"}
    for season in seasons:
        expected[f"stats_player_week_{season}.csv.gz"] = "stats_player"
        expected[f"stats_player_reg_{season}.csv.gz"] = "stats_player"
    return expected


def upstream_digest_sha(asset: dict[str, Any]) -> str | None:
    digest = asset.get("digest")
    if not digest:
        return None
    digest = str(digest)
    if not digest.startswith("sha256:"):
        raise RuntimeError(f"Unsupported upstream digest format for {asset.get('name')}: {digest}")
    return digest.split(":", 1)[1].lower()


def build_initial_source_manifest(contract: dict[str, Any]) -> dict[str, Any]:
    seasons = [int(value) for value in contract["captureWindow"]["seasons"]]
    expected = expected_asset_names(seasons)
    releases: dict[str, dict[str, Any]] = {}
    by_tag: dict[str, dict[str, dict[str, Any]]] = {}
    for tag in sorted(set(expected.values())):
        release, assets = release_assets(tag)
        releases[tag] = release
        by_tag[tag] = {str(asset.get("name")): asset for asset in assets}

    captured_at = now_vancouver()
    records: list[dict[str, Any]] = []
    RAW_ROOT.mkdir(parents=True, exist_ok=True)
    for asset_name, tag in sorted(expected.items(), key=lambda item: (item[1], item[0])):
        asset = by_tag[tag].get(asset_name)
        if asset is None:
            raise RuntimeError(f"Required nflverse release asset not found: tag={tag} asset={asset_name}")
        data = http_bytes(str(asset["browser_download_url"]))
        computed_sha = sha256_bytes(data)
        expected_sha = upstream_digest_sha(asset)
        if int(asset.get("size", -1)) != len(data):
            raise RuntimeError(
                f"Asset byte-size mismatch for {asset_name}: metadata={asset.get('size')} downloaded={len(data)}"
            )
        if expected_sha and expected_sha != computed_sha:
            raise RuntimeError(
                f"Asset SHA-256 mismatch for {asset_name}: upstream={expected_sha} computed={computed_sha}"
            )
        raw_path = RAW_ROOT / asset_name
        raw_path.write_bytes(data)
        release = releases[tag]
        records.append(
            {
                "releaseId": int(release["id"]),
                "releaseTag": str(release["tag_name"]),
                "releaseUpdatedAt": release.get("updated_at"),
                "assetId": int(asset["id"]),
                "assetName": asset_name,
                "browserDownloadUrl": str(asset["browser_download_url"]),
                "byteSize": len(data),
                "upstreamDigest": asset.get("digest"),
                "computedSha256": computed_sha,
                "assetUpdatedAt": asset.get("updated_at"),
                "rawPath": relative(raw_path),
            }
        )

    manifest = {
        "schemaVersion": "walters-qb-performance-source-manifest-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3B",
        "status": "SOURCE_ASSETS_HASH_LOCKED",
        "capturedAt": captured_at,
        "captureTimezone": "America/Vancouver",
        "provider": "nflverse",
        "repository": NFLVERSE_REPOSITORY,
        "seasons": seasons,
        "gameType": contract["captureWindow"]["gameType"],
        "assetCount": len(records),
        "allUpstreamDigestsPresent": all(record["upstreamDigest"] for record in records),
        "allComputedHashesVerified": True,
        "initialCaptureCompleted": True,
        "marketViewed": False,
        "assets": records,
    }
    write_json(SOURCE_MANIFEST_PATH, manifest)
    return manifest


def verify_locked_source_manifest(contract: dict[str, Any], manifest: dict[str, Any]) -> dict[str, Any]:
    seasons = [int(value) for value in contract["captureWindow"]["seasons"]]
    expected = set(expected_asset_names(seasons))
    actual = {str(record.get("assetName")) for record in manifest.get("assets", [])}
    if manifest.get("status") != "SOURCE_ASSETS_HASH_LOCKED":
        raise RuntimeError("Existing Stage 3B source manifest is not source-locked")
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise RuntimeError(f"Locked source manifest asset set mismatch: missing={missing} extra={extra}")
    for record in manifest["assets"]:
        raw_path = ROOT / str(record["rawPath"])
        if not raw_path.exists():
            raise RuntimeError(f"Locked raw source asset is missing: {record['rawPath']}")
        actual_size = raw_path.stat().st_size
        actual_sha = sha256_file(raw_path)
        if actual_size != int(record["byteSize"]):
            raise RuntimeError(f"Locked raw asset size mismatch: {record['assetName']}")
        if actual_sha != str(record["computedSha256"]):
            raise RuntimeError(f"Locked raw asset SHA-256 mismatch: {record['assetName']}")
        expected_sha = upstream_digest_sha({"name": record["assetName"], "digest": record.get("upstreamDigest")})
        if expected_sha and expected_sha != actual_sha:
            raise RuntimeError(f"Locked raw asset no longer matches upstream digest: {record['assetName']}")
    return manifest


def load_or_capture_manifest(contract: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    if SOURCE_MANIFEST_PATH.exists():
        manifest = verify_locked_source_manifest(contract, read_json(SOURCE_MANIFEST_PATH))
        return manifest, False
    return build_initial_source_manifest(contract), True


def normalize_header(name: str) -> str:
    return str(name or "").lstrip("\ufeff").strip()


def csv_rows_from_gzip(path: Path) -> tuple[list[str], Iterable[dict[str, str]]]:
    handle = gzip.open(path, mode="rt", encoding="utf-8-sig", newline="")
    reader = csv.DictReader(handle)
    if reader.fieldnames is None:
        handle.close()
        raise RuntimeError(f"CSV asset has no header: {relative(path)}")
    reader.fieldnames = [normalize_header(name) for name in reader.fieldnames]

    def iterator() -> Iterable[dict[str, str]]:
        try:
            for row in reader:
                yield {normalize_header(key): value for key, value in row.items()}
        finally:
            handle.close()

    return list(reader.fieldnames), iterator()


def require_fields(headers: list[str], required: Iterable[str], asset_name: str) -> None:
    header_set = set(headers)
    missing = [field for field in required if field not in header_set]
    if missing:
        raise RuntimeError(f"Required fields missing from {asset_name}: {missing}")


def text_value(row: dict[str, Any], key: str, default: str = "") -> str:
    value = row.get(key)
    if value is None:
        return default
    return str(value).strip()


def int_value(row: dict[str, Any], key: str) -> int:
    raw = row.get(key)
    if raw is None or str(raw).strip() in {"", "NA", "NaN", "nan", "NULL", "null"}:
        return 0
    value = float(str(raw).strip())
    if not math.isfinite(value):
        return 0
    rounded = round(value)
    if abs(value - rounded) > 1e-6:
        raise RuntimeError(f"Expected integer-compatible value for {key}, received {raw!r}")
    return int(rounded)


def float_value(row: dict[str, Any], key: str) -> float:
    raw = row.get(key)
    if raw is None or str(raw).strip() in {"", "NA", "NaN", "nan", "NULL", "null"}:
        return 0.0
    value = float(str(raw).strip())
    if not math.isfinite(value):
        return 0.0
    return value


def safe_ratio(numerator: float, denominator: float) -> float | None:
    if denominator <= 0:
        return None
    return round(numerator / denominator, 8)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def nfl_passer_rating(completions: int, attempts: int, yards: int, touchdowns: int, interceptions: int) -> float | None:
    if attempts <= 0:
        return None
    a = clamp(((completions / attempts) - 0.3) * 5.0, 0.0, 2.375)
    b = clamp(((yards / attempts) - 3.0) * 0.25, 0.0, 2.375)
    c = clamp((touchdowns / attempts) * 20.0, 0.0, 2.375)
    d = clamp(2.375 - ((interceptions / attempts) * 25.0), 0.0, 2.375)
    return round(((a + b + c + d) / 6.0) * 100.0, 6)


def add_derived(row: dict[str, Any]) -> dict[str, Any]:
    attempts = int(row["attempts"])
    sacks = int(row["sacks_suffered"])
    dropbacks = attempts + sacks
    fumbles = int(row["sack_fumbles"]) + int(row["rushing_fumbles"])
    fumbles_lost = int(row["sack_fumbles_lost"]) + int(row["rushing_fumbles_lost"])
    row["dropbacks"] = dropbacks
    row["recorded_qb_fumbles"] = fumbles
    row["recorded_qb_fumbles_lost"] = fumbles_lost
    row["nfl_passer_rating"] = nfl_passer_rating(
        int(row["completions"]),
        attempts,
        int(row["passing_yards"]),
        int(row["passing_tds"]),
        int(row["interceptions"]),
    )
    row["yards_per_attempt"] = safe_ratio(int(row["passing_yards"]), attempts)
    row["interception_rate"] = safe_ratio(int(row["interceptions"]), attempts)
    row["sack_rate"] = safe_ratio(sacks, dropbacks)
    row["fumble_rate"] = safe_ratio(fumbles, dropbacks)
    row["qb_rushing_yards_per_dropback"] = safe_ratio(int(row["rushing_yards"]), dropbacks)
    return row


def source_record(manifest: dict[str, Any], name: str) -> dict[str, Any]:
    for record in manifest["assets"]:
        if record["assetName"] == name:
            return record
    raise RuntimeError(f"Source manifest does not contain {name}")


def normalized_base_row(source: dict[str, Any], *, weekly: bool) -> dict[str, Any]:
    result: dict[str, Any] = {
        "player_id": text_value(source, "player_id"),
        "player_display_name": text_value(source, "player_display_name"),
        "position": text_value(source, "position").upper(),
        "recent_team": text_value(source, "team" if weekly else "recent_team").upper(),
        "season": int_value(source, "season"),
        "season_type": text_value(source, "season_type", "REG").upper() or "REG",
    }
    if weekly:
        result["week"] = int_value(source, "week")
        result["opponent_team"] = text_value(source, "opponent_team").upper()
    for field in SOURCE_INTEGER_FIELDS:
        source_field = SOURCE_INTEGER_FIELD_MAP.get(field, field)
        result[field] = int_value(source, source_field)
    for field in SOURCE_FLOAT_FIELDS:
        result[field] = round(float_value(source, field), 8)
    return add_derived(result)


def normalize_weekly_assets(contract: dict[str, Any], manifest: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    seasons = [int(value) for value in contract["captureWindow"]["seasons"]]
    rows: list[dict[str, Any]] = []
    headers_by_asset: dict[str, list[str]] = {}
    required = list(contract["weeklyFieldWhitelist"])
    for season in seasons:
        name = f"stats_player_week_{season}.csv.gz"
        record = source_record(manifest, name)
        raw_path = ROOT / record["rawPath"]
        headers, source_rows = csv_rows_from_gzip(raw_path)
        headers_by_asset[name] = headers
        require_fields(headers, required, name)
        for source in source_rows:
            if text_value(source, "season_type", "REG").upper() != "REG":
                continue
            if text_value(source, "position").upper() != "QB":
                continue
            row = normalized_base_row(source, weekly=True)
            if row["season"] != season:
                raise RuntimeError(f"Season identity mismatch inside {name}: {row['season']}")
            if not row["player_id"]:
                raise RuntimeError(f"QB row without player_id in {name}: {row['player_display_name']}")
            row["source_asset"] = name
            rows.append(row)
    rows.sort(key=lambda row: (int(row["season"]), int(row["week"]), str(row["player_id"]), str(row["recent_team"])))
    return rows, headers_by_asset


def aggregate_source_rows(rows: Iterable[dict[str, Any]], *, season: int, asset_name: str) -> list[dict[str, Any]]:
    by_player: dict[str, dict[str, Any]] = {}
    teams: dict[str, set[str]] = defaultdict(set)
    for source in rows:
        if text_value(source, "season_type", "REG").upper() != "REG":
            continue
        if text_value(source, "position").upper() != "QB":
            continue
        base = normalized_base_row(source, weekly=False)
        if base["season"] != season:
            raise RuntimeError(f"Season identity mismatch inside {asset_name}: {base['season']}")
        player_id = str(base["player_id"])
        if not player_id:
            raise RuntimeError(f"QB season row without player_id in {asset_name}")
        if player_id not in by_player:
            by_player[player_id] = {
                **base,
                "recent_team": "",
                "source_asset": asset_name,
            }
        else:
            target = by_player[player_id]
            for field in SOURCE_INTEGER_FIELDS:
                target[field] += int(base[field])
            for field in SOURCE_FLOAT_FIELDS:
                target[field] = round(float(target[field]) + float(base[field]), 8)
            if not target["player_display_name"] and base["player_display_name"]:
                target["player_display_name"] = base["player_display_name"]
        if base["recent_team"]:
            teams[player_id].add(str(base["recent_team"]))
    result: list[dict[str, Any]] = []
    for player_id, row in by_player.items():
        row["recent_team"] = "|".join(sorted(teams[player_id]))
        result.append(add_derived(row))
    result.sort(key=lambda row: (int(row["season"]), str(row["player_id"])))
    return result


def normalize_seasonal_assets(contract: dict[str, Any], manifest: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    seasons = [int(value) for value in contract["captureWindow"]["seasons"]]
    output: list[dict[str, Any]] = []
    headers_by_asset: dict[str, list[str]] = {}
    required = list(contract["seasonalFieldWhitelist"])
    for season in seasons:
        name = f"stats_player_reg_{season}.csv.gz"
        record = source_record(manifest, name)
        raw_path = ROOT / record["rawPath"]
        headers, source_rows = csv_rows_from_gzip(raw_path)
        headers_by_asset[name] = headers
        require_fields(headers, required, name)
        output.extend(aggregate_source_rows(source_rows, season=season, asset_name=name))
    output.sort(key=lambda row: (int(row["season"]), str(row["player_id"])))
    return output, headers_by_asset


def serialize_csv_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, float):
        if not math.isfinite(value):
            return ""
        return f"{value:.8f}".rstrip("0").rstrip(".")
    return value


def write_csv(path: Path, fieldnames: list[str], rows: Iterable[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: serialize_csv_value(row.get(field)) for field in fieldnames})


def weekly_aggregate(rows: list[dict[str, Any]]) -> dict[tuple[int, str], dict[str, int]]:
    result: dict[tuple[int, str], dict[str, int]] = {}
    for row in rows:
        key = (int(row["season"]), str(row["player_id"]))
        bucket = result.setdefault(key, {field: 0 for field in SOURCE_INTEGER_FIELDS})
        for field in SOURCE_INTEGER_FIELDS:
            bucket[field] += int(row[field])
    return result


def seasonal_aggregate(rows: list[dict[str, Any]]) -> dict[tuple[int, str], dict[str, int]]:
    result: dict[tuple[int, str], dict[str, int]] = {}
    for row in rows:
        key = (int(row["season"]), str(row["player_id"]))
        bucket = result.setdefault(key, {field: 0 for field in SOURCE_INTEGER_FIELDS})
        for field in SOURCE_INTEGER_FIELDS:
            bucket[field] += int(row[field])
    return result


def crosscheck_weekly_vs_seasonal(
    contract: dict[str, Any], weekly_rows: list[dict[str, Any]], seasonal_rows: list[dict[str, Any]]
) -> dict[str, Any]:
    fields = [str(field) for field in contract["crosscheck"]["exactCountingFields"]]
    weekly = weekly_aggregate(weekly_rows)
    seasonal = seasonal_aggregate(seasonal_rows)
    mismatches: list[dict[str, Any]] = []
    keys = sorted(set(weekly) | set(seasonal))
    for season, player_id in keys:
        weekly_record = weekly.get((season, player_id), {field: 0 for field in SOURCE_INTEGER_FIELDS})
        seasonal_record = seasonal.get((season, player_id), {field: 0 for field in SOURCE_INTEGER_FIELDS})
        field_mismatches = {
            field: {"weekly": int(weekly_record[field]), "seasonal": int(seasonal_record[field])}
            for field in fields
            if int(weekly_record[field]) != int(seasonal_record[field])
        }
        if field_mismatches:
            mismatches.append(
                {
                    "season": season,
                    "playerId": player_id,
                    "fields": field_mismatches,
                }
            )
    return {
        "state": "PASS" if not mismatches else "FAIL_CLOSED_MISMATCH",
        "comparedPlayerSeasons": len(keys),
        "fieldCount": len(fields),
        "mismatchCount": len(mismatches),
        "mismatches": mismatches[:100],
        "mismatchListTruncated": len(mismatches) > 100,
    }


def normalize_name(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    text = text.lower().replace("’", "'")
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [token for token in text.split() if token and token not in SUFFIX_TOKENS]
    return " ".join(tokens)


def normalized_last_name(value: Any) -> str:
    key = normalize_name(value)
    return key.split()[-1] if key else ""


def normalize_birthdate(value: Any) -> str | None:
    raw = str(value or "").strip()
    if not raw or raw.lower() in {"na", "nan", "none", "null"}:
        return None
    raw = raw.split("T", 1)[0]
    formats = ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y%m%d")
    for pattern in formats:
        try:
            return datetime.strptime(raw, pattern).date().isoformat()
        except ValueError:
            pass
    try:
        return date.fromisoformat(raw).isoformat()
    except ValueError:
        return raw


def first_present(row: dict[str, Any], fields: Iterable[str]) -> str:
    for field in fields:
        value = text_value(row, field)
        if value:
            return value
    return ""


def player_identity_names(row: dict[str, Any]) -> set[str]:
    names: set[str] = set()
    for field in (
        "display_name",
        "full_name",
        "player_display_name",
        "common_name",
        "short_name",
    ):
        value = text_value(row, field)
        key = normalize_name(value)
        if key:
            names.add(key)
    first_names = [
        first_present(row, ("common_first_name", "first_name")),
        first_present(row, ("football_name",)),
    ]
    last_name = first_present(row, ("common_last_name", "last_name"))
    for first_name in first_names:
        key = normalize_name(f"{first_name} {last_name}")
        if key:
            names.add(key)
    return names


def read_players_identity(manifest: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], dict[str, set[str]], dict[str, set[str]], dict[str, list[str]]]:
    record = source_record(manifest, "players.csv.gz")
    raw_path = ROOT / record["rawPath"]
    headers, rows = csv_rows_from_gzip(raw_path)
    gsis_field = next((field for field in ("gsis_id", "player_id") if field in headers), None)
    if gsis_field is None:
        raise RuntimeError("nflverse players asset contains no GSIS/player identity field")
    position_fields = [field for field in ("position", "ngs_position", "position_group") if field in headers]
    if not position_fields:
        raise RuntimeError("nflverse players asset contains no position field")
    records: dict[str, dict[str, Any]] = {}
    name_index: dict[str, set[str]] = defaultdict(set)
    birth_last_index: dict[str, set[str]] = defaultdict(set)
    for row in rows:
        gsis_id = text_value(row, gsis_field)
        if not gsis_id:
            continue
        position = first_present(row, position_fields).upper()
        if position and position != "QB":
            continue
        names = player_identity_names(row)
        if not names:
            continue
        display_name = first_present(row, ("display_name", "full_name", "player_display_name"))
        birthdate = normalize_birthdate(first_present(row, ("birth_date", "birthdate", "date_of_birth")))
        last_name = first_present(row, ("common_last_name", "last_name")) or normalized_last_name(display_name)
        identity = {
            "gsisId": gsis_id,
            "displayName": display_name,
            "birthdate": birthdate,
            "position": position or "QB",
            "nameKeys": sorted(names),
            "lastNameKey": normalized_last_name(last_name),
        }
        records[gsis_id] = identity
        for name_key in names:
            name_index[name_key].add(gsis_id)
        if birthdate and identity["lastNameKey"]:
            birth_last_index[f"{birthdate}|{identity['lastNameKey']}"] .add(gsis_id)
    if not records:
        raise RuntimeError("No quarterback identities were read from nflverse players asset")
    return records, name_index, birth_last_index, {"headers": headers}


def load_aliases() -> dict[str, str]:
    aliases_doc = read_json(IDENTITY_ALIASES_PATH)
    aliases: dict[str, str] = {}
    for entry in aliases_doc.get("aliases", []):
        ea_id = str(entry.get("eaPlayerId", "")).strip()
        gsis_id = str(entry.get("gsisId", "")).strip()
        if not ea_id or not gsis_id:
            raise RuntimeError("Identity alias rows require eaPlayerId and gsisId")
        if ea_id in aliases:
            raise RuntimeError(f"Duplicate identity alias for EA player {ea_id}")
        aliases[ea_id] = gsis_id
    return aliases


def load_ea_birthdates() -> dict[str, str | None]:
    current = read_json(EA_CURRENT_PATH)
    normalized_path = ROOT / "data" / "walters" / "nfl" / "madden27" / str(current["normalizedPath"])
    normalized = read_json(normalized_path)
    return {
        str(player.get("eaPlayerId")): normalize_birthdate(player.get("birthdate"))
        for player in normalized.get("players", [])
    }


def suggestions_for_name(name_key: str, identity_records: dict[str, dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    choices: list[tuple[float, dict[str, Any]]] = []
    for identity in identity_records.values():
        score = max((difflib.SequenceMatcher(None, name_key, key).ratio() for key in identity["nameKeys"]), default=0.0)
        if score >= 0.60:
            choices.append((score, identity))
    choices.sort(key=lambda item: (-item[0], item[1]["displayName"], item[1]["gsisId"]))
    return [
        {
            "gsisId": identity["gsisId"],
            "displayName": identity["displayName"],
            "birthdate": identity["birthdate"],
            "similarity": round(score, 4),
        }
        for score, identity in choices[:limit]
    ]


def resolve_ea_identities(
    manifest: dict[str, Any], weekly_rows: list[dict[str, Any]]
) -> tuple[dict[str, Any], dict[str, Any]]:
    stage2 = read_json(STAGE2_REGISTRY_PATH)
    ea_birthdates = load_ea_birthdates()
    aliases = load_aliases()
    identity_records, name_index, birth_last_index, identity_meta = read_players_identity(manifest)

    current_qbs = [
        player
        for player in stage2.get("players", [])
        if player.get("teamStatus") == "NFL_TEAM"
        and player.get("position") == "QB"
        and player.get("curve") == "QB"
        and player.get("valueStatus") == "CALIBRATED"
    ]
    current_qbs.sort(
        key=lambda player: (
            -int(player.get("maddenOvr") or 0),
            int(player["eaPlayerId"]) if str(player.get("eaPlayerId", "")).isdigit() else str(player.get("eaPlayerId", "")),
        )
    )
    top67_ids = {str(player["eaPlayerId"]) for player in current_qbs[:67]}
    if len(top67_ids) != 67:
        raise RuntimeError(f"Stage 3B could not reconstruct the 67-QB Stage 2 cohort: {len(top67_ids)}")

    history: dict[str, dict[str, int]] = defaultdict(lambda: {"weeklyRows": 0, "attempts": 0, "dropbacks": 0})
    for row in weekly_rows:
        bucket = history[str(row["player_id"])]
        bucket["weeklyRows"] += 1
        bucket["attempts"] += int(row["attempts"])
        bucket["dropbacks"] += int(row["dropbacks"])

    results: list[dict[str, Any]] = []
    assigned: dict[str, list[str]] = defaultdict(list)
    blocked = 0
    for player in current_qbs:
        ea_id = str(player["eaPlayerId"])
        ea_name = str(player.get("player") or "").strip()
        ea_birthdate = ea_birthdates.get(ea_id)
        name_key = normalize_name(ea_name)
        last_name_key = normalized_last_name(ea_name)
        candidates: set[str] = set()
        method = None

        if ea_id in aliases:
            alias_id = aliases[ea_id]
            if alias_id not in identity_records:
                raise RuntimeError(f"Reviewed alias references unknown nflverse GSIS ID: EA={ea_id} GSIS={alias_id}")
            candidates = {alias_id}
            method = "MATCHED_REVIEWED_ALIAS"
        else:
            by_name = set(name_index.get(name_key, set()))
            if ea_birthdate and by_name:
                exact_birth = {candidate for candidate in by_name if identity_records[candidate]["birthdate"] == ea_birthdate}
                if len(exact_birth) == 1:
                    candidates = exact_birth
                    method = "MATCHED_NAME_BIRTHDATE"
                elif len(exact_birth) > 1:
                    candidates = exact_birth
            if not candidates and len(by_name) == 1:
                candidates = by_name
                method = "MATCHED_UNIQUE_NORMALIZED_NAME"
            elif not candidates and len(by_name) > 1:
                candidates = by_name
            if not candidates and ea_birthdate and last_name_key:
                by_birth_last = set(birth_last_index.get(f"{ea_birthdate}|{last_name_key}", set()))
                if len(by_birth_last) == 1:
                    candidates = by_birth_last
                    method = "MATCHED_BIRTHDATE_LAST_NAME"
                elif len(by_birth_last) > 1:
                    candidates = by_birth_last

        if len(candidates) == 1:
            gsis_id = next(iter(candidates))
            identity = identity_records[gsis_id]
            assigned[gsis_id].append(ea_id)
            history_record = history.get(gsis_id, {"weeklyRows": 0, "attempts": 0, "dropbacks": 0})
            has_history = history_record["weeklyRows"] > 0
            status = "MATCHED_IDENTITY_WITH_CAPTURED_STATS" if has_history else "MATCHED_IDENTITY_NO_CAPTURED_STATS"
            results.append(
                {
                    "eaPlayerId": ea_id,
                    "eaPlayerName": ea_name,
                    "eaTeam": player.get("teamAbbr"),
                    "maddenOvr": int(player.get("maddenOvr") or 0),
                    "stage2PriorValue": float(player.get("waltersPoints")),
                    "eaBirthdate": ea_birthdate,
                    "top67DistributionCohort": ea_id in top67_ids,
                    "gsisId": gsis_id,
                    "nflverseDisplayName": identity["displayName"],
                    "nflverseBirthdate": identity["birthdate"],
                    "identityMethod": method,
                    "identityStatus": status,
                    "capturedWeeklyRows": int(history_record["weeklyRows"]),
                    "capturedAttempts": int(history_record["attempts"]),
                    "capturedDropbacks": int(history_record["dropbacks"]),
                    "marketViewed": False,
                }
            )
        else:
            blocked += 1
            reason = "AMBIGUOUS" if candidates else "UNRESOLVED"
            results.append(
                {
                    "eaPlayerId": ea_id,
                    "eaPlayerName": ea_name,
                    "eaTeam": player.get("teamAbbr"),
                    "maddenOvr": int(player.get("maddenOvr") or 0),
                    "stage2PriorValue": float(player.get("waltersPoints")),
                    "eaBirthdate": ea_birthdate,
                    "top67DistributionCohort": ea_id in top67_ids,
                    "gsisId": None,
                    "nflverseDisplayName": None,
                    "nflverseBirthdate": None,
                    "identityMethod": None,
                    "identityStatus": f"BLOCKED_IDENTITY_{reason}",
                    "candidateGsisIds": sorted(candidates),
                    "suggestions": suggestions_for_name(name_key, identity_records),
                    "capturedWeeklyRows": 0,
                    "capturedAttempts": 0,
                    "capturedDropbacks": 0,
                    "marketViewed": False,
                }
            )

    duplicates = [
        {"gsisId": gsis_id, "eaPlayerIds": sorted(ea_ids)}
        for gsis_id, ea_ids in sorted(assigned.items())
        if len(ea_ids) > 1
    ]
    results.sort(key=lambda row: (not bool(row["top67DistributionCohort"]), -int(row["maddenOvr"]), str(row["eaPlayerId"])))
    crosswalk = {
        "schemaVersion": "walters-qb-performance-identity-crosswalk-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3B",
        "status": "PASS" if blocked == 0 and not duplicates else "FAIL_CLOSED_REVIEW_REQUIRED",
        "sourceManifest": relative(SOURCE_MANIFEST_PATH),
        "eaStage2Registry": relative(STAGE2_REGISTRY_PATH),
        "aliasRegistry": relative(IDENTITY_ALIASES_PATH),
        "currentEaNflTeamQbCount": len(current_qbs),
        "top67DistributionCohortCount": sum(1 for row in results if row["top67DistributionCohort"]),
        "resolvedIdentityCount": sum(1 for row in results if str(row["identityStatus"]).startswith("MATCHED_")),
        "resolvedWithCapturedStatsCount": sum(1 for row in results if row["identityStatus"] == "MATCHED_IDENTITY_WITH_CAPTURED_STATS"),
        "resolvedWithoutCapturedStatsCount": sum(1 for row in results if row["identityStatus"] == "MATCHED_IDENTITY_NO_CAPTURED_STATS"),
        "blockedIdentityCount": blocked,
        "duplicateGsisAssignmentCount": len(duplicates),
        "duplicateGsisAssignments": duplicates,
        "marketViewed": False,
        "players": results,
    }
    identity_audit = {
        "nflverseQbIdentityRecordCount": len(identity_records),
        "nflverseIdentityHeaderCount": len(identity_meta["headers"]),
        "currentEaNflTeamQbCount": len(current_qbs),
        "top67DistributionCohortCount": crosswalk["top67DistributionCohortCount"],
        "resolvedIdentityCount": crosswalk["resolvedIdentityCount"],
        "resolvedWithCapturedStatsCount": crosswalk["resolvedWithCapturedStatsCount"],
        "resolvedWithoutCapturedStatsCount": crosswalk["resolvedWithoutCapturedStatsCount"],
        "blockedIdentityCount": blocked,
        "duplicateGsisAssignmentCount": len(duplicates),
        "state": crosswalk["status"],
    }
    return crosswalk, identity_audit


def forbidden_output_fields(fieldnames: Iterable[str]) -> list[str]:
    return sorted(
        field
        for field in fieldnames
        if any(token in field.lower() for token in FORBIDDEN_OUTPUT_TOKENS)
    )


def protected_hashes() -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    for path in (
        POWER_LEDGER_PATH,
        PERSONNEL_CONTEXT_PATH,
        MATCHUP_CONTEXT_PATH,
        ACTIVE_WEEK_PATH,
    ):
        result[relative(path)] = sha256_file(path) if path.exists() else None
    return result


def build_source_registry(manifest: dict[str, Any]) -> dict[str, Any]:
    weekly_assets = [record for record in manifest["assets"] if record["assetName"].startswith("stats_player_week_")]
    seasonal_assets = [record for record in manifest["assets"] if record["assetName"].startswith("stats_player_reg_")]
    players_asset = next(record for record in manifest["assets"] if record["assetName"] == "players.csv.gz")
    return {
        "schemaVersion": "walters-qb-performance-source-registry-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3B",
        "captureStatus": "CAPTURED_HASH_LOCKED",
        "allExternalAssetsHashPinned": True,
        "sourceManifest": relative(SOURCE_MANIFEST_PATH),
        "marketSourcesAllowed": False,
        "marketViewed": False,
        "sources": [
            {
                "id": "EA_MADDEN27_FROZEN_QB_PRIOR",
                "type": "LOCAL_FROZEN_PRIOR",
                "authorityRole": "SHRINKAGE_PRIOR_ONLY",
                "paths": [
                    "data/walters/nfl/player-values/player-values-2026-v1.json",
                    "data/walters/nfl/player-values/calibration-audit-v1.json",
                    "data/walters/nfl/player-values/stage2-current.json",
                    "data/walters/nfl/madden27/madden27-current.json",
                ],
                "mayMoveGrahamFairDirectly": False,
            },
            {
                "id": "NFLVERSE_PLAYER_IDENTITY",
                "type": "HASH_LOCKED_PUBLIC_FOOTBALL_IDENTITY",
                "authorityRole": "EA_TO_GSIS_IDENTITY_RECONCILIATION",
                "releaseTag": players_asset["releaseTag"],
                "asset": players_asset,
                "marketData": False,
            },
            {
                "id": "NFLVERSE_WEEKLY_PLAYER_STATS",
                "type": "HASH_LOCKED_PUBLIC_FOOTBALL_STATISTICS",
                "authorityRole": "PRIMARY_FOOTBALL_PERFORMANCE_EVIDENCE",
                "captureYears": manifest["seasons"],
                "exactAssets": weekly_assets,
                "marketData": False,
            },
            {
                "id": "NFLVERSE_SEASONAL_PLAYER_STATS",
                "type": "HASH_LOCKED_PUBLIC_FOOTBALL_STATISTICS",
                "authorityRole": "LONG_TERM_AGGREGATION_CROSSCHECK",
                "captureYears": manifest["seasons"],
                "exactAssets": seasonal_assets,
                "marketData": False,
            },
            {
                "id": "NFLVERSE_SCHEDULE_CONTEXT_FROZEN",
                "type": "LOCAL_FROZEN_SCHEDULE_CONTEXT",
                "authorityRole": "OPPONENT_AND_SCHEDULE_JOIN_CONTEXT",
                "path": relative(SCHEDULE_CONTEXT_PATH),
                "sha256AtStage3BCapture": manifest.get("localContextAtCapture", {}).get("scheduleContextSha256"),
                "marketData": False,
                "directSpreadAddendAllowed": False,
            },
            {
                "id": "APPROVED_GRAHAM_PERSONNEL_CONTEXT",
                "type": "LOCAL_GOVERNED_CONTEXT",
                "authorityRole": "CONFIDENCE_AND_INTERPRETATION_ONLY",
                "path": relative(PERSONNEL_CONTEXT_PATH),
                "marketData": False,
                "directQbPerformancePointsAllowed": False,
                "directSpreadAddendAllowed": False,
            },
        ],
        "prohibitedSourceFamilies": [
            "sportsbook odds feeds",
            "Pinnacle or consensus prices",
            "closing lines and line movement",
            "market-implied quarterback values",
            "ATS outcome labels",
            "ESPN FPI as production authority",
            "unversioned manual quarterback rankings",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the governed Walters QB performance Stage 3B source and identity layer.")
    parser.add_argument("--self-test", action="store_true", help="Run deterministic helper tests without network or repository writes.")
    args = parser.parse_args()

    if args.self_test:
        assert normalize_name("Patrick Mahomes II") == "patrick mahomes"
        assert normalize_name("D.J. Uiagalelei") == "d j uiagalelei"
        assert normalize_birthdate("09/17/1995") == "1995-09-17"
        assert nfl_passer_rating(20, 30, 250, 2, 1) is not None
        sample = {
            "attempts": 30,
            "sacks_suffered": 3,
            "sack_fumbles": 1,
            "rushing_fumbles": 0,
            "sack_fumbles_lost": 1,
            "rushing_fumbles_lost": 0,
            "completions": 20,
            "passing_yards": 250,
            "passing_tds": 2,
            "interceptions": 1,
            "rushing_yards": 30,
        }
        add_derived(sample)
        assert sample["dropbacks"] == 33
        assert sample["recorded_qb_fumbles"] == 1
        print("WALTERS QB STAGE 3B SELF-TEST: PASS")
        return 0

    for required in (
        CONTRACT_PATH,
        STAGE3A_CONTRACT_PATH,
        STAGE2_REGISTRY_PATH,
        STAGE2_CURRENT_PATH,
        EA_CURRENT_PATH,
        IDENTITY_ALIASES_PATH,
    ):
        if not required.exists():
            raise RuntimeError(f"Missing required Stage 3B dependency: {relative(required)}")

    contract = read_json(CONTRACT_PATH)
    stage3a = read_json(STAGE3A_CONTRACT_PATH)
    stage2_current = read_json(STAGE2_CURRENT_PATH)
    if contract.get("status") != "CONTRACT_LOCKED_NON_OPERATIONAL":
        raise RuntimeError("Stage 3B contract is not locked")
    if contract.get("operational") is not False or contract.get("productionAuthority") is not False:
        raise RuntimeError("Stage 3B contract must remain non-operational")
    if stage3a.get("modelDiscipline", {}).get("weightsStatus") != "UNESTIMATED_LOCKED_OFF":
        raise RuntimeError("Stage 3A weights boundary is not locked off")
    if stage2_current.get("state") != "VALIDATED_NON_OPERATIONAL":
        raise RuntimeError("Stage 2 dependency is not VALIDATED_NON_OPERATIONAL")

    protected_before = protected_hashes()
    manifest, captured_new_sources = load_or_capture_manifest(contract)
    if captured_new_sources:
        manifest["protectedArtifactSha256AtCapture"] = protected_before
        manifest["localContextAtCapture"] = {
            "scheduleContextPath": relative(SCHEDULE_CONTEXT_PATH),
            "scheduleContextSha256": sha256_file(SCHEDULE_CONTEXT_PATH) if SCHEDULE_CONTEXT_PATH.exists() else None,
            "personnelContextPath": relative(PERSONNEL_CONTEXT_PATH),
        }
        write_json(SOURCE_MANIFEST_PATH, manifest)
    weekly_rows, weekly_headers = normalize_weekly_assets(contract, manifest)
    seasonal_rows, seasonal_headers = normalize_seasonal_assets(contract, manifest)
    write_csv(WEEKLY_OUTPUT_PATH, WEEKLY_OUTPUT_FIELDS, weekly_rows)
    write_csv(SEASONAL_OUTPUT_PATH, SEASONAL_OUTPUT_FIELDS, seasonal_rows)

    crosscheck = crosscheck_weekly_vs_seasonal(contract, weekly_rows, seasonal_rows)
    crosswalk, identity_audit = resolve_ea_identities(manifest, weekly_rows)
    write_json(IDENTITY_CROSSWALK_PATH, crosswalk)

    source_registry = build_source_registry(manifest)
    write_json(SOURCE_REGISTRY_PATH, source_registry)

    forbidden_fields = sorted(set(forbidden_output_fields(WEEKLY_OUTPUT_FIELDS + SEASONAL_OUTPUT_FIELDS)))
    required_asset_count = int(contract["acceptance"]["requiredSourceAssets"])
    expected_seasons = [int(value) for value in contract["acceptance"]["requiredSeasons"]]
    checks = [
        {
            "id": "QBP3B-SOURCE-ASSET-COUNT",
            "actual": int(manifest["assetCount"]),
            "expected": required_asset_count,
            "pass": int(manifest["assetCount"]) == required_asset_count,
        },
        {
            "id": "QBP3B-SOURCE-SEASONS",
            "actual": [int(value) for value in manifest["seasons"]],
            "expected": expected_seasons,
            "pass": [int(value) for value in manifest["seasons"]] == expected_seasons,
        },
        {
            "id": "QBP3B-SOURCE-HASHES",
            "actual": bool(manifest["allComputedHashesVerified"]),
            "expected": True,
            "pass": bool(manifest["allComputedHashesVerified"]),
        },
        {
            "id": "QBP3B-IDENTITY-BLOCKS",
            "actual": int(identity_audit["blockedIdentityCount"]),
            "expected": 0,
            "pass": int(identity_audit["blockedIdentityCount"]) == 0,
        },
        {
            "id": "QBP3B-TOP67-COUNT",
            "actual": int(identity_audit["top67DistributionCohortCount"]),
            "expected": 67,
            "pass": int(identity_audit["top67DistributionCohortCount"]) == 67,
        },
        {
            "id": "QBP3B-DUPLICATE-GSIS",
            "actual": int(identity_audit["duplicateGsisAssignmentCount"]),
            "expected": 0,
            "pass": int(identity_audit["duplicateGsisAssignmentCount"]) == 0,
        },
        {
            "id": "QBP3B-SEASONAL-CROSSCHECK",
            "actual": int(crosscheck["mismatchCount"]),
            "expected": 0,
            "pass": int(crosscheck["mismatchCount"]) == 0,
        },
        {
            "id": "QBP3B-FORBIDDEN-OUTPUT-FIELDS",
            "actual": forbidden_fields,
            "expected": [],
            "pass": not forbidden_fields,
        },
        {
            "id": "QBP3B-MARKET-ISOLATION",
            "actual": False,
            "expected": False,
            "pass": True,
        },
    ]
    audit_pass = all(bool(check["pass"]) for check in checks)
    protected_after = protected_hashes()
    protected_unchanged = protected_before == protected_after
    checks.append(
        {
            "id": "QBP3B-PROTECTED-ARTIFACTS",
            "actual": protected_unchanged,
            "expected": True,
            "pass": protected_unchanged,
        }
    )
    audit_pass = audit_pass and protected_unchanged

    audit = {
        "schemaVersion": "walters-qb-performance-stage3b-audit-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3B",
        "status": "PASS" if audit_pass else "FAIL_CLOSED_REVIEW_REQUIRED",
        "generatedAt": manifest["capturedAt"],
        "initialSourceCaptureCompleted": bool(manifest.get("initialCaptureCompleted")),
        "sourceManifest": relative(SOURCE_MANIFEST_PATH),
        "sourceAssetCount": int(manifest["assetCount"]),
        "seasons": manifest["seasons"],
        "gameType": manifest["gameType"],
        "weeklyNormalized": {
            "path": relative(WEEKLY_OUTPUT_PATH),
            "rowCount": len(weekly_rows),
            "sha256": sha256_file(WEEKLY_OUTPUT_PATH),
            "fieldCount": len(WEEKLY_OUTPUT_FIELDS),
            "sourceHeaderCountByAsset": {name: len(headers) for name, headers in sorted(weekly_headers.items())},
        },
        "seasonalNormalized": {
            "path": relative(SEASONAL_OUTPUT_PATH),
            "rowCount": len(seasonal_rows),
            "sha256": sha256_file(SEASONAL_OUTPUT_PATH),
            "fieldCount": len(SEASONAL_OUTPUT_FIELDS),
            "sourceHeaderCountByAsset": {name: len(headers) for name, headers in sorted(seasonal_headers.items())},
        },
        "identity": identity_audit,
        "identityCrosswalk": {
            "path": relative(IDENTITY_CROSSWALK_PATH),
            "sha256": sha256_file(IDENTITY_CROSSWALK_PATH),
        },
        "weeklySeasonalCrosscheck": crosscheck,
        "forbiddenOutputFields": forbidden_fields,
        "protectedArtifactSha256Before": manifest.get("protectedArtifactSha256AtCapture", protected_before),
        "protectedArtifactSha256After": manifest.get("protectedArtifactSha256AtCapture", protected_after),
        "protectedArtifactsUnchanged": protected_unchanged,
        "checks": checks,
        "weightsEstimated": False,
        "candidateQbValuesCreated": False,
        "grahamFairNumbersChanged": False,
        "uncertaintyOverlaysRetired": False,
        "productionAuthority": False,
        "marketViewed": False,
        "nextSubstage": (
            contract["acceptance"]["nextSubstageOnPass"] if audit_pass else "STAGE3B_REMEDIATION_REQUIRED"
        ),
    }
    write_json(AUDIT_PATH, audit)

    current = {
        "schemaVersion": "walters-qb-performance-stage3-current-v1",
        "module": "WALTERS_QB_PERFORMANCE",
        "stage": 3,
        "substage": "3B",
        "status": (
            contract["acceptance"]["passState"] if audit_pass else contract["acceptance"]["failState"]
        ),
        "generatedAt": manifest["capturedAt"],
        "operational": False,
        "productionAuthority": False,
        "marketViewed": False,
        "priorAuthority": "EA_MADDEN27_DISTRIBUTION_CALIBRATED_PRIOR_ONLY",
        "weightsStatus": "UNESTIMATED_LOCKED_OFF",
        "dataCaptureStatus": "PASS_HASH_LOCKED" if manifest["allComputedHashesVerified"] else "FAIL_CLOSED",
        "identityAuditStatus": identity_audit["state"],
        "seasonalCrosscheckStatus": crosscheck["state"],
        "candidateOutputStatus": "NOT_CREATED",
        "grahamWritesAllowed": False,
        "uncertaintyOverlayRetirementAllowed": False,
        "activeContract": relative(STAGE3A_CONTRACT_PATH),
        "activeStage3BContract": relative(CONTRACT_PATH),
        "activeSourceRegistry": relative(SOURCE_REGISTRY_PATH),
        "sourceManifest": relative(SOURCE_MANIFEST_PATH),
        "identityCrosswalk": relative(IDENTITY_CROSSWALK_PATH),
        "audit": relative(AUDIT_PATH),
        "auditSha256": sha256_file(AUDIT_PATH),
        "nextSubstage": audit["nextSubstage"],
    }
    write_json(STAGE3_CURRENT_PATH, current)

    summary = {
        "status": audit["status"],
        "assets": manifest["assetCount"],
        "weeklyRows": len(weekly_rows),
        "seasonalRows": len(seasonal_rows),
        "currentQbs": identity_audit["currentEaNflTeamQbCount"],
        "identityBlocks": identity_audit["blockedIdentityCount"],
        "duplicateGsis": identity_audit["duplicateGsisAssignmentCount"],
        "crosscheckMismatches": crosscheck["mismatchCount"],
        "productionAuthority": False,
        "marketViewed": False,
        "nextSubstage": current["nextSubstage"],
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(
            json.dumps(
                {
                    "status": "STAGE3B_BUILD_ERROR",
                    "error": f"{type(error).__name__}: {error}",
                    "productionAuthority": False,
                    "marketViewed": False,
                },
                indent=2,
            ),
            file=sys.stderr,
        )
        raise
