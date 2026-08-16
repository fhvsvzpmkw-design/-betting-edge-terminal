# Betting Edge v0.9 Preflight — 2026-08-15

**Status:** PREP READY / ACTIVATION HOLD  
**Target:** future `BETTING_EDGE_CONTRACT.md` v0.9 production cutover  
**Current draft authority:** NONE — `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md` remains explicitly non-operational  
**Activation hold:** complete the 18:15 LATE / WEST COAST live regression/acceptance sequence before production cutover

This file records the pre-activation equivalence and readiness review. It is an audit/preparation artifact only and does not activate v0.9.

---

## 1. Sources reviewed

- `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md` — inherited execution/hard-gate baseline.
- `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md` — durable-history/provenance delta, still non-operational.
- `BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md` — staged player-prop identity tightening, non-operational until incorporated into production contract.
- `runner.html` — current v1.3 runner.
- `r.html` — compact archive-backed resolver.
- `.github/workflows/odds-refresh.yml` — production odds publication workflow.
- `.github/workflows/odds-history-index.yml` — independent compact odds-history indexer.
- `data/history/odds-index.json` — current compact odds snapshot index.
- `run-history.json` — current issued-report index.
- current 2026-08-15 Evening issued-report archive and Research Fit/provenance sidecar.
- all five active Betting Edge scheduled report task definitions.

---

## 2. Executive preflight result

### READY NOW

The implemented history/share architecture is materially aligned with the v0.9 draft:

- exact issued reports are archived;
- Research Fit/provenance sidecars are present;
- `run-history.json` indexes issued reports;
- full `data/live-odds.json` snapshots remain in Git history rather than being duplicated;
- `data/history/odds-index.json` contains compact Git snapshot provenance;
- `r.html` resolves deterministic compact IDs, validates active report identity, retries publication lag, and hydrates only same-date prior lanes;
- a valid report retains a self-contained long fallback when history publication fails;
- current runner repricing is an overlay and does not mutate the issued recommendation;
- all five scheduled lanes now include the approved player-prop identity rule and require exact structured `rec.feed` identity for displayed player props.

### ACTIVATION HOLD

Do not promote v0.9 before the planned 18:15 live acceptance/regression check. The preferred live sequence in the draft is an Evening + Late pair because it exercises both archive publication and later-lane source-backed lineage/session hydration.

---

## 3. Inherited v0.8 equivalence check

| Inherited behavior | Preflight result | Notes |
|---|---|---|
| 75-minute feed freshness | PASS / unchanged | v0.9 explicitly inherits it; scheduled lanes still require it. |
| 30-minute exact quote freshness | PASS / unchanged | runner constant remains 30 minutes; v0.9 inherits the rule. |
| Bet365 + DraftKings supported pricing | PASS / unchanged | no v0.9 preparation change to books. |
| event/market/selection identity before executable price | PASS / tightened for player props | v0.8 already requires team/player identity; new delta makes exact structured player-prop identity durable through issuance/reprice. |
| fair-value requirement before BET | PASS / unchanged | player identity does not create fair value. |
| `playTo` required | PASS / unchanged | no new exception. |
| non-BET stake = $0 | PASS / unchanged | all five task definitions retain the stake contract. |
| total risk = sum of BET stakes | PASS / unchanged | no history layer may alter it. |
| zero BETs allowed | PASS / unchanged | no forced-action change. |
| fresh Vancouver run timestamp/date integrity | PASS / unchanged | all five lanes retain timestamp integrity gate. |
| runner round-trip payload validation | PASS / unchanged | player-prop payload validation adds identity checks rather than replacing round-trip validation. |
| report schedule | PASS / unchanged | no v0.9 prep change to lane times. |
| odds-refresh request schedule/budget | PASS / unchanged | player-prop preparation did not change odds-refresh logic. |

---

## 4. Player-prop integration readiness

### Existing baseline

v0.8 already requires validation of:

- event identity;
- team/player identity;
- exact market;
- exact selection/side;
- exact prop line where applicable;
- approved sportsbook;
- exact quote freshness;
- no unresolved identity conflict.

### v0.9 tightening staged now

The staged player-prop delta adds:

- explicit current player/team/game participation validation when feed context is insufficient;
- required machine-readable `rec.feed` identity on every displayed player prop;
- exact `eventId` + `marketKey` + `side` + `selectionKey` + player label + line/`hdp` where applicable;
- durable preservation of that identity in the archived issued payload;
- no silent substitution to a different player or changed line;
- a later changed line is not treated as an exact reprice of the issued line.

### Runner compatibility

Current `runner.html` already supports this shape:

- structured matching is attempted first when `rec.feed.eventId`, market identity, and side are present;
- exact `selectionKey` is honored when present;
- player/selection label is matched when supplied;
- exact line/`hdp` is required when supplied;
- if the structured event is not found, runner returns an identity mismatch rather than silently substituting a different game;
- title/fuzzy matching remains a fallback only for recommendations without structured feed identity.

**Result:** PASS. No runner rewrite is required for the player-prop identity change.

---

## 5. v0.9 history / delivery readiness

### Odds snapshot history

Current compact odds index has a real successful 2026-08-15 snapshot entry with:

- `generatedAt`;
- Vancouver generation time;
- exact snapshot commit SHA;
- exact blob SHA;
- SHA-256;
- schema / identity schema;
- event count;
- selected sports;
- request usage.

The dedicated index workflow is downstream of a successful odds refresh and does not control publication of `data/live-odds.json`.

**Result:** PASS.

### Issued report archive

The 2026-08-15 Evening lane produced an exact issued report archive and a matching `run-history.json` entry.

**Result:** PASS for one live lane.

### Research Fit / provenance sidecar

The matching Evening sidecar:

- uses schema 2;
- matches slot, label, run timestamp, report path, and `feedGeneratedAt`;
- records v0.9 as non-operational provenance;
- records runner/feed/Research Library/policy/manifest/R2 blob identities;
- keeps Research Fit non-authoritative for pricing/status/stake.

**Result:** PASS.

### Compact resolver

Current `r.html`:

- requires deterministic short-ID format;
- rejects non-unique matches;
- validates report timestamp/slot/feed provenance against index;
- retries bounded GitHub Pages publication lag;
- limits hydrated prior runs to the active report date;
- uses at most the newest valid run per lane;
- treats optional prior-lane fetch failure as non-blocking;
- passes the active archived payload to the existing runner.

**Result:** PASS.

### Stronger H3 acceptance

The draft prefers two different live lanes including a later lane capable of source-backed prior-lineage/navigation testing.

**Result:** PENDING 18:15 live run.

---

## 6. Contract wording reconciliation required at production merge

The current v0.9 draft repeatedly says the issued runner payload shape is unchanged. The player-prop tightening now requires optional `rec.feed` structured identity on player-specific recommendations.

This is compatible with the current runner, but the production contract should not describe it ambiguously.

At production merge, replace the absolute "payload shape unchanged" language with the equivalent rule:

> Core visible recommendation fields and runner behavior remain compatible; player-specific props may additionally carry the runner-supported `rec.feed` structured identity required for exact issuance and repricing integrity.

The production contract must incorporate `BETTING_EDGE_CONTRACT_DRAFT_v0.9_PLAYER_PROP_DELTA.md` before activation.

---

## 7. Scheduler cutover changes — DO NOT APPLY BEFORE ACTIVATION

The five scheduled report tasks currently implement much of the v0.9 behavior directly but still treat v0.9 as a non-operational provenance/reference draft.

On explicit production cutover, update all five lanes so that they:

1. resolve `BETTING_EDGE_CONTRACT.md` from the approved repository/branch before handicapping;
2. verify the production contract declares v0.9 and is operational;
3. resolve the current `runner.html` in the same repository context;
4. stop with `PREFLIGHT BLOCK — ANALYSIS NOT STARTED` if contract/runner authority cannot be resolved;
5. obey the production contract as governing authority rather than reading the v0.9 draft merely for provenance;
6. record the production contract blob SHA in durable provenance;
7. retain all existing live-feed, price, Research Fit, payload, history-failure-isolation, short-link, and player-prop gates.

These changes are intentionally deferred until explicit activation so the 18:15 acceptance run remains on the currently approved operating configuration.

---

## 8. Current runner-version note

The archived 15:21 Evening sidecar identifies the runner blob that existed at that issuance. The current repository runner has since changed because of the approved meter-only UI patch.

That difference is expected historical provenance, not a defect. The 18:15 live acceptance should capture/operate with the current runner and confirm that the meter-only UI change did not regress history, payload, pricing, or structured repricing behavior.

---

## 9. 18:15 final pre-activation acceptance checklist

Before promoting v0.9, verify the 18:15 lane:

1. uses a fresh valid odds snapshot under inherited freshness rules;
2. renders normally on the current runner;
3. retains correct stake/risk reconciliation;
4. preserves player-prop structured identity if any player prop is displayed;
5. archives the exact issued payload;
6. writes the matching Research Fit/provenance sidecar;
7. appends the correct `run-history.json` entry;
8. delivers a resolving compact short link after history success;
9. long fallback represents the same active issued content;
10. can use the actual archived Evening report for source-backed same-day lineage when relevant;
11. can hydrate the valid same-day Evening lane into session navigation;
12. does not hydrate a different betting date;
13. does not let history/share work change or suppress a valid betting decision.

If these pass, v0.9 is ready for explicit production promotion.

---

## 10. Planned production promotion sequence after acceptance

1. Build `BETTING_EDGE_CONTRACT.md` as the v0.9 authoritative production contract, incorporating inherited v0.8 rules, the v0.9 durable-history/provenance delta, and the player-prop identity delta.
2. Mark the production contract operational and record its version/date/provenance.
3. Update the five scheduled lanes to perform contract/runner preflight first and use the production contract as authority.
4. Keep `BETTING_EDGE_CONTRACT_DRAFT_v0.8.md`, `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md`, and the player-prop delta as historical design artifacts; do not delete them.
5. Run the first post-cutover lane and verify contract preflight plus normal report/history/share behavior.
6. Do not bundle the richer lower History-box UI into this production promotion.

---

## Decision

**v0.9 preparation is ready. Production activation remains intentionally held until the 18:15 live acceptance sequence is verified.**