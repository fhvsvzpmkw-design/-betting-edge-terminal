# Issued Card Observations

This directory stores retrospective observations for already-issued Betting Edge recommendation cards. It is an **audit layer**, not a second handicap engine.

It supports both legacy Core v1.3 and current Core v1.4 reports. Result/price observations must never rewrite the immutable issued decision.

## Immutable issuance boundary

Observation processing may not alter:

- issued BET / LEAN / WAIT / PASS status;
- issued display price;
- fair value or `playTo`;
- stake/risk;
- exact `rec.feed` identity;
- personnel evidence;
- Core v1.4 `coreAssessment`;
- `waltersEvidence` or Walters runtime provenance;
- Research/Core/Walters schema-3 provenance;
- the original report JSON.

Result Closure writes only matching files under `data/history/observations/...`.

## Price observation

Price observations use only immutable odds snapshots already indexed in `data/history/odds-index.json`; they do not request fresh odds.

Matching rules:

- exact issued `rec.feed.selectionKey`;
- only sportsbooks named on the issued card;
- exact issued snapshot whose `generatedAt` matches the report `feedGeneratedAt` for normalized issued-price analytics;
- only exact quotes no more than 30 minutes old at that snapshot;
- fail closed when the exact snapshot/quote cannot be resolved.

Human-facing `issued.priceAmerican` remains immutable display evidence and must not be parsed as the numeric analytics source.

When safely resolvable, additive normalized issued fields may include:

- `analysisPriceState`
- `analysisPriceReason`
- `analysisPriceAmerican`
- `analysisPriceDecimal`
- `analysisBook`
- `analysisBookKey`
- `analysisQuoteUpdatedAt`
- `analysisSnapshotBlobSha`
- `marketKey`
- `side`
- bettor-facing `selectedLine`

For away spreads, bettor-facing `selectedLine` is the opposite sign of raw Odds-API.io home-side `hdp`.

Do not rewrite already-COMPLETE cards solely to backfill price analytics.

Preferred helper:

`node tools/observe-issued-prices.mjs data/history/runs/YYYY-MM-DD/<run>.json`

## Result verification lifecycle

Lifecycle:

`ISSUED -> UNRESOLVED -> VERIFIED -> COMPLETE`

Only issued BET / LEAN / WAIT / PASS cards are targeted. Do not scan the full sports board.

Use exact `rec.feed.eventId` and `rec.feed.selectionKey` wherever available.

Final results should be verified through authoritative or otherwise reliable exact-event/date sources. Fail closed on ambiguity.

Once COMPLETE, a card is not routinely rechecked. A later correction must be explicit and source-backed.

## Deterministic score-market grading

Standard moneyline, spread and game-total cards may be graded from a verified final score when exact issued identity is sufficient.

### Spread semantics

Odds-API.io spread-row `hdp` is the **HOME-side handicap**, and the raw trailing line in both home/away selection keys identifies that market row.

- home selection → use raw `hdp`;
- away selection → use the opposite sign.

Example: raw `hdp: -11.5` means home -11.5 / away +11.5.

### Asian quarter lines

Supported spread or standard game-total lines ending in `.25` or `.75` split into two equal 0.5-stake components on the adjacent whole/half lines.

Examples:

- `-0.75` = half `-0.5` + half `-1.0`;
- Over `2.25` = half Over `2.0` + half Over `2.5`.

Valid aggregate grades:

- `WIN`
- `LOSS`
- `PUSH`
- `VOID`
- `HALF_WIN`
- `HALF_LOSS`

Quarter-line records retain `settlementComponents` with component line, `stakeFraction: 0.5` and component grade.

### Markets requiring exact selection verification

Player props, regulation-only markets, shortened/suspended games and unsupported special settlement rules remain UNRESOLVED unless the exact issued selection can be safely verified.

Preferred helper:

`node tools/verify-issued-results.mjs <issued-run.json> <verification.json>`

## Official versus hypothetical

- issued `BET` result → **official**;
- issued `LEAN`, `WAIT`, `PASS` result → **hypothetical**.

Hypothetical outcomes never change the official betting ledger or bankroll.

Missing later-price/CLV evidence does not prevent a safely verified result from becoming COMPLETE.

## Unresolved reasons

Use a specific reason whenever known. Standard reasons include:

- `verification_deferred_event_cap`
- `result_not_verified`
- `event_not_final`
- `identity_conflict`
- `source_conflict`
- `settlement_ambiguity`
- `exact_stat_not_verified`
- `market_requires_exact_selection_verification`

## Retry metadata

Preserve/add lightweight retry audit fields:

- `firstUnresolvedAt`
- `lastVerificationAttemptAt`
- `verificationAttempts`
- `nextRetryTier`

For an event actually subjected to targeted verification, update the last-attempt timestamp and increment attempts.

Normal retry guidance:

- around 24h;
- around 72h;
- around 7d;
- then `exception` for genuine long-lived ambiguity.

Quota-deferred items use `next_backlog_pass` and must not increment verification attempts merely because they were skipped by the cap.

## Daily historical result closure

Controlled by `CARD_GRADING_AUTHORITY.md` version 1.1 and the existing `card-grading.yml` workflow. Native execution runs at 03:00 America/Vancouver; the continuing ChatGPT task verifies it and supplies fallback recovery at 03:30.

Each pass attempts every pending past issued event, deduplicated by exact event ID. Previous-day and older backlog counts remain separate, with no fixed 20/10 quotas. Cache result requests by exact provider/league/date so one final result may close all matching cards without repeating broad board retrieval. Genuine exceptions cannot monopolize a quota or hide newer unresolved events. Receipts must distinguish historical backlog from current-day cards and report exact unresolved identities and reasons.

Match full-game identities from issued metadata (`at` or `@`) and exact immutable issued snapshots where display names are missing; never infer a game from a placeholder or silently overwrite a conflicting identity. College football includes FBS and FCS. CFL uses its official scoreboard when ESPN does not cover it. Official unplayed cancellations require exact-selection void verification. Tied NFL/CFL two-way full-game moneylines require the issued book's verified refund rule; spreads and totals use the verified final score.

This remains independent of live odds and report production. No live refresh, re-handicap, issuance edit or bankroll write is permitted.

## Core v1.4 compatibility

Result Closure does **not** require a current Core production preflight because it grades historical issuance under the authority that existed when each report was created.

For Core v1.4 cards specifically, the closure process treats `coreAssessment`, Walters evidence, personnel evidence and schema-3 Core/Research/Walters provenance as immutable source evidence. It grades the issued selection only; it does not reconsider whether Core v1.4 should have issued the card.

## Summary output

Each closure run should report separately:

- previous-day events attempted / closed;
- backlog events attempted / closed;
- remaining quota-deferred count;
- genuine unresolved-exception count.

This layer remains deliberately small: no second odds engine, no general results database, no automatic re-handicap and no hidden results/CLV learning loop.
