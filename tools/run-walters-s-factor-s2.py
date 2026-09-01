#!/usr/bin/env python3
import csv
import hashlib
import io
import json
import math
import os
import statistics
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path.cwd()
BASE = ROOT / "data/walters/nfl/s-factors"
S1_PATH = BASE / "s-factor-calibration-v1.json"
LOCK_PATH = BASE / "s2-model-lock-v1.json"
REGISTRY_PATH = BASE / "registries/team-geography-v1.json"
H4_PATH = ROOT / "data/walters/nfl/home-field/home-field-production-current.json"


def fail(msg):
    raise RuntimeError(f"WALTERS S FACTOR S2 FAILED // {msg}")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=False) + "\n", encoding="utf-8")


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fnum(v):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except Exception:
        return None


def inum(v):
    x = fnum(v)
    return None if x is None else int(x)


def round6(v):
    return None if v is None else round(float(v), 6)


def normalize_team(team, registry):
    t = (team or "").strip()
    return registry.get("aliases", {}).get(t, t)


def team_meta(team, season, registry):
    t = normalize_team(team, registry)
    node = registry.get("teams", {}).get(t)
    if not node:
        return None
    era = next((e for e in node.get("eras", []) if int(e["from"]) <= season <= int(e["to"])), None)
    if not era:
        return None
    return {
        "team": t,
        "conference": node["conference"],
        "division": node["division"],
        **era,
        "bandValue": registry["timezoneBands"][era["timezoneBand"]],
    }


def haversine_miles(a, b):
    r = 3958.7613
    lat1, lon1, lat2, lon2 = map(math.radians, [a["lat"], a["lon"], b["lat"], b["lon"]])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def surface_class(v):
    s = (v or "").strip().lower()
    if not s:
        return None
    return "NATURAL" if s == "grass" else "SYNTHETIC"


def parse_time_minutes(v):
    s = (v or "").strip()
    if not s or ":" not in s:
        return None
    try:
        h, m = s.split(":", 1)
        return int(h) * 60 + int(m)
    except Exception:
        return None


def solve_linear(a, b):
    n = len(b)
    m = [list(map(float, a[i])) + [float(b[i])] for i in range(n)]
    for col in range(n):
        pivot = max(range(col, n), key=lambda r: abs(m[r][col]))
        if abs(m[pivot][col]) < 1e-12:
            continue
        if pivot != col:
            m[col], m[pivot] = m[pivot], m[col]
        p = m[col][col]
        for j in range(col, n + 1):
            m[col][j] /= p
        for r in range(n):
            if r == col:
                continue
            fac = m[r][col]
            if abs(fac) < 1e-15:
                continue
            for j in range(col, n + 1):
                m[r][j] -= fac * m[col][j]
    return [m[i][n] if abs(m[i][i]) > 1e-10 else 0.0 for i in range(n)]


def fit_team_ratings(games, teams, ridge, h4_domestic):
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    a = [[0.0] * n for _ in range(n)]
    b = [0.0] * n
    for g in games:
        if g["home_score"] is None or g["away_score"] is None:
            continue
        h, aw = g["home_team"], g["away_team"]
        if h not in idx or aw not in idx:
            continue
        y = (g["home_score"] - g["away_score"]) - (0.0 if g["is_neutral"] else h4_domestic)
        hi, ai = idx[h], idx[aw]
        a[hi][hi] += 1.0
        a[ai][ai] += 1.0
        a[hi][ai] -= 1.0
        a[ai][hi] -= 1.0
        b[hi] += y
        b[ai] -= y
    for i in range(n):
        a[i][i] += ridge
    vals = solve_linear(a, b)
    mean = sum(vals) / len(vals) if vals else 0.0
    return {t: vals[idx[t]] - mean for t in teams}


def fit_ridge(rows, feature_names, prior, ridge):
    p = len(feature_names)
    if p == 0:
        return {}
    a = [[0.0] * p for _ in range(p)]
    b = [0.0] * p
    for r in rows:
        x = [float(r["features"].get(name, 0.0)) for name in feature_names]
        y = float(r["residual"])
        for i in range(p):
            if x[i] == 0:
                continue
            b[i] += x[i] * y
            for j in range(i, p):
                if x[j] != 0:
                    a[i][j] += x[i] * x[j]
    for i in range(p):
        for j in range(i):
            a[i][j] = a[j][i]
        a[i][i] += ridge
        b[i] += ridge * float(prior.get(feature_names[i], 0.0))
    vals = solve_linear(a, b)
    return {feature_names[i]: vals[i] for i in range(p)}


def metrics(rows, adjustment_fn):
    errs = [float(r["residual"]) - float(adjustment_fn(r)) for r in rows]
    if not errs:
        return {"n": 0, "meanError": None, "mae": None, "rmse": None}
    return {
        "n": len(errs),
        "meanError": round6(sum(errs) / len(errs)),
        "mae": round6(sum(abs(e) for e in errs) / len(errs)),
        "rmse": round6(math.sqrt(sum(e * e for e in errs) / len(errs))),
    }


def accepted_vs_zero(candidate, zero):
    if not candidate["n"] or not zero["n"]:
        return False
    return (
        candidate["mae"] <= zero["mae"] + 1e-9
        and candidate["rmse"] <= zero["rmse"] + 1e-9
        and abs(candidate["meanError"]) <= abs(zero["meanError"]) + 0.05 + 1e-9
    )


def derive_surface_registry(rows, registry):
    counts = defaultdict(Counter)
    raw = defaultdict(Counter)
    for g in rows:
        if g["game_type"] != "REG" or g["is_neutral"]:
            continue
        cls = surface_class(g["surface"])
        if not cls:
            continue
        key = (g["season"], g["home_team"])
        counts[key][cls] += 1
        raw[key][(g["surface"] or "").strip().lower()] += 1
    out = {"schema": 1, "registryId": "walters-nfl-s-factor-surface-registry-2021-2026-v1", "method": "modal non-neutral scheduled home surface by team-season; schedule metadata only", "entries": []}
    for (season, team), c in sorted(counts.items()):
        top = c.most_common()
        resolved = len(top) == 1 or top[0][1] > top[1][1]
        out["entries"].append({
            "season": season,
            "team": team,
            "surfaceClass": top[0][0] if resolved else "UNRESOLVED",
            "classCounts": dict(c),
            "rawSurfaceCounts": dict(raw[(season, team)]),
            "resolved": resolved,
        })
    return out


def surface_lookup(surface_registry):
    return {(e["season"], e["team"]): e["surfaceClass"] for e in surface_registry["entries"] if e["resolved"]}


def download_source(lock):
    errors = []
    for url in [lock["source"]["scheduleUrl"], lock["source"]["fallbackUrl"]]:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "betting-edge-walters-s2/1.0"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = resp.read()
            if len(data) < 100000 or b"game_id,season,game_type" not in data[:500]:
                raise RuntimeError("download did not look like nflverse games.csv")
            return url, data
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    fail("FAIL_CLOSED_S2_SOURCE_DOWNLOAD // " + " | ".join(errors))


def main():
    s1 = read_json(S1_PATH)
    lock = read_json(LOCK_PATH)
    registry = read_json(REGISTRY_PATH)
    h4 = read_json(H4_PATH)

    if s1.get("stage") != "S1" or s1.get("state") != "CONTRACT_LOCKED_SHADOW_ONLY" or s1.get("marketViewed") is not False:
        fail("FAIL_CLOSED_S2_S1_CONTRACT")
    if lock.get("stage") != "S2" or lock.get("state") != "MODEL_LOCKED_BEFORE_HOLDOUT" or lock.get("marketViewed") is not False:
        fail("S2 model lock invalid")
    if h4.get("state") != "OPERATIONAL_SCOPED" or h4.get("productionAuthority") is not True or h4.get("marketViewed") is not False:
        fail("FAIL_CLOSED_S2_H4_AUTHORITY")
    h4_domestic = float(h4["productionScope"]["domesticLeagueBaseline"]["homeLocationAdvantagePoints"])
    if abs(h4_domestic - float(lock["h4Control"]["domesticHomeAdvantagePoints"])) > 1e-9:
        fail("H4 production baseline differs from locked S2 control")

    source_url, source_bytes = download_source(lock)
    source_sha = sha256_bytes(source_bytes)
    text = source_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    upstream_fields = list(reader.fieldnames or [])
    whitelist = lock["source"]["fieldWhitelist"]
    missing = [f for f in whitelist if f not in upstream_fields]
    if missing:
        fail("source missing required fields: " + ",".join(missing))
    persisted_rows = []
    parsed = []
    for raw in reader:
        season = inum(raw.get("season"))
        if season is None or season < 2014 or season > 2026:
            continue
        if (raw.get("game_type") or "") not in ("REG", "SB"):
            continue
        saved = {k: raw.get(k, "") for k in whitelist}
        persisted_rows.append(saved)
        away = normalize_team(raw.get("away_team"), registry)
        home = normalize_team(raw.get("home_team"), registry)
        location = (raw.get("location") or "").strip()
        g = {
            "game_id": raw.get("game_id") or "",
            "season": season,
            "game_type": raw.get("game_type") or "",
            "week": inum(raw.get("week")) or 0,
            "gameday": raw.get("gameday") or "",
            "weekday": raw.get("weekday") or "",
            "gametime": raw.get("gametime") or "",
            "away_team": away,
            "away_score": fnum(raw.get("away_score")),
            "home_team": home,
            "home_score": fnum(raw.get("home_score")),
            "location": location,
            "is_neutral": location.lower() != "home",
            "overtime": inum(raw.get("overtime")) or 0,
            "away_rest": inum(raw.get("away_rest")),
            "home_rest": inum(raw.get("home_rest")),
            "div_game": inum(raw.get("div_game")) or 0,
            "roof": raw.get("roof") or "",
            "surface": raw.get("surface") or "",
            "stadium_id": raw.get("stadium_id") or "",
            "stadium": raw.get("stadium") or "",
        }
        parsed.append(g)

    parsed.sort(key=lambda g: (g["season"], g["gameday"], g["game_id"]))
    persisted_rows.sort(key=lambda r: (int(r["season"]), r["gameday"], r["game_id"]))

    source_path = ROOT / lock["outputs"]["sourceSnapshot"]
    source_path.parent.mkdir(parents=True, exist_ok=True)
    with source_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=whitelist)
        w.writeheader()
        w.writerows(persisted_rows)

    surf_reg = derive_surface_registry(parsed, registry)
    surf_reg["generatedFromSourceSha256"] = source_sha
    surface_path = ROOT / lock["outputs"]["surfaceRegistry"]
    write_json(surface_path, surf_reg)
    surf = surface_lookup(surf_reg)

    teams = sorted(registry["teams"].keys())
    reg_games = [g for g in parsed if g["game_type"] == "REG"]
    completed_reg = [g for g in reg_games if g["home_score"] is not None and g["away_score"] is not None]
    by_season = defaultdict(list)
    team_sched = defaultdict(lambda: defaultdict(list))
    game_pos = {}
    for g in reg_games:
        by_season[g["season"]].append(g)
        for t in (g["home_team"], g["away_team"]):
            team_sched[g["season"]][t].append(g)
    for season in team_sched:
        for team in team_sched[season]:
            team_sched[season][team].sort(key=lambda g: (g["gameday"], g["game_id"]))
            for i, g in enumerate(team_sched[season][team]):
                game_pos[(season, team, g["game_id"])] = i

    sb_identity = {}
    for g in parsed:
        if g["game_type"] != "SB" or g["home_score"] is None or g["away_score"] is None:
            continue
        if g["home_score"] > g["away_score"]:
            winner, loser = g["home_team"], g["away_team"]
        else:
            winner, loser = g["away_team"], g["home_team"]
        sb_identity[g["season"] + 1] = {"winner": winner, "loser": loser, "sourceGameId": g["game_id"]}

    eligible_strength_seasons = [s for s in range(2014, 2026) if s != 2020]
    rating_cache = {}

    def ratings_before(season, week, gameday):
        key = (season, week)
        if key in rating_cache:
            return rating_cache[key]
        prior_seasons = [s for s in eligible_strength_seasons if s < season][-int(lock["teamStrengthControl"]["lookbackEligibleSeasons"]):]
        fit_games = []
        for s in prior_seasons:
            fit_games.extend([g for g in by_season.get(s, []) if g["home_score"] is not None and g["away_score"] is not None])
        if season != 2020:
            fit_games.extend([g for g in by_season.get(season, []) if g["home_score"] is not None and g["away_score"] is not None and g["gameday"] < gameday])
        r = fit_team_ratings(fit_games, teams, float(lock["teamStrengthControl"]["ridgePenalty"]), h4_domestic)
        rating_cache[key] = r
        return r

    def percentile_tier(team, ratings):
        ordered = sorted((v, t) for t, v in ratings.items())
        rank = next(i for i, (_, t) in enumerate(ordered) if t == team)
        pct = (rank + 0.5) / len(ordered)
        if pct < float(lock["pregameStrengthTiersForBookByeRows"]["belowAverageMaxPercentile"]):
            return "BELOW"
        if pct >= float(lock["pregameStrengthTiersForBookByeRows"]["greatMinPercentile"]):
            return "GREAT"
        return "AVERAGE"

    family_of = {
        "S_TURF_SAME":"TURF_SURFACE","S_TURF_OPPOSITE":"TURF_SURFACE",
        "S_SAME_DIVISION":"DIVISION_CONFERENCE","S_DIFFERENT_CONFERENCE":"DIVISION_CONFERENCE",
        "S_HOME_THURSDAY_NIGHT":"REST_PRIMETIME","S_HOME_SUNDAY_NIGHT":"REST_PRIMETIME","S_HOME_MONDAY_NIGHT":"REST_PRIMETIME","S_HOME_OFF_MNF_AWAY":"REST_PRIMETIME","S_AWAY_OFF_MNF_HOME":"REST_PRIMETIME","S_AWAY_OFF_MNF_AWAY":"REST_PRIMETIME",
        "S_THIRD_AWAY_IN_FOUR":"ROAD_DENSITY",
        "S_HOME_OFF_HOME_OT":"OVERTIME_RECOVERY","S_HOME_OFF_AWAY_OT":"OVERTIME_RECOVERY","S_AWAY_OFF_HOME_OT":"OVERTIME_RECOVERY","S_AWAY_OFF_AWAY_OT":"OVERTIME_RECOVERY",
        "S_HOME_BYE":"BYE","S_AWAY_BYE":"BYE",
        "S_SB_WINNER":"SUPER_BOWL_AFTEREFFECT","S_SB_LOSER":"SUPER_BOWL_AFTEREFFECT",
        "S_TRAVEL_2000_PLUS":"TRAVEL_DISTANCE",
        "S_EARLY_WEST":"TIME_ZONE_BODY_CLOCK","S_EARLY_MOUNTAIN":"TIME_ZONE_BODY_CLOCK","S_NIGHT_EAST":"TIME_ZONE_BODY_CLOCK","S_NIGHT_CENTRAL":"TIME_ZONE_BODY_CLOCK","S_NIGHT_MOUNTAIN":"TIME_ZONE_BODY_CLOCK",
        "S_SECOND_REMOTE_TWO_TZ":"CONSECUTIVE_REMOTE",
        "S_HOME_BOUNCE":"BOUNCE_BACK","S_AWAY_BOUNCE":"BOUNCE_BACK",
        "EXT_REST_DIFF_DAYS":"REST_PRIMETIME","EXT_BYE_STRENGTH":"BYE",
        "EXT_TRAVEL_750_1249":"TRAVEL_DISTANCE","EXT_TRAVEL_1250_1999":"TRAVEL_DISTANCE","EXT_TRAVEL_1000MI":"TRAVEL_DISTANCE","EXT_TRAVEL_X_ROAD":"TRAVEL_DISTANCE",
        "EXT_TZ_EARLY_EASTWARD":"TIME_ZONE_BODY_CLOCK","EXT_TZ_NIGHT_WESTWARD":"TIME_ZONE_BODY_CLOCK",
        "EXT_SURFACE_AWAY_SYNTH_MISMATCH":"TURF_SURFACE","EXT_ALTITUDE_HIGH":"ALTITUDE_EXPOSURE"
    }
    printed_features = {k for k in family_of if k.startswith("S_")}
    extension_features = {k for k in family_of if k.startswith("EXT_")}

    missing_audit = Counter()

    def previous_game(g, team):
        arr = team_sched[g["season"]].get(team, [])
        pos = game_pos.get((g["season"], team, g["game_id"]))
        if pos is None or pos <= 0:
            return None
        prev = arr[pos - 1]
        if prev["home_score"] is None or prev["away_score"] is None:
            return None
        return prev

    def side_in(game, team):
        return "HOME" if game["home_team"] == team else "AWAY"

    def is_night(g):
        m = parse_time_minutes(g["gametime"])
        return m is not None and m >= 19 * 60

    def derive_record(g):
        ratings = ratings_before(g["season"], g["week"], g["gameday"])
        hfa = 0.0 if g["is_neutral"] else h4_domestic
        baseline = ratings.get(g["home_team"], 0.0) - ratings.get(g["away_team"], 0.0) + hfa
        margin = g["home_score"] - g["away_score"]
        feats = defaultdict(float)

        hs = surf.get((g["season"], g["home_team"]))
        aws = surf.get((g["season"], g["away_team"]))
        if not g["is_neutral"] and hs and aws:
            if hs == aws:
                feats["S_TURF_SAME"] = -1.0
            else:
                feats["S_TURF_OPPOSITE"] = 1.0
                if aws == "SYNTHETIC":
                    feats["EXT_SURFACE_AWAY_SYNTH_MISMATCH"] = 1.0
        else:
            missing_audit["surface_family_unresolved"] += 1

        hm = team_meta(g["home_team"], g["season"], registry)
        am = team_meta(g["away_team"], g["season"], registry)
        if hm and am:
            if hm["division"] == am["division"]:
                feats["S_SAME_DIVISION"] = -1.0
            elif hm["conference"] != am["conference"]:
                feats["S_DIFFERENT_CONFERENCE"] = 1.0
        else:
            missing_audit["alignment_unresolved"] += 1

        wd = g["weekday"].lower()
        if is_night(g):
            if wd.startswith("thurs"):
                feats["S_HOME_THURSDAY_NIGHT"] = 2.0
            elif wd.startswith("sun"):
                feats["S_HOME_SUNDAY_NIGHT"] = 4.0
            elif wd.startswith("mon"):
                feats["S_HOME_MONDAY_NIGHT"] = 2.0

        hp = previous_game(g, g["home_team"])
        ap = previous_game(g, g["away_team"])
        if hp and hp["weekday"].lower().startswith("mon") and side_in(hp, g["home_team"]) == "AWAY":
            feats["S_HOME_OFF_MNF_AWAY"] = -4.0
        if ap and ap["weekday"].lower().startswith("mon"):
            feats["S_AWAY_OFF_MNF_HOME" if side_in(ap, g["away_team"]) == "HOME" else "S_AWAY_OFF_MNF_AWAY"] = 6.0 if side_in(ap, g["away_team"]) == "HOME" else 8.0

        arr = team_sched[g["season"]].get(g["away_team"], [])
        pos = game_pos.get((g["season"], g["away_team"], g["game_id"]))
        third_away = False
        if pos is not None:
            window = arr[max(0, pos - 3):pos + 1]
            if len(window) == 4 and side_in(g, g["away_team"]) == "AWAY" and sum(1 for x in window if side_in(x, g["away_team"]) == "AWAY") >= 3:
                feats["S_THIRD_AWAY_IN_FOUR"] = 2.0
                third_away = True

        if hp and hp["overtime"]:
            if side_in(hp, g["home_team"]) == "HOME": feats["S_HOME_OFF_HOME_OT"] = -4.0
            else: feats["S_HOME_OFF_AWAY_OT"] = -2.0
        if ap and ap["overtime"]:
            if side_in(ap, g["away_team"]) == "HOME": feats["S_AWAY_OFF_HOME_OT"] = 4.0
            else: feats["S_AWAY_OFF_AWAY_OT"] = 2.0

        home_bye = g["home_rest"] is not None and g["home_rest"] >= 12
        away_bye = g["away_rest"] is not None and g["away_rest"] >= 12
        tier_units_home = {"BELOW":4.0,"AVERAGE":5.0,"GREAT":7.0}
        tier_units_away = {"BELOW":5.0,"AVERAGE":6.0,"GREAT":8.0}
        if home_bye:
            feats["S_HOME_BYE"] = tier_units_home[percentile_tier(g["home_team"], ratings)]
        if away_bye:
            feats["S_AWAY_BYE"] = -tier_units_away[percentile_tier(g["away_team"], ratings)]
        feats["EXT_BYE_STRENGTH"] = ((ratings.get(g["home_team"],0.0) if home_bye else 0.0) - (ratings.get(g["away_team"],0.0) if away_bye else 0.0)) / 10.0

        sb = sb_identity.get(g["season"])
        if sb:
            for team, side_sign in ((g["home_team"], 1.0), (g["away_team"], -1.0)):
                arrt = team_sched[g["season"]].get(team, [])
                p = game_pos.get((g["season"], team, g["game_id"]), -1)
                game_no = p + 1
                if 1 <= game_no <= 4:
                    mag = 4.0 if game_no == 1 else 2.0
                    if team == sb["winner"]:
                        feats["S_SB_WINNER"] += side_sign * mag
                    if team == sb["loser"]:
                        feats["S_SB_LOSER"] += -side_sign * mag

        distance = None
        if not g["is_neutral"] and hm and am:
            distance = haversine_miles(am, hm)
            if distance >= 2000.0:
                feats["S_TRAVEL_2000_PLUS"] = 1.0
            if 750.0 <= distance < 1250.0:
                feats["EXT_TRAVEL_750_1249"] = 1.0
            if 1250.0 <= distance < 2000.0:
                feats["EXT_TRAVEL_1250_1999"] = 1.0
            feats["EXT_TRAVEL_1000MI"] = distance / 1000.0
            if third_away:
                feats["EXT_TRAVEL_X_ROAD"] = distance / 1000.0
            if hm["altitudeClass"] == "HIGH":
                feats["EXT_ALTITUDE_HIGH"] = 1.0
        else:
            missing_audit["travel_family_unresolved"] += 1

        tm = parse_time_minutes(g["gametime"])
        if not g["is_neutral"] and hm and am and tm is not None:
            if 12 * 60 + 30 <= tm <= 13 * 60 + 30:
                if am["timezoneBand"] == "PACIFIC": feats["S_EARLY_WEST"] = 2.0
                elif am["timezoneBand"] == "MOUNTAIN": feats["S_EARLY_MOUNTAIN"] = 1.0
                eastward = max(0, hm["bandValue"] - am["bandValue"])
                feats["EXT_TZ_EARLY_EASTWARD"] = float(eastward)
            if tm >= 19 * 60:
                z = am["timezoneBand"]
                if z == "EASTERN": feats["S_NIGHT_EAST"] = 6.0
                elif z == "CENTRAL": feats["S_NIGHT_CENTRAL"] = 3.0
                elif z == "MOUNTAIN": feats["S_NIGHT_MOUNTAIN"] = 1.0
                westward = max(0, am["bandValue"] - hm["bandValue"])
                feats["EXT_TZ_NIGHT_WESTWARD"] = float(westward)
        else:
            missing_audit["timezone_family_unresolved"] += 1

        if not g["is_neutral"] and hm and am and ap:
            prior_venue_meta = None
            if not ap["is_neutral"]:
                prior_venue_meta = team_meta(ap["home_team"], ap["season"], registry)
            if prior_venue_meta:
                current_remote = abs(hm["bandValue"] - am["bandValue"]) >= 2
                prior_remote = abs(prior_venue_meta["bandValue"] - am["bandValue"]) >= 2
                prior_away_from_home = side_in(ap, g["away_team"]) == "AWAY"
                if current_remote and prior_remote and prior_away_from_home:
                    feats["S_SECOND_REMOTE_TWO_TZ"] = 2.0

        def bounce_units(prev, team):
            if not prev:
                return 0.0
            pf = prev["home_score"] if prev["home_team"] == team else prev["away_score"]
            pa = prev["away_score"] if prev["home_team"] == team else prev["home_score"]
            if pf is None or pa is None or pf >= pa:
                return 0.0
            loss = pa - pf
            return 4.0 if loss >= 29 else (2.0 if loss >= 19 else 0.0)
        hb = bounce_units(hp, g["home_team"])
        ab = bounce_units(ap, g["away_team"])
        if hb: feats["S_HOME_BOUNCE"] = hb
        if ab: feats["S_AWAY_BOUNCE"] = -ab

        if g["home_rest"] is not None and g["away_rest"] is not None:
            feats["EXT_REST_DIFF_DAYS"] = float(max(-7, min(7, g["home_rest"] - g["away_rest"])))

        book_units = sum(v for k, v in feats.items() if k in printed_features)
        return {
            "season": g["season"], "week": g["week"], "game_id": g["game_id"], "gameday": g["gameday"],
            "away": g["away_team"], "home": g["home_team"], "location": g["location"],
            "observedMargin": margin, "h4Base": hfa,
            "homeStrength": ratings.get(g["home_team"],0.0), "awayStrength": ratings.get(g["away_team"],0.0),
            "baselineMargin": baseline, "residual": margin - baseline,
            "bookNetSUnits": book_units, "travelMiles": distance,
            "features": dict(feats),
        }

    target_seasons = set(lock["source"]["primaryTrainingSeasons"] + lock["source"]["rareEventBackfillSeasons"] + lock["source"]["validationSeasons"])
    derived_all = [derive_record(g) for g in completed_reg if g["season"] in target_seasons]
    train = [r for r in derived_all if r["season"] in lock["source"]["primaryTrainingSeasons"]]
    backfill = [r for r in derived_all if r["season"] in lock["source"]["rareEventBackfillSeasons"]]
    valid = [r for r in derived_all if r["season"] in lock["source"]["validationSeasons"]]
    if len(train) < 900 or len(valid) < 240:
        fail(f"insufficient training/validation rows train={len(train)} validation={len(valid)}")

    scalar_cfg = lock["candidateModels"]["S_CURRENT_SCALAR"]
    x2 = sum(r["bookNetSUnits"] ** 2 for r in train) + float(scalar_cfg["ridgePenalty"])
    xy = sum(r["bookNetSUnits"] * r["residual"] for r in train)
    scalar = xy / x2 if x2 else 0.0

    all_feature_names = sorted({k for r in train for k, v in r["features"].items() if abs(v) > 1e-12})
    prior = {name: (scalar if name in printed_features else 0.0) for name in all_feature_names}
    partial_cfg = lock["candidateModels"]["S_PARTIAL_POOL_FAMILY"]
    coeff = fit_ridge(train, all_feature_names, prior, float(partial_cfg["ridgePenalty"]))

    def zero_adj(r): return 0.0
    def book_adj(r): return 0.20 * r["bookNetSUnits"]
    def scalar_adj(r): return scalar * r["bookNetSUnits"]
    def partial_adj(r): return sum(coeff.get(k,0.0) * v for k, v in r["features"].items())

    val_metrics = {
        "S_ZERO_BASELINE": metrics(valid, zero_adj),
        "S_BOOK_EXACT_020": metrics(valid, book_adj),
        "S_CURRENT_SCALAR": metrics(valid, scalar_adj),
        "S_PARTIAL_POOL_FAMILY": metrics(valid, partial_adj),
    }
    train_metrics = {
        "S_ZERO_BASELINE": metrics(train, zero_adj),
        "S_BOOK_EXACT_020": metrics(train, book_adj),
        "S_CURRENT_SCALAR": metrics(train, scalar_adj),
        "S_PARTIAL_POOL_FAMILY": metrics(train, partial_adj),
    }
    zero_v = val_metrics["S_ZERO_BASELINE"]
    scalar_ok = accepted_vs_zero(val_metrics["S_CURRENT_SCALAR"], zero_v)
    partial_ok = accepted_vs_zero(val_metrics["S_PARTIAL_POOL_FAMILY"], zero_v)
    selected = "S_ZERO_BASELINE"
    if scalar_ok:
        selected = "S_CURRENT_SCALAR"
    if partial_ok:
        pm, sm = val_metrics["S_PARTIAL_POOL_FAMILY"], val_metrics["S_CURRENT_SCALAR"]
        comparator = sm if scalar_ok else zero_v
        if pm["mae"] <= comparator["mae"] + 1e-9 and pm["rmse"] <= comparator["rmse"] + 1e-9 and abs(pm["meanError"]) <= abs(comparator["meanError"]) + 0.05 + 1e-9:
            selected = "S_PARTIAL_POOL_FAMILY"

    def contribution(r, family, model):
        if model == "S_CURRENT_SCALAR":
            units = sum(v for k, v in r["features"].items() if k in printed_features and family_of.get(k) == family)
            return scalar * units
        if model == "S_PARTIAL_POOL_FAMILY":
            return sum(coeff.get(k,0.0) * v for k, v in r["features"].items() if family_of.get(k) == family)
        return 0.0

    normal_scale = {
        "EXT_REST_DIFF_DAYS":3.0,"EXT_BYE_STRENGTH":1.0,"EXT_TRAVEL_750_1249":1.0,"EXT_TRAVEL_1250_1999":1.0,
        "EXT_TRAVEL_1000MI":2.5,"EXT_TRAVEL_X_ROAD":2.5,"EXT_TZ_EARLY_EASTWARD":3.0,"EXT_TZ_NIGHT_WESTWARD":3.0,
        "EXT_SURFACE_AWAY_SYNTH_MISMATCH":1.0,"EXT_ALTITUDE_HIGH":1.0
    }
    factor_safety = {}
    for name in all_feature_names:
        c = scalar if selected == "S_CURRENT_SCALAR" and name in printed_features else coeff.get(name,0.0)
        if name in printed_features:
            safe = abs(c) <= 1.0 + 1e-9
            implied = abs(c)
        else:
            implied = abs(c) * normal_scale.get(name,1.0)
            safe = implied <= 1.5 + 1e-9
        factor_safety[name] = {"coefficient": round6(c), "normalTriggerAbsPoints": round6(implied), "safe": safe}

    families = sorted(set(family_of.values()))
    rare_allowed = set(s1["historicalDataContract"]["rareEventBackfillWindow"]["allowedFamilies"])
    family_gates = []
    min_train = int(lock["evaluation"]["familyMinimumPrimaryEvents"])
    min_val = int(lock["evaluation"]["familyMinimumValidationEvents"])
    tol = float(lock["evaluation"]["familyValidationToleranceMae"])
    passed_families = []
    for fam in families:
        tr_aff = [r for r in train if abs(contribution(r, fam, selected)) > 1e-12]
        va_aff = [r for r in valid if abs(contribution(r, fam, selected)) > 1e-12]
        bf_aff = [r for r in backfill if any(abs(v)>1e-12 and family_of.get(k)==fam for k,v in r["features"].items())]
        if selected == "S_ZERO_BASELINE":
            tr_aff = [r for r in train if any(abs(v)>1e-12 and family_of.get(k)==fam for k,v in r["features"].items())]
            va_aff = [r for r in valid if any(abs(v)>1e-12 and family_of.get(k)==fam for k,v in r["features"].items())]
        def slope(rows):
            xs = [contribution(r,fam,selected) for r in rows]
            den = sum(x*x for x in xs)
            return None if den < 1e-12 else sum(x*r["residual"] for x,r in zip(xs,rows))/den
        tr_slope, va_slope = slope(tr_aff), slope(va_aff)
        zero_aff_mae = None if not va_aff else sum(abs(r["residual"]) for r in va_aff)/len(va_aff)
        fam_mae = None if not va_aff else sum(abs(r["residual"]-contribution(r,fam,selected)) for r in va_aff)/len(va_aff)
        fam_features = [k for k in all_feature_names if family_of.get(k)==fam]
        safe = all(factor_safety.get(k,{"safe":True})["safe"] for k in fam_features)
        direction_ok = tr_slope is not None and va_slope is not None and va_slope >= -0.10
        mae_ok = zero_aff_mae is not None and fam_mae <= zero_aff_mae + tol + 1e-9
        count_ok = len(tr_aff) >= min_train and len(va_aff) >= min_val
        pass_gate = selected != "S_ZERO_BASELINE" and count_ok and direction_ok and mae_ok and safe and fam != "SUPER_BOWL_AFTEREFFECT"
        if pass_gate:
            passed_families.append(fam)
        family_gates.append({
            "family": fam,
            "primaryEvents": len(tr_aff), "validationEvents": len(va_aff), "rareBackfillEvents": len(bf_aff),
            "rareBackfillAllowed": fam in rare_allowed,
            "trainAlignmentSlope": round6(tr_slope), "validationAlignmentSlope": round6(va_slope),
            "validationAffectedZeroMae": round6(zero_aff_mae), "validationAffectedFamilyMae": round6(fam_mae),
            "countGate": count_ok, "directionGate": direction_ok, "heldoutMaeGate": mae_ok, "coefficientSafetyGate": safe,
            "s3NumericCandidate": pass_gate,
            "reason": "PASS" if pass_gate else ("aggregate model is zero" if selected=="S_ZERO_BASELINE" else "one or more current-regime family gates failed")
        })

    def scoped_adj(r):
        return sum(contribution(r, fam, selected) for fam in passed_families)
    scoped_metrics = metrics(valid, scoped_adj)
    scoped_accepted = bool(passed_families) and accepted_vs_zero(scoped_metrics, zero_v)
    if not scoped_accepted:
        passed_families = []
        scoped_metrics = metrics(valid, zero_adj)

    family_estimates = []
    for fam in families:
        fnames = [k for k in all_feature_names if family_of.get(k)==fam]
        weighted = []
        for name in fnames:
            n = sum(1 for r in train if abs(r["features"].get(name,0.0))>1e-12)
            c = scalar if selected == "S_CURRENT_SCALAR" and name in printed_features else coeff.get(name,0.0)
            if n: weighted.append((c,n))
        estimate = sum(c*n for c,n in weighted)/sum(n for _,n in weighted) if weighted else 0.0
        family_estimates.append({"family":fam,"weightedCoefficient":round6(estimate),"features":fnames})

    output_feature_names = sorted(set(all_feature_names))
    derived_path = ROOT / lock["outputs"]["derivedFeatures"]
    derived_path.parent.mkdir(parents=True, exist_ok=True)
    base_cols = ["season","week","game_id","gameday","away","home","location","observedMargin","h4Base","homeStrength","awayStrength","baselineMargin","residual","bookNetSUnits","travelMiles"]
    with derived_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=base_cols + output_feature_names)
        w.writeheader()
        for r in sorted([x for x in derived_all if x["season"] in set(lock["source"]["primaryTrainingSeasons"] + lock["source"]["validationSeasons"])], key=lambda x:(x["season"],x["week"],x["game_id"])):
            row = {k: round6(r[k]) if isinstance(r.get(k), float) else r.get(k) for k in base_cols}
            for name in output_feature_names:
                row[name] = round6(r["features"].get(name,0.0))
            w.writerow(row)

    generated_at = datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
    protected = {}
    candidates = {
        "currentNumbers": ROOT / "data/walters/nfl/2026/week-01-current-numbers.json",
        "powerRatings": ROOT / "data/walters/nfl-power-ratings-ledger.json",
        "personnelLedger": ROOT / "data/walters/nfl/2026/week-01-personnel-ledger.json",
        "playerValueRegistry": ROOT / "data/walters/nfl/player-values/player-values-2026-v1.json"
    }
    for key,path in candidates.items():
        if path.exists(): protected[key]=sha256_file(path)

    state = "PASS_CURRENT_CALIBRATION_S3_CANDIDATE" if passed_families else "PASS_CURRENT_CALIBRATION_NO_S3_NUMERIC_CANDIDATE"
    release = {
        "schema":1,"releaseId":"walters-nfl-s-factor-release-2026-v1","calibrationId":s1["calibrationId"],"stage":"S2","state":state,"season":2026,
        "generatedAt":generated_at,"productionAuthority":False,"liveBoardMutationAllowed":False,"marketViewed":False,
        "trainingSeasons":lock["source"]["primaryTrainingSeasons"],"rareEventBackfillSeasons":lock["source"]["rareEventBackfillSeasons"],"validationSeasons":lock["source"]["validationSeasons"],
        "sourceSnapshots":[{"url":source_url,"sha256":source_sha,"persistedPath":lock["outputs"]["sourceSnapshot"],"persistedSha256":sha256_file(source_path),"upstreamColumnCount":len(upstream_fields),"persistedFieldWhitelist":whitelist}],
        "registrySnapshots":[{"path":str(REGISTRY_PATH.relative_to(ROOT)),"sha256":sha256_file(REGISTRY_PATH)},{"path":lock["outputs"]["surfaceRegistry"],"sha256":sha256_file(surface_path)}],
        "h4Control":{"homeAdvantagePoints":h4_domestic,"neutralPoints":0.0,"productionId":h4["productionId"]},
        "modelId":selected,"bookExactSpreadPointsPerSUnit":0.20,"currentScalarSpreadPointsPerSUnit":round6(scalar),"currentScalarSurvivalRatioVsBook":round6(scalar/0.20),
        "modelMetrics":{"training":train_metrics,"validation":val_metrics,"selectedScopedValidation":scoped_metrics},
        "aggregateAcceptance":{"scalarAccepted":scalar_ok,"partialPoolAccepted":partial_ok,"selectedModel":selected,"scopedAccepted":scoped_accepted},
        "s3ScopeCandidate":{"numericFamilies":passed_families,"modelId":selected if passed_families else "S_ZERO_BASELINE","nonNumericFamilies":[f for f in families if f not in passed_families],"rule":"Only listed numericFamilies may advance to active-week S3 shadow; S2 itself has no live authority."},
        "familyEstimates":family_estimates,"familyGates":family_gates,
        "factorEstimates":[{"feature":n,"family":family_of.get(n),"coefficient":round6(scalar if selected=="S_CURRENT_SCALAR" and n in printed_features else coeff.get(n,0.0)),"printed":n in printed_features,"safety":factor_safety[n]} for n in all_feature_names],
        "sampleCounts":{"primaryTraining":len(train),"rareBackfill":len(backfill),"validation":len(valid)},
        "missingness":dict(missing_audit),"protectedArtifactSha256":protected,
        "nextGate":"Build S3 active-week shadow only from the S2 numeric family scope. No live mutation before explicit S4 activation."
    }
    write_json(ROOT / lock["outputs"]["release"], release)

    audit = {
        "schema":1,"auditId":"walters-nfl-s-factor-s2-validation-audit-v1","stage":"S2","state":"PASS","generatedAt":generated_at,"marketViewed":False,
        "source":{"downloadUrl":source_url,"sha256":source_sha,"upstreamFields":upstream_fields,"forbiddenFieldsReadAsValues":[],"persistedFields":whitelist,"persistedRows":len(persisted_rows)},
        "holdoutIntegrity":{"trainingSeasons":lock["source"]["primaryTrainingSeasons"],"validationSeasons":lock["source"]["validationSeasons"],"modelLockPath":str(LOCK_PATH.relative_to(ROOT)),"modelLockSha256":sha256_file(LOCK_PATH),"rule":"No model definitions are tuned after 2025 metrics are read."},
        "teamStrengthControl":lock["teamStrengthControl"],"surfaceRegistryEntries":len(surf_reg["entries"]),"modelMetrics":{"training":train_metrics,"validation":val_metrics,"scoped":scoped_metrics},
        "selectedModel":selected,"scalar":round6(scalar),"familyGates":family_gates,"missingness":dict(missing_audit),"protectedArtifactSha256":protected
    }
    write_json(ROOT / lock["outputs"]["audit"], audit)
    current = {
        "schema":1,"stage":"S2","state":state,"season":2026,"updatedAt":generated_at,"productionAuthority":False,"liveBoardMutationAllowed":False,"marketViewed":False,
        "releasePath":lock["outputs"]["release"],"releaseSha256":sha256_file(ROOT / lock["outputs"]["release"]),"selectedModel":selected,
        "currentScalarSpreadPointsPerSUnit":round6(scalar),"s3NumericFamilies":passed_families,"s3ScopedValidation":scoped_metrics,
        "nextGate":["Run S3 active-week shadow only for S2-approved numeric families.","Preserve H4, personnel, matchup and carried ratings exactly.","If no numeric families are approved, S3 may still audit triggers but must remain zero numeric."]
    }
    write_json(ROOT / lock["outputs"]["current"], current)

    print(f"WALTERS S FACTOR S2: PASS // TRAIN {len(train)} // HOLDOUT {len(valid)} // SCALAR {scalar:.4f} PT/S // SELECTED {selected} // S3 FAMILIES {len(passed_families)} // MARKET ISOLATED")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        raise
