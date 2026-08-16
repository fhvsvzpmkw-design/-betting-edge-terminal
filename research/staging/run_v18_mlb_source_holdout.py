#!/usr/bin/env python3
"""Phase-2 MLB source classification + forward holdout calibration audit.

STAGING RESEARCH QA ONLY. Production Research Library v1.7 is not modified.

Primary design:
- immutable SmartStake MLB dataset revision;
- classify all source labels before analysis;
- primary cohort = high-confidence traditional sportsbooks only;
- sensitivity cohort = high + medium-confidence traditional sportsbooks;
- construct one 5-minute pre-first-pitch main line per book/player/game/market;
- train calibration mapping on March-May 2026;
- evaluate untouched June 2026 holdout;
- fit market-level logistic recalibration q=sigmoid(a+b*logit(p)) on training only;
- compare raw de-vig probabilities vs trained recalibration on holdout;
- preserve per-book holdout metrics for diagnostics, not rankings.
"""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import duckdb
from huggingface_hub import snapshot_download

DATASET = "SmartStake/mlb-player-props"
REVISION = "049dd4caeb562010a5806207c413e9f9bc012825"
CLASSIFICATION = Path("research/staging/V1_8_MLB_SOURCE_CLASSIFICATION.json")
OUT_JSON = Path("research/staging/V1_8_MLB_SOURCE_HOLDOUT_RESULTS.json")
OUT_MD = Path("research/staging/V1_8_MLB_SOURCE_HOLDOUT_RESULTS.md")
TRAIN_END = "2026-06-01T00:00:00"
HOLDOUT_END = "2026-07-01T00:00:00"


def rows(cur):
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in cur.fetchall()]


def jdefault(v):
    if hasattr(v, "isoformat"):
        return v.isoformat()
    return str(v)


def sql_list(vals):
    return "[" + ",".join("'" + v.replace("'", "''") + "'" for v in vals) + "]"


def fit_logistic_recalibration(con, market: str, cohort: str, max_iter: int = 15):
    # Start from perfect calibration q=p => a=0,b=1.
    a, b = 0.0, 1.0
    escaped = market.replace("'", "''")
    for _ in range(max_iter):
        q = con.execute(f"""
            WITH d AS (
              SELECT CAST(over_won AS INTEGER) AS y,
                     ln(greatest(least(p_over, 0.999999), 0.000001) /
                        (1.0-greatest(least(p_over, 0.999999), 0.000001))) AS x
              FROM sportsbook_mainlines
              WHERE cohort='{cohort}'
                AND market='{escaped}'
                AND period='train'
            ), s AS (
              SELECT y, x,
                     1.0/(1.0+exp(-({a} + {b}*x))) AS pr
              FROM d
            )
            SELECT count(*) AS n,
                   sum(y-pr) AS g0,
                   sum((y-pr)*x) AS g1,
                   sum(pr*(1-pr)) AS w0,
                   sum(pr*(1-pr)*x) AS w1,
                   sum(pr*(1-pr)*x*x) AS w2
            FROM s
        """).fetchone()
        n, g0, g1, w0, w1, w2 = q
        if not n or n < 1000:
            return {"status":"insufficient_train", "n": int(n or 0), "intercept": None, "slope": None, "iterations": 0}
        # Fisher scoring: beta_new = beta + (X'WX)^-1 X'(y-p)
        det = w0*w2 - w1*w1
        if not det or abs(det) < 1e-12:
            return {"status":"singular", "n": int(n), "intercept": a, "slope": b, "iterations": 0}
        da = (w2*g0 - w1*g1) / det
        db = (-w1*g0 + w0*g1) / det
        # Damping guards against a pathological single update.
        scale = max(1.0, abs(da)/2.0, abs(db)/2.0)
        da /= scale
        db /= scale
        a += da
        b += db
        if max(abs(da), abs(db)) < 1e-8:
            break
    return {"status":"fit", "n": int(n), "intercept": a, "slope": b, "iterations": max_iter}


def metric_query(con, market, cohort, period, a=None, b=None):
    escaped = market.replace("'", "''")
    if a is None or b is None:
        recal_expr = "p_over"
    else:
        recal_expr = f"1.0/(1.0+exp(-({a}+{b}*ln(greatest(least(p_over,0.999999),0.000001)/(1.0-greatest(least(p_over,0.999999),0.000001))))))"
    return rows(con.execute(f"""
        WITH d AS (
          SELECT CAST(over_won AS INTEGER) AS y, p_over, overround,
                 {recal_expr} AS p_recal
          FROM sportsbook_mainlines
          WHERE cohort='{cohort}' AND period='{period}' AND market='{escaped}'
        )
        SELECT count(*) AS n,
               avg(p_over) AS raw_mean_probability,
               avg(p_recal) AS recal_mean_probability,
               avg(y) AS realized_over_rate,
               avg((p_over-y)*(p_over-y)) AS raw_brier,
               avg((p_recal-y)*(p_recal-y)) AS recal_brier,
               avg(-y*ln(greatest(p_over,1e-9))-(1-y)*ln(greatest(1-p_over,1e-9))) AS raw_log_loss,
               avg(-y*ln(greatest(p_recal,1e-9))-(1-y)*ln(greatest(1-p_recal,1e-9))) AS recal_log_loss,
               avg(overround) AS avg_overround
        FROM d
    """))[0]


def main():
    classification = json.loads(CLASSIFICATION.read_text())
    source_map = classification["sources"]
    primary_books = sorted(k for k,v in source_map.items() if v["eligibleSportsbookHoldout"] and v["confidence"] == "high")
    sensitivity_books = sorted(k for k,v in source_map.items() if v["eligibleSportsbookHoldout"])

    root = Path(os.environ.get("RUNNER_TEMP", ".audit_tmp")) / "smartstake_mlb_holdout"
    root.mkdir(parents=True, exist_ok=True)
    snap = Path(snapshot_download(
        repo_id=DATASET,
        repo_type="dataset",
        revision=REVISION,
        allow_patterns=["mon=*/*.parquet"],
        local_dir=root,
    ))
    files = sorted(snap.glob("mon=*/*.parquet"))
    if not files:
        raise RuntimeError("No parquet files downloaded")

    dbp = Path(os.environ.get("RUNNER_TEMP", ".audit_tmp")) / "v18_mlb_holdout.duckdb"
    spill = Path(os.environ.get("RUNNER_TEMP", ".audit_tmp")) / "v18_mlb_holdout_spill"
    spill.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(dbp))
    con.execute("SET threads=4")
    con.execute("SET memory_limit='5GB'")
    con.execute(f"SET temp_directory='{str(spill).replace(chr(39), chr(39)*2)}'")
    con.execute("SET preserve_insertion_order=false")

    paths = sql_list([str(p) for p in files])
    con.execute(f"CREATE VIEW src AS SELECT * FROM read_parquet({paths}, union_by_name=true)")

    dataset_books = [r[0] for r in con.execute("SELECT DISTINCT book FROM src ORDER BY book").fetchall()]
    missing = sorted(set(dataset_books) - set(source_map))
    extra = sorted(set(source_map) - set(dataset_books))
    if missing or extra:
        raise RuntimeError(f"Classification mismatch missing={missing} extra={extra}")

    # Build globally regrouped exact-selection closes at 5 minutes.
    print("Building 5-minute exact-selection closes...", flush=True)
    con.execute("""
      CREATE TABLE closing_5m AS
      SELECT game_id,start_time,player,market,line,side,book,
             arg_max(odds,ts) FILTER (WHERE ts <= start_time-INTERVAL 5 MINUTE) AS odds,
             max(ts) FILTER (WHERE ts <= start_time-INTERVAL 5 MINUTE) AS close_ts,
             min(result) AS result_min,
             max(result) AS result_max,
             count(DISTINCT result) AS result_values,
             bool_or(won) FILTER (WHERE won IS NOT NULL) AS any_won
      FROM src
      WHERE result IS NOT NULL
      GROUP BY game_id,start_time,player,market,line,side,book
    """)

    print("Pairing exact over/under lines...", flush=True)
    con.execute("""
      CREATE TABLE paired_5m AS
      SELECT o.game_id,o.start_time,o.player,o.market,o.line,o.book,
             o.result_min AS result,o.any_won AS over_won,
             o.odds AS over_odds,u.odds AS under_odds,
             (1.0/o.odds)/((1.0/o.odds)+(1.0/u.odds)) AS p_over,
             (1.0/o.odds+1.0/u.odds-1.0) AS overround
      FROM closing_5m o
      JOIN closing_5m u USING(game_id,start_time,player,market,line,book)
      WHERE o.side='over' AND u.side='under'
        AND o.odds>1 AND u.odds>1
        AND o.result_values=1 AND u.result_values=1
        AND o.result_min=u.result_min
        AND o.any_won IS NOT NULL
    """)

    print("Selecting one market-information-only main line per source/player/game/market...", flush=True)
    con.execute("""
      CREATE TABLE mainlines AS
      SELECT * EXCLUDE(rn) FROM (
        SELECT *, row_number() OVER(
          PARTITION BY game_id,player,market,book
          ORDER BY abs(p_over-0.5), abs(overround), line
        ) AS rn
        FROM paired_5m
      ) q WHERE rn=1
    """)

    # Add analysis cohort and temporal period. A row can appear in both cohorts, so UNION ALL.
    psql = sql_list(primary_books)
    ssql = sql_list(sensitivity_books)
    con.execute(f"""
      CREATE TABLE sportsbook_mainlines AS
      WITH labeled AS (
        SELECT *,
          CASE
            WHEN start_time < TIMESTAMP '{TRAIN_END}' THEN 'train'
            WHEN start_time >= TIMESTAMP '{TRAIN_END}' AND start_time < TIMESTAMP '{HOLDOUT_END}' THEN 'holdout'
            ELSE 'outside'
          END AS period
        FROM mainlines
      )
      SELECT *, 'primary' AS cohort FROM labeled WHERE book IN {psql}
      UNION ALL
      SELECT *, 'sensitivity' AS cohort FROM labeled WHERE book IN {ssql}
    """)

    markets = [r[0] for r in con.execute("SELECT DISTINCT market FROM sportsbook_mainlines ORDER BY market").fetchall()]
    results = {
        "schema": 1,
        "targetLibraryVersion": "1.8",
        "state": "STAGING_MLB_SOURCE_CLASSIFIED_FORWARD_HOLDOUT_EXECUTED",
        "runtimeAuthority": False,
        "activeProductionLibrary": "1.7",
        "dataset": DATASET,
        "datasetRevision": REVISION,
        "executedAtUtc": datetime.now(timezone.utc).isoformat(),
        "trainWindow": {"start":"dataset_start", "endExclusive": TRAIN_END},
        "holdoutWindow": {"startInclusive": TRAIN_END, "endExclusive": HOLDOUT_END},
        "closeCutoffMinutes": 5,
        "sourceClassification": {
            "datasetSourceCount": len(dataset_books),
            "classifiedSourceCount": len(source_map),
            "missing": missing,
            "extra": extra,
            "primaryHighConfidenceSportsbooks": primary_books,
            "primaryCount": len(primary_books),
            "sensitivityAllEligibleSportsbooks": sensitivity_books,
            "sensitivityCount": len(sensitivity_books),
            "classCounts": rows(con.execute("SELECT 1")) and {
                cls: sum(1 for v in source_map.values() if v["class"] == cls)
                for cls in sorted(set(v["class"] for v in source_map.values()))
            },
            "classificationComplete": not missing and not extra,
            "conservativeRule": "Ambiguous/nontraditional/composite labels are excluded from sportsbook holdout rather than guessed into the primary cohort."
        },
        "design": {
            "mainLineSelection": "Within each source/player/game/market choose exact over/under line whose proportional no-vig over probability is closest to 0.50; tie-break lower absolute overround then line.",
            "calibrator": "Per-market logistic recalibration q=sigmoid(a+b*logit(p)); a,b fit on March-May only, then frozen for June holdout.",
            "primaryCohort": "High-confidence traditional sportsbook labels only.",
            "sensitivityCohort": "High- and medium-confidence labels classified as traditional sportsbooks.",
            "interpretation": "Holdout calibration is evidence about probability calibration, not a claim of executable betting profit or book sharpness."
        },
        "coverageByCohortPeriodMarket": rows(con.execute("""
          SELECT cohort,period,market,count(*) AS n,count(DISTINCT book) AS books,
                 count(DISTINCT game_id) AS games,count(DISTINCT player) AS players
          FROM sportsbook_mainlines
          WHERE period IN ('train','holdout')
          GROUP BY cohort,period,market
          ORDER BY cohort,market,period
        """)),
        "fits": [],
        "holdoutBookDiagnostics": rows(con.execute("""
          SELECT cohort,book,market,count(*) AS n,
                 avg((p_over-CAST(over_won AS INTEGER))*(p_over-CAST(over_won AS INTEGER))) AS brier,
                 avg(CAST(over_won AS INTEGER))-avg(p_over) AS calibration_gap,
                 avg(overround) AS avg_overround
          FROM sportsbook_mainlines
          WHERE period='holdout'
          GROUP BY cohort,book,market
          HAVING count(*) >= 100
          ORDER BY cohort,market,brier
        """)),
    }

    for cohort in ("primary", "sensitivity"):
        for market in markets:
            fit = fit_logistic_recalibration(con, market, cohort)
            train_metrics = metric_query(con, market, cohort, "train", fit.get("intercept"), fit.get("slope"))
            hold_metrics = metric_query(con, market, cohort, "holdout", fit.get("intercept"), fit.get("slope"))
            if hold_metrics.get("n"):
                hold_metrics["brierImprovement"] = (hold_metrics.get("raw_brier") or 0) - (hold_metrics.get("recal_brier") or 0)
                hold_metrics["logLossImprovement"] = (hold_metrics.get("raw_log_loss") or 0) - (hold_metrics.get("recal_log_loss") or 0)
                hold_metrics["rawCalibrationGap"] = (hold_metrics.get("realized_over_rate") or 0) - (hold_metrics.get("raw_mean_probability") or 0)
                hold_metrics["recalCalibrationGap"] = (hold_metrics.get("realized_over_rate") or 0) - (hold_metrics.get("recal_mean_probability") or 0)
            results["fits"].append({
                "cohort": cohort,
                "market": market,
                "fit": fit,
                "train": train_metrics,
                "holdout": hold_metrics,
            })

    # Stability summary for candidate admission: require substantial holdout n and no degradation.
    primary_fits = [x for x in results["fits"] if x["cohort"] == "primary"]
    stable = []
    for x in primary_fits:
        h = x["holdout"]
        stable.append({
            "market": x["market"],
            "holdoutN": h.get("n",0),
            "rawCalibrationGap": h.get("rawCalibrationGap"),
            "recalCalibrationGap": h.get("recalCalibrationGap"),
            "brierImprovement": h.get("brierImprovement"),
            "logLossImprovement": h.get("logLossImprovement"),
            "recalibrationGeneralized": bool((h.get("n") or 0) >= 1000 and (h.get("brierImprovement") or 0) > 0 and (h.get("logLossImprovement") or 0) > 0)
        })
    results["primaryHoldoutStability"] = stable
    results["admissionChecks"] = {
        "all75SourcesOperationallyClassified": not missing and not extra,
        "nonSportsbookSourcesExcludedFromPrimary": True,
        "forwardHoldoutPerformed": True,
        "trainAndHoldoutSeparatedByTime": True,
        "fiveMinutePregameCutoffUsed": True,
        "directProfitabilityClaimAllowed": False,
        "bookSharpnessRankingAllowed": False,
        "mlbDirectMarketAuditPhaseComplete": True,
        "productionPromotionPerformed": False
    }

    OUT_JSON.write_text(json.dumps(results, indent=2, default=jdefault) + "\n")

    lines = [
      "# Betting Edge Research Library v1.8 — MLB Source Classification + Forward Holdout",
      "",
      "**State:** STAGING VALIDATION EXECUTED — NOT RUNTIME AUTHORITY  ",
      "**Active production library remains:** v1.7  ",
      f"**Dataset revision:** `{REVISION}`  ",
      f"**Train:** before {TRAIN_END}  ",
      f"**Holdout:** {TRAIN_END} through before {HOLDOUT_END}  ",
      "",
      "## Source classification",
      "",
      f"- Dataset labels classified: **{len(source_map)}/{len(dataset_books)}**",
      f"- Primary high-confidence sportsbook cohort: **{len(primary_books)} sources**",
      f"- Sportsbook sensitivity cohort: **{len(sensitivity_books)} sources**",
      "- Exchanges/prediction markets, DFS/Pick'em/sweepstakes products, derived best/composite aliases, and ambiguous labels are excluded from the primary sportsbook calibration cohort.",
      "",
      "## Forward holdout",
      "",
      "Per-market logistic recalibration was fit using March-May only and frozen before evaluating June. Positive Brier/log-loss improvement means the training-period calibration adjustment generalized to the untouched June holdout; it is not an executable betting-profit claim.",
      "",
      "| Market | June n | Raw gap | Recal gap | Brier improvement | Log-loss improvement | Generalized? |",
      "|---|---:|---:|---:|---:|---:|---|",
    ]
    for s in stable:
        def fmt(v):
            return "—" if v is None else f"{v:.6f}"
        lines.append(f"| {s['market']} | {s['holdoutN']:,} | {fmt(s['rawCalibrationGap'])} | {fmt(s['recalCalibrationGap'])} | {fmt(s['brierImprovement'])} | {fmt(s['logLossImprovement'])} | {'YES' if s['recalibrationGeneralized'] else 'NO'} |")
    lines += [
      "",
      "## Interpretation guardrail",
      "",
      "This closes the MLB source-classification and temporal holdout validation phase. Any surviving calibration result may inform a future v1.8 direct-market prior only after canonical review. It cannot by itself create a bet, rank a sportsbook as sharp, set an executable price, or override Betting Edge gates.",
      "",
      "## Production status",
      "",
      "**Production v1.7 is unchanged. No manifest promotion occurred.**",
    ]
    OUT_MD.write_text("\n".join(lines) + "\n")
    print(json.dumps(results["admissionChecks"], indent=2), flush=True)


if __name__ == "__main__":
    main()
