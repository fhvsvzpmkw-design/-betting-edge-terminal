# Betting Edge Research Library v1.8 — MLB Phase 2 Closeout

**Date:** 2026-08-15  
**State:** STAGING VALIDATION COMPLETE — NOT RUNTIME AUTHORITY  
**Active production library remains:** Research Library v1.7  

## Decision

The MLB-specific Phase 2 research-validation work is complete enough to move into the broader v1.8 candidate-freeze build.

Completed MLB gates:

- full immutable SmartStake 2026 dataset audit executed;
- 621,391,637 quote rows scanned;
- grading/timing/integrity checks passed;
- repeated minute snapshots identified and prevented from acting as independent evidence;
- exact over/under pairing and market-information-only main-line construction executed;
- all 75 source labels operationally classified;
- exchanges/prediction markets, DFS/Pick'em/sweepstakes products, derived/composite aliases and ambiguous sources excluded from the primary sportsbook cohort;
- 43 high-confidence traditional sportsbook labels used as the primary cohort;
- 47 sportsbook labels used in the broader sensitivity cohort;
- March-May calibration used as training only;
- June held out untouched until final temporal validation;
- 5-minute pre-first-pitch cutoff used;
- direct profitability and book-sharpness claims remain prohibited.

## Forward-holdout result

The primary high-confidence sportsbook cohort produced the following June results after a per-market logistic recalibration was learned only from March-May:

| Market | June n | Raw calibration gap | Recalibrated gap | Brier improvement | Log-loss improvement | Training recalibration generalized? |
|---|---:|---:|---:|---:|---:|---|
| Total bases | 82,917 | -1.14 pp | +1.58 pp | -0.000071 | -0.000186 | No |
| Batting walks | 29,961 | -2.79 pp | -0.83 pp | +0.000878 | +0.002314 | Yes |
| Hits | 72,897 | +0.17 pp | +1.72 pp | -0.000278 | -0.000573 | No |
| Home runs | 37,950 | -0.54 pp | +2.76 pp | -0.000790 | -0.003509 | No |
| RBIs | 59,054 | -1.93 pp | +1.11 pp | +0.000221 | +0.000504 | Yes |
| Pitcher strikeouts | 9,267 | +0.10 pp | +1.22 pp | -0.000004 | -0.000037 | No |

Positive improvement means the training-period correction improved both Brier score and log loss on June. Negative improvement means the correction made the untouched holdout worse.

## Canonical interpretation proposed for v1.8

### 1. No universal MLB player-prop correction

The strongest direct-market conclusion is **not** that a profitable universal bias was found. Four of six market families — total bases, hits, home runs and pitcher strikeouts — rejected the learned March-May recalibration in the June holdout by worsening both Brier score and log loss.

For Betting Edge, this is useful evidence against applying a generic historical over/under correction to MLB player props.

### 2. Strikeouts, hits and home runs should remain price-first

June raw calibration gaps for pitcher strikeouts (+0.10 pp), hits (+0.17 pp) and home runs (-0.54 pp) were small in the audited primary sportsbook main-line surface. The earlier-period recalibration did not generalize.

**History Fit implication:** mechanism evidence can still matter — pitcher/batter matchup, workload, Statcast quality, park/personnel effects — but historical research should not manufacture a broad price adjustment for these markets.

### 3. Walks and RBIs show a limited direct-market calibration signal worth preserving cautiously

Training-period recalibration improved both Brier and log loss on the untouched June sample for batting walks and RBIs. The result is real enough to preserve as a **mixed/direct-market candidate**, but not as an executable betting edge.

Reasons to cap confidence:

- one partial 2026 season;
- multiple books observe correlated versions of the same player-game outcome;
- the dataset's source-game crosswalk is documented but not exposed for independent reconstruction;
- best-price execution was not modeled as a bettor strategy;
- no forward season or independent dataset replication exists yet.

These findings may support a future C-tier or cautious B-/C direct-market History Fit prior, not a deterministic correction.

### 4. Source type is now an explicit research dimension

The 75 source labels split operationally into:

- 47 traditional sportsbook labels;
- 7 exchange/prediction-market labels;
- 10 DFS/Pick'em/sweepstakes labels;
- 9 derived/aggregator labels;
- 2 conservatively excluded ambiguous labels.

Only the sportsbook cohort is allowed to support sportsbook-calibration conclusions. Other source classes remain useful for separate market-structure research but cannot be blended silently into the same probability surface.

## Remaining limitations that travel with the evidence

The MLB audit is complete for this v1.8 build phase, but its limitations remain part of the canonical record:

- coverage is March through June 2026 for settled outcomes in this immutable export;
- July quotes in the export were largely/unsettled at publication and are not used as a second holdout;
- a single full-season or next-season replication is not yet available;
- cross-book observations are correlated because they often settle on the same player-game result;
- exact book execution limits, bettor limits and real best-price availability are outside this calibration study;
- source game-key de-drift cannot be independently reconstructed from the released table alone.

## Phase status

**MLB Phase 2: COMPLETE FOR v1.8 CANDIDATE FREEZE.**

The next project step is no longer another MLB discovery/audit pass. The next step is the cross-sport **v1.8 candidate freeze**: assemble the deduplicated surviving items, corrected source registry and evidence clusters for MLB, NFL, NBA/WNBA, NHL, soccer and general methodology, then generate the frozen candidate library for retrieval/boundary testing.

No production manifest, History Fit runtime, contract, runner or scheduled report was changed by this closeout.
