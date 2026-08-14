# Betting Edge Governance & Report-Generation Contract

**Document status:** DRAFT — governance/specification only  
**Draft version:** 0.4  
**Prepared:** 2026-08-14  
**Repository target:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Proposed production filename:** `BETTING_EDGE_CONTRACT.md`

> **NOT YET OPERATIONAL**
>
> This v0.4 document is a design draft. It is **not connected to the scheduler, Betting Edge report task, runner, or odds-refresh workflow**. It cannot affect a live report until a separate integration step is deliberately approved and tested.

---

# 1. Executive Design

Betting Edge should minimize variability in **execution** without minimizing variability in **analysis**.

The governing principle is:

> **Hard-code the guardrails; keep the handicapper adaptive.**

This contract therefore has three layers:

## Layer A — HARD GATES

Binary operating requirements. These should eventually be machine-checkable wherever practical.

Examples:

- Is the feed fresh?
- Is the exact market identified?
- Is the exact sportsbook quote fresh enough?
- Is fair-value work available?
- Is `playTo` present?
- Is stake legal for the status?
- Does total risk reconcile?
- Is the payload valid?

A failed hard gate cannot be overridden by analytical enthusiasm.

## Layer B — DECISION FRAMEWORK

Rules that structure good handicapping without forcing a fixed model.

Examples:

- price vs fair value;
- no-vig/sharp benchmarking;
- movement;
- matchup fundamentals;
- injuries/lineups/weather/rest/travel;
- contrary evidence;
- historical calibration;
- user-history fit;
- uncertainty.

These guide judgment. They are not a rigid point system.

## Layer C — DISCOVERY SPACE

Intentionally adaptive.

Betting Edge may discover:

- new predictive metrics;
- better market relationships;
- better sport-specific inputs;
- better timing;
- better sources;
- better fair-value methods;
- better use of user history;
- new failure modes.

A discovery is not automatically promoted into a hard rule.

---

# 2. Precedence Rules

When evidence, data, or system layers conflict, the following order governs:

1. **Data validity**
2. **Event / market / selection identity**
3. **Executable-price freshness**
4. **Fair-value availability**
5. **Exposure and staking constraints**
6. **Analytical judgment**
7. **Secondary expert/context signals**

Higher levels cannot be overridden by lower levels.

Examples:

- A great matchup cannot override a stale feed.
- A strong model cannot override an identity mismatch.
- A perceived edge cannot override an unverified executable price.
- A handicapper's opinion cannot override failed market validation.
- Historical success cannot turn a bad current price into a BET.

---

# 3. Formal System Invariants

These are conditions the system should always preserve.

## Invariant 1 — Same-snapshot stability

If report R is issued from snapshot A and the runner reprices R against the identical snapshot A, using identical identity and freshness rules:

> Every successfully matched issued price must resolve to **UNCHANGED**.

If it does not, there is an issuance/repricing consistency problem that requires investigation.

## Invariant 2 — Non-BET means zero risk

For every recommendation:

`status != BET  =>  stake = $0`

LEAN may display `$0 — WATCH`, but contributes zero risk.

## Invariant 3 — Risk reconciliation

`total new risk = sum(stakes where status == BET)`

No other status contributes to risk.

## Invariant 4 — No verified price without complete validation

A price cannot be called verified/current/executable unless all required price-validation gates pass.

## Invariant 5 — No BET without fair threshold

If defensible fair-value work is unavailable:

`playTo = THRESHOLD UNAVAILABLE`

and:

`status != BET`

## Invariant 6 — No forced action

Zero BETs is always a valid report result.

## Invariant 7 — Repricing does not silently re-handicap

Update Odds / Reprice compares current validated prices with the issued report. It does not silently rewrite the issued fair value, reasoning, grade, or stake.

---

# 4. HARD GATES

## 4.1 Approved live-feed route

Report generation should obtain `data/live-odds.json` from the connected GitHub repository through the GitHub Contents/API route.

For this large JSON, do not rely on a file-fetch route that may truncate the resource.

Only if the Contents/API route fails may the GitHub Pages `live-odds.json` copy be used as fallback.

Never substitute cached search-result odds as current sportsbook prices.

---

## 4.2 Feed-level freshness

The feed's `generatedAt` must be present, parseable, and no more than:

> **75 minutes old**

at report generation.

If missing, malformed, too old, or unavailable through both approved routes:

- use **FEED STALE** / unavailable state as appropriate;
- do not represent contained prices as current;
- do not issue a BET materially dependent on those prices.

A fresh file does **not** prove every bookmaker quote inside it is fresh.

---

## 4.3 Verified executable-price checklist

A sportsbook price is **VERIFIED EXECUTABLE** only when every applicable item below passes:

1. Overall feed passes the ≤75-minute rule.
2. Event identity is validated.
3. Team/player identity is validated.
4. Exact market type is validated.
5. Exact selection/side is validated.
6. Exact spread/total/prop line is validated where applicable.
7. Sportsbook is an approved user book.
8. Exact market object has a valid `updatedAt`.
9. Exact market `updatedAt` is within the executable quote-age limit.
10. Event has not started/closed for the intended pregame market.
11. Price is represented in the required American-odds format for the report.
12. No unresolved identity conflict remains.

Failure of any required item means the price must not be represented as verified executable.

---

## 4.4 Exact quote freshness

### Current global operating standard

> Exact Bet365/DraftKings market quote age must be **≤30 minutes relative to feed `generatedAt`** to qualify as current/executable.

Formula:

`quote_age = feed.generatedAt - exact_market.updatedAt`

Required:

`quote_age <= 30 minutes`

### Status of this threshold

The 30-minute limit is the:

> **CURRENT GLOBAL STANDARD — SUBJECT TO EMPIRICAL REVIEW**

It should remain universal initially because one clear standard is safer than unsupported sport/market exceptions.

Future evidence may justify market-class-specific thresholds, but such a change must go through formal change control.

---

## 4.5 Context-only quote window

Raw market objects older than 30 minutes may remain useful.

Current raw-feed retention may include quotes approximately:

> **30–90 minutes old**

These may support:

- movement history;
- prior-price context;
- market-availability diagnosis;
- opener/earlier comparison.

They must **not** be displayed as the current executable price.

This deliberately separates:

**raw data retention** from **bettable-price validation**.

---

## 4.6 Exact identity requirement

Do not force-match similar markets.

Identity distinctions include, but are not limited to:

- moneyline vs spread/run line;
- full game vs first period/half/five innings;
- regulation vs overtime-inclusive;
- main line vs alternate line;
- player hits vs total bases;
- over 1.5 vs over 2.5;
- same player in a different event.

If identity cannot be confidently validated:

**IDENTITY MISMATCH**

and no price-dependent BET.

---

## 4.7 Supported user books

Current primary live-validation books:

- **Bet365**
- **DraftKings**

For serious candidates:

- use exact snapshot prices and timestamps;
- line-shop between eligible supported books;
- use the best fresh valid user-book price.

If one book is stale and the other is fresh, use the fresh eligible quote.

If no supported book has a fresh exact match:

**PRICE NOT VERIFIED**

---

## 4.8 Fair-value gate

A BET requires defensible fair-value work.

Fair value may use:

- no-vig market consensus;
- sharp/reference prices;
- multi-book structure;
- sport-specific projections;
- matchup adjustments;
- injury/lineup/weather/rest/travel information;
- historical calibration.

Fair value must allow for uncertainty/model error.

False precision should be avoided.

Where practical for serious candidates, fair value should include an uncertainty range or confidence band rather than a single apparently exact number.

Example:

`fair = -115; uncertainty band = -108 to -122`

`playTo` should remain conservative relative to that uncertainty, rather than being derived from the point estimate alone.

If fair-value work cannot be defended:

- `playTo = "THRESHOLD UNAVAILABLE"`
- no BET.

---

## 4.9 `playTo` gate

Every recommendation must contain `playTo`.

### BET / LEAN

The worst acceptable American price and/or line that still clears the recommendation after:

- vig;
- uncertainty;
- model-error margin.

### WAIT due to stale/unverified price

`playTo = "WAIT FOR FRESH PRICE"`

### PASS

`playTo = "NO BET"`

### Fair threshold unavailable

`playTo = "THRESHOLD UNAVAILABLE"`

and no BET.

---

## 4.10 Stake gate

Only:

`status = BET`

may carry nonzero stake.

Before payload validation, force every non-BET stake to zero.

Routine stake sizing remains conservative, with approximately **3% of bankroll as the normal single-position upper bound** unless a future approved contract revision changes the framework.

Stake sizing may consider:

- edge;
- confidence;
- uncertainty;
- correlation;
- existing exposure;
- liquidity/market fragility;
- historical staking behavior.

Visual stars or enthusiasm do not mechanically determine stake.

---

## 4.11 Exposure gate

Before adding a BET, consider:

- existing open wagers;
- same-game correlation;
- same-team dependency;
- duplicated thesis;
- portfolio concentration.

If otherwise qualifying action would create unacceptable correlated risk:

**DUPLICATE EXPOSURE**

stake = `$0`.

---

## 4.12 Payload integrity gate

Payload must be constructed as a structured JSON object.

Required validation sequence:

1. Construct object.
2. Serialize with a proper JSON serializer.
3. Parse serialized JSON successfully.
4. Base64URL-encode that exact UTF-8 JSON without padding.
5. Decode Base64URL back to UTF-8.
6. Parse successfully again.
7. Verify critical decoded fields.
8. Verify recommendation counts.
9. Verify every recommendation has an allowed status.
10. Verify every recommendation has `playTo`.
11. Verify every non-BET has zero stake.
12. Verify total risk equals BET stakes only.
13. Verify no price-dependent BET lacks verified price.
14. Verify no BET lacks defensible fair threshold.
15. Only then build/deliver the runner URL.

Never hand-splice encoded payload fragments.

If validation fails:

> rebuild and revalidate; do not deliver the malformed/inconsistent runner link.

---

# 5. Hard Failure vs Analytical Warning Matrix

| Condition | Classification | Required consequence |
|---|---|---|
| Feed >75 min / malformed / unavailable | HARD FAIL for current pricing | FEED STALE/UNAVAILABLE; no price-dependent BET |
| Exact event/market/selection cannot be validated | HARD FAIL | IDENTITY MISMATCH; no price-dependent BET |
| Exact quote >30 min and no fresh supported alternative | HARD FAIL for executable price | PRICE NOT VERIFIED; no price-dependent BET |
| Fair threshold unavailable | HARD FAIL for BET | THRESHOLD UNAVAILABLE; no BET |
| Non-BET carries stake | HARD FAIL | Force stake to $0 before validation |
| Risk does not equal BET stakes | HARD FAIL | Rebuild payload |
| Payload round-trip fails | HARD FAIL | Do not deliver runner link |
| Material lineup/injury unresolved | ANALYTICAL BLOCK | WAIT / LINEUP/INFORMATION PENDING when material |
| Strong evidence conflicts | ANALYTICAL BLOCK/WARNING | CONFLICTING SIGNALS; normally no BET until resolved or sufficiently outweighed |
| Historical fit weak | WARNING | Reduce confidence; does not independently force PASS |
| Named handicapper disagrees | CONTEXT WARNING | Consider, but never independently controls grade |
| Market movement opposes thesis | ANALYTICAL WARNING | Investigate; may lower grade depending on cause |
| Same-snapshot reprice != UNCHANGED | SYSTEM INVARIANT FAILURE | Investigate issuance/repricing consistency |

---

# 6. DECISION FRAMEWORK

## 6.1 Independent market-based analysis

Betting Edge is not a tout-consensus product.

Primary analysis should independently use:

- market prices;
- no-vig/fair-value comparison;
- line movement;
- sharp/reference information;
- sport-specific matchup inputs;
- injuries/lineups/weather/rest/travel;
- historical market calibration;
- user betting history as a filter without overfitting.

Named handicappers are secondary context only.

---

## 6.2 Good matchup vs good bet

A favorable team/player/matchup is not enough.

The central question is:

> **Is the available validated price better than the conservative fair threshold by enough to overcome vig, uncertainty, and model error?**

No value at the current price means no BET, even if the underlying side is likely to win.

---

## 6.3 Evidence standard for BET

A BET requires multiple **meaningfully independent** supporting signals.

However:

> **Evidence quality and independence matter more than raw signal count.**

Two unusually strong independent signals may be more persuasive than five weak or correlated signals.

Examples of signal families:

- price edge vs fair;
- sharp/no-vig support;
- meaningful market movement;
- matchup fundamentals;
- injury/lineup advantage;
- weather/rest/travel;
- historical calibration;
- user-history fit.

Do not count multiple versions of the same underlying information as separate confirmation.

---

## 6.4 Contrary-evidence requirement

Every serious candidate should explicitly consider the strongest credible evidence against the play.

The purpose is not artificial balance. It is to test whether the thesis survives its best objection.

A BET should identify:

- strongest support;
- strongest contrary evidence;
- why the remaining edge is still sufficient.

---

## 6.5 Historical calibration

Historical data may inform:

- whether similar market edges have held up;
- sport/market reliability;
- uncertainty;
- model calibration.

Historical calibration should carry provenance wherever practical:

- comparable sample size;
- sport / league;
- market class;
- relevant price or line band;
- observation period;
- whether the comparison is genuinely independent of the current market signal;
- contract/model version where known.

Do not overfit small samples.

Historical calibration modifies confidence; it does not replace current price analysis.

A historical-fit grade without enough provenance to explain what produced it should be treated as low-confidence context rather than a decisive signal.

---

## 6.6 User-history filter

User betting history may identify:

- stronger/weaker market classes;
- staking tendencies;
- behavioral biases;
- possible specialties;
- overexposure patterns.

It is a filter, not an automatic signal.

A favorable user-history pattern cannot make a bad current price valuable.

---

## 6.7 Named experts / handicappers

Named handicappers and consensus sources may provide:

- context;
- disagreement signal;
- information leads;
- market narrative.

They must never be the primary reason for BET.

---

# 7. Decision Status Vocabulary

Allowed recommendation statuses:

- **BET**
- **LEAN**
- **WAIT**
- **PASS**

## BET

Actionable now at the listed verified price, with sufficient edge after vig, uncertainty, and model-error margin.

Only BET may carry nonzero stake.

## LEAN

Interesting and potentially valuable, but below BET confidence/edge threshold or lacking sufficient confirmation.

Stake = `$0` or `$0 — WATCH`.

## WAIT

Potentially actionable, but a material input remains unresolved.

Examples:

- price not verified;
- lineup pending;
- key injury unresolved;
- material weather pending;
- exact market not yet reliably available.

### Controlling-reason rule

WAIT is appropriate only when resolving the pending input could plausibly change the decision at the current price or at a realistically obtainable near-term price.

If the current verified price already fails `playTo` by enough that resolving the pending information would not reasonably make the selection actionable, use **PASS / NO VALUE** rather than WAIT.

When practical, document why the unresolved item is material by estimating one or more of:

- expected fair-price impact;
- expected line impact;
- whether the resolution could cross `playTo`.

Stake = `$0`.

## PASS

No bet under current conditions.

PASS is the correct state when the controlling blocker is genuine lack of value at the current verified price, even if the underlying matchup remains favorable.

Stake = `$0`.

Zero BETs is valid.

---

# 8. Controlled Price / Decision Language

Decision state and price-comparison state are distinct.

## VALUE CONFIRMED

Play qualifies at listed current verified price.

## VALUE IMPROVED

Better current verified price is available and play still qualifies.

## VALUE HOLDS

Verified price changed but remains inside `playTo`.

## EDGE GONE

Use only when the **same validated market/selection** had a documented qualifying BET or LEAN edge in an earlier lane/snapshot and now no longer qualifies.

Never use as a generic PASS label.

## PRICE MOVED

Verified sportsbook odds moved beyond `playTo`.

## FAIR VALUE CHANGED

Updated analysis/fair value—not sportsbook movement alone—removed a previously qualifying edge.

## MARKET UNAVAILABLE

Exact market is confirmed absent.

## PRICE NOT VERIFIED

Exact current price cannot be confidently retrieved/matched/validated.

## LINEUP/INFORMATION PENDING

Material non-price information remains unresolved.

## CONFLICTING SIGNALS

Material evidence disagrees enough to impair confidence.

## FEED STALE

Overall snapshot fails feed freshness.

## POLICY BLOCK

Explicit operating gate prevents action.

## EVENT STARTED/CLOSED

Betting window ended.

## DUPLICATE EXPOSURE

Existing correlated risk prevents another wager.

## IDENTITY MISMATCH

Event/team/player/market identity cannot be validated.

## UNRESOLVED

Technical state, not analytical conclusion.

Do not use vague substitutes such as PRICE GONE when verified odds are unchanged.

---

# 9. Runner Comparison Contract

The runner is a presentation/comparison layer, not a second independent handicapper.

It should preserve issued:

- decision grade;
- fair value;
- stake;
- reasoning;
- historical assessment.

## Price comparison states

For exact matched market:

- better = **IMPROVED**
- worse = **WORSENED**
- identical = **UNCHANGED**

These describe price comparison only.

They do not automatically alter BET/LEAN/WAIT/PASS.

## Clear Comparison

Should restore the clean issued snapshot and remove comparison state.

It must not:

- erase saved historical runs;
- change issued analysis;
- modify bankroll;
- create new analysis.

## Session switching

Switching report lanes must not leak comparison state between sessions.

---

# 10. Report-Lane Framework

All lanes use the same hard gates.

Current terminal lanes:

- 06:00
- 08:00
- 09:30
- 15:15
- 18:15

Lane purpose may differ without changing hard validation.

## 06:00

Early structure, overnight movement, developing information, initial candidates.

## 08:00 MAIN

Deep morning handicap; strongest actionable prices; distinguish good matchups from good bets; identify changes from 06:00.

## 09:30

Later morning confirmation/reassessment using fresher information; test whether earlier edges persist.

## 15:15 / 18:15

Later slate, lineup/market updates, remaining events, late movement, event-specific timing.

No lane is required to produce a BET.

---

# 11. Recommendation Data Contract

Core recommendation fields:

- `status`
- `title`
- `meta`
- `book`
- `price`
- `playTo`
- `fair`
- `edge`
- `move`
- `hist`
- `stake`
- `support`
- `contrary`
- `source`
- `analysis`

Core run fields:

- `slot`
- `label`
- `ts`
- `bankroll`
- `risk`
- `counts`
- `summary`
- `recs`

Useful optional audit metadata may later include:

- `feedGeneratedAt`
- `contractVersion`
- validation result/version
- prior-lane reference

Do not add optional metadata to production until compatibility is tested.

---

# 12. DISCOVERY SPACE

Betting Edge should remain free to improve its analytical process.

Potential discovery areas include:

- new predictive sport metrics;
- market microstructure;
- sharp-market proxies;
- timing effects;
- injury/lineup interpretation;
- travel/rest effects;
- weather effects;
- pitcher/goalie/QB/player matchup modeling;
- prop-model inputs;
- correlations;
- better fair-value techniques;
- better historical calibration;
- new sources.

Recommended promotion path:

1. Observation
2. Hypothesis
3. Repeated evidence
4. Calibration
5. Adaptive use
6. Formal hard-rule consideration only if appropriate

This prevents one-off discoveries from becoming permanent constraints.

---

# 13. Change Control

Hard rules should change deliberately.

Record:

- date;
- old rule;
- new rule;
- reason;
- evidence/incident;
- affected components;
- code/instruction changes required;
- regression tests.

## Change record — 2026-08-14

### Issue

An issued report could use a bookmaker quote whose market timestamp was materially older than the snapshot, while runner repricing used a 30-minute per-quote freshness rule.

The same snapshot could therefore appear to produce WORSENED pricing even though no newer snapshot existed.

### Decision

Align issuance and repricing standards.

### Rule

Exact executable Bet365/DraftKings quote age must be ≤30 minutes relative to feed `generatedAt`.

### Context retention

Older quotes may remain in raw feed for historical/movement context.

### Intentionally unchanged

- runner logic;
- scheduler;
- raw-feed retention;
- saved history;
- Clear Comparison;
- session switching.

---

# 14. Regression Test Suite

## Feed

Test:

- fresh feed + fresh quotes;
- fresh feed + one stale book;
- fresh feed + both stale;
- stale feed;
- malformed feed;
- missing exact market;
- ambiguous identity.

## Same-snapshot invariant

1. Issue from snapshot A.
2. Reprice against snapshot A.
3. Every successfully matched issued price must be UNCHANGED.
4. Any deviation is investigated before acceptance.

## New-snapshot movement

Issue from A; reprice against B:

- better → IMPROVED;
- worse → WORSENED;
- same → UNCHANGED;
- no fresh exact match → appropriate unresolved/price state.

## Stakes

Test:

- BET + nonzero stake accepted;
- LEAN + nonzero stake forced/rejected to zero;
- WAIT + nonzero stake forced/rejected to zero;
- PASS + nonzero stake forced/rejected to zero;
- risk reconciles exactly.

## Payload

Test:

- serialize;
- parse;
- encode;
- decode;
- parse;
- verify critical fields;
- verify counts;
- verify stakes/risk.

## Runner state

Test:

- Update Odds;
- Clear Comparison;
- switch lanes;
- reprice one lane;
- switch away/back;
- clear at different points;
- no comparison leakage;
- history intact.

---

# 15. Failure-Closed Principle

When a critical validation cannot be satisfied, prefer no action over fabricated certainty.

Examples:

- stale feed → no current-price BET;
- uncertain identity → no price-dependent BET;
- stale exact quote → do not call it current;
- unavailable fair value → no BET;
- payload validation failure → no runner link;
- unclear bankroll/exposure when material → resolve rather than silently invent.

The system must never manufacture recommendations to fill a report.

---

# 16. Future Operationalization — Not Yet Approved

## Phase 1 — Documentation

Review this contract and remove contradictions.

## Phase 2 — Read-before-run

If approved, scheduled Betting Edge report generation would be instructed to load the current contract before performing analysis.

The schedule itself remains only the trigger.

## Phase 3 — Deterministic validators

Machine-enforce appropriate hard gates:

- feed age;
- quote age;
- status vocabulary;
- `playTo`;
- stake;
- risk sum;
- payload round-trip;
- deterministic identity fields where practical.

## Phase 4 — Contract version auditability

Optionally store contract version in report metadata after runner compatibility testing.

Historical reports are not rewritten.

---

# 17. What Must Remain Flexible

Do **not** hard-code:

- permanent sport/model weights without evidence;
- fixed minimum number of signals;
- fixed minimum number of BETs;
- named handicapper consensus;
- automatic bets based on historical user success;
- permanent team/player biases;
- rigid fair-value formulas for every sport;
- untested market-specific freshness exceptions;
- automatic stake from star rating.

The contract exists to improve truthfulness and consistency, not to turn Betting Edge into a static rules engine.

---

# 18. Open Research Questions

These are deliberately unresolved and are **not production rules**:

1. Does the 30-minute global quote threshold remain optimal after observing a meaningful sample of actual pulls?
2. Do some market classes eventually justify stricter or looser thresholds?
3. Which identity checks can be made fully deterministic?
4. Which hard gates should live in report-generation validation versus runner validation?
5. Should contract version eventually appear in payload metadata?
6. Would a machine-readable schema add enough reliability to justify another maintained artifact?
7. How should scheduled reports obtain authoritative open exposure if it is not programmatically available?
8. What historical sample sizes are too small to influence calibration?
9. Should raw retention eventually vary by market class?

Do not guess these into production behavior. Gather evidence first.

---

# 19. Audit Checklist

Before accepting a Betting Edge report, verify:

1. Approved feed route used.
2. Feed ≤75 minutes.
3. Serious executable quotes ≤30 minutes relative to snapshot.
4. Exact identity validated.
5. Best eligible supported user-book price used.
6. Fair value defensible.
7. BET evidence sufficiently strong and meaningfully independent.
8. Strongest contrary evidence considered.
9. Every rec has `playTo`.
10. Every non-BET has zero stake.
11. Total risk equals BET stakes.
12. Controlled vocabulary used correctly.
13. Payload passed round-trip validation.
14. Zero BETs was permitted.
15. No adaptive discovery was incorrectly promoted into a hard rule.

---

# 20. Positive-Effect Test

This contract should be adopted operationally only if it produces a **net positive effect**.

Evaluate it against these criteria:

## Reliability

Does it reduce:

- stale-price issuance;
- identity errors;
- stake inconsistencies;
- malformed payloads;
- contradictory terminology;
- artificial same-snapshot price movement?

## Analytical freedom

Does Betting Edge still:

- discover new signals;
- adapt sport-by-sport;
- challenge existing assumptions;
- incorporate new information;
- find unexpected value;
- return zero BETs when appropriate?

## Clarity

Are reports easier to understand?

Can we distinguish:

- data failure;
- price failure;
- analytical uncertainty;
- genuine lack of value?

## Operational burden

Does the contract add unnecessary failure points, latency, maintenance, or complexity?

If a proposed contract feature adds more operational risk than reliability, do not adopt it merely because it is theoretically cleaner.

## Betting quality

Most importantly, does the contract improve decision quality by preventing bad execution **without suppressing legitimate analytical edge discovery**?

The contract should be revised if it demonstrably harms that objective.

---

---

# 21. V0.4 Shadow History & Decision Calibration Layer

## 21.1 Purpose

Shadow History is an observational and calibration system that records serious Betting Edge candidates whether or not they become BETs.

Its purpose is to learn from:

- BETs;
- LEANs;
- WAITs;
- near-threshold PASS decisions;
- price-blocked candidates;
- information-blocked candidates;
- conflicting-signal candidates;
- fair-value changes;
- clean PASS/control observations.

Shadow History is **not** a hard decision gate by default.

It must not automatically turn historical success into a current BET.

## 21.2 Backward-compatibility requirement

V0.4 is designed as an extension of the existing Betting Edge flow:

`odds snapshot -> analysis -> fair value / playTo -> BET / LEAN / WAIT / PASS -> stake -> validated terminal payload`

Shadow History sits beside and behind that flow.

Initial Shadow History implementation must not require material changes to:

- live-odds generation;
- existing report lanes;
- scheduler timing;
- runner comparison behavior;
- stake contract;
- payload round-trip validation;
- current controlled vocabulary.

If a Shadow History feature requires major production surgery, redesign the feature before modifying the working pipeline.

## 21.3 Serious-candidate capture

A serious candidate may be recorded even with `$0` stake.

Minimum shadow observation should include, where available:

- stable candidate identity key;
- decision timestamp;
- lane;
- event;
- sport / league;
- market;
- selection;
- sportsbook;
- verified price;
- exact quote timestamp;
- fair point estimate;
- fair uncertainty band;
- `playTo`;
- price distance from `playTo`;
- edge estimate;
- decision status;
- controlling blocker;
- support summary;
- strongest contrary evidence;
- historical-fit grade and provenance;
- contract version;
- model / method version where available.

## 21.4 Stable candidate identity

Shadow History must not merge materially different bets.

Identity should distinguish at minimum:

- event;
- market class;
- selection;
- line / threshold where applicable;
- regulation / full-game / period scope;
- player identity where applicable.

Sportsbook may be stored as execution context without necessarily defining the underlying analytical candidate.

A stable deterministic key should be used wherever practical.

## 21.5 Shadow buckets

Initial descriptive buckets:

- `BET_QUALIFIED`
- `LEAN_QUALIFIED`
- `NEAR_THRESHOLD`
- `PRICE_BLOCKED`
- `INFORMATION_BLOCKED`
- `CONFLICTING_SIGNALS`
- `FAIR_VALUE_CHANGED`
- `MARKET_UNAVAILABLE`
- `PRICE_NOT_VERIFIED`
- `CLEAN_PASS_CONTROL`

Buckets are descriptive tags, not automatic recommendation statuses.

A candidate may carry more than one descriptive tag when analytically justified, but one **controlling blocker** should be identified for the final decision.

## 21.6 Price-distance tracking

For serious candidates, record the distance between the current verified price and the actionable threshold.

Examples:

- favorite: current `-120`, playTo `-110` -> misses threshold by 10 cents;
- underdog: current `+172`, playTo `+180` -> misses threshold by 8 cents.

This field is descriptive and should be market-aware.

It exists to distinguish:

- almost actionable;
- materially overpriced;
- nominally fair but without uncertainty cushion.

## 21.7 Counterfactual threshold tracking

Where practical, record what would have changed the decision.

Examples:

- playable at `-110` or better;
- playable if confirmed starter is active;
- playable if weather lowers projected total by X;
- playable if fair value strengthens beyond a defined threshold.

Counterfactuals must be recorded at decision time when possible.

They must not be retroactively rewritten to fit the outcome.

## 21.8 Post-decision observations

Shadow History should separately track what happened after the decision.

Potential fields:

- best later user-book price;
- closing user-book price;
- broader market close where available;
- final fair-value estimate before event start;
- material information change;
- whether the original counterfactual condition occurred;
- closing-line value;
- event result;
- wager result if a BET existed.

Market quality and game outcome must remain separate.

A losing wager may still have been a strong price decision.

A winning wager may still have been a poor price decision.

## 21.9 Information-leakage protection

Historical evaluation must distinguish information available at decision time from information learned later.

Every backfilled item should be classified as one of:

- `KNOWN_AT_DECISION`
- `POST_DECISION_UPDATE`
- `CLOSING_MARKET_DATA`
- `FINAL_RESULT`

Post-decision information must never be silently treated as if it informed the original recommendation.

## 21.10 Decision-version provenance

Every shadow observation should identify, where available:

- contract version;
- fair-value method version;
- model version;
- calibration-table version;
- relevant source version / snapshot;
- decision lane.

This prevents decisions created under materially different logic from being pooled without adjustment.

## 21.11 Error attribution

When sufficient evidence exists, postmortem analysis may classify misses using tags such as:

- `BAD_PRICE`
- `FAIR_VALUE_MISS`
- `LINEUP_INFORMATION_MISS`
- `MARKET_MOVED_AGAINST_THESIS`
- `MATCHUP_MODEL_MISS`
- `IDENTITY_OR_DATA_ERROR`
- `VARIANCE_NOISE`
- `INSUFFICIENT_INFORMATION`
- `UNCLASSIFIED`

These are analytical diagnostics, not retroactive excuses.

Outcome alone is insufficient to assign an error category.

## 21.12 Promotion firewall

Shadow findings do not become production rules automatically.

Recommended promotion path:

1. Observation
2. Hypothesis
3. Adequate sample
4. Out-of-sample or forward validation
5. Stability check across time / market regimes
6. Economic / market rationale
7. Limited adaptive use
8. Formal contract consideration only when justified

A discovery that disappears out of sample should remain research history, not a production rule.

---

# 22. Shadow History Storage Architecture

## 22.1 No monolithic history file

Shadow History must not depend on one ever-growing JSON array.

Raw observations should be partitioned from the beginning.

Preferred early structure:

`shadow-history/YYYY/MM/DD/<sport-or-lane>.jsonl`

or another comparably partitioned append-friendly structure.

## 22.2 Raw vs derived data

Maintain two conceptual layers:

### Raw observation layer

Auditable event-level records.

### Derived calibration layer

Compact summaries used by routine Betting Edge analysis.

Examples:

- sport / market reliability;
- price-band calibration;
- edge-band calibration;
- WAIT resolution outcomes;
- near-threshold performance;
- closing-line-value summaries;
- recent rolling windows.

Routine report generation should not need to load years of raw history.

## 22.3 Storage portability

The schema should remain portable.

GitHub may be used initially for:

- schemas;
- contract versions;
- compact summaries;
- partitioned auditable observations;
- small-to-moderate research datasets.

If scale materially grows, the analytical store may later move to:

- SQLite;
- DuckDB;
- hosted relational / analytical database;
- another purpose-built datastore.

Such migration should not require changing the core recommendation semantics.

## 22.4 Write-safety requirements

Before production Shadow History writes are approved, define and test:

- append / update behavior;
- concurrent lane writes;
- duplicate prevention;
- deterministic identity;
- partial-write recovery;
- file-size limits;
- retention policy;
- summary rebuild process;
- rollback behavior.

Shadow History writing must never be allowed to break odds refresh, report issuance, runner delivery, or scheduler execution.

A failed shadow write should normally fail **open for reporting but closed for shadow persistence**:

- preserve the Betting Edge report if all report gates pass;
- record / surface the shadow-write failure;
- do not fabricate a successful history write.

---

# 23. Lane-to-Lane Decision State Machine

For the same validated market / selection, track both recommendation state and the reason for transition.

Useful analytical transition labels:

- `NEW`
- `VALUE_CONFIRMED`
- `VALUE_IMPROVED`
- `VALUE_HOLDS`
- `PRICE_MOVED`
- `FAIR_VALUE_CHANGED`
- `LINEUP_INFORMATION_PENDING`
- `CONFLICTING_SIGNALS`
- `PASS_NO_VALUE`
- `EDGE_GONE`
- `EVENT_STARTED_CLOSED`

Each transition should identify the causal driver where known:

- sportsbook movement;
- fair-value revision;
- lineup / injury / weather update;
- identity resolution;
- exposure change;
- policy gate.

Price comparison remains separate from decision state.

---

# 24. V0.4 Decision Audit

For serious candidates, the compact analytical audit should be conceptually reconstructable as:

`current price -> fair estimate / range -> playTo -> price distance -> controlling blocker -> historical adjustment -> final status`

This is an audit structure, not a requirement to display every field in the terminal UI.

The objective is to make a recommendation explainable without forcing the handicapper into a rigid points model.

---

# 25. V0.4 Additional Regression Tests

Before any V0.4 feature becomes operational, add tests for:

## WAIT vs PASS

- pending information + current price plausibly actionable after resolution -> WAIT;
- pending information + current price materially outside any plausible actionable range -> PASS;
- pure price failure with no material unresolved information -> PASS.

## Fair-value uncertainty

- point fair available but uncertainty too wide -> no forced BET;
- playTo remains conservative relative to uncertainty band;
- revised fair value is distinguished from sportsbook movement.

## Shadow identity

- same event, different market -> different candidate key;
- same player, different prop threshold -> different candidate key;
- same market across books -> same analytical candidate with distinct execution context where appropriate.

## Leakage

- post-decision lineup news cannot alter stored original decision inputs;
- closing price stored separately from issued price;
- final outcome cannot rewrite the original fair value.

## Shadow write safety

- duplicate write;
- concurrent lane write;
- partial write;
- failed summary rebuild;
- oversized partition;
- shadow write failure does not suppress an otherwise valid Betting Edge report.

## Calibration provenance

- historical-fit grade has sample / market / period provenance;
- insufficient provenance lowers confidence;
- small sample cannot independently promote PASS / LEAN into BET.

---

# 26. V0.4 Open Research Questions

These remain non-production research items:

1. What minimum sample sizes should influence each historical-fit grade?
2. Which price-distance bands are most useful by market class?
3. Should fair-value uncertainty bands be numeric for every sport or qualitative for some markets?
4. What constitutes a realistically obtainable near-term price for WAIT vs PASS?
5. Which shadow buckets should be mutually exclusive versus multi-tag?
6. What closing-market source should be authoritative for calibration?
7. When should raw shadow partitions be compacted?
8. At what scale should raw analytical history move away from GitHub?
9. Which shadow summaries are valuable enough to load during routine report generation?
10. Which findings justify adaptive model changes versus formal hard-rule changes?

Do not guess these into production behavior.

---

# 27. V0.4 Integration Plan — Not Yet Approved

## Phase A — Draft only

- maintain V0.4 as governance/specification;
- no scheduler changes;
- no runner changes;
- no odds-refresh changes;
- no production shadow writes.

## Phase B — Shadow schema prototype

- define machine-readable record schema;
- generate sample records offline;
- validate stable identity and bucket logic;
- validate file partition strategy.

## Phase C — Passive shadow capture

- write observations without feeding them back into live grades;
- shadow failure cannot block a valid report;
- compare captured decisions against existing terminal output.

## Phase D — Derived calibration summaries

- build compact historical summaries;
- validate sample-size and leakage controls;
- keep summaries advisory.

## Phase E — Controlled analytical readback

- allow report analysis to consume approved calibration summaries;
- no automatic rule promotion;
- monitor positive-effect test.

## Phase F — Production rule consideration

Only after demonstrated value, stability, regression safety, and explicit approval.

---

# 28. V0.4 Compatibility Guard

V0.4 should be considered backward-compatible only if:

- existing live-price validation remains valid;
- existing runner payloads remain valid unless deliberately versioned;
- non-BET stake invariants remain unchanged;
- same-snapshot repricing remains stable;
- existing report lanes continue to function;
- Shadow History failure cannot corrupt report issuance;
- no new analytical field is silently treated as a hard gate;
- old historical reports remain readable and are not rewritten.

Any proposed implementation that violates these conditions requires a separate migration plan rather than being treated as a routine V0.4 integration.


---


# 29. Formal Architecture Separation

V0.4 makes the operating architecture explicit.

Betting Edge should be treated as five cooperating layers with deliberately narrow responsibilities:

1. **CONTRACT** — defines global governance, hard gates, decision semantics, validation rules, historical-calibration rules, and compatibility requirements.
2. **LANE** — defines the analytical purpose of a particular report window such as 06:00, 08:00, 09:30, 15:15, or 18:15.
3. **SCHEDULER** — determines when a lane is triggered. It should not duplicate the full governance contract.
4. **SHADOW HISTORY** — records serious-candidate observations and later calibration evidence. It does not control live recommendations unless a separate approved readback stage is active.
5. **RUNNER** — renders issued reports and performs presentation/repricing comparison. It is not an independent handicapper.

The default design rule is:

> **Global rules belong in the contract; lane intent belongs in the lane definition; timing belongs in the scheduler; learning records belong in Shadow History; presentation belongs in the runner.**

This separation is intended to reduce duplicated instructions, configuration drift, and accidental disagreement between report lanes.

---

# 30. Authoritative Contract Loading

## 30.1 Draft state

While the contract filename contains `DRAFT`, report generation must not assume it is authoritative unless a test or manual instruction explicitly names that draft.

Uploading `BETTING_EDGE_CONTRACT_DRAFT_v0.4.md` to the repository alone must not alter production behavior.

## 30.2 Future production state

After explicit approval, the authoritative production contract may use:

`BETTING_EDGE_CONTRACT.md`

Scheduled report generation may then use a read-before-run sequence:

1. trigger the lane;
2. retrieve the authoritative contract from the approved repository / branch;
3. validate that the contract is readable and identifies an approved version;
4. apply global contract rules;
5. apply the named lane purpose;
6. perform the analysis;
7. validate and deliver the report.

The schedule should remain a trigger plus lane selector, not a duplicate copy of the entire contract.

## 30.3 Contract retrieval failure

Until deterministic fallback behavior is separately approved:

- inability to retrieve the authoritative contract is a **POLICY BLOCK** for contract-dependent automated issuance;
- the system must not silently fall back to an unknown or partially remembered contract version;
- manual recovery may deliberately name a known approved contract version if the operator chooses to do so.

A draft contract retrieval failure must not affect production because drafts are non-authoritative.

---

# 31. Contract Provenance and Version Pinning

Every future report generated under an authoritative contract should be able to identify the rules that governed it.

Preferred provenance fields:

- `contractVersion`;
- `contractPath`;
- repository branch or immutable commit SHA where practical;
- optional contract content hash;
- lane identifier;
- report timestamp;
- feed `generatedAt`.

Shadow History observations should preserve the same provenance.

The purpose is auditability, not payload bloat. Provenance may live in internal metadata or a compact audit object if runner compatibility makes that preferable.

A later contract revision must not retroactively rewrite the provenance of prior reports or shadow observations.

---

# 32. GitHub Permission and Write-Boundary Model

V0.4 distinguishes read permissions from write permissions.

## 32.1 Read-only report generation

Routine report generation should normally require read access to:

- the authoritative contract;
- live odds / approved market snapshots;
- approved compact calibration summaries when readback is activated;
- other explicitly approved analytical inputs.

Routine analysis should not require authority to modify:

- workflows;
- runner code;
- contract files;
- scheduler definitions;
- canary workflows.

## 32.2 Controlled Shadow History writes

If GitHub is used as the initial Shadow History backend, production write capability should be narrowly scoped to approved persistence paths such as:

- `data/shadow-history/`;
- `data/calibration/`;
- optional audit / manifest files specifically designated for shadow persistence.

The analytical process should not gain broad repository mutation authority merely because Shadow History needs persistence.

## 32.3 No automatic governance mutation

A live Betting Edge run must never automatically rewrite:

- `BETTING_EDGE_CONTRACT.md`;
- workflow YAML;
- runner HTML / JavaScript;
- scheduler / canary definitions;
- other governance or execution code.

Changes to those components require deliberate change control.

## 32.4 Write failure isolation

A failure to persist Shadow History must not invalidate an otherwise valid Betting Edge report.

Required behavior:

- report path: continue if all report gates pass;
- shadow path: record failure state and do not claim persistence succeeded;
- no fabricated retry success;
- no mutation of the issued recommendation to compensate for persistence failure.

---

# 33. Compact Scheduler Contract

Once authoritative contract loading is approved and tested, scheduled prompts may be reduced substantially.

A future scheduler instruction should contain only what is unique to the scheduled job, for example:

- report lane / slot;
- lane label;
- trigger timing;
- authoritative contract location / version policy;
- required delivery target;
- any truly lane-specific objective not already defined in the contract.

The scheduler should not duplicate permanent rules for:

- feed freshness;
- exact quote freshness;
- market identity;
- `playTo`;
- stake legality;
- risk reconciliation;
- controlled vocabulary;
- payload validation;
- historical-calibration principles.

These belong in the authoritative contract.

## 33.1 Migration safeguard

Scheduled prompts must not be shortened until read-before-run behavior has been tested against the existing self-contained prompts.

During migration, compare old and new execution on the same inputs and investigate material recommendation or validation differences before cutover.

---

# 34. V0.4 Integration Modes

V0.4 defines explicit activation modes so implementation can proceed incrementally.

## MODE 0 — DOCUMENTATION ONLY

- draft stored in repository or Library;
- no production consumer;
- no behavior change.

## MODE 1 — CONTRACT READ TEST

- selected manual / test runs read the draft contract;
- existing production scheduled prompts remain unchanged;
- compare outputs and validation behavior.

## MODE 2 — AUTHORITATIVE READ-BEFORE-RUN

- approved production contract becomes authoritative;
- scheduled prompts become compact lane triggers;
- no Shadow History writes required yet.

## MODE 3 — PASSIVE SHADOW WRITE

- serious candidates are persisted;
- Shadow History remains observational;
- shadow failure cannot block valid reports.

## MODE 4 — CALIBRATION SUMMARY BUILD

- compact derived summaries are produced;
- leakage and sample-size controls enforced;
- summaries remain advisory.

## MODE 5 — CONTROLLED SHADOW READBACK

- approved summaries may influence uncertainty / confidence;
- no automatic hard-rule promotion;
- all influence remains subordinate to current verified price and hard gates.

## MODE 6 — MATURE OPERATION

- deterministic validators enforce suitable hard rules;
- contract controls global governance;
- lanes stay analytically adaptive;
- Shadow History is calibrated, versioned, and auditable;
- storage may move beyond GitHub without changing recommendation semantics.

Movement between modes requires explicit approval and regression testing.

---

# 35. V0.4 Compatibility Manifest and Cutover Tests

V0.4 is intended to integrate with the current Betting Edge architecture without radical replacement.

## 35.1 Intentionally unchanged before activation

Draft creation / upload alone must not change:

- current report times;
- active scheduler / canary behavior;
- `data/live-odds.json` schema;
- current odds-refresh behavior;
- supported primary books;
- feed freshness threshold;
- exact quote freshness threshold;
- BET / LEAN / WAIT / PASS statuses;
- controlled price vocabulary;
- non-BET zero-stake invariant;
- risk reconciliation;
- runner payload requirements;
- runner repricing semantics;
- bankroll handling;
- saved historical reports.

## 35.2 Read-before-run equivalence test

Before replacing a full scheduled prompt with a compact contract-driven prompt:

1. choose the same lane and same live snapshot;
2. run the current self-contained prompt;
3. run the proposed contract-driven prompt;
4. compare hard-gate outcomes;
5. compare candidate identity;
6. compare verified executable prices;
7. compare fair-value reasoning and `playTo` treatment;
8. compare status vocabulary;
9. compare stakes / total risk;
10. compare payload validity;
11. investigate any material difference;
12. cut over only when the difference is explained and acceptable.

Exact recommendation equality is not required where legitimate adaptive analytical judgment differs, but validation behavior and contract invariants must remain consistent.

## 35.3 Shadow write isolation test

Before enabling Shadow History persistence:

- simulate write success;
- simulate permission denial;
- simulate stale SHA / concurrent update;
- simulate duplicate observation;
- simulate malformed partition;
- simulate summary rebuild failure;
- confirm valid report issuance remains unaffected;
- confirm failure is visible and not falsely marked successful.

## 35.4 Rollback boundary

Every activation step must have a simple rollback path.

At minimum:

- compact scheduler prompts can revert to the previous self-contained prompts;
- Shadow History writes can be disabled independently;
- calibration readback can be disabled independently;
- runner and odds refresh remain usable without Shadow History;
- prior reports remain readable.

The known-good production pipeline remains the rollback baseline until a later mode is explicitly accepted as the new baseline.

---

# 36. Production-Promotion Criteria

The draft should not become the authoritative production contract merely because it is complete.

Promotion requires evidence that the contract-driven architecture:

- preserves or improves report reliability;
- reduces duplicated scheduler instructions;
- reduces cross-lane rule drift;
- preserves valid adaptive handicapping;
- does not introduce unacceptable latency;
- does not create a new single point of failure without a tested recovery path;
- preserves runner compatibility;
- preserves stake / risk invariants;
- can identify the exact contract version used;
- can disable Shadow History independently;
- passes the Positive-Effect Test.

Only after those conditions are met should the draft filename be replaced by the authoritative production filename.

---
# 37. Governing Principle

> **Rigid about data validity, market identity, price truth, staking safety, terminology, and payload integrity. Flexible about how genuine betting value is discovered.**
