-- Betting Edge Research Library v1.8
-- SmartStake MLB Player Props 2026 reproducibility audit
-- STAGING ONLY — NOT RUNTIME AUTHORITY
--
-- Intended engine: DuckDB with httpfs / hf:// support.
-- This script audits the public SmartStake dataset before any direct-market
-- conclusion can become canonical Research Library evidence.
--
-- IMPORTANT: Do not use the outputs as a betting signal. This is research QA.

INSTALL httpfs;
LOAD httpfs;

CREATE OR REPLACE TEMP VIEW src AS
SELECT *
FROM read_parquet(
  'hf://datasets/SmartStake/mlb-player-props/mon=*/*.parquet',
  hive_partitioning = true
);

-- ---------------------------------------------------------------------------
-- A. Coverage / schema sanity
-- ---------------------------------------------------------------------------
SELECT
  count(*) AS rows,
  count(DISTINCT game_id) AS games,
  count(DISTINCT player) AS players,
  count(DISTINCT market) AS markets,
  count(DISTINCT book) AS books,
  min(ts) AS first_quote_utc,
  max(ts) AS last_quote_utc,
  min(start_time) AS first_start_utc,
  max(start_time) AS last_start_utc
FROM src;

SELECT market, count(*) AS rows, count(DISTINCT game_id) AS games
FROM src
GROUP BY market
ORDER BY rows DESC;

SELECT book, count(*) AS rows, count(DISTINCT game_id) AS games
FROM src
GROUP BY book
ORDER BY rows DESC;

-- ---------------------------------------------------------------------------
-- B. Identity uniqueness at the documented minute key
-- The publisher says duplicates on this identity were collapsed.
-- Expected duplicate_rows = 0.
-- ---------------------------------------------------------------------------
WITH grouped AS (
  SELECT
    game_id, player, market, line, side, book, ts,
    count(*) AS n
  FROM src
  GROUP BY ALL
)
SELECT
  sum(n - 1) AS duplicate_rows,
  count(*) FILTER (WHERE n > 1) AS duplicated_keys,
  max(n) AS max_rows_per_key
FROM grouped;

-- ---------------------------------------------------------------------------
-- C. Repeated unchanged quotes across different minutes
-- Public viewer visibly shows these. This quantifies them.
-- They are not independent price changes and must not be frequency-weighted.
-- ---------------------------------------------------------------------------
WITH q AS (
  SELECT
    game_id, player, market, line, side, book, ts, odds,
    lag(odds) OVER (
      PARTITION BY game_id, player, market, line, side, book
      ORDER BY ts
    ) AS prev_odds
  FROM src
), scored AS (
  SELECT *,
         CASE WHEN prev_odds IS NOT NULL AND odds = prev_odds THEN 1 ELSE 0 END AS unchanged
  FROM q
)
SELECT
  count(*) AS quote_rows,
  sum(unchanged) AS repeated_unchanged_rows,
  round(100.0 * sum(unchanged) / nullif(count(*) - count(*) FILTER (WHERE prev_odds IS NULL), 0), 3)
    AS pct_noninitial_rows_unchanged
FROM scored;

-- ---------------------------------------------------------------------------
-- D. Grade/result consistency
-- Expected mismatch counts = 0. Pushes should have won IS NULL.
-- ---------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE result IS NULL AND won IS NOT NULL) AS won_without_result,
  count(*) FILTER (WHERE result IS NOT NULL AND result = line AND won IS NOT NULL) AS graded_pushes,
  count(*) FILTER (
    WHERE result IS NOT NULL AND won IS NOT NULL AND side = 'over'
      AND won <> (result > line)
  ) AS over_grade_mismatches,
  count(*) FILTER (
    WHERE result IS NOT NULL AND won IS NOT NULL AND side = 'under'
      AND won <> (result < line)
  ) AS under_grade_mismatches,
  count(*) FILTER (WHERE side NOT IN ('over','under')) AS unexpected_side_rows,
  count(*) FILTER (WHERE odds <= 1 OR odds IS NULL) AS invalid_decimal_odds_rows
FROM src;

-- ---------------------------------------------------------------------------
-- E. Timing contamination
-- Any quote at/after scheduled first pitch cannot be used as pregame closing.
-- Also report safety-buffer eligibility.
-- ---------------------------------------------------------------------------
SELECT
  count(*) FILTER (WHERE ts >= start_time) AS at_or_after_start_rows,
  count(*) FILTER (WHERE ts < start_time) AS pregame_rows,
  count(*) FILTER (WHERE ts <= start_time - INTERVAL 5 MINUTE) AS pregame_5m_safe_rows,
  count(*) FILTER (WHERE ts <= start_time - INTERVAL 15 MINUTE) AS pregame_15m_safe_rows,
  count(*) FILTER (WHERE ts <= start_time - INTERVAL 60 MINUTE) AS pregame_60m_safe_rows
FROM src;

-- ---------------------------------------------------------------------------
-- F. Closing quote construction, 5-minute safety buffer
-- One quote per exact selection; repeated unchanged minutes do not matter.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TEMP VIEW closing_5m AS
SELECT
  game_id,
  start_time,
  player,
  market,
  line,
  side,
  book,
  arg_max(odds, ts) AS odds,
  max(ts) AS close_ts,
  any_value(result) AS result,
  any_value(won) AS won
FROM src
WHERE result IS NOT NULL
  AND ts <= start_time - INTERVAL 5 MINUTE
GROUP BY game_id, start_time, player, market, line, side, book;

-- Verify outcome consistency within each exact selection before trusting any_value().
WITH c AS (
  SELECT
    game_id, player, market, line, side, book,
    count(DISTINCT result) AS result_values,
    count(DISTINCT won) FILTER (WHERE won IS NOT NULL) AS won_values
  FROM src
  WHERE result IS NOT NULL
  GROUP BY ALL
)
SELECT
  count(*) FILTER (WHERE result_values > 1) AS selections_with_multiple_results,
  count(*) FILTER (WHERE won_values > 1) AS selections_with_multiple_nonnull_grades
FROM c;

-- ---------------------------------------------------------------------------
-- G. Exact-line two-way pairing
-- One probability is evaluated per over/under market pair.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TEMP VIEW paired_5m AS
SELECT
  o.game_id,
  o.start_time,
  o.player,
  o.market,
  o.line,
  o.book,
  o.odds AS over_odds,
  u.odds AS under_odds,
  greatest(o.close_ts, u.close_ts) AS pair_close_ts,
  o.result,
  o.won AS over_won,
  (1.0 / o.odds + 1.0 / u.odds - 1.0) AS overround,
  (1.0 / o.odds) / ((1.0 / o.odds) + (1.0 / u.odds)) AS p_over_prop
FROM closing_5m o
JOIN closing_5m u
  USING (game_id, start_time, player, market, line, book)
WHERE o.side = 'over'
  AND u.side = 'under'
  AND o.odds > 1
  AND u.odds > 1
  AND o.won IS NOT NULL;

SELECT
  count(*) AS paired_lines,
  count(DISTINCT (game_id, player, market, book)) AS player_market_book_events,
  avg(overround) AS avg_overround,
  quantile_cont(overround, 0.5) AS median_overround,
  min(overround) AS min_overround,
  max(overround) AS max_overround
FROM paired_5m;

-- ---------------------------------------------------------------------------
-- H. Main-line selection to control alternate-line multiplicity
-- Choose, using market information only, the closing exact line whose de-vig
-- over probability is closest to 0.50 for each book/player/game/market.
-- This avoids giving one player-game many independent votes because a book
-- posts many alternate thresholds.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TEMP VIEW mainline_5m AS
SELECT * EXCLUDE (rn)
FROM (
  SELECT *,
    row_number() OVER (
      PARTITION BY game_id, player, market, book
      ORDER BY abs(p_over_prop - 0.5), abs(overround), line
    ) AS rn
  FROM paired_5m
)
WHERE rn = 1;

SELECT market, count(*) AS mainline_events, count(DISTINCT book) AS books
FROM mainline_5m
GROUP BY market
ORDER BY mainline_events DESC;

-- ---------------------------------------------------------------------------
-- I. Descriptive closing calibration — proportional no-vig baseline
-- This is NOT a sharpness ranking until book types and sample comparability
-- are audited. Treat sportsbook/exchange/prediction-market sources separately.
-- ---------------------------------------------------------------------------
SELECT
  book,
  market,
  count(*) AS n,
  avg((p_over_prop - CAST(over_won AS INTEGER)) *
      (p_over_prop - CAST(over_won AS INTEGER))) AS brier,
  avg(
    -CAST(over_won AS INTEGER) * ln(greatest(p_over_prop, 1e-9))
    -(1-CAST(over_won AS INTEGER)) * ln(greatest(1-p_over_prop, 1e-9))
  ) AS log_loss,
  avg(overround) AS avg_overround
FROM mainline_5m
GROUP BY book, market
HAVING count(*) >= 200
ORDER BY market, brier;

-- ---------------------------------------------------------------------------
-- J. Reliability / calibration bins
-- Do not interpret bins with small n.
-- ---------------------------------------------------------------------------
WITH b AS (
  SELECT *,
    width_bucket(p_over_prop, 0.0, 1.0, 10) AS bin
  FROM mainline_5m
)
SELECT
  market,
  bin,
  count(*) AS n,
  avg(p_over_prop) AS mean_predicted,
  avg(CAST(over_won AS INTEGER)) AS realized_rate,
  avg(CAST(over_won AS INTEGER)) - avg(p_over_prop) AS calibration_gap
FROM b
GROUP BY market, bin
ORDER BY market, bin;

-- ---------------------------------------------------------------------------
-- K. Closing-time sensitivity
-- Repeat main-line calibration at 0/5/15/60 minutes before start.
-- A claimed result that disappears under a modest closing-buffer change should
-- not become a strong canonical prior.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TEMP TABLE audit_cutoffs(cutoff_min INTEGER);
INSERT INTO audit_cutoffs VALUES (0), (5), (15), (60);

WITH cutoff_close AS (
  SELECT
    c.cutoff_min,
    s.game_id, s.start_time, s.player, s.market, s.line, s.side, s.book,
    arg_max(s.odds, s.ts) AS odds,
    max(s.ts) AS close_ts,
    any_value(s.result) AS result,
    any_value(s.won) AS won
  FROM src s
  CROSS JOIN audit_cutoffs c
  WHERE s.result IS NOT NULL
    AND s.ts <= s.start_time - c.cutoff_min * INTERVAL 1 MINUTE
  GROUP BY c.cutoff_min, s.game_id, s.start_time, s.player, s.market, s.line, s.side, s.book
), pairs AS (
  SELECT
    o.cutoff_min, o.game_id, o.player, o.market, o.line, o.book,
    o.won AS over_won,
    (1.0/o.odds)/((1.0/o.odds)+(1.0/u.odds)) AS p_over,
    (1.0/o.odds + 1.0/u.odds - 1.0) AS overround
  FROM cutoff_close o
  JOIN cutoff_close u
    USING (cutoff_min, game_id, start_time, player, market, line, book)
  WHERE o.side='over' AND u.side='under'
    AND o.odds > 1 AND u.odds > 1 AND o.won IS NOT NULL
), ranked AS (
  SELECT *,
    row_number() OVER (
      PARTITION BY cutoff_min, game_id, player, market, book
      ORDER BY abs(p_over - 0.5), abs(overround), line
    ) AS rn
  FROM pairs
)
SELECT
  cutoff_min,
  market,
  count(*) AS n,
  avg((p_over - CAST(over_won AS INTEGER)) *
      (p_over - CAST(over_won AS INTEGER))) AS brier
FROM ranked
WHERE rn=1
GROUP BY cutoff_min, market
ORDER BY market, cutoff_min;

-- ---------------------------------------------------------------------------
-- L. Book classification output
-- `book` mixes sportsbooks, exchanges and prediction markets. Export/review
-- distinct names before any cross-book comparison. No source type should be
-- inferred solely from odds behavior.
-- ---------------------------------------------------------------------------
SELECT DISTINCT book
FROM src
ORDER BY book;

-- ---------------------------------------------------------------------------
-- M. Minimum canonical-admission checks
-- A direct-market finding must not be promoted unless:
--   * B/D/E/F/G consistency tests pass or anomalies are explicitly explained;
--   * book/source types are classified;
--   * main-line and all-line analyses are distinguished;
--   * closing-buffer sensitivity is reported;
--   * March-June evaluation is not reused to fit and evaluate a learned
--     recalibration without a forward holdout;
--   * repeated unchanged quote minutes are never treated as independent events;
--   * uncertainty accounts for the same player-game result appearing at many
--     books/lines.
-- ---------------------------------------------------------------------------
