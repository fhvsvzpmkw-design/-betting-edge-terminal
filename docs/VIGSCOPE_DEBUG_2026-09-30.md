# VigScope / Betting Edge debug — September 30, 2026

Core 1.5 remains operational. This repair addresses producer validation loops, personnel reuse, the Week 4 baseline and confirmed starter valuation. Issued reports and carried rating history are preserved.

## Findings and changes

| Finding | Repair |
|---|---|
| September 30 08:00 lane issued 54 blocked selections after ten preparation cycles; 34 draft assessments were stopped by a blanket recent-official-source condition | Exact-event personnel observations survive newer odds snapshots and prior-lane empty receipts. Producers review applicability and dependency-specific shortfalls; BET checks remain blocking. |
| September 30 final-morning lane completed 32 PASS decisions, with 22 genuine research blockers after thirteen preparation cycles | Read-only diagnostics collect all fourteen candidate-gate failures in one pass. Preparation records the same diagnostics; freeze and publication retain their gates. |
| Official MLB starter/lineup facts required repeated manual research | One official schedule request per date, cached across lanes; probable pitchers and incomplete lineups keep explicit limitations. Live acquisition verified three exact pregame events. |
| Wednesday sweep was verified before its recorded completion and submission | Receipt reverified at actual time; original completion retained in runtime receipt history. Future and reversed clocks now fail before a receipt can be written. |
| The research completion publisher failed when other successful workflows advanced main; the baseline job was displaced by other queued numeric writers | Receipt publication now checks the original staging intent and revalidates against the latest main before retrying a non-forced push. Baseline recovery has its own queue and retains the same source/board checks. |
| Full Wednesday 32-team/16-game catch-up left every Week 4 number marked baseline pending | Source-bound baseline adapter clears the initial-current-baseline gate from the verified catch-up, preserves the missed Tuesday attempt and retains partial historical weekly inputs. No numeric move comes from this status recovery. |
| Confirmed Tampa Bay starter Jalon Daniels was rejected solely for no qualifying NFL sample, preserving the previous QB term | Explicit frozen-prior estimate, official confirmation, exact identity and LOW confidence. Registry, embedded baseline, personnel and HFA remain fixed. Home fair +3.407 becomes +5.257; displayed GB -3.5 becomes GB -5.5. |

## Weeks 1–3 closeout

| Week | Final games verified | Existing game updates arithmetically audited | Missing paired historical inputs |
|---|---:|---:|---:|
| 1 | 16 | 6 | 10 |
| 2 | 16 | 16 | 0 |
| 3 | 16 | 0 | 16 |

All 48 exact final scores match the archived ordered teams and kickoffs. All 22 existing paired update calculations match those final margins, opposite-team old ratings, paired injury totals, location signs and 90/10 arithmetic. Six Week 1 updates use legacy history without modern kickoff/game-day blob bindings; this is disclosed rather than retroactively certifying evidence. Twenty-six games remain missing complete paired historical injury/replacement inputs. A completed final score is not a completed rating update, and an unknown injury loss is not zero.

The closeout audit records each missing game and its recovery action. Late Week 1 recovery requires chronological reconciliation because Week 2 has already been applied; it must not overwrite intervening ratings. Week 3 recovery remains owned by the existing paired-evidence evaluator and weekly calculator. No score-only rating model or after-the-fact betting return was introduced.

## Week 4 current numbers

Negative home fair means home favorite; positive means home underdog. Every row retains the missing Week 3 weekly-learning limitation. Unresolved starters remain preserved, not adopted as current cleared values.

| Away @ Home | Exact home fair | Displayed home fair | Additional limitation |
|---|---:|---:|---|
| PIT @ CLE | -0.287 | -0.5 | Current overlays reviewed |
| IND @ WAS | +0.574 | +0.5 | Starter unresolved; prior fair preserved; Personnel/cluster inputs unresolved |
| TEN @ BAL | -12.572 | -12.5 | Personnel/cluster inputs unresolved |
| NE @ BUF | -2.400 | -2.5 | Current overlays reviewed |
| NYJ @ CHI | -8.955 | -9.0 | Starter unresolved; prior fair preserved |
| JAX @ CIN | -1.086 | -1.0 | Current overlays reviewed |
| DAL @ HOU | +0.251 | +0.5 | Personnel/cluster inputs unresolved |
| ARI @ NYG | -4.110 | -4.0 | Personnel/cluster inputs unresolved |
| LAR @ PHI | +1.880 | +2.0 | Current overlays reviewed |
| GB @ TB | +5.257 | +5.5 | TB frozen QB prior estimate; no qualifying sample |
| MIA @ MIN | -9.327 | -9.5 | Personnel/cluster inputs unresolved |
| KC @ LV | +1.736 | +1.5 | Current overlays reviewed |
| LAC @ SEA | -12.853 | -13.0 | Current overlays reviewed |
| DEN @ SF | -3.297 | -3.5 | Current overlays reviewed |
| DET @ CAR | -0.070 | +0.0 | Personnel/cluster inputs unresolved |
| ATL @ NO | -7.071 | -7.0 | Current overlays reviewed |

Conditional QB packet: Washington is +0.484 with a cleared/named Jayden Daniels or +0.574 with Marcus Mariota. Chicago is -8.535 with a cleared/named Caleb Williams or -6.035 with Case Keenum/Tyson Bagent using their equal frozen 6.0 priors. These scenarios have no board-write or betting authority and do not estimate playing impairment.

## Validation

The September 30 final-morning checkpoint passes all fourteen candidate gates unchanged. Regression suites pass for report controller/pipeline, Core evidence handoff, game intelligence, fair decomposition and QB production; targeted tests cover full baseline coverage, source binding, receipt chronology, exact-event personnel reuse, official MLB ambiguity/unknown lineups, frozen QB priors and 48-game closeout arithmetic. Both issued morning reports are replayed through the fifteen-check readback pipeline without rewriting bytes.

The Graham board and public game dossier show partial weekly inputs and QB prior estimates. All five Main tasks use operating revision 2026-09-30.1 with the existing times and scopes. Future scheduled Graham reviews use the confirmed-prior policy and verified baseline recovery; historical gaps remain specific work items, not fictional completions.

## Source and reproduction

- Official TB confirmation: https://www.buccaneers.com/news/baker-mayfield-three-weeks-minimum-thumb-injury-update
- Frozen QB source: `data/walters/nfl/qb-performance/candidates/qb-candidates-2026-stage3c-v1.json`
- Verified catch-up: `data/walters/nfl/2026/week-04-research-ledger.json` and its exact daily-review runtime receipt
- Final facts/audit: `data/walters/nfl/2026/weeks-01-03-final-facts-20260930.json`, `weeks-01-03-closeout-audit-20260930.json`
- Conditional QBs: `data/walters/nfl/2026/week-04-qb-scenarios-20260930.json`
- Commands and boundaries: `docs/REPORT_RUN_CONTROLLER.md`, `docs/GRAHAM_QB_PRIOR_ESTIMATES.md`, `tools/graham-baseline-recovery.mjs`
