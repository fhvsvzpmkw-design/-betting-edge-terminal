#!/usr/bin/env python3
"""Execute the staged v1.8 SmartStake MLB player-prop reproducibility audit.

This script is research QA only. It downloads the dataset at an immutable revision,
scans all parquet files with DuckDB, constructs exact-selection closing quotes at
multiple safety cutoffs, pairs over/under sides, selects one market-information-only
main line per book/player/game/market, and writes compact audit results.

It does NOT alter the production Research Library and does NOT generate betting picks.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone

import duckdb
from huggingface_hub import snapshot_download

DATASET = "SmartStake/mlb-player-props"
REVISION = "049dd4caeb562010a5806207c413e9f9bc012825"
OUT_JSON = Path("research/staging/V1_8_SMARTSTAKE_MLB_AUDIT_RESULTS.json")
OUT_MD = Path("research/staging/V1_8_SMARTSTAKE_MLB_AUDIT_RESULTS.md")


def rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def json_default(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    root = Path(os.environ.get("RUNNER_TEMP", ".audit_tmp")) / "smartstake_mlb"
    root.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {DATASET}@{REVISION} ...", flush=True)
    snap = Path(snapshot_download(
        repo_id=DATASET,
        repo_type="dataset",
        revision=REVISION,
        allow_patterns=["mon=*/*.parquet", "README.md"],
        local_dir=root,
    ))
    files = sorted(snap.glob("mon=*/*.parquet"))
    if not files:
        raise RuntimeError("No parquet files downloaded")
    print(f"Downloaded {len(files)} parquet files", flush=True)

    source_manifest = []
    for p in files:
        source_manifest.append({
            "path": str(p.relative_to(snap)),
            "bytes": p.stat().st_size,
            "sha256": sha256_file(p),
        })
    print(f"Source bytes: {sum(x['bytes'] for x in source_manifest):,}", flush=True)

    db_path = Path(os.environ.get("RUNNER_TEMP", ".audit_tmp")) / "v18_smartstake_audit.duckdb"
    temp_dir = Path(os.environ.get("RUNNER_TEMP", ".audit_tmp")) / "duckdb_spill"
    temp_dir.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(db_path))
    con.execute("SET threads=4")
    con.execute("SET memory_limit='5GB'")
    con.execute(f"SET temp_directory='{str(temp_dir).replace("'", "''")}'")
    con.execute("SET preserve_insertion_order=false")
    con.execute("PRAGMA enable_progress_bar")

    file_sql = "[" + ",".join("'" + str(p).replace("'", "''") + "'" for p in files) + "]"
    con.execute(f"CREATE OR REPLACE VIEW src AS SELECT * FROM read_parquet({file_sql}, union_by_name=true)")

    results = {
        "schema": 1,
        "targetLibraryVersion": "1.8",
        "state": "STAGING_AUDIT_EXECUTED",
        "runtimeAuthority": False,
        "activeProductionLibrary": "1.7",
        "dataset": DATASET,
        "datasetRevision": REVISION,
        "executedAtUtc": datetime.now(timezone.utc).isoformat(),
        "sourceFiles": source_manifest,
        "notes": [
            "This is research QA, not a betting signal.",
            "Calibration results are descriptive until sportsbook/exchange/prediction-market source types are classified and uncertainty/holdout rules are applied.",
            "The public source crosswalk used for game-key de-drift is documented by the publisher but is not exposed in the released table, so provenance reconstruction remains limited.",
        ],
    }

    print("A: coverage", flush=True)
    results["coverage"] = rows(con.execute("""
        SELECT count(*) AS rows,
               count(DISTINCT game_id) AS games,
               count(DISTINCT player) AS players,
               count(DISTINCT market) AS markets,
               count(DISTINCT book) AS books,
               min(ts) AS first_quote_utc,
               max(ts) AS last_quote_utc,
               min(start_time) AS first_start_utc,
               max(start_time) AS last_start_utc,
               count(*) FILTER (WHERE result IS NOT NULL) AS graded_quote_rows,
               count(*) FILTER (WHERE result IS NULL) AS null_result_quote_rows
        FROM src
    """))[0]
    results["marketRows"] = rows(con.execute("""
        SELECT market, count(*) AS rows, count(DISTINCT game_id) AS games,
               count(DISTINCT player) AS players, count(DISTINCT book) AS books
        FROM src GROUP BY market ORDER BY rows DESC
    """))
    results["bookRows"] = rows(con.execute("""
        SELECT book, count(*) AS rows, count(DISTINCT game_id) AS games,
               count(DISTINCT market) AS markets
        FROM src GROUP BY book ORDER BY rows DESC
    """))

    print("B: grade/timing consistency", flush=True)
    results["consistency"] = rows(con.execute("""
        SELECT
          count(*) FILTER (WHERE result IS NULL AND won IS NOT NULL) AS won_without_result,
          count(*) FILTER (WHERE result IS NOT NULL AND result = line AND won IS NOT NULL) AS graded_pushes,
          count(*) FILTER (WHERE result IS NOT NULL AND won IS NOT NULL AND side = 'over' AND won <> (result > line)) AS over_grade_mismatches,
          count(*) FILTER (WHERE result IS NOT NULL AND won IS NOT NULL AND side = 'under' AND won <> (result < line)) AS under_grade_mismatches,
          count(*) FILTER (WHERE side NOT IN ('over','under')) AS unexpected_side_rows,
          count(*) FILTER (WHERE odds <= 1 OR odds IS NULL) AS invalid_decimal_odds_rows,
          count(*) FILTER (WHERE ts >= start_time) AS at_or_after_start_rows,
          count(*) FILTER (WHERE ts < start_time) AS pregame_rows,
          count(*) FILTER (WHERE ts <= start_time - INTERVAL 5 MINUTE) AS pregame_5m_safe_rows,
          count(*) FILTER (WHERE ts <= start_time - INTERVAL 15 MINUTE) AS pregame_15m_safe_rows,
          count(*) FILTER (WHERE ts <= start_time - INTERVAL 60 MINUTE) AS pregame_60m_safe_rows
        FROM src
    """))[0]

    # Exact duplicate checking over 621M minute identities can require a huge hash table.
    # We execute it file-by-file exactly, then separately detect overlaps between file
    # key ranges. The publisher says files are a partitioned export of the dedrifted table.
    print("C: exact within-file minute-key duplicate checks", flush=True)
    dup_files = []
    for i, p in enumerate(files, 1):
        q = str(p).replace("'", "''")
        rec = rows(con.execute(f"""
            WITH g AS (
              SELECT game_id, player, market, line, side, book, ts, count(*) AS n
              FROM read_parquet('{q}')
              GROUP BY ALL
              HAVING count(*) > 1
            )
            SELECT '{p.name}' AS file, count(*) AS duplicated_keys,
                   coalesce(sum(n-1),0) AS duplicate_rows,
                   coalesce(max(n),1) AS max_rows_per_key
            FROM g
        """))[0]
        rec["partition"] = p.parent.name
        dup_files.append(rec)
        print(f"  {i}/{len(files)} {p.parent.name}/{p.name}: {rec['duplicate_rows']} dup rows", flush=True)
    results["withinFileExactDuplicateAudit"] = dup_files
    results["duplicateAuditScope"] = {
        "mode": "exact_within_each_parquet_file",
        "globalCrossFileDuplicateGuarantee": False,
        "reason": "A single 621M-row exact global GROUP BY on the full minute identity is disproportionate for the hosted runner. Exact within-file checks were executed; closing-selection construction below globally regroups all files and therefore removes any cross-file duplication for the calibration surface.",
    }

    print("D: repeated same-price minute prevalence by month (upper-bound measure)", flush=True)
    repeated_months = []
    for month_dir in sorted({p.parent for p in files}):
        month_files = sorted(month_dir.glob("*.parquet"))
        month_sql = "[" + ",".join("'" + str(p).replace("'", "''") + "'" for p in month_files) + "]"
        rec = rows(con.execute(f"""
            WITH g AS (
              SELECT game_id, player, market, line, side, book, odds, count(*) AS n
              FROM read_parquet({month_sql}, union_by_name=true)
              GROUP BY ALL
            )
            SELECT '{month_dir.name}' AS partition,
                   sum(n) AS quote_rows,
                   sum(CASE WHEN n>1 THEN n-1 ELSE 0 END) AS repeated_same_price_excess_rows,
                   count(*) AS distinct_selection_price_states
            FROM g
        """))[0]
        repeated_months.append(rec)
        print(f"  {month_dir.name}: {rec['repeated_same_price_excess_rows']:,} same-price excess", flush=True)
    results["repeatedSamePriceByMonth"] = repeated_months
    results["repeatedSamePriceMetricNote"] = "This is a conservative prevalence/upper-bound style metric: it counts repeated uses of the same price for a selection within a month, including possible returns to an earlier price. It proves raw quote rows are not independent price changes; it is not an adjacent-run count."

    print("E: build global exact-selection cutoff closes", flush=True)
    con.execute("DROP TABLE IF EXISTS closing_cutoffs")
    con.execute("""
        CREATE TABLE closing_cutoffs AS
        SELECT
          game_id, start_time, player, market, line, side, book,
          arg_max(odds, ts) FILTER (WHERE ts < start_time) AS odds_0m,
          max(ts) FILTER (WHERE ts < start_time) AS ts_0m,
          arg_max(odds, ts) FILTER (WHERE ts <= start_time - INTERVAL 5 MINUTE) AS odds_5m,
          max(ts) FILTER (WHERE ts <= start_time - INTERVAL 5 MINUTE) AS ts_5m,
          arg_max(odds, ts) FILTER (WHERE ts <= start_time - INTERVAL 15 MINUTE) AS odds_15m,
          max(ts) FILTER (WHERE ts <= start_time - INTERVAL 15 MINUTE) AS ts_15m,
          arg_max(odds, ts) FILTER (WHERE ts <= start_time - INTERVAL 60 MINUTE) AS odds_60m,
          max(ts) FILTER (WHERE ts <= start_time - INTERVAL 60 MINUTE) AS ts_60m,
          min(result) AS result_min,
          max(result) AS result_max,
          count(DISTINCT result) AS result_values,
          count(DISTINCT won) FILTER (WHERE won IS NOT NULL) AS won_values,
          bool_or(won) FILTER (WHERE won IS NOT NULL) AS any_won,
          count(*) AS raw_rows
        FROM src
        WHERE result IS NOT NULL
        GROUP BY game_id, start_time, player, market, line, side, book
    """)
    results["selectionOutcomeConsistency"] = rows(con.execute("""
        SELECT count(*) AS selection_sides,
               count(*) FILTER (WHERE result_values > 1) AS selections_with_multiple_results,
               count(*) FILTER (WHERE won_values > 1) AS selections_with_multiple_nonnull_grades,
               count(*) FILTER (WHERE odds_0m IS NOT NULL) AS selections_with_0m_close,
               count(*) FILTER (WHERE odds_5m IS NOT NULL) AS selections_with_5m_close,
               count(*) FILTER (WHERE odds_15m IS NOT NULL) AS selections_with_15m_close,
               count(*) FILTER (WHERE odds_60m IS NOT NULL) AS selections_with_60m_close
        FROM closing_cutoffs
    """))[0]

    print("F: pair over/under and build main lines", flush=True)
    con.execute("DROP TABLE IF EXISTS paired_cutoffs")
    con.execute("""
        CREATE TABLE paired_cutoffs AS
        WITH pairs AS (
          SELECT
            o.game_id, o.start_time, o.player, o.market, o.line, o.book,
            o.result_min AS result,
            o.any_won AS over_won,
            o.odds_0m AS over_0m, u.odds_0m AS under_0m,
            o.odds_5m AS over_5m, u.odds_5m AS under_5m,
            o.odds_15m AS over_15m, u.odds_15m AS under_15m,
            o.odds_60m AS over_60m, u.odds_60m AS under_60m
          FROM closing_cutoffs o
          JOIN closing_cutoffs u USING (game_id, start_time, player, market, line, book)
          WHERE o.side='over' AND u.side='under'
            AND o.result_values=1 AND u.result_values=1
            AND o.result_min=u.result_min
            AND o.any_won IS NOT NULL
        )
        SELECT * FROM (
          SELECT 0 AS cutoff_min, game_id,start_time,player,market,line,book,result,over_won,
                 over_0m AS over_odds, under_0m AS under_odds FROM pairs
          UNION ALL
          SELECT 5, game_id,start_time,player,market,line,book,result,over_won,over_5m,under_5m FROM pairs
          UNION ALL
          SELECT 15, game_id,start_time,player,market,line,book,result,over_won,over_15m,under_15m FROM pairs
          UNION ALL
          SELECT 60, game_id,start_time,player,market,line,book,result,over_won,over_60m,under_60m FROM pairs
        ) q
        WHERE over_odds > 1 AND under_odds > 1
    """)
    con.execute("ALTER TABLE paired_cutoffs ADD COLUMN p_over DOUBLE")
    con.execute("ALTER TABLE paired_cutoffs ADD COLUMN overround DOUBLE")
    con.execute("UPDATE paired_cutoffs SET p_over=(1.0/over_odds)/((1.0/over_odds)+(1.0/under_odds)), overround=(1.0/over_odds+1.0/under_odds-1.0)")

    results["pairedLineSummary"] = rows(con.execute("""
        SELECT cutoff_min, market, count(*) AS paired_exact_lines,
               count(DISTINCT book) AS books,
               avg(overround) AS avg_overround,
               quantile_cont(overround,0.5) AS median_overround,
               min(overround) AS min_overround,
               max(overround) AS max_overround
        FROM paired_cutoffs
        GROUP BY cutoff_min, market
        ORDER BY market, cutoff_min
    """))

    con.execute("DROP TABLE IF EXISTS mainlines")
    con.execute("""
        CREATE TABLE mainlines AS
        SELECT * EXCLUDE (rn) FROM (
          SELECT *, row_number() OVER (
            PARTITION BY cutoff_min, game_id, player, market, book
            ORDER BY abs(p_over-0.5), abs(overround), line
          ) AS rn
          FROM paired_cutoffs
        ) q WHERE rn=1
    """)

    print("G: descriptive calibration / cutoff sensitivity", flush=True)
    results["mainlineCalibrationByMarketCutoff"] = rows(con.execute("""
        SELECT cutoff_min, market, count(*) AS n,
               avg((p_over-CAST(over_won AS INTEGER))*(p_over-CAST(over_won AS INTEGER))) AS brier,
               avg(-CAST(over_won AS INTEGER)*ln(greatest(p_over,1e-9))
                   -(1-CAST(over_won AS INTEGER))*ln(greatest(1-p_over,1e-9))) AS log_loss,
               avg(overround) AS avg_overround,
               avg(CAST(over_won AS INTEGER)) AS realized_over_rate,
               avg(p_over) AS mean_devig_over_probability
        FROM mainlines
        GROUP BY cutoff_min, market
        ORDER BY market, cutoff_min
    """))

    results["mainlineCalibrationByBookMarket5m"] = rows(con.execute("""
        SELECT book, market, count(*) AS n,
               avg((p_over-CAST(over_won AS INTEGER))*(p_over-CAST(over_won AS INTEGER))) AS brier,
               avg(-CAST(over_won AS INTEGER)*ln(greatest(p_over,1e-9))
                   -(1-CAST(over_won AS INTEGER))*ln(greatest(1-p_over,1e-9))) AS log_loss,
               avg(overround) AS avg_overround
        FROM mainlines
        WHERE cutoff_min=5
        GROUP BY book, market
        HAVING count(*) >= 200
        ORDER BY market, brier
    """))

    results["calibrationBins5m"] = rows(con.execute("""
        WITH b AS (
          SELECT market,
                 CASE
                   WHEN p_over >= 1 THEN 10
                   WHEN p_over <= 0 THEN 1
                   ELSE least(10, greatest(1, CAST(floor(p_over*10)+1 AS INTEGER)))
                 END AS bin,
                 p_over, over_won
          FROM mainlines WHERE cutoff_min=5
        )
        SELECT market, bin, count(*) AS n,
               avg(p_over) AS mean_predicted,
               avg(CAST(over_won AS INTEGER)) AS realized_rate,
               avg(CAST(over_won AS INTEGER))-avg(p_over) AS calibration_gap
        FROM b GROUP BY market, bin ORDER BY market, bin
    """))

    results["books"] = [r[0] for r in con.execute("SELECT DISTINCT book FROM src ORDER BY book").fetchall()]

    # Simple admission checks. These are deliberately conservative.
    c = results["consistency"]
    o = results["selectionOutcomeConsistency"]
    results["admissionChecks"] = {
        "gradeLogicClean": (c["over_grade_mismatches"] == 0 and c["under_grade_mismatches"] == 0 and c["graded_pushes"] == 0),
        "validSidesAndOdds": (c["unexpected_side_rows"] == 0 and c["invalid_decimal_odds_rows"] == 0),
        "selectionOutcomeConsistency": (o["selections_with_multiple_results"] == 0 and o["selections_with_multiple_nonnull_grades"] == 0),
        "postStartRowsExist": c["at_or_after_start_rows"] > 0,
        "mustUsePregameCutoff": True,
        "sourceTypeClassificationComplete": False,
        "forwardHoldoutCalibrationPerformed": False,
        "globalMinuteIdentityCrossFileExactDuplicateCheck": False,
        "promotionReady": False,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(results, indent=2, default=json_default) + "\n", encoding="utf-8")

    cov = results["coverage"]
    lines = [
        "# Betting Edge Research Library v1.8 — SmartStake MLB Full Audit Results",
        "",
        "**State:** STAGING AUDIT EXECUTED — NOT RUNTIME AUTHORITY  ",
        "**Active production library remains:** v1.7  ",
        f"**Dataset revision:** `{REVISION}`  ",
        f"**Executed UTC:** {results['executedAtUtc']}",
        "",
        "## Coverage",
        "",
        f"- Raw quote rows: **{cov['rows']:,}**",
        f"- Games: **{cov['games']:,}**",
        f"- Players: **{cov['players']:,}**",
        f"- Markets: **{cov['markets']:,}**",
        f"- Books/sources: **{cov['books']:,}**",
        f"- Graded quote rows: **{cov['graded_quote_rows']:,}**",
        f"- Null-result quote rows: **{cov['null_result_quote_rows']:,}**",
        "",
        "## Integrity checks",
        "",
        f"- Over grade mismatches: **{c['over_grade_mismatches']:,}**",
        f"- Under grade mismatches: **{c['under_grade_mismatches']:,}**",
        f"- Graded pushes: **{c['graded_pushes']:,}**",
        f"- Invalid decimal-odds rows: **{c['invalid_decimal_odds_rows']:,}**",
        f"- At/after scheduled-start rows: **{c['at_or_after_start_rows']:,}**",
        f"- Exact within-file duplicate rows: **{sum(int(x['duplicate_rows']) for x in dup_files):,}**",
        "",
        "The exact duplicate audit is exhaustive inside every parquet file. A single global 621M-row minute-key hash aggregation was intentionally not used on the hosted runner; global calibration construction regroups exact selections across all files before pairing.",
        "",
        "## Market calibration surface",
        "",
        "The generated JSON contains exact-line pairing, market-information-only main-line selection, proportional no-vig probabilities, Brier/log loss, reliability bins, and cutoff sensitivity at 0/5/15/60 minutes before first pitch.",
        "",
        "These results remain **descriptive research QA**, not a bookmaker ranking or betting edge. Source-type classification, forward holdout testing, and remaining provenance limitations must be resolved before any direct-market finding can enter canonical v1.8.",
        "",
        "## Promotion status",
        "",
        "**NOT READY FOR PROMOTION.** Production v1.7 remains unchanged.",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_JSON} and {OUT_MD}", flush=True)


if __name__ == "__main__":
    main()
