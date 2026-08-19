# Issued Card Observations

This directory stores small retrospective observations for already-issued Betting Edge recommendation cards. It is an audit layer, not a second handicapping engine.

## Price observation

- Price observations use only odds snapshots already indexed in `data/history/odds-index.json`; they do not request fresh odds.
- Matching is exact: the issued `rec.feed.selectionKey` and issued sportsbook must match the stored snapshot.
- A comparison snapshot must be generated after the issued run's `feedGeneratedAt` and before that recommendation's scheduled start time.
- The latest eligible stored snapshot is the observation point.
- If no eligible snapshot or exact quote exists, the price observation remains explicitly unavailable. Do not infer or fuzzy-match a price.
- An observed price is a **last observed pre-start price**, not a verified closing line or formal CLV unless separately established.
- Full odds snapshots are not duplicated here; observation records reference their immutable Git blob SHA.

Manual validation command:

`node tools/observe-issued-prices.mjs data/history/runs/YYYY-MM-DD/<run>.json`

## Result verification and completion

Every displayed issued card may be closed after its event is final. The lifecycle is:

`ISSUED -> UNRESOLVED -> VERIFIED -> COMPLETE`

Rules:

- Result verification is targeted only at issued BET / LEAN / WAIT / PASS cards. Do not scan the full sports board.
- Prefer exact event identity from `rec.feed.eventId` and `rec.feed.selectionKey`.
- Web verification should use an authoritative or otherwise reliable final-score/result source for the exact event and date.
- Final-score grading for moneyline, spread and game-total cards is deterministic from the exact issued side/line.
- **Spread sign convention:** Odds-API.io spread-row `hdp` is the HOME-side handicap and is also the raw line stored at the end of both home/away selection keys for that row. A home selection uses raw `hdp`; an away selection uses the opposite sign. Example: home Washington / away Toronto with raw `hdp: -11.5` means Washington -11.5 and Toronto +11.5.
- Player props, regulation-only markets, shortened/suspended games and other special settlement cases remain unresolved unless the exact issued selection can be verified safely.
- A verified BET is an **official** result. LEAN / WAIT / PASS results are **hypothetical** and never alter the official betting ledger.
- Missing price/CLV observation does not prevent a result from becoming COMPLETE.
- Once a card is COMPLETE, routine backlog checks do not recheck it.
- A completed result is not silently rewritten. Any later correction must be explicit and source-backed.
- Result verification never changes the original issued status, price, fair value, playTo, stake or analysis and never reruns the handicap.
- Failure of this audit layer must never block a Betting Edge report.

Deterministic grading helper:

`node tools/verify-issued-results.mjs <issued-run.json> <verification.json>`

The verification JSON supplies already-verified final event evidence. The helper grades standard score-based markets and updates/creates the matching observation sidecar. Unsupported markets fail closed as unresolved unless an exact selection outcome is supplied.

## 05:00 result-closure backlog rule

A separate daily 05:00 America/Vancouver result-closure task performs one lightweight closure pass before the morning odds/report sequence:

1. inspect the previous Vancouver day's issued cards plus older cards explicitly still UNRESOLVED;
2. group unresolved cards by exact event so one verified final can close multiple cards;
3. perform targeted result verification only for events expected to be finished;
4. grade score markets with the spread sign convention above;
5. save verified completion records in this observation layer;
6. leave ambiguous or unsupported cards UNRESOLVED.

The 05:00 audit is independent of the 05:45 odds refresh and 06:00 Betting Edge Open report. Its failure must not modify live odds or block the report.

This layer is deliberately small: no second odds engine, no full-board result harvesting, no duplicate odds archive and no automatic re-handicapping from outcomes.
