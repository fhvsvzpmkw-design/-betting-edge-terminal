# Betting Edge Governance & Report-Generation Contract

**Document status:** DRAFT — governance/specification only  
**Draft version:** 0.7  
**Prepared:** 2026-08-14  
**Repository target:** `fhvsvzpmkw-design/-betting-edge-terminal`  
**Proposed production filename:** `BETTING_EDGE_CONTRACT.md`

> **NOT YET OPERATIONAL**
>
> This v0.7 document is a design draft. It is **not connected to the scheduler, Betting Edge report task, runner, or odds-refresh workflow**. It cannot affect a live report until a separate integration step is deliberately approved and tested.

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
- Research Library historical calibration;
- user-history fit as a separate secondary context;
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
- approved current-model/local calibration inputs where independently justified.

At **R3 controlled Research Library integration**, the Research Library is an independent historical lens applied after the provisional current-market handicap is formed. It must not silently generate or rewrite fair value. If future evidence justifies Research Library influence on fair-value construction itself, that requires a separately approved activation step, equivalence testing, and explicit change control.

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
| Historical fit weak | WARNING | Surface the caution in History Fit; at R3 it does not independently change fair value, `playTo`, status, or stake |
| Named handicapper disagrees | CONTEXT WARNING | Consider, but never independently controls grade |
| Market movement opposes thesis | ANALYTICAL WARNING | Investigate; may lower grade depending on cause |
| Same-snapshot reprice != UNCHANGED | SYSTEM INVARIANT FAILURE | Investigate issuance/repricing consistency |

---

# 6. DECISION FRAMEWORK

## 6.1 Independent market-based analysis

Betting Edge is not a tout-consensus product.

Primary current handicap analysis should independently use:

- market prices;
- no-vig/fair-value comparison;
- line movement;
- sharp/reference information;
- sport-specific matchup inputs;
- injuries/lineups/weather/rest/travel.

At R3, the Research Library is applied **after a provisional current recommendation is formed** as an independent historical lens. Personal betting history remains a separate secondary filter. Neither should be counted as a substitute for current price/fair-value evidence.

The Research Library may expose a reason to re-check the current handicap, but it must not silently rewrite fair value, `playTo`, status, or stake merely because History Fit is supportive or contrary. Any revised live decision must be justified by an explicit re-evaluation of current evidence.

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

Examples of live signal families:

- price edge vs fair;
- sharp/no-vig support;
- meaningful market movement;
- matchup fundamentals;
- injury/lineup advantage;
- weather/rest/travel.

At R3, **Research Library History Fit and personal-ledger context are advisory/context layers, not additional BET-confirmation votes**. They may identify a reason to re-examine the live thesis, but they do not satisfy the multiple-independent-signal requirement by themselves.

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

## 6.5 Research Library historical calibration

The primary historical evidence layer for current Betting Edge analysis is the **Betting Edge Research Library**.

The Research Library contains curated research priors, source references, mechanism findings, replication warnings, era-drift cautions, and explicitly classified research gaps across sports and market classes. It is a read-only analytical input during report generation.

For a serious candidate, the historical question is:

> **What does the best applicable Betting Edge research say about this type of market situation, and how directly does that evidence apply here?**

The Research Library may inform:

- market-efficiency expectations;
- favorite/longshot structure;
- margin/de-vig assumptions;
- line-movement interpretation;
- injury/news incorporation;
- live-market behavior;
- market-class fragility;
- era/regime uncertainty;
- known research gaps;
- confidence and model-error margin.

Historical research must remain subordinate to current validated price, fair value, identity, and current information.

A Research Library prior cannot create a BET by itself, rescue an invalid price, or convert a research anomaly into a mechanical wagering system.

The terminal field currently labeled **History Fit** should be interpreted as the concise **Research Library view of the current candidate** unless a later approved UI revision renames the field.

History Fit should normally contain:

1. a brief grade/verdict;
2. the most relevant historical mechanism or finding;
3. the main limitation, conflict, era caveat, or evidence-strength qualifier.

It should not become a literature review inside the card. Detailed provenance may remain in analysis/audit data.

---

## 6.6 Personal ledger filter — deliberately separate

The user's betting ledger is **not the Research Library** and should not determine the History Fit grade.

User betting history may identify:

- stronger/weaker personal market classes;
- staking tendencies;
- behavioral biases;
- possible specialties;
- repeated overexposure;
- timing or execution habits.

It remains a separate, secondary personalization filter.

Default rule:

> **Research Library evidence determines History Fit; personal ledger evidence does not silently alter that grade.**

If personal history is materially relevant, it may be mentioned briefly elsewhere in the analysis or staking/exposure discussion. It should not be forced into every card and should not make the report wordy.

A favorable personal-history pattern cannot make a bad current price valuable. A weak personal-history pattern cannot automatically veto a well-supported current edge.

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
- `researchLibraryVersion`
- research retrieval status
- applied Research Library prior IDs for serious candidates

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
- better Research Library retrieval and local calibration;
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
2. Do some market classes eventually justify stricter or looser quote-age thresholds?
3. Which identity checks can be made fully deterministic?
4. Which hard gates should live in report-generation validation versus runner validation?
5. Should contract version eventually appear in payload metadata?
6. Would machine-readable contract and Research Library schemas add enough reliability to justify maintained artifacts?
7. How should scheduled reports obtain authoritative open exposure if it is not programmatically available?
8. Which Research Library findings are sufficiently direct, current, and replicated to receive high History Fit confidence?
9. How should era drift be represented without inventing an arbitrary decay formula?
10. How should conflicting research priors be summarized without double-counting related papers or mechanisms?
11. Which current research gaps require local historical calibration rather than more generic literature searching?
12. Should raw odds retention eventually vary by market class?
13. What evidence would justify activating a future Shadow History collector, and what storage/write boundary would be acceptable?

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
15. If R3+ is active, History Fit came from the approved Research Library process.
16. Personal ledger evidence did not silently alter the Research Library History Fit grade.
17. No adaptive discovery or research prior was incorrectly promoted into a hard rule.

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

# 21. V0.7 Historical-Evidence Architecture — Major Direction Correction

## 21.1 Why V0.7 changes direction

V0.6 correctly identified the need for disciplined historical calibration, provenance, leakage protection, and future learning. However, it placed **Shadow History** too close to the center of the historical-evidence architecture before Betting Edge had an approved persistence bridge for candidate-level observations.

That created a sequencing problem:

- the system already possesses a substantial curated research-prior library;
- that library can be read and used without runtime write authority;
- the live report already contains a History Fit field capable of carrying a concise historical interpretation;
- but V0.6 emphasized future writes, partitions, idempotency, enrichment, and shadow storage before formalizing the immediately usable read-only research layer.

V0.7 corrects the order of operations.

The historical-evidence hierarchy is now:

1. **Betting Edge Research Library** — primary historical research lens available now;
2. **current/same-day market evidence** — current context, handled in movement/fair-value analysis rather than disguised as historical research;
3. **personal ledger** — separate user-specific secondary filter;
4. **Shadow History** — optional future proprietary evidence layer after a safe persistence path exists.

This is not a rejection of Shadow History. It is a correction of sequence and responsibility.

---

## 21.2 Core v0.7 historical principle

> **Use the strongest read-only historical evidence already available before building a write-dependent historical system.**

The Research Library should become useful first.

Shadow History should only be activated later if it offers incremental value beyond:

- established literature;
- curated Betting Edge research priors;
- current verified market structure;
- same-day price lineage;
- personal-ledger context.

---

## 21.3 Historical-evidence separation

Betting Edge must keep the following evidence families distinct.

### A. Research Library evidence

External published or otherwise classified research synthesized into Betting Edge priors.

Examples:

- market-efficiency findings;
- favorite/longshot effects;
- bookmaker-margin behavior;
- line-movement information and overreaction;
- injury/news incorporation;
- live-market surprise response;
- sport/market-specific research gaps.

### B. Current market evidence

Evidence from the actual current betting market.

Examples:

- current no-vig probability;
- Bet365/DraftKings price relationship;
- opener/current movement;
- reversal path;
- quote freshness;
- current market disagreement.

This belongs primarily in current analysis, not in the Research Library grade.

### C. Personal ledger evidence

The user's own settled betting history and behavior.

This is personalization, not external market research.

### D. Future Shadow History evidence

Betting Edge's own prospectively recorded candidate observations, if and when safe persistence is activated.

This is proprietary forward calibration, not a substitute for the Research Library.

These families may inform the same decision, but they must not be silently merged into one opaque "history" score.

---

# 22. Current Betting Edge Research Library Inventory

## 22.1 Audited package inventory

V0.7 recognizes the existing Research Prior Library packages as the current research source set.

The audited package sequence is:

| Package | Role | Logical items |
|---|---|---:|
| `v1.0` | foundational consolidated prior library | 28 |
| `v1.1` | expanded evidence hierarchy / more sources | 13 |
| `v1.2` | additional sport and methodology coverage | 12 |
| `v1.3` | thin-market and integrity guardrails | 15 |
| `v1.4` | classic papers and mechanisms | 10 |
| `v1.5` | targeted question resolutions | 10 |
| `v1.6` | final generic gap resolution | 8 |
| **Total** | logical prior/resolution items across passes | **96** |

The current library is therefore substantial enough to support structured historical interpretation, but it is **not yet one canonical production file**.

---

## 22.2 What the library actually is

The Research Library is a curated collection of:

- synthesized research findings;
- source references and identifiers where available;
- evidence-strength classifications;
- Betting Edge usage guidance;
- warnings about replication and era drift;
- explicitly identified research gaps;
- research questions that were resolved or intentionally left local.

It should not be misrepresented as a full-text archive of every cited article.

A source reference may point to an external paper or study without storing the complete copyrighted work.

The operational value is the structured prior and provenance, not possession of every article's full text.

---

## 22.3 Major coverage already present

The current library includes meaningful coverage of:

### Cross-sport methodology

- no-vig probability normalization;
- market efficiency;
- favorite/longshot bias and reverse variants;
- bookmaker margin structure;
- consensus versus individual-book information;
- closing-line information;
- calibration versus raw prediction accuracy;
- structural breaks and era drift.

### MLB

- historical reverse favorite/longshot effects;
- evidence against simplistic public fading;
- intraday line movement;
- movement overreaction/reversal mechanisms.

### NBA

- opening-to-closing spread information;
- player absence and market adjustment;
- totals-era drift;
- early-season learning/uncertainty;
- modern movement behavior.

### NFL

- long-run spread efficiency;
- divisional familiarity findings;
- weather/acclimatization evidence;
- betting-split/line-movement context;
- edge decay and market learning;
- weak/mixed evidence around generic home-dog heuristics.

### NHL

- historical reverse favorite/longshot evidence;
- totals-market work;
- information effects;
- modern moneyline movement and negative autocorrelation;
- explicit warnings against assuming old NHL findings transport unchanged.

### Soccer

- favorite/longshot effects;
- bookmaker versus exchange information;
- Asian handicap distinctions;
- bookmaker dispersion;
- league-specific efficiency;
- live surprise underreaction/overreaction.

### Tennis

- favorite/longshot effects;
- market structure;
- model-versus-market comparison;
- replication/data-quality warnings.

### MMA/UFC

- recent market-efficiency baseline;
- moneyline versus prop separation;
- model-versus-market methodology;
- warnings against importing favorite/longshot priors from other sports.

### CFL

- credible live win-probability methodology;
- explicit recognition that broad pregame market-efficiency research remains thin.

### Boxing

- partial fight-winner odds context;
- de-vig method implications;
- explicit separation of fight winner from method/round derivatives;
- unresolved derivative-market calibration gaps.

### Player and micro props

- practitioner evidence around book differences and vig shape;
- lack of a broad peer-reviewed calibration body;
- integrity-risk concerns;
- requirement for larger uncertainty and stricter local validation.

### Live betting

- event surprise;
- time since event;
- liquidity/execution;
- pregame market as prior;
- evidence that information incorporation may be fast but not monotonic.

---

## 22.4 Known unresolved areas

The final v1.6 pass intentionally stopped generic literature hunting and classified several areas as legitimate local-calibration needs:

- CFL pregame moneyline/spread/total;
- boxing derivatives such as method/round/total-round;
- broad player-prop calibration by sport/book/market.

A research gap is itself useful information.

When the library says evidence is genuinely thin, Betting Edge should not manufacture confidence from adjacent sports or superficially similar markets.

---

# 23. Canonical Research Library Model

## 23.1 Why canonicalization is needed

The current 96 logical items are distributed across seven package generations with evolving field names and status vocabularies.

Before routine report integration, V0.7 recommends producing a canonical read-only Research Library representation.

Canonicalization should:

- preserve the original package/version provenance;
- normalize sport and market taxonomy;
- normalize evidence-strength fields;
- preserve original wording where analytically useful;
- retain explicit research gaps;
- prevent duplicate mechanisms from being counted as independent evidence;
- separate source-level records from synthesized prior-level records.

Canonicalization is a **manual preparation step**, not a live-report write requirement.

---

## 23.2 Recommended read-only repository layout

A future manually uploaded research package may use:

```text
research/
  README.md
  research-library.json
  source-registry.json
  history-fit-policy.json
  taxonomy.json
```

Optional future versioned archives may live under:

```text
research/archive/
```

No runtime report needs permission to modify these files.

The report process only needs read access.

---

## 23.3 Source registry and prior registry must remain separate

A **source** is a paper, book chapter, working paper, official publication, industry report, thesis, or other evidence item.

A **prior** is Betting Edge's synthesized interpretation of one or more sources.

One prior may cite multiple sources.

One source may support multiple priors.

This separation prevents bibliographic details from being mixed with analytical conclusions.

---

# 24. Canonical Source Record Contract

## 24.1 Recommended source fields

A canonical source record should support, where available:

```json
{
  "sourceId": "...",
  "title": "...",
  "authors": ["..."],
  "year": 2025,
  "publication": "...",
  "sourceType": "PEER_REVIEWED|BOOK_CHAPTER|WORKING_PAPER|PREPRINT|THESIS|OFFICIAL|INDUSTRY|PRACTITIONER",
  "doi": "...",
  "url": "...",
  "verificationStatus": "VERIFIED|PARTIAL|UNVERIFIED",
  "sports": ["NHL"],
  "marketClasses": ["MONEYLINE"],
  "sampleEra": {"start": 2019, "end": 2023},
  "addedInLibraryVersion": "1.5",
  "notes": "..."
}
```

Not every source will have every field.

Missing metadata must remain missing rather than being invented.

---

## 24.2 Source verification rule

V0.7 distinguishes:

- **analytical usefulness** of a prior;
- **bibliographic verification** of a source.

A prior may remain valuable as research context even if some bibliographic metadata still needs cleanup, but production-grade provenance should clearly mark that limitation.

Never invent:

- DOI;
- journal;
- year;
- authorship;
- sample size;
- exact result.

---

# 25. Canonical Research Prior Record Contract

## 25.1 Recommended fields

A canonical research prior should support:

```json
{
  "priorId": "nhl_moneyline_movement_reversal",
  "libraryVersion": "1.7",
  "sourcePackageVersions": ["1.0", "1.5", "1.6"],
  "sport": "NHL",
  "league": "NHL",
  "marketClass": "MONEYLINE",
  "scope": "PREGAME",
  "mechanismTags": ["LINE_MOVEMENT", "REVERSAL", "OVERREACTION"],
  "evidenceTier": "A|B|C|D",
  "confidence": "HIGH|MEDIUM_HIGH|MEDIUM|LOW",
  "transportability": "CURRENT|HISTORICAL|ERA_DEPENDENT|UNKNOWN",
  "finding": "...",
  "bettingEdgeImplication": "...",
  "applicabilityConditions": ["..."],
  "exclusions": ["..."],
  "sourceIds": ["..."],
  "productionEligibility": "ADVISORY|RESEARCH_ONLY|GAP",
  "lastReviewed": "YYYY-MM-DD"
}
```

---

## 25.2 Prior identity

A `priorId` should represent one distinct research mechanism or finding.

Do not create separate independent priors merely because:

- the same result appeared in multiple package versions;
- one paper was summarized twice;
- a later resolution restated the earlier conclusion;
- the same mechanism applies to several sports.

Version history should be represented as provenance, not duplicate votes.

---

## 25.3 Research gaps are first-class prior records

A research gap should remain machine-readable.

Example:

```json
{
  "priorId": "player_props_broad_efficiency_gap",
  "marketClass": "PLAYER_PROP",
  "productionEligibility": "GAP",
  "finding": "Broad peer-reviewed calibration evidence is insufficient for a universal production prior.",
  "bettingEdgeImplication": "Use local/book-aware calibration, larger uncertainty, and strict price verification."
}
```

A `GAP` record should normally produce **NO DIRECT PRIOR** or a cautious History Fit result rather than false neutrality.

---

# 26. Evidence Hierarchy

## 26.1 Evidence tier

V0.7 retains and formalizes the Research Library evidence hierarchy.

### Tier A

Peer-reviewed and replicated/consistent body of evidence, or a very strong methodological consensus.

### Tier B

A strong peer-reviewed study or robust historical literature with meaningful applicability.

### Tier C

Credible working paper, preprint, thesis, or limited single-study evidence requiring replication.

### Tier D

Industry, practitioner, descriptive, or architecture-guiding evidence only.

Evidence tier affects confidence in the prior.

It does not replace current price analysis.

---

## 26.2 Evidence tier is not applicability

A Tier A source can be weakly applicable to a current candidate because:

- the study is old;
- the market class differs;
- bookmaker structure changed;
- the candidate sits outside the studied price band;
- the finding depends on a league/regime no longer present.

Conversely, a lower-tier current source may be directly relevant but still receive limited confidence because the evidence quality is weaker.

Betting Edge must therefore assess at least two dimensions:

1. **evidence quality**;
2. **candidate applicability**.

---

## 26.3 No numeric pseudo-precision requirement

V0.7 does not require a rigid numeric score such as:

`0.73 historical confidence`

unless a later validated calibration system demonstrates that such a number is meaningful.

Qualitative confidence is preferable to unsupported precision.

---

# 27. Applicability and Research Matching

## 27.1 Retrieval question

For each serious candidate, research matching should ask:

> **Which library priors are genuinely relevant to this exact sport, market class, timing state, price structure, and information environment?**

The goal is not to retrieve the largest number of priors.

The goal is to retrieve the smallest set of materially relevant priors.

---

## 27.2 Matching dimensions

Where available, candidate-to-prior matching should consider:

- sport;
- league;
- market class;
- moneyline/spread/total/prop distinction;
- player vs team market;
- pregame vs live;
- favorite vs underdog role;
- broad price band;
- main line vs alternate/derivative;
- full-game vs period/half/inning scope;
- information state such as lineup/news event;
- movement path versus static price;
- market liquidity / integrity sensitivity;
- research era and current transportability.

---

## 27.3 Matching priority

Use the most specific applicable evidence first.

Preferred order:

1. exact sport + exact market class + comparable state;
2. exact sport + closely related market mechanism;
3. cross-sport methodological prior with strong structural relevance;
4. adjacent-sport evidence only as explicitly labeled context;
5. no direct prior if the match is too weak.

Do not borrow a strong NFL prior to manufacture confidence in CFL merely because both are football.

Do not borrow game-market evidence for player props.

Do not borrow fight-winner evidence for boxing round derivatives.

---

## 27.4 No forced match

If no direct or defensible prior exists:

> **History Fit should say so.**

Examples:

- `HISTORY FIT: NR — No reliable direct research prior for this player-prop market.`
- `HISTORY FIT: C — Only indirect methodological support; sport-specific evidence is thin.`

Lack of research is preferable to fake specificity.

---

# 28. Preventing Double Counting

## 28.1 Mechanism clustering

Several library entries may describe the same underlying mechanism.

Examples:

- market efficiency;
- closing-line information;
- consensus outperforming one book;
- modern movement reversal;
- favorite/longshot structure.

Do not count every related paper as a separate independent signal if they arise from one conceptual mechanism.

---

## 28.2 Source overlap

If a v1.5 question resolution restates a v1.0 prior using the same or overlapping source evidence, treat it as an updated synthesis, not an additional independent vote.

---

## 28.3 Research Library signal families

Recommended broad research families include:

- market-efficiency / consensus;
- margin/de-vig structure;
- favorite/longshot structure;
- movement / close / reversal;
- injury/information incorporation;
- live surprise / time decay;
- matchup/regime-specific literature;
- liquidity / integrity risk;
- research-gap / transportability warning.

A History Fit explanation should normally rely on one to three materially distinct families, not a long checklist.

---

# 29. Era Drift and Transportability

## 29.1 Historical evidence is not timeless

Sportsbook markets evolve.

Changes may include:

- lower or different margins;
- more books and faster information transfer;
- mobile betting;
- exchange information;
- market-making changes;
- rule changes;
- scoring environment shifts;
- roster/strategy changes;
- legalization and participant mix;
- data-feed improvements;
- prop-market expansion.

A historical finding can remain useful as a mechanism prior while losing direct quantitative transportability.

---

## 29.2 Transportability states

Recommended states:

- `CURRENT` — evidence reasonably representative of modern market structure;
- `HISTORICAL` — useful mechanism/guardrail, but not assumed quantitatively current;
- `ERA_DEPENDENT` — known to change across periods or regimes;
- `UNKNOWN` — insufficient evidence to judge transportability.

---

## 29.3 No arbitrary decay formula

V0.7 does not impose a formula that automatically reduces a paper's weight by age.

A foundational 1991 market-mechanism paper may remain highly important.

A 2018 threshold anomaly may be obsolete.

Age is evidence about context, not a mechanical penalty.

---

# 30. Research Conflict Resolution

## 30.1 Mixed evidence is a valid result

The library must be able to say:

- evidence is supportive;
- evidence is contrary;
- evidence is mixed;
- evidence is era-dependent;
- evidence is indirect;
- no direct prior exists.

It must not force every candidate into a positive or negative historical narrative.

---

## 30.2 Conflict handling

When applicable priors conflict:

1. identify the strongest direct modern evidence;
2. identify the strongest credible contrary prior;
3. determine whether the conflict is explained by market class, era, bookmaker structure, price band, or methodology;
4. avoid averaging incompatible findings into a meaningless numeric score;
5. summarize the conflict briefly in History Fit.

---

## 30.3 Example

For a favorite in a market where historical favorite/longshot research differs by sport and book structure:

> **HISTORY FIT: C — MIXED.** Broad favorite/longshot literature warns against universal price corrections, while this sport has shown a different historical pattern. Treat the library as a guardrail, not a directional signal at this exact price.

---

# 31. History Fit — Formal Report Contract

## 31.1 Meaning of the field

The existing terminal field `hist` / **History Fit** is redefined in V0.7 as:

> **The concise Betting Edge Research Library view of the current candidate.**

It is not:

- the candidate's overall grade;
- the user's personal betting-history score;
- a Shadow History score;
- a count of matching trends;
- a backtested win-rate claim;
- a substitute for fair value;
- a substitute for current price.

This semantic clarification can be adopted without changing the runner payload field name.

---

## 31.2 Required output components

For serious displayed candidates, History Fit should normally contain three compact elements:

1. **Verdict / grade** — how well the candidate aligns with applicable research;
2. **Mechanism** — the most relevant research finding or market principle;
3. **Limitation** — evidence strength, era caveat, research conflict, or gap.

The target is concise analytical value, not literature-review prose.

---

## 31.3 Length target

Recommended normal target:

> **25–50 words, usually one to three short sentences.**

Shorter is acceptable when the research message is simple.

If the terminal URL/payload budget is tight, compress History Fit toward **20–40 words** while preserving the verdict, mechanism, and main limitation. Payload integrity and runner-delivery reliability take precedence over extra prose.

Longer than roughly 50 words should be exceptional and used only when a material conflict cannot be stated truthfully in less space.

Do not dump source lists, study abstracts, or personal-ledger statistics into the card.

---

## 31.4 Grade scale

V0.7 recommends the following interpretive scale.

### A — STRONG DIRECT FIT

High-quality and directly applicable research meaningfully supports the candidate's market setup or analytical mechanism.

An A does **not** mean BET.

### B — SUPPORTIVE WITH CAVEATS

Relevant research provides meaningful support, but one or more limitations exist:

- evidence not fully modern;
- limited replication;
- imperfect market match;
- mixed book structure;
- modest transportability uncertainty.

### C — MIXED / NEUTRAL / INDIRECT

Research is conflicting, weakly directional, only indirectly applicable, or primarily useful as a guardrail.

### D — RESEARCH CAUTION / CONTRARY

Credible applicable research materially cautions against the candidate's mechanism or exposes a known weakness in the thesis.

A D does not mechanically force PASS, but the live case must survive the contrary evidence.

### NR — NO RELIABLE DIRECT PRIOR

The Research Library does not contain enough directly applicable evidence to grade the setup responsibly.

`NR` is preferable to fabricating a C.

---

## 31.5 Optional plus/minus modifiers

`A-`, `B+`, `B-`, `C+`, and similar modifiers may be used when they improve communication.

They must not imply a mathematically calibrated precision that does not exist.

---

## 31.6 History Fit is not a status mapping

The following mappings are prohibited:

- `A => BET`
- `B => LEAN`
- `C => WAIT`
- `D => PASS`

Decision status remains determined by the full current analytical process.

Possible combinations include:

- BET with History Fit C because the current price/model edge is strong but literature is mixed;
- PASS with History Fit A because the market price is too expensive;
- WAIT with History Fit B because lineup information is pending;
- BET with History Fit D only if the current evidence explicitly addresses the research caution and still clears uncertainty.

---

# 32. History Fit Construction Procedure

## 32.1 Step 1 — identify candidate structure

For the serious candidate, establish:

- sport/league;
- market class;
- timing state;
- selection role;
- line/threshold where relevant;
- current information state;
- key mechanism under consideration.

---

## 32.2 Step 2 — retrieve applicable priors

Retrieve the smallest relevant set of Research Library priors.

Do not retrieve generic sport trends merely because they share the league name.

---

## 32.3 Step 3 — assess evidence quality and applicability

For each potentially applicable prior, consider:

- evidence tier;
- confidence;
- market match;
- era transportability;
- source overlap;
- whether the finding is directional, cautionary, methodological, or a research gap.

---

## 32.4 Step 4 — identify dominant historical mechanism

Examples:

- line movement may contain information but also short-run overreaction;
- player absence tends to be incorporated by game time;
- generic public fading lacks support;
- favorite/longshot effects are sport- and book-dependent;
- thin props require larger model-error margins;
- pregame market probability should anchor a live model.

---

## 32.5 Step 5 — identify strongest research limitation

Examples:

- old sample;
- only one strong paper;
- finding did not replicate;
- different market class;
- modern market structure changed;
- practitioner evidence only;
- direct literature absent.

---

## 32.6 Step 6 — render concise History Fit

Recommended pattern:

`HISTORY FIT: <GRADE> — <VERDICT>. <mechanism>. <limitation>.`

The wording should be natural, not template-heavy when a shorter explanation is clearer.

---

# 33. History Fit Examples

## 33.1 Modern NHL moneyline movement

> **HISTORY FIT: B+ — SUPPORTIVE WITH CAUTION.** Modern NHL/NFL/NBA research suggests short-run moneyline moves can overreact and reverse, so the movement path matters more than raw steam. Useful support if the current price remains inside fair value; not a stand-alone reversal bet.

---

## 33.2 NBA player absence

> **HISTORY FIT: B — SUPPORTIVE EARLY, WEAKER LATE.** Research shows important absences can create opening-line bias, but markets tend to correct by game time. The historical case is strongest before the full injury adjustment is already embedded in price.

---

## 33.3 NFL generic home underdog

> **HISTORY FIT: C — WEAK/MIXED.** Long-run NFL markets are highly efficient and generic home-dog systems have not transported reliably. Any value must come from the specific matchup and current price rather than the label itself.

---

## 33.4 MLB public fade

> **HISTORY FIT: D — CAUTION.** MLB research does not support blindly fading public betting as a profitable rule. Splits can provide context, but the current price and independent market/matchup evidence must carry the case.

---

## 33.5 Player prop

> **HISTORY FIT: NR — DIRECT RESEARCH IS THIN.** Broad peer-reviewed prop calibration remains limited, while book-specific vig and role/usage differences matter materially. Use stricter price verification and a larger model-error margin rather than claiming a strong historical prior.

---

## 33.6 CFL pregame

> **HISTORY FIT: NR — LOCAL GAP.** Published CFL work supports strong market priors for live modeling, but broad pregame efficiency evidence remains thin. Do not import NFL pregame trends as if they were CFL-specific history.

---

## 33.7 Strong research fit but bad price

> **HISTORY FIT: A- — STRONG STRUCTURAL FIT.** The library strongly supports the underlying mechanism, but historical fit does not rescue an overextended current price. The recommendation remains price-dependent.

This example exists to reinforce that History Fit is not the final decision.

---

# 34. Personal Ledger Boundary

## 34.1 Personal ledger is a different evidence family

The user's ledger contains settled personal wagering behavior and results.

It can help Betting Edge understand:

- market preferences;
- timing habits;
- stake behavior;
- repeated exposure patterns;
- areas where the user has historically performed better or worse;
- execution quality where CLV/timing data are available.

It does not represent published market research.

---

## 34.2 Default display rule

Do **not** force personal-ledger commentary into every History Fit box.

The card should remain concise.

If personal history is material, preferred locations are:

- a brief note in expanded analysis;
- stake/exposure discussion;
- a separate future `Personal Fit` field only after UI/contract review.

---

## 34.3 No personal-outcome overfitting

Avoid conclusions such as:

- "You are good at MLB, therefore BET";
- "You lost your last five NHL totals, therefore PASS";
- "This team has made you money, therefore increase stake."

Personal results can reflect variance, market selection, changing process, and small samples.

The ledger is a behavioral/execution filter before it is a predictive model.

---

## 34.4 Ledger and Research Library disagreement

If the personal ledger and Research Library disagree:

- do not silently blend them;
- keep the Research Library grade unchanged;
- mention personal evidence only if material;
- current price/fair value remains primary.

---

# 35. Same-Day Betting Edge Lineage

## 35.1 Same-day lineage is not History Fit

The 06:00, 08:00, 09:30, 15:15, and 18:15 lanes may create a valuable sequence of observations for the same current market.

Examples:

- WAIT -> LEAN -> BET;
- BET -> VALUE HOLDS;
- BET -> PRICE MOVED beyond `playTo`;
- LEAN -> FAIR VALUE CHANGED;
- unresolved lineup -> confirmed information.

This sequence is **current-session evidence**, not external historical research.

It should normally appear in:

- movement;
- material-change summary;
- support/contrary analysis;
- prior-run comparison.

Do not inflate History Fit by counting earlier Betting Edge opinions as historical research.

---

## 35.2 Analytical value of lineage

Same-day lineage can reveal:

- whether the thesis was stable;
- whether price moved toward or away from fair value;
- whether new information changed fair value;
- whether the market merely repriced an already-known thesis;
- whether a recommendation is becoming less actionable despite stronger conviction.

This is especially valuable in 15:15 and 18:15 reports.

---

# 36. Research Library and Current Market Interaction

## 36.1 Correct interaction

At R3, Research Library evidence is applied as an **independent interpretive/audit lens after the provisional current handicap is formed**. Its normal output is History Fit.

Research may expose a reason to re-open the current analysis—for example, a known market-efficiency caution or a research gap—but any resulting change to fair value, `playTo`, status, or stake must come from an explicit re-evaluation of current evidence. The History Fit grade itself does not rewrite the recommendation.

Examples of appropriate research cautions:

- movement research may warn against treating every move as monotonic truth;
- injury research may warn against double-counting already-incorporated news;
- favorite/longshot research may alter uncertainty around margin allocation;
- market-efficiency research may raise the evidence burden before overriding a liquid consensus;
- thin-market research gaps may justify larger model-error margins.

---

## 36.2 Incorrect interaction

Research Library evidence must not be used to:

- substitute an old average return for current fair value;
- generate a current sportsbook quote;
- infer current lineup status;
- infer current weather;
- infer current market liquidity without evidence;
- apply a fixed historical win rate to a single candidate;
- force a bet because a historical subgroup was profitable.

---

# 37. Research Library Guardrails

## 37.1 Universal guardrails

The following rules apply to every research prior:

1. A research prior cannot create a BET by itself.
2. A research prior cannot substitute for a verified executable price.
3. A research prior cannot override an identity failure.
4. A research prior cannot override the fair-value gate.
5. A research prior cannot independently determine stake.
6. Historical anomaly does not equal current profit opportunity.
7. Old evidence requires transportability assessment.
8. Practitioner evidence must be labeled as such.
9. Research gaps must remain visible.
10. Multiple papers describing one mechanism are not multiple independent live signals.

---

## 37.2 No "trend shopping"

Betting Edge must not search the library until it finds a trend that supports a preferred pick.

Retrieval should be candidate-structure-driven, not outcome-driven.

A valid retrieval may return contrary evidence or no direct prior.

---

## 37.3 No post-hoc cherry picking

Do not select only the historical period or subgroup that makes the current candidate look best.

If the library explicitly identifies replication failure or era drift, History Fit must preserve that caution.

---

# 38. Thin-Market Contract

## 38.1 Player props

Player props must not inherit historical confidence from game moneylines, spreads, or totals.

Research Library treatment should emphasize:

- book-specific margin shape;
- lineup/role/minutes/usage uncertainty;
- market identity;
- threshold-specific calibration;
- larger model-error margin;
- stronger sample requirements;
- integrity sensitivity for micro outcomes.

Current status:

> broad production-grade peer-reviewed prop calibration remains a Research Library gap.

---

## 38.2 Boxing derivatives

Fight-winner research cannot be transferred mechanically to:

- method of victory;
- round groups;
- exact round;
- total rounds.

Derivative markets require separate local calibration.

---

## 38.3 CFL

CFL pregame and CFL live are separate historical modules.

Published live-model methodology may justify:

- strong use of pregame market prior;
- sport-specific state updating.

It does not establish a generic CFL pregame betting edge.

---

## 38.4 Low-liquidity and integrity-sensitive markets

Low liquidity or integrity sensitivity should widen uncertainty and reduce confidence in apparent movement signals.

A dramatic move in a thin market may reflect:

- small order flow;
- stale book differences;
- participant information;
- market closure/reopening;
- limited liquidity;
- true information.

Research context should increase caution, not create certainty.

---

# 39. De-Vig and Margin Research Contract

## 39.1 Baseline

No-vig conversion remains a core Betting Edge methodology.

Proportional normalization is a useful baseline, but V0.7 recognizes Research Library evidence that bookmaker margin allocation may be asymmetric by price and market structure.

---

## 39.2 Multi-method research implication

Where analytically justified, future fair-value work may compare:

- proportional normalization;
- Shin-style methods;
- power-style methods;
- book-aware margin models.

This is especially relevant when:

- favorite/longshot bias is material;
- overround is large;
- market has more than two outcomes;
- book structure is known to shade prices asymmetrically.

---

## 39.3 No automatic production method switch

The Research Library finding that proportional normalization is not universally sufficient does not automatically replace the current no-vig method.

Method changes require:

- explicit implementation;
- regression testing;
- fair-value comparison;
- validation against forward CLV/calibration;
- change control.

---

# 40. Line-Movement Research Contract

## 40.1 Movement is informative but non-monotonic

Research Library evidence supports two simultaneous truths:

- market movement often incorporates information;
- short-run movement can also overreact and partially reverse.

Therefore:

> **More steam is not automatically more truth.**

---

## 40.2 Movement-path features

Where available, Betting Edge should prefer a movement path over a single open/current delta.

Useful features include:

- direction;
- magnitude;
- timing;
- sequence;
- reversal;
- book agreement/disagreement;
- time since major move;
- known information catalyst.

---

## 40.3 History Fit use

History Fit may say that a move fits a documented research mechanism.

It should not claim that the current move will reverse merely because reversal exists in aggregate research.

---

# 41. Live-Market Research Contract

## 41.1 Pregame prior remains important

Research Library evidence supports using pregame market calibration as a strong prior for live probability models.

Live state should update that prior rather than discard it.

---

## 41.2 Surprise and time-since-event

Live markets may react differently to:

- expected scoring/information events;
- highly surprising events;
- clean objective news;
- ambiguous events;
- events near market expiry.

Time since event matters.

---

## 41.3 Live History Fit

A live History Fit explanation should focus on the relevant market mechanism, not merely quote pregame historical trends.

If no live-specific prior exists, say so.

---

# 42. Research Library Maintenance Model

## 42.1 Maintenance is deliberate, not continuous mutation

The Research Library should be updated through deliberate research passes.

A live Betting Edge run must not rewrite the library.

---

## 42.2 Trigger for new research

After the v1.6 broad search closure, new research should normally be triggered by:

- a specific Betting Edge question;
- repeated model failure;
- a new market class;
- a material rule/scoring/market-structure change;
- conflicting existing priors;
- new high-quality publication;
- evidence that a current prior no longer transports.

Avoid endless generic literature hunting without a decision question.

---

## 42.3 Library versioning

Research Library versioning is independent from contract versioning.

Example:

- Contract: `v0.7`
- Research Library: `v1.7`

A report should eventually be able to identify both when authoritative readback is activated.

---

# 43. Research Library Provenance

## 43.1 Minimum provenance for an applied prior

Where practical, internal audit data should preserve:

- `priorId`;
- research library version;
- evidence tier;
- confidence;
- source IDs;
- sample era/transportability;
- candidate applicability class;
- report lane/time.

The terminal card does not need to display all of this.

---

## 43.2 Provenance and concise UI can coexist

The UI can show:

> **HISTORY FIT: B+ — SUPPORTIVE WITH CAUTION.** Modern movement research supports watching reversal path, but it is not a mechanical fade signal.

while internal audit metadata preserves the exact prior/source references.

Clarity should not require losing provenance.

---

# 44. Research Library Permission Model

## 44.1 Runtime read requirement

Routine report generation using the Research Library should require **read access only** to the approved canonical research artifacts.

It should not require permission to modify:

- the research library;
- the contract;
- workflows;
- runner code;
- odds-refresh code;
- scheduler/canary definitions;
- live odds;
- user ledger.

---

## 44.2 Manual upload is compatible with the design

The user may manually upload approved Research Library artifacts to the repository.

Once present, report generation can read them without runtime write authority.

This is a materially simpler integration boundary than Shadow History persistence.

---

## 44.3 Read failure

If Research Library retrieval fails after read-only integration is activated:

- current price analysis may still proceed if all core report gates pass;
- History Fit should be marked unavailable rather than fabricated;
- the failure should not be confused with FEED STALE;
- no research prior should be reconstructed from vague memory if authoritative library read is required by the active mode.

Recommended state:

**HISTORY LIBRARY UNAVAILABLE**

This is an analytical-context degradation, not automatically a price-validation failure.

---

# 45. Shadow History — Reclassified Future Layer

## 45.1 New role

Shadow History remains a potentially valuable future feature, but it is no longer the centerpiece of near-term historical calibration.

Its future purpose would be to create **Betting Edge-specific prospective evidence** about serious candidates.

Examples:

- BET/LEAN/WAIT/PASS candidates at decision time;
- issued fair value and `playTo`;
- later market movement;
- closing-line value;
- decision blockers;
- outcomes and postmortem classification.

---

## 45.2 Shadow History is not required for Research Library use

The Research Library can be integrated read-only without:

- candidate persistence;
- GitHub runtime writes;
- JSONL partitions;
- database storage;
- enrichment records;
- write idempotency;
- concurrent-write handling.

This is the central sequencing correction in V0.7.

---

## 45.3 Shadow History remains optional

Even if a safe write path later becomes available, Shadow History should be activated only if it demonstrates incremental value.

Possible value tests include:

- better calibration of near-threshold decisions;
- better understanding of WAIT resolution;
- stronger forward CLV assessment;
- identification of Betting Edge-specific systematic errors;
- sport/market calibration where external literature is genuinely thin.

If the value is small relative to complexity, it may remain inactive.

---

# 46. Future Shadow History Safety Contract

## 46.1 Preserve useful V0.6 principles

V0.7 retains the following V0.6 Shadow History principles for future use:

- decision-time observations must remain immutable;
- later information must be stored separately;
- closing market and final result must not rewrite the original decision;
- candidate identity must distinguish materially different markets;
- quote identity must distinguish sportsbook/time/line/price;
- duplicate writes must be prevented;
- persistence failure must not suppress an otherwise valid Betting Edge report;
- Shadow findings must not automatically become production rules.

---

## 46.2 Future identity model

If Shadow History is eventually activated:

### `candidateKey`

Represents the analytical bet identity:

- event;
- market class;
- selection;
- line/threshold;
- scope;
- player identity where applicable.

### `quoteKey`

Represents one executable quote:

- `candidateKey`;
- sportsbook;
- quote timestamp;
- exact line/threshold;
- exact price.

This remains a sound V0.6 design and is preserved.

---

## 46.3 Future persistence only after explicit approval

No Shadow History write path is approved merely by this draft.

Activation requires:

- a persistence destination;
- scoped permissions;
- duplicate/idempotency design;
- concurrency handling;
- failure isolation;
- rollback;
- regression testing;
- explicit user approval.

---

# 47. Research Library vs Shadow History

| Question | Research Library | Shadow History |
|---|---|---|
| Available now? | Yes, as existing curated packages | No persistent collector yet |
| Requires runtime writes? | No | Yes, once activated |
| Primary content | External research priors/mechanisms | Betting Edge's own prospective observations |
| Best near-term use | History Fit / uncertainty / guardrails | Future local calibration |
| Can create BET alone? | No | No |
| Can replace current price? | No | No |
| Can be used before persistence bridge? | Yes | No |
| Main risk | stale/indirect/overfit research interpretation | write complexity, leakage, data quality |
| Current V0.7 priority | High | Deferred / optional |

---

# 48. Historical Evidence Precedence

When historical evidence families disagree, use the following order of responsibility:

1. **Current hard gates and price truth** — always first;
2. **current fair-value/matchup analysis**;
3. **direct applicable Research Library evidence**;
4. **same-day market lineage as current context**;
5. **personal ledger as separate user filter**;
6. **future Shadow History only after approved readback**;
7. **named expert/context evidence**.

This is not a rigid weighting formula.

It is a guard against letting weaker historical context override current validated reality.

---

# 49. Formal Architecture Separation

V0.7 expands the architecture to make the historical-evidence boundaries explicit.

Betting Edge should be treated as cooperating layers with deliberately narrow responsibilities:

1. **CONTRACT** — global governance, hard gates, decision semantics, validation, historical-evidence rules, compatibility requirements.
2. **LANE** — purpose of the specific report window such as 06:00, 08:00, 09:30, 15:15, or 18:15.
3. **SCHEDULER** — determines when a lane is triggered; does not handicap.
4. **MARKET DATA** — current odds snapshots, quote timestamps, market identity, source/book metadata.
5. **RESEARCH LIBRARY** — read-only external research priors, mechanisms, evidence strengths, gaps, and provenance.
6. **PERSONAL LEDGER** — separate user-specific settled wager and behavior history.
7. **SHADOW HISTORY** — optional future prospective Betting Edge candidate evidence, inactive until persistence is deliberately approved.
8. **RUNNER** — presentation, local session history, repricing/comparison; not an independent handicapper.

The default design rule becomes:

> **Global rules belong in the contract; lane intent belongs in the lane definition; timing belongs in the scheduler; current prices belong in market data; research priors belong in the Research Library; personal behavior belongs in the ledger; future proprietary observations belong in Shadow History; presentation belongs in the runner.**

This separation is intended to prevent duplicated logic and semantic drift.

---

# 50. Authoritative Contract Loading

## 50.1 Draft state

While the contract filename contains `DRAFT`, report generation must not assume it is authoritative unless a test or manual instruction explicitly names that draft.

Uploading:

`BETTING_EDGE_CONTRACT_DRAFT_v0.7.md`

to the repository alone must not alter production behavior.

---

## 50.2 Future production state

After explicit approval, an authoritative production contract may use:

`BETTING_EDGE_CONTRACT.md`

A contract-driven run may then:

1. retrieve the approved contract;
2. verify approved version/provenance;
3. apply global hard gates;
4. apply lane purpose;
5. retrieve current market data;
6. retrieve approved Research Library artifacts if the research track is active;
7. perform analysis;
8. validate decision/stake/payload;
9. deliver the report.

---

## 50.3 Contract retrieval failure

Until deterministic fallback behavior is separately approved:

- inability to retrieve the authoritative production contract is a `POLICY BLOCK` for contract-dependent automated issuance;
- do not silently substitute an unknown remembered version;
- manual recovery may deliberately name a known approved contract version.

A draft retrieval failure cannot affect production while the draft is non-authoritative.

---

# 51. Contract and Research Provenance

## 51.1 Contract provenance

Future reports generated under an authoritative contract should be able to identify:

- `contractVersion`;
- `contractPath`;
- repository branch or immutable commit SHA where practical;
- optional contract hash;
- lane;
- report timestamp;
- feed `generatedAt`.

---

## 51.2 Research provenance

When Research Library readback becomes active, internal report provenance should additionally support:

- `researchLibraryVersion`;
- research artifact path/commit where practical;
- applied `priorId` values for serious displayed candidates;
- evidence tier/confidence where used;
- research retrieval status.

---

## 51.3 No provenance bloat requirement

These fields do not all need to be visible in the terminal URL payload.

Auditability may live in compact metadata if runner compatibility or URL length makes full detail impractical.

---

# 52. V0.7 Activation Model — Three Independent Tracks

V0.6 used a mostly linear activation model that moved from contract documentation toward Shadow History writes.

V0.7 replaces that with **three independent tracks** because contract governance, Research Library integration, and Shadow History persistence are separate capabilities.

The tracks are:

- **C-track:** Contract activation;
- **R-track:** Research Library activation;
- **S-track:** Shadow History activation.

A system may advance on one track without advancing on the others.

Example:

> `C0 / R3 / S0` can mean the current self-contained production prompts remain authoritative, the Research Library is used read-only for History Fit, and Shadow History remains inactive.

This is intentionally allowed.

---

# 53. C-Track — Contract Activation

## C0 — DOCUMENTATION ONLY

- V0.7 draft exists;
- no production consumer;
- no behavior change.

## C1 — MANUAL CONTRACT READ TEST

- selected manual/test runs read V0.7;
- scheduled production prompts remain unchanged;
- compare validation and reasoning behavior.

## C2 — AUTHORITATIVE READ-BEFORE-RUN

- approved production contract becomes authoritative;
- scheduled prompts may become compact lane triggers;
- equivalence testing completed.

## C3 — DETERMINISTIC VALIDATION SUPPORT

- appropriate hard gates are machine-validated where practical;
- adaptive handicapping remains flexible;
- contract version/provenance is auditable.

Movement requires explicit approval and regression testing.

---

# 54. R-Track — Research Library Activation

## R0 — EXISTING PACKAGES / NO PRODUCTION READBACK

- v1.0–v1.6 Research Library packages exist;
- available for manual analysis/audit;
- production report does not rely on them automatically.

This is the current conceptual starting point.

---

## R1 — CANONICALIZATION

- merge/normalize 96 logical items into canonical prior records;
- build source registry;
- normalize taxonomy;
- preserve original package provenance;
- identify duplicates/updated syntheses;
- mark research gaps explicitly;
- no production behavior change.

---

## R2 — MANUAL READ TEST

- selected manual/test reports retrieve the canonical library;
- construct History Fit using V0.7 rules;
- compare with current qualitative History Fit;
- check wordiness, relevance, false specificity, and retrieval quality;
- no automatic production dependency yet.

---

## R3 — CONTROLLED READ-ONLY REPORT INTEGRATION

- scheduled/manual reports read approved Research Library artifacts;
- the provisional current handicap (fair value, `playTo`, status, and stake) is formed independently before Research Library interpretation;
- History Fit is generated from those artifacts as the library's view of that candidate;
- research may trigger an explicit re-check of the live thesis, but must not silently rewrite the provisional recommendation;
- runtime writes are not required;
- library failure degrades History Fit only, unless future policy says otherwise;
- current hard gates remain unchanged.

---

## R4 — MATURE RESEARCH LIBRARY

- versioned canonical library;
- verified source registry;
- targeted maintenance process;
- source/prior provenance;
- conflict/era handling;
- monitored effect on report quality;
- no automatic research-based hard-rule promotion.

---

# 55. S-Track — Shadow History Activation

## S0 — INACTIVE

- no persistence required;
- no report dependency;
- preserved as future design option.

## S1 — SCHEMA / OFFLINE PROTOTYPE

- candidate/quote schemas tested offline;
- no production writes.

## S2 — PASSIVE WRITE

- serious candidate observations persisted;
- observations remain advisory/unused by live grades;
- write failure cannot block valid reports.

## S3 — DERIVED SHADOW CALIBRATION

- compact summaries built;
- leakage controls enforced;
- forward CLV/calibration monitored.

## S4 — CONTROLLED SHADOW READBACK

- approved summaries may affect uncertainty/confidence;
- still subordinate to current price/hard gates;
- no automatic rule promotion.

Shadow activation is not required to reach R3 or R4.

---

# 56. Recommended Near-Term Direction

V0.7 recommends the following sequence before revisiting Shadow History:

1. remain `C0` while reviewing this draft;
2. move Research Library from `R0` to `R1` by canonicalizing existing packages;
3. test concise History Fit at `R2`;
4. if output quality is clearly better and operational burden remains low, consider `R3` read-only integration;
5. keep Shadow History at `S0` unless a specific local-calibration problem justifies it.

This sequence uses existing assets and avoids unnecessary write complexity.

---

# 57. Contract-Driven Scheduler Interface

Once C2 is approved, a scheduled prompt should ideally contain only what is unique to that job.

Example lane-specific fields:

- lane/slot;
- label;
- trigger timing;
- authoritative contract location/version policy;
- Research Library policy/version if R3+;
- delivery target;
- truly lane-specific analytical objective.

The scheduler should not duplicate permanent global rules for:

- feed freshness;
- quote freshness;
- market identity;
- `playTo`;
- stake legality;
- risk reconciliation;
- controlled vocabulary;
- payload validation;
- History Fit semantics;
- Research Library guardrails.

---

## 57.1 Migration safeguard

Scheduled prompts must not be shortened until contract read-before-run is tested against the existing self-contained prompts.

During migration:

1. use same lane/snapshot;
2. run current prompt;
3. run contract-driven test;
4. compare hard-gate results;
5. compare candidate identity/current price;
6. compare status/stake/payload;
7. compare History Fit only if the same R-track is active;
8. investigate material differences.

---

# 58. V0.7 Recommendation Data Contract

The current runner-compatible recommendation structure remains valid.

A serious recommendation may contain:

- `status`;
- `title`;
- `meta`;
- `book`;
- `price`;
- `playTo`;
- `fair`;
- `edge`;
- `move`;
- `hist`;
- `stake`;
- `support`;
- `contrary`;
- `source`;
- `analysis`.

V0.7 changes the **semantic expectation** of `hist`, not necessarily the payload schema.

---

## 58.1 `hist` semantics

When R3+ is active:

`hist` should be produced from the approved Research Library process defined in Sections 31–33.

When R3 is not active:

- do not falsely imply authoritative Research Library retrieval occurred;
- existing qualitative historical analysis may remain until deliberately migrated.

---

## 58.2 Optional internal research audit object

A future non-UI/internal object may support:

```json
{
  "researchAudit": {
    "libraryVersion": "1.7",
    "retrievalStatus": "OK",
    "appliedPriors": [
      {
        "priorId": "...",
        "evidenceTier": "A",
        "applicability": "DIRECT",
        "role": "SUPPORT|CONTRARY|CAUTION|GAP"
      }
    ]
  }
}
```

This object is optional and must not be added to the runner payload until URL-size and compatibility are tested.

---

# 59. Research Retrieval Interface Contract

## 59.1 Input

A research retrieval call for a candidate should conceptually include:

```json
{
  "sport": "NHL",
  "league": "NHL",
  "marketClass": "MONEYLINE",
  "scope": "PREGAME",
  "selectionRole": "FAVORITE|UNDERDOG|OVER|UNDER|PLAYER_OVER|...",
  "priceBand": "optional",
  "mechanismTags": ["LINE_MOVEMENT", "REVERSAL"],
  "informationState": ["optional"]
}
```

---

## 59.2 Output

Conceptual retrieval output:

```json
{
  "status": "OK|NO_DIRECT_PRIOR|LIBRARY_UNAVAILABLE",
  "libraryVersion": "1.7",
  "priors": [
    {
      "priorId": "...",
      "evidenceTier": "A",
      "confidence": "HIGH",
      "transportability": "CURRENT",
      "applicability": "DIRECT|PARTIAL|INDIRECT",
      "role": "SUPPORT|CONTRARY|CAUTION|GAP"
    }
  ]
}
```

The final History Fit wording is generated from this evidence, not copied mechanically from a single record.

---

# 60. Degraded-Mode Matrix

| Condition | Core report | Current price BET? | History Fit | Required state |
|---|---|---:|---|---|
| fresh feed + valid quotes + Research Library available | continue | allowed if all gates pass | normal | normal |
| fresh feed + valid quotes + Research Library unavailable | continue | allowed if all core gates pass | unavailable/degraded | `HISTORY LIBRARY UNAVAILABLE` |
| stale feed + Research Library available | current-price analysis degraded | no price-dependent BET | research context may remain but cannot rescue price | `FEED STALE` |
| identity mismatch + library support | blocked for that price-dependent candidate | no | research cannot override | `IDENTITY MISMATCH` |
| fair value unavailable + library support | no BET | no | may show context, not action | `THRESHOLD UNAVAILABLE` |
| no direct research prior | continue | allowed if all other gates pass | `NR` / no direct prior | normal |
| personal ledger unavailable | continue | allowed | History Fit unaffected | personal context unavailable |
| future Shadow write failure | continue if report gates pass | allowed | Research Library unaffected | shadow failure only |

---

# 61. Read/Write Responsibility Matrix

| Component | Routine read | Routine write | Notes |
|---|---:|---:|---|
| authoritative contract | yes if C2+ | no | governance changes deliberate only |
| live odds | yes | no by report generator | odds workflow publishes separately |
| Research Library | yes if R3+ | **no** | read-only report input |
| source registry | yes if R3+ as needed | no | maintained deliberately |
| personal ledger | yes when approved/available | no | separate user history |
| runner | read/use | no | presentation/repricing |
| scheduler | trigger | no | not handicapper |
| Shadow History | optional read at S4 | write only S2+ | future scoped persistence |
| workflows | no routine mutation | no | deliberate change control |

The important V0.7 change is that **Research Library integration has no runtime write requirement**.

---

# 62. Research Library Integration Regression Tests

Before R3 production readback, test at minimum:

## 62.1 Direct match

- exact sport/market prior exists;
- correct prior retrieved;
- History Fit describes it accurately;
- no unrelated generic trend dominates.

## 62.2 No direct prior

- thin market with explicit research gap;
- result is `NR` or cautious indirect context;
- system does not invent a specific trend.

## 62.3 Conflicting priors

- supportive and contrary evidence both exist;
- strongest direct modern evidence identified;
- conflict is summarized rather than hidden.

## 62.4 Era-dependent evidence

- old threshold study plus modern replication/decay evidence;
- History Fit reflects transportability caution.

## 62.5 Duplicate mechanism

- same mechanism appears in multiple library versions;
- not counted as multiple independent confirmations.

## 62.6 Research gap

- player prop / boxing derivative / CFL pregame case;
- adjacent-sport evidence does not silently fill the gap.

## 62.7 Wordiness

- card History Fit remains normally within target length;
- detailed source provenance does not spill into the main card unnecessarily.

## 62.8 Decision independence

- same candidate with and without Research Library context;
- core price/identity/stake gates remain identical;
- provisional fair value, `playTo`, status, and stake do not change solely because the History Fit grade changes;
- if research triggers a re-evaluation, any changed recommendation is traceable to explicit current-evidence reasoning rather than the grade itself;
- Research Library cannot manufacture a BET after a failed hard gate.

---

# 63. V0.7 Acceptance Test Matrix

## Contract

- draft has no production effect by upload alone;
- version correctly identifies 0.7;
- no section incorrectly states Shadow History is required for historical analysis.

## Pricing

- feed ≤75 minutes;
- exact current quote ≤30 minutes relative to feed snapshot;
- stale context not called executable;
- best eligible user-book price used.

## Decision semantics

- BET/LEAN/WAIT/PASS preserved;
- WAIT vs PASS controlling reason preserved;
- EDGE GONE remains restricted to previously qualifying edge loss;
- price movement and fair-value changes remain distinct.

## Risk

- only BET carries nonzero stake;
- total risk reconciles;
- History Fit grade does not set stake mechanically;
- at R3, History Fit does not silently rewrite fair value, `playTo`, status, or stake.

## Research Library

- 96 existing logical items accounted for during canonicalization;
- source/prior distinction preserved;
- evidence tier and applicability separated;
- gaps remain visible;
- duplicates/updated syntheses not double-counted;
- `hist` meaning matches Research Library view at R3+;
- personal ledger does not silently alter History Fit grade.

## Shadow History

- remains optional at S0;
- no write dependency introduced by Research Library integration;
- future persistence can be disabled independently.

## Runner

- current payload remains valid;
- session switching/repricing unchanged;
- History Fit semantic update does not break rendering.

---

# 64. V0.7 Compatibility Manifest

V0.7 is intended to be compatible with the current Betting Edge production architecture.

Draft creation/upload alone must not change:

- current report times;
- GitHub scheduler/canary behavior;
- `data/live-odds.json` schema;
- odds-refresh workflow;
- primary books;
- feed freshness threshold;
- exact quote freshness threshold;
- BET/LEAN/WAIT/PASS vocabulary;
- controlled price terminology;
- non-BET zero-stake invariant;
- risk reconciliation;
- runner payload requirements;
- runner repricing semantics;
- bankroll handling;
- saved historical reports.

The intended conceptual change is historical-evidence architecture, not production plumbing.

---

# 65. Proposed Future Repository Layout

If later approved, a coherent repository may evolve toward:

```text
BETTING_EDGE_CONTRACT.md

.github/
  workflows/
    odds-refresh.yml
    scheduler-canary.yml
    scheduler-canary-v2.yml

data/
  live-odds.json
  betting-ledger.json
  shadow-history/          # future only if S2+
  calibration/             # future only if justified

research/
  README.md
  research-library.json
  source-registry.json
  history-fit-policy.json
  taxonomy.json
  archive/

index.html
runner.html
run-history.json
```

The `research/` tree is read-only to routine report generation.

The `shadow-history/` tree is not required to exist until S2 is deliberately activated.

---

# 66. Production Cutover Protocol

## Gate 1 — Draft review

- review V0.7 for contradictions;
- confirm Research Library semantics;
- confirm Shadow History reclassification;
- no production change.

## Gate 2 — Research canonicalization

- account for all existing packages;
- build normalized source/prior files;
- verify parseability;
- check duplicate mechanisms and gaps;
- no production readback.

## Gate 3 — Manual History Fit test

- choose representative candidates across sports/markets;
- compare current History Fit with library-driven History Fit;
- evaluate clarity, relevance, word count, and evidence fidelity.

## Gate 4 — Read-only integration test

- selected report reads canonical library;
- no runtime writes;
- failure mode tested;
- runner unchanged.

## Gate 5 — Controlled R3 activation

Only after positive-effect review.

## Gate 6 — Contract activation consideration

C-track may proceed independently after equivalence testing.

## Gate 7 — Shadow History consideration

Only when a specific need and safe persistence boundary justify S-track activation.

---

# 67. Rollback Plan

Every activation step must have a simple rollback.

At minimum:

- R3 Research Library readback can be disabled without changing odds refresh;
- contract-driven scheduler prompts can revert to previous self-contained prompts;
- Shadow History can remain S0 or be disabled independently;
- runner remains usable without Research Library or Shadow History;
- prior reports remain readable;
- known-good production pipeline remains the fallback baseline until a later configuration is explicitly accepted.

---

# 68. Production-Promotion Criteria

No V0.7 component should become authoritative merely because the document is detailed.

Promotion requires evidence that the proposed component:

- preserves or improves report reliability;
- improves historical explanation quality;
- does not manufacture false precision;
- does not make cards excessively wordy;
- does not allow research priors to override price truth;
- preserves adaptive handicapping;
- does not introduce unacceptable latency;
- does not create unnecessary permissions or writes;
- preserves runner compatibility;
- preserves stake/risk invariants;
- can identify the exact contract/research version used;
- passes the Positive-Effect Test.

---

# 69. V0.7 Change Record — Historical Architecture Correction

## Problem identified

V0.6 devoted extensive architecture to Shadow History persistence before establishing the Research Library as the primary immediately usable historical evidence layer.

## User-facing clarification

The History Fit box is intended to answer:

> **How does the Betting Edge Research Library view this pick?**

The answer should be concise but substantive.

## V0.7 decision

- Research Library becomes primary historical research lens;
- History Fit grade belongs to Research Library interpretation;
- personal ledger is separate and secondary;
- same-day lane history remains current market lineage, not Research Library history;
- Shadow History becomes optional future proprietary calibration;
- Research Library integration is read-only and does not require runtime writes;
- at R3, Research Library output is an independent History Fit lens rather than a hidden component of fair value or BET qualification;
- Shadow write architecture is retained only as future design, not near-term dependency.

## Intentionally unchanged

- price truth;
- feed and quote freshness;
- hard gates;
- decision vocabulary;
- staking contract;
- runner comparison behavior;
- current production schedule;
- manual upload/change-control preference.

---

# 70. Research Library Canonicalization Checklist

Before declaring R1 complete, verify:

1. v1.0 28 items accounted for.
2. v1.1 13 additions accounted for.
3. v1.2 12 additions accounted for.
4. v1.3 15 additions accounted for.
5. v1.4 10 additions accounted for.
6. v1.5 10 question resolutions accounted for.
7. v1.6 8 final gap resolutions accounted for.
8. Total logical source-set items reconciles to 96 before deduplication/consolidation.
9. Updated syntheses are linked to earlier priors rather than counted as independent votes.
10. Source identifiers are preserved where available.
11. Unverified bibliographic metadata remains labeled, not guessed.
12. Evidence tiers normalized.
13. Sport/league taxonomy normalized.
14. Market-class taxonomy normalized.
15. pregame/live scope normalized.
16. research gaps retained explicitly.
17. era/transportability status represented.
18. practitioner evidence separated from peer-reviewed evidence.
19. current Research Library version assigned.
20. canonical JSON parses successfully.

---

# 71. Research Library Quality Checklist for a Candidate

Before using a prior in History Fit, ask:

1. Is the sport match direct?
2. Is the market-class match direct?
3. Is pregame/live scope correct?
4. Is the relevant line/threshold structure comparable?
5. Is the source evidence level known?
6. Is the finding replicated or single-study?
7. Is the era reasonably transportable?
8. Is the same mechanism already represented by another retrieved prior?
9. Is there meaningful contrary research?
10. Is the prior directional, methodological, cautionary, or merely a gap?
11. Can its implication be stated without inventing a current edge?
12. Can History Fit remain concise?

If these questions cannot be answered responsibly, lower confidence or use `NR`.

---

# 72. Open Research Library Questions After V0.7

These are targeted next questions, not a request for another generic literature sweep:

1. Which of the 96 existing logical items are duplicates, superseded syntheses, or distinct mechanisms?
2. Which source records still need bibliographic verification?
3. Which priors are suitable for direct R3 History Fit use versus research-only context?
4. Should History Fit use only letter grades, or letter grade plus a fixed verdict vocabulary?
5. Should the terminal retain the label `HISTORY FIT` or eventually rename it `RESEARCH FIT` while keeping payload compatibility?
6. What is the cleanest canonical taxonomy for market classes across sports?
7. Which old findings are still structurally useful but quantitatively non-transportable?
8. Which exact markets justify local calibration because the external library has declared a true gap?
9. Can Research Library retrieval remain fast and compact enough for scheduled reports?
10. Does library-driven History Fit materially improve user understanding without changing decision quality in harmful ways?

---

# 73. Freeze Principle Before Any V0.7 Activation

Do not combine this historical-architecture correction with unrelated UI, scheduler, odds-workflow, or runner changes.

Before activating any V0.7 feature:

- preserve the known-good production baseline;
- make one change family at a time;
- use manual upload/change control unless explicitly changed;
- verify resulting behavior;
- retain a rollback route.

Research Library integration should be treated as a read-only analytical enhancement, not an excuse to reorganize the working production pipeline.

---

# 74. V0.7 Production-Readiness Objective

V0.7 is successful if Betting Edge can eventually do the following reliably:

1. obtain a valid current price;
2. build a defensible current fair-value case;
3. make a disciplined BET/LEAN/WAIT/PASS decision;
4. explain the strongest support and contrary evidence;
5. consult the approved Research Library for the most relevant historical mechanism;
6. render a concise, truthful History Fit explanation;
7. keep personal ledger evidence separate and proportionate;
8. preserve same-day market lineage as current context;
9. operate with no Shadow History write dependency;
10. add future proprietary calibration only if it demonstrably earns its complexity.

---

# 75. Governing Principle

Betting Edge should be:

> **Rigid about data validity, market identity, price truth, staking safety, terminology, payload integrity, and research provenance — but flexible about how genuine betting value is discovered.**

For historical evidence specifically:

> **Research Library first; personal history separate; current market truth primary; Shadow History only when it becomes useful and safely collectible.**

That is the central V0.7 correction.


# 76. Audited Research Source-Set Inventory

This appendix records the logical IDs/questions/areas present in the existing v1.0–v1.6 Research Library packages before canonical deduplication. Its purpose is reconciliation, not production weighting.

## betting-edge-research-prior-library-v1.0

Count: **28**

- `method_no_vig_normalized_probabilities`
- `market_efficiency_general`
- `favorite_longshot_general`
- `consensus_beats_individual_book`
- `closing_line_information`
- `mlb_reverse_flb`
- `mlb_public_fading`
- `mlb_intraday_line_movement`
- `nba_point_spread_closing_efficiency`
- `nba_player_absence`
- `nba_totals_high_total_anomaly`
- `nba_early_season_totals`
- `nfl_point_spread_efficiency`
- `nfl_divisional_games`
- `nfl_weather_acclimatization`
- `nfl_reverse_line_context`
- `nhl_reverse_flb`
- `nhl_current_gap`
- `tennis_flb`
- `tennis_market_structure`
- `mma_efficiency_2026`
- `boxing_sparse_literature`
- `cfl_sparse_literature`
- `soccer_flb`
- `soccer_exchange_vs_book`
- `soccer_asian_handicap`
- `live_betting_information`
- `calibration_over_accuracy`

## betting-edge-research-prior-library-v1.1-expanded

Count: **13**

- `nhl_efficiency_reexamination_2004`
- `nhl_reverse_flb_2011`
- `nfl_recent_inefficiency_shank`
- `home_field_cross_sport`
- `margin_miscalculation`
- `bookmaker_grid_structural_flb`
- `inplay_surprise_news`
- `market_price_time_to_expiry`
- `odds_only_calibration_methods`
- `mlb_intraday_inefficiency_2024`
- `soccer_41_bookmaker_efficiency`
- `soccer_multileague_efficiency`
- `favorite_longshot_mechanism_review_2026`

## betting-edge-research-prior-library-v1.2-more-sources

Count: **12**

- `cfl_ingame_win_probability_2015_2019`
- `cfl_official_live_data_ecosystem`
- `ufc_calibration_win_vs_props`
- `mma_markov_model_vs_books`
- `tennis_buzz_replication_warning`
- `soccer_bookmaker_bias_mechanism_2023`
- `nfl_market_learning`
- `nba_totals_replication_shift`
- `nba_early_season_learning`
- `crosssport_accuracy_vs_calibration`
- `college_moneyline_flb`
- `home_field_not_universal`

## betting-edge-research-prior-library-v1.3-thin-markets

Count: **15**

- `nhl_totals_market_2018`
- `nhl_information_effects_2013`
- `nhl_2015_2021_model_test`
- `nfl_inefficiency_decay_1997`
- `nfl_objective_information_2006`
- `nfl_home_dog_weak_evidence`
- `player_props_nfl_four_books_2024`
- `player_props_research_gap`
- `prop_integrity_risk`
- `boxing_market_literature_gap_v2`
- `boxing_derivatives_separate`
- `cfl_pregame_research_gap_v2`
- `cfl_live_market_prior`
- `pandemic_regime_warning`
- `live_liquidity_execution`

## betting-edge-research-prior-library-v1.4-classics-and-mechanisms

Count: **10**

- `levitt_bookmaker_behavior_2004`
- `shin_insider_odds_1991`
- `forrest_goddard_simmons_2005`
- `dixon_pope_2004`
- `spann_skiera_tipsters_markets_2009`
- `zuber_gandar_bowers_1985`
- `sauer_brajer_ferris_marr_1988`
- `woodland_woodland_mlb_update_2003`
- `hvattum_arntzen_2010_elo`
- `klaassen_magnus_tennis_forecasting`

## betting-edge-research-prior-library-v1.5-question-resolution

Count: **10**

- `Modern NHL: is there useful recent market-movement evidence?`
- `Modern NHL totals: is the literature stronger than we thought?`
- `CFL pregame: do we have a full efficiency literature?`
- `Boxing: is there any serious odds-based academic work at all?`
- `Player props: is there strong peer-reviewed calibration research?`
- `Live betting: should we assume prices incorporate new information instantly?`
- `Should live models be anchored to pregame market information?`
- `Can sportsbook line movement itself overreact?`
- `Do statistical betting models need to maximize pick accuracy?`
- `Are player/micro props unusually sensitive to integrity risk?`

## betting-edge-research-prior-library-v1.6-final-gap-resolution

Count: **8**

- `CFL pregame`
- `CFL live`
- `Boxing fight winner`
- `Boxing method/round/total-round derivatives`
- `Player props`
- `Micro-props`
- `Modern NHL/NFL/NBA line movement`
- `De-vig methodology`

---

# 77. Final V0.7 Review Rule

Before this draft is considered complete enough for any integration test, perform one full read looking specifically for:

- contradictions between early global rules and later Research Library rules;
- any statement that accidentally makes Shadow History a prerequisite;
- any statement that lets History Fit determine BET status mechanically;
- any statement that mixes personal ledger results into the Research Library grade;
- any runtime write requirement for read-only Research Library use;
- any stale references to a linear Shadow-first activation sequence;
- any new requirement that would break the current runner or scheduler without explicit migration.

If such a contradiction exists, correct the draft before testing rather than relying on interpretation during a live run.

---

# 78. Closing Principle

V0.7 deliberately chooses the lower-complexity path first:

> **Use the research we already have, explain it well, keep the live market primary, and postpone new persistence until it proves necessary.**

