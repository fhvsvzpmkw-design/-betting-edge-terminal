#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import time
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

EA_BASE = "https://www.ea.com"
EA_RATINGS = f"{EA_BASE}/games/madden-nfl/ratings"
THIRD_PARTY_CSV = "https://raw.githubusercontent.com/zachxwalton/madden-ratings-breakdown/main/scraper/output/madden27_ratings.csv"
USER_AGENT = "BettingEdge-Madden27-Freezer/1.1 (+source-locked Walters research)"
ROOT = Path("data/walters/nfl/madden27")

TEAM_ABBR = {
    "Arizona Cardinals": "ARI", "Atlanta Falcons": "ATL", "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF", "Carolina Panthers": "CAR", "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN", "Cleveland Browns": "CLE", "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN", "Detroit Lions": "DET", "Green Bay Packers": "GB",
    "Houston Texans": "HOU", "Indianapolis Colts": "IND", "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC", "Las Vegas Raiders": "LV", "Los Angeles Chargers": "LAC",
    "LA Chargers": "LAC", "Los Angeles Rams": "LAR", "LA Rams": "LAR",
    "Miami Dolphins": "MIA", "Minnesota Vikings": "MIN", "New England Patriots": "NE",
    "New Orleans Saints": "NO", "New York Giants": "NYG", "NY Giants": "NYG",
    "New York Jets": "NYJ", "NY Jets": "NYJ", "Philadelphia Eagles": "PHI",
    "Pittsburgh Steelers": "PIT", "San Francisco 49ers": "SF", "Seattle Seahawks": "SEA",
    "Tampa Bay Buccaneers": "TB", "Tennessee Titans": "TEN", "Washington Commanders": "WAS",
}
FREE_AGENT_LABELS = {"Free Agents", "Free Agent", "FA"}

POSITION_MAP = {
    "QB": "QB", "HB": "RB", "RB": "RB", "FB": "FB", "WR": "WR", "TE": "TE",
    "LT": "LT", "LG": "LG", "C": "C", "RG": "RG", "RT": "RT",
    "LEDG": "EDGE", "REDG": "EDGE", "LE": "EDGE", "RE": "EDGE",
    "DT": "DT", "NT": "NT",
    "SAM": "OLB", "WILL": "OLB", "LOLB": "OLB", "ROLB": "OLB", "OLB": "OLB",
    "MIKE": "MLB", "MLB": "MLB", "LB": "LB",
    "CB": "CB", "FS": "FS", "SS": "SS",
    "K": "K", "P": "P", "LS": "LS",
}
CALIBRATION_POSITIONS = {
    "QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT",
    "EDGE", "DT", "NT", "OLB", "MLB", "LB", "CB", "FS", "SS",
}


def get_bytes(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def get_json(url: str) -> dict:
    return json.loads(get_bytes(url).decode("utf-8"))


def extract_build_id(html: str) -> str:
    match = re.search(r"/_next/static/([^/]+)/_buildManifest\.js", html)
    if not match:
        raise RuntimeError("EA_BUILD_ID_NOT_FOUND")
    return match.group(1)


def fetch_ea_players() -> tuple[str, int, list[dict]]:
    html = get_bytes(EA_RATINGS).decode("utf-8", errors="replace")
    build_id = extract_build_id(html)
    template = f"{EA_BASE}/_next/data/{build_id}/games/madden-nfl/ratings.json?page={{page}}"
    first = get_json(template.format(page=1))
    details = first["pageProps"]["ratingDetails"]
    official_total = int(details["totalItems"])
    pages = math.ceil(official_total / 100)
    players = list(details["items"])
    for page in range(2, pages + 1):
        time.sleep(0.20)
        payload = get_json(template.format(page=page))
        players.extend(payload["pageProps"]["ratingDetails"]["items"])
    unique: dict[str, dict] = {}
    for player in players:
        pid = str(player.get("id", "")).strip()
        if not pid:
            raise RuntimeError("EA_PLAYER_WITHOUT_ID")
        unique.setdefault(pid, player)
    if len(unique) != official_total:
        raise RuntimeError(f"EA_COUNT_MISMATCH reported={official_total} unique={len(unique)}")
    return build_id, official_total, list(unique.values())


def value_of(entry):
    if isinstance(entry, dict) and "value" in entry:
        return entry.get("value")
    return entry


def normalize_player(player: dict) -> dict:
    team = player.get("team") or {}
    team_name = str(team.get("label") or "").strip()
    raw_position = str((player.get("position") or {}).get("id") or "").upper().strip()
    team_abbr = TEAM_ABBR.get(team_name)
    if team_abbr:
        team_status = "NFL_TEAM"
    elif not team_name or team_name in FREE_AGENT_LABELS or "free agent" in team_name.lower():
        team_status = "FREE_AGENT"
    else:
        team_status = "OTHER"
    canonical_position = POSITION_MAP.get(raw_position, "UNKNOWN")

    abilities = []
    for ability in player.get("playerAbilities") or []:
        abilities.append({
            "type": str((ability.get("type") or {}).get("id") or ""),
            "label": str(ability.get("label") or ""),
        })
    stats = {str(k): value_of(v) for k, v in (player.get("stats") or {}).items()}
    first = str(player.get("firstName") or "").strip()
    last = str(player.get("lastName") or "").strip()
    return {
        "eaPlayerId": str(player.get("id")),
        "firstName": first,
        "lastName": last,
        "fullName": f"{first} {last}".strip(),
        "teamName": team_name or None,
        "teamAbbr": team_abbr,
        "teamStatus": team_status,
        "rawPosition": raw_position or None,
        "position": canonical_position,
        "personnelCalibrationEligible": canonical_position in CALIBRATION_POSITIONS,
        "overall": player.get("overallRating"),
        "age": player.get("age"),
        "heightInches": player.get("height"),
        "weightLbs": player.get("weight"),
        "college": player.get("college"),
        "yearsPro": player.get("yearsPro"),
        "jerseyNumber": player.get("jerseyNum"),
        "birthdate": player.get("birthdate"),
        "handedness": player.get("handedness"),
        "archetype": (player.get("archetype") or {}).get("label"),
        "iteration": (player.get("iteration") or {}).get("label"),
        "abilities": abilities,
        "stats": stats,
    }


def normalization_audit(players: list[dict]) -> dict:
    unmapped_teams = Counter((p.get("teamName") or "<blank>") for p in players if p.get("teamStatus") == "OTHER")
    unmapped_positions = Counter((p.get("rawPosition") or "<blank>") for p in players if p.get("position") == "UNKNOWN")
    team_status = Counter(p.get("teamStatus") for p in players)
    positions = Counter(p.get("position") for p in players)
    raw_positions = Counter(p.get("rawPosition") or "<blank>" for p in players)
    return {
        "status": "PASS" if not unmapped_teams and not unmapped_positions else "REVIEW_REQUIRED",
        "unmappedTeamPlayerCount": sum(unmapped_teams.values()),
        "unmappedTeams": dict(sorted(unmapped_teams.items())),
        "unmappedPositionPlayerCount": sum(unmapped_positions.values()),
        "unmappedPositions": dict(sorted(unmapped_positions.items())),
        "teamStatusCounts": dict(sorted(team_status.items())),
        "canonicalPositionCounts": dict(sorted(positions.items())),
        "rawPositionCounts": dict(sorted(raw_positions.items())),
        "calibrationEligibleCount": sum(1 for p in players if p.get("personnelCalibrationEligible")),
        "specialistOrUnsupportedCount": sum(1 for p in players if not p.get("personnelCalibrationEligible")),
    }


def reconcile_with_public_snapshot(official_players: list[dict]) -> dict:
    official = {str(p.get("id")): p for p in official_players}
    try:
        text = get_bytes(THIRD_PARTY_CSV).decode("utf-8")
        rows = list(csv.DictReader(io.StringIO(text)))
        third = {str(r.get("player_id", "")).strip(): r for r in rows if str(r.get("player_id", "")).strip()}
        official_ids, third_ids = set(official), set(third)
        shared = official_ids & third_ids
        official_only = sorted(official_ids - third_ids, key=lambda x: int(x) if x.isdigit() else x)
        third_only = sorted(third_ids - official_ids, key=lambda x: int(x) if x.isdigit() else x)
        overall_changes = []
        for pid in sorted(shared, key=lambda x: int(x) if x.isdigit() else x):
            old = str(third[pid].get("overall", "")).strip()
            new = str(official[pid].get("overallRating", "")).strip()
            if old and new and old != new:
                overall_changes.append({
                    "eaPlayerId": pid,
                    "player": f"{official[pid].get('firstName','')} {official[pid].get('lastName','')}".strip(),
                    "publicSnapshotOverall": int(old) if old.isdigit() else old,
                    "eaCurrentOverall": int(new) if new.isdigit() else new,
                })
        def describe_official(pid):
            p = official[pid]
            return {"eaPlayerId": pid, "player": f"{p.get('firstName','')} {p.get('lastName','')}".strip(), "team": (p.get('team') or {}).get('label'), "position": (p.get('position') or {}).get('id'), "overall": p.get('overallRating')}
        def describe_third(pid):
            r = third[pid]
            return {"eaPlayerId": pid, "player": r.get("full_name"), "team": r.get("team_name"), "position": r.get("position"), "overall": int(r["overall"]) if str(r.get("overall","")).isdigit() else r.get("overall")}
        return {
            "status": "COMPARED",
            "comparisonRole": "RECONCILIATION_ONLY_NOT_SOURCE_AUTHORITY",
            "sourceUrl": THIRD_PARTY_CSV,
            "publicSnapshotCount": len(third),
            "officialCurrentCount": len(official),
            "netPlayerCountDifferenceOfficialMinusPublic": len(official) - len(third),
            "sharedEaPlayerIdCount": len(shared),
            "officialOnlyCount": len(official_only),
            "publicSnapshotOnlyCount": len(third_only),
            "populationChurnBeyondNetCount": bool(official_only or third_only),
            "officialOnly": [describe_official(pid) for pid in official_only],
            "publicSnapshotOnly": [describe_third(pid) for pid in third_only],
            "overallChangeCount": len(overall_changes),
            "overallChanges": overall_changes,
            "interpretation": "The net count difference is not treated as a one-player identity discrepancy when official-only/public-only populations are non-zero. Current EA is authoritative; the public snapshot is comparison evidence only.",
        }
    except Exception as exc:
        return {"status": "COMPARISON_FAILED_NON_BLOCKING", "sourceUrl": THIRD_PARTY_CSV, "officialCurrentCount": len(official), "error": f"{type(exc).__name__}: {exc}"}


def sha256_json(obj) -> str:
    encoded = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    now = datetime.now(ZoneInfo("America/Vancouver"))
    captured_at = now.isoformat(timespec="seconds")
    date_key = now.date().isoformat()
    build_id, total, players = fetch_ea_players()
    normalized_players = [normalize_player(p) for p in players]
    normalized_players.sort(key=lambda p: int(p["eaPlayerId"]) if str(p["eaPlayerId"]).isdigit() else str(p["eaPlayerId"]))
    raw_players = sorted(players, key=lambda p: int(p.get("id")) if str(p.get("id", "")).isdigit() else str(p.get("id", "")))
    audit = normalization_audit(normalized_players)
    reconciliation = reconcile_with_public_snapshot(players)

    raw_name = f"ea-madden27-raw-{date_key}.json"
    normalized_name = f"madden27-normalized-{date_key}.json"
    reconciliation_name = f"reconciliation-{date_key}.json"

    raw_doc = {
        "schema": 1,
        "datasetId": f"ea-madden-nfl-27-raw-{date_key}",
        "state": "FROZEN_RAW",
        "sourceAuthority": "EA_OFFICIAL_MADDEN_NFL_27",
        "sourceUrl": EA_RATINGS,
        "eaBuildId": build_id,
        "capturedAt": captured_at,
        "timezone": "America/Vancouver",
        "reportedTotalItems": total,
        "uniquePlayerCount": len(raw_players),
        "players": raw_players,
    }
    normalized_doc = {
        "schema": 1,
        "datasetId": f"graham-madden27-normalized-{date_key}",
        "state": "FROZEN_NORMALIZED_STAGE_1",
        "sourceAuthority": "EA_OFFICIAL_MADDEN_NFL_27",
        "sourceRawDataset": raw_name,
        "capturedAt": captured_at,
        "officialPlayerCount": total,
        "normalization": {
            "teamConvention": "Betting Edge/Graham NFL abbreviations",
            "positionConvention": "Walters personnel calibration v1 canonical positions",
            "rawTeamAndPositionPreserved": True,
            "specialistsRetainedButCalibrationIneligible": True,
            "maddenValuesNotYetConvertedToWaltersPoints": True,
        },
        "normalizationAudit": audit,
        "players": normalized_players,
    }
    reconciliation_doc = {
        "schema": 1,
        "datasetId": f"madden27-reconciliation-{date_key}",
        "capturedAt": captured_at,
        "officialAuthority": EA_RATINGS,
        **reconciliation,
    }

    raw_sha = sha256_json(raw_doc)
    normalized_sha = sha256_json(normalized_doc)
    raw_doc["contentSha256Canonical"] = raw_sha
    normalized_doc["contentSha256Canonical"] = normalized_sha

    write_json(ROOT / raw_name, raw_doc)
    write_json(ROOT / normalized_name, normalized_doc)
    write_json(ROOT / reconciliation_name, reconciliation_doc)

    current = {
        "schema": 1,
        "datasetId": "madden27-current-stage1",
        "state": "FROZEN_STAGE_1",
        "sourceAuthority": "EA_OFFICIAL_MADDEN_NFL_27",
        "sourceUrl": EA_RATINGS,
        "capturedAt": captured_at,
        "eaBuildId": build_id,
        "officialPlayerCount": total,
        "rawPath": raw_name,
        "normalizedPath": normalized_name,
        "reconciliationPath": reconciliation_name,
        "normalizationAuditStatus": audit["status"],
        "unmappedTeamPlayerCount": audit["unmappedTeamPlayerCount"],
        "unmappedPositionPlayerCount": audit["unmappedPositionPlayerCount"],
        "rawCanonicalSha256": raw_sha,
        "normalizedCanonicalSha256": normalized_sha,
        "stage2Authority": False,
        "note": "Stage 1 only. This snapshot may not generate Walters point values or move Graham numbers until the Stage 2 distribution/calibration audit is approved.",
    }
    write_json(ROOT / "madden27-current.json", current)
    print(f"MADDEN 27 EA FREEZE COMPLETE // {total} OFFICIAL PLAYERS // {captured_at}")
    print(f"NORMALIZATION // {audit['status']} // UNMAPPED TEAMS {audit['unmappedTeamPlayerCount']} // UNMAPPED POSITIONS {audit['unmappedPositionPlayerCount']}")
    print(f"RECONCILIATION // {reconciliation.get('status')} // PUBLIC COUNT {reconciliation.get('publicSnapshotCount','n/a')} // OFFICIAL ONLY {reconciliation.get('officialOnlyCount','n/a')} // PUBLIC ONLY {reconciliation.get('publicSnapshotOnlyCount','n/a')}")


if __name__ == "__main__":
    main()
