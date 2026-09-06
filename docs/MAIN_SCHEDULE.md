# Main Betting Edge Schedule

Betting Edge uses one permanent schedule in `America/Vancouver`. It has no seasonal profiles, queued schedule state or Preferences selector.

`data/main-schedule.json` is the machine-readable authority. The canonical slot names remain unchanged so report generation, publication and History continue to use the established lanes.

| Canonical slot | Odds pulse | Report run | Label | Featured VigScope |
|---|---:|---:|---|---|
| `open` | 05:50 | 06:00 | OPEN / OVERNIGHT | No |
| `main` | 07:50 | 08:00 | MAIN | Yes |
| `final_morning` | 09:20 | 09:30 | FINAL MORNING | Yes |
| `evening` | 15:05 | 15:15 | EVENING | Yes |
| `late` | 18:05 | 18:15 | LATE / WEST COAST | No |

The five-pull daily cap is unchanged. Cloudflare remains the single automatic odds scheduler and dispatches the existing protected `odds-refresh.yml` workflow. Manual workflow dispatch remains the recovery path for a missed scheduled pull.

Historical issued reports are immutable. Existing `mlb` / `MLB / SUMMER` provenance remains valid as historical evidence; new compatibility metadata identifies the schedule as `main` / `MAIN BETTING EDGE`.
