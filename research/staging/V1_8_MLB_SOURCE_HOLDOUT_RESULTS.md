# Betting Edge Research Library v1.8 — MLB Source Classification + Forward Holdout

**State:** STAGING VALIDATION EXECUTED — NOT RUNTIME AUTHORITY  
**Active production library remains:** v1.7  
**Dataset revision:** `049dd4caeb562010a5806207c413e9f9bc012825`  
**Train:** before 2026-06-01T00:00:00  
**Holdout:** 2026-06-01T00:00:00 through before 2026-07-01T00:00:00  

## Source classification

- Dataset labels classified: **75/75**
- Primary high-confidence sportsbook cohort: **43 sources**
- Sportsbook sensitivity cohort: **47 sources**
- Exchanges/prediction markets, DFS/Pick'em/sweepstakes products, derived best/composite aliases, and ambiguous labels are excluded from the primary sportsbook calibration cohort.

## Forward holdout

Per-market logistic recalibration was fit using March-May only and frozen before evaluating June. Positive Brier/log-loss improvement means the training-period calibration adjustment generalized to the untouched June holdout; it is not an executable betting-profit claim.

| Market | June n | Raw gap | Recal gap | Brier improvement | Log-loss improvement | Generalized? |
|---|---:|---:|---:|---:|---:|---|
| player bases | 82,917 | -0.011387 | 0.015811 | -0.000071 | -0.000186 | NO |
| player batting walks | 29,961 | -0.027943 | -0.008253 | 0.000878 | 0.002314 | YES |
| player hits | 72,897 | 0.001737 | 0.017176 | -0.000278 | -0.000573 | NO |
| player home runs | 37,950 | -0.005437 | 0.027601 | -0.000790 | -0.003509 | NO |
| player rbis | 59,054 | -0.019250 | 0.011145 | 0.000221 | 0.000504 | YES |
| player strikeouts | 9,267 | 0.001026 | 0.012209 | -0.000004 | -0.000037 | NO |

## Interpretation guardrail

This closes the MLB source-classification and temporal holdout validation phase. Any surviving calibration result may inform a future v1.8 direct-market prior only after canonical review. It cannot by itself create a bet, rank a sportsbook as sharp, set an executable price, or override Betting Edge gates.

## Production status

**Production v1.7 is unchanged. No manifest promotion occurred.**
