# Guy Laflame daily selection authority

Status: OPERATIONAL. Policy: `guy-researched-daily-call-v1`.
Effective November 1, 2026, 00:00 America/Vancouver.

The existing five Main report tasks own Guy's researched daily NHL moneyline choice. This is Guy's independent editorial play, with a prospective flat-one-unit record. It does not change VigScope grades, Core betting authority, bankroll or a customer wager. There is no new scheduled task, prediction-weight formula or odds pull. The current report queue and its publication remain separate; a Guy-specific shortfall must not block independently completed VigScope cards.

## Research and choice

After normal feed/source intake, run `node tools/guy-daily-selection.mjs --shortlist`. It returns the top three eligible MoneyPuck-ranked games, or fewer when fewer have matching fresh forecasts and executable prices. Preserve its source-board blob SHA/as-of and exact event, teams, start and model IDs. Use the saved source board; do not obtain another odds snapshot for Guy. Reuse current NHL research already performed for the report.

Review every shortlisted game before choosing one. For both teams, identify named starting goalies and whether the source actually confirms them or only projects them. Record a decision-sensitive recheck for projected goalies, no later than the selected-game lock. Check material lineup changes, rest/travel and recent five-on-five play using actual source findings. Each topic needs its observed time and HTTPS source references; venue/injury boilerplate, an unvisited link or a source name is not a completed review. Explain why remaining uncertainty is acceptable to this hockey opinion. MoneyPuck's expected starter is not proof it repriced its forecast for that goalie.

For each game record a preferred side, strongest supporting reason and strongest contrary factor. Guy may choose either side and need not choose the highest model gap. An opposing MoneyPuck side or a negative model gap requires an explicit independent hockey rationale. Do not invent a Guy win probability, average model weights or claim the model's gap belongs to Guy's own calibrated fair.

Choose one full-game, overtime/shootout-inclusive moneyline. Record the current book/price and a worst acceptable price. Use a deliberate Pinnacle assessment (`AGREES`, `DISAGREES` or `UNAVAILABLE`) and a concrete explanation. An unfavorable Pinnacle comparison requires actual hockey grounds for the disagreement; a missing benchmark remains disclosed. Neither Pinnacle nor the last VigScope grade automatically selects or vetoes Guy's play. Do not count market-blended forecasts as independent market confirmation.

## Staging contract

Write only `data/characters/guy-laflame/call-staging.json` as a complete source-bound research submission. The publisher owns `calls-ledger.json`, generated hotline and archives.

- Top level: `schema:1`, `state:"READY"`, `policyId:"guy-researched-daily-call-v1"`, unique `researchId`, Vancouver `date`, actual `researchedAt`, `boardAsOf`, `sourceBoardBlobSha`, `candidates`, `chosen`.
- Each candidate: exact `eventId`, `home`, `away`, `startTime`, `preferredSide`, original `modelRecordIds`, `supportReason`, `contraryReason`, and `assessment`.
- `assessment.goalies`: exactly one entry per team, with `team`, `name`, `status` (`CONFIRMED` or `PROJECTED`), actual `observedAt` and `sourceRefs:[{url,observedAt}]`. A projected goalie also needs `recheckAt`.
- `assessment.lineup`, `assessment.restTravel`, `assessment.fiveOnFive`: each `{summary,observedAt,sourceRefs:[{url,observedAt}]}`. Retain actual player/team findings and contrary information.
- `chosen`: exact `eventId`, `side`, `minDecimalPrice`, `reason`, and `pinnacleAssessment:{status,reason}`. Include `modelDisagreementReason` when opposing the shortlisted MoneyPuck side or taking a negative model gap. Decimal price is internal transport only; the interface and price limit use American odds. Convert the intended American limit accurately and verify the publisher's conservative limit.
- A pre-lock change needs a new `researchId`, later `researchedAt` and nonempty top-level `revisionReason`. Preserve prior submissions and public calls in the ledger; never reuse an ID with changed bytes.

The original research board is loaded and hash-verified from Git. A new price pulse need not erase unchanged research; current price/model/goalie applicability is checked independently. Missing snapshots, changed model values or changed goalie identities require named review. The publication quote must be current, exact, from an executable captured book and no worse than the stated limit. Use the current policy's 75-minute quote/forecast and six-hour research bounds; preserve original source clocks.

Commit staging, inspect the exact **Guy daily researched selection** workflow for that commit, and read back the matching research/publication ID in `calls-ledger.json` and the hotline. A failed candidate is unfinished Guy work, not a published call. Correct real shortfalls in a new submission; never invent facts or rewrite prior records to pass validation. No retrospective November or October picks.

Manual publication recovery uses that same workflow with `staging_commit` set to the exact original main commit SHA. A blank dispatch refreshes saved status only. The publisher checks the selected-game cutoff again after rendering and immediately before pushing, then verifies the remote ledger and immutable edition. A queued submission never consumes another run's newer staging.

## Publication, locks and results

One daily play may be revised before one minute prior to its selected game's own start. Once that cutoff passes, team, book, published odds and publication identity freeze. A later game cannot replace it. Every public revision remains auditable. Current quoted prices and expiry/goalie-review notices are displayed separately from the recorded publication price. An expired price must never be presented as currently available, and a later concern does not erase a published call or avoid a loss.

The existing game-intelligence collection refreshes saved context and settlement without new odds calls. Its structured ESPN goalie evidence distinguishes explicit confirmed status from projected starters. The selector must not infer a new hockey judgment solely from a source change: it flags recheck and retains the published record. The next applicable Main task completes the actual decision-sensitive follow-up using current sources.

Grade the final locked published call once at flat 1u risk using verified exact-event final scores including OT/shootouts. Pending, ambiguous and special settlements are excluded from ROI until resolved. Never manufacture a closing line or treat the last captured quote as an official close. Keep `value-ledger.json` and its intentional highest-captured-MoneyPuck-edge history intact; it remains the separate historical benchmark.

The relaunch is implemented only when policy/engine tests, producer handoff, goalie intake, hotspot/F8 rendering and prospective ledger publication pass. First live selection acceptance requires a genuine researched November 1 submission; an empty seed ledger or green build is not that selection.
