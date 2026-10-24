# October 24 morning production incident

Authoritative incident review of the preserved October 24 checkpoints and issued History. This document is research/operating context, not an issued report or a betting recommendation.

| Lane | Preserved result | Failure |
| --- | --- | --- |
| 06:00 | Published 0 assessed / 718 available | All 718 receipts used the same general unfinished-assessment explanation. Saving event checkpoints did not finish the decisions. |
| 08:00 | Unissued DRAFT, revision 113; 498 draft assessments, including 9 zero-stake LEANs; 220 blocked | Every one of the 498 cards lacked the exact structured card-evidence handoff. Replaying the saved bytes also failed personnel, evidence and lineage validation. The task's “all gates passed” / “remaining work is mechanical” wording was unsupported by this saved checkpoint. |
| 09:30 | Published 94 PASS / 555 available; 461 unfinished | 288 unfinished selections carried missing targeted QB follow-up; 155 had no qualified exact reference or had an event-time/started-event mismatch; 18 had other incomplete candidate/forecast reviews. |

The 06:00 and 09:30 publication/readback receipts are real; those successes do not certify completion of their unfinished analysis. The 08:00 report remains unissued. None of its nine draft LEANs is a published selection or a validated replacement report.

## Confirmed implementation defects and repair

1. The shared event planner read earlier issued History but omitted earlier committed, unpublished checkpoints. Consequently, a failed publication could hide its source observations from the next lane. `tools/checkpoint-research-leads.mjs` now exposes exact same-event/start-time source observations with the original checkpoint path/blob, clocks and an explicit unissued designation. It deliberately excludes grades, stake, fair and clearance. Published-decision lineage continues to use issued History only.
2. The compact event plan omitted candidate `missingResearch` fields. It now retains the actual missing-field codes, so the producer can fix the precise failure instead of repeating a generic blocker.
3. Saving an event returned counts without immediately exposing absent card evidence. Event checkpoints now return `eventAssessment` using the existing card and quarterback inspectors. This adds feedback, not a validation gate or a new clearance rule.
4. Controller responses now distinguish analysis state, final validation and durable publication. A DRAFT's EVALUATED count cannot advertise final validation, and a published partial analysis remains partial.

Implementation commits: `19c0312de38995cf15ded7c3f3697763cd640886` and `053d4a1abea709c3a4564511ba9dbaf81bae5eb6`. The first commit passed the full report-producer transfer/replay workflow, publication-reliability workflow, primary-market coverage and Game Day regressions. The second adds immediate event feedback and has passed its local inspector/controller regression tests; inspect its matching Actions run for final CI results.

No thresholds, source approval rules, stake rules, timing, activation or issued historical payloads were changed. All five permanent Main tasks already resolve the shared authority from main, so they inherit the repaired producer instructions without copying a new prompt or adding schedules.

## Resume useful work

Use the latest exact committed checkpoint and actual issue time. Retain accepted snapshot provenance; do not backdate, request duplicate odds, copy old grades, or treat a missing model interval as a universal forecast veto. Complete current research and the explicit selection handoff, prepare an early finished event, inspect deferrals, and continue recoverable work. Keep genuine exact-reference and source gaps separate from missing authoring fields.

The 09:30 checkpoint preserved three forecast-supported draft opinions that failed candidate completion: Milwaukee ML, Tampa Bay ML and Los Angeles ML. They are review leads only. Re-evaluate current model applicability, price, exact-source dispositions, named personnel and the two-source NHL policy. Recreate `candidateAssessment` from the actual judgment and bind all card/sidecar/receipt copies. Do not merely restore their old labels.

Additional current-source leads checked during this incident review:

- [NHL Kings–Devils projected lineups](https://www.nhl.com/news/los-angeles-kings-new-jersey-devils-game-preview-october-24-2026): Kuemper and Allen projected; Hellebuyck scratched. Byfield questionable. Preserve the distinction between a projection and confirmed participation.
- [Kings official preview](https://www.nhl.com/kings/news/tune-in-kings-versus-devils-october-24): Byfield is a game-time decision; no morning skate. The actual unresolved player must replace the draft's generic lineup sentence.
- [Utah official preview](https://www.nhl.com/utah/news/utah-returns-home-hosts-tampa-bay-game-preview-10-24-26): Tampa plays consecutive nights; Hildeby is expected. Utah's tandem is Vejmelka/Cossa. Check the named goalie assumptions before reusing a model point.
- [Official MLB World Series coverage](https://www.mlb.com/news/rays-brewers-world-series-game-1-starting-lineups-and-pitching-matchup) contains Game 1 material. Do not carry a Game 1 pitcher assumption into today's different game. Recheck the exact current Gameday/game-number and pitching matchup.

These observations do not clear a selection or replace its required current source records. Preserve each provider's actual check time when incorporating it; a MoneyPuck CSV cannot be relabelled an ESPN or official personnel page. The generic source-template substitutions seen in the morning draft are an analyst execution failure, not missing evidence permission.
