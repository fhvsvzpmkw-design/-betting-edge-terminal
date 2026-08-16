# Betting Edge v0.9 Player-Prop Identity Delta

**Status:** DRAFT PREPARATION — NON-OPERATIONAL  
**Prepared:** 2026-08-15  
**Applies to:** `BETTING_EDGE_CONTRACT_DRAFT_v0.9.md` preparation only  
**Production effect:** none until an explicit v0.9 production-contract cutover

This delta records the player-prop identity tightening approved during v0.9 preparation. It does not independently activate a new contract and must be incorporated into the final production `BETTING_EDGE_CONTRACT.md` if v0.9 is promoted.

---

## Proposed Invariant 23 — Executable player-prop identity integrity

For every player-specific prop, event identity and selection identity must remain exact from current feed validation through issuance, durable history, and later repricing.

A player prop may not receive `BET` unless all applicable identity elements validate:

1. exact event/game;
2. exact player/participant;
3. current player-to-game/team participation context when the feed alone is insufficient;
4. exact prop market;
5. exact side/selection (`over`, `under`, or other applicable side);
6. exact line/handicap/total where the market has a line;
7. exact approved-book quote meeting inherited freshness requirements.

If player/team/game identity is ambiguous, missing, or conflicting, use `IDENTITY MISMATCH` or `PRICE NOT VERIFIED` / `WAIT` as appropriate and force stake to zero. Analytical confidence may not override this gate.

When the feed alone does not establish the player's current team/game relationship, a current authoritative roster, lineup, injury, transaction, or official game-status source may be used to validate participation context. That external context validates identity only; it does not replace the sportsbook quote in `data/live-odds.json`.

---

## Issued structured identity requirement

Every displayed player-prop recommendation must preserve a machine-readable `rec.feed` object copied from the exact live-odds row used for issuance.

Required fields when available/applicable:

- `eventId`;
- `eventKey`;
- `market`;
- `marketKey`;
- `side`;
- `selectionKey`;
- `label` or player/participant label;
- `hdp` / line when the market has a line.

Minimum hard validation before delivery for a player prop:

- `eventId` present;
- `marketKey` present;
- `side` present;
- `selectionKey` present;
- player/participant label present;
- line/`hdp` present when that market is line-based.

The visible card may remain concise. `rec.feed` is machine identity/provenance, not additional display copy.

---

## Line integrity and repricing

A later different prop line is a different selection for exact comparison purposes.

Example:

- issued: Player X Over 246.5;
- later market: Player X Over 251.5.

The 251.5 quote must not be represented as an exact reprice of the issued 246.5 selection. The original structured identity remains immutable in the issued report.

The current runner already supports structured matching by event, market, selection/player label, side, and exact line when supplied. Structured identity takes precedence over title parsing/fuzzy fallback for recommendations carrying `rec.feed`.

---

## Durable-history treatment

The issued player-prop `rec.feed` object is part of the exact issued payload and therefore inherits v0.9 immutability rules:

- archive it unchanged under `data/history/runs/`;
- do not remove or rewrite it merely because the player changes teams later;
- do not rewrite it because a later sportsbook line differs;
- do not convert a later reprice overlay into decision-time history.

The full historical odds snapshot remains recoverable from Git history of `data/live-odds.json`, so no separate roster database or duplicated full-feed prop archive is required for this v0.9 change.

---

## Scope / non-goals

This delta does **not**:

- increase Odds-API request volume;
- change the odds-refresh schedule;
- change the supported books;
- create a player-roster database;
- activate Shadow History;
- create a player-learning workflow;
- change the lower History-box UI;
- change fair-value, `playTo`, status, or staking methodology;
- weaken the inherited 75-minute feed or 30-minute exact-quote freshness rules.

Future learned player/team associations may be derived from accumulated odds history under separate change control, but they are not required for current player-prop execution.

---

## Production-cutover incorporation rule

Before v0.9 is promoted operationally, the final production contract must incorporate the substance of this delta and resolve any wording that otherwise claims the runner payload shape is wholly unchanged. The intended compatibility statement is:

> Core visible recommendation fields and runner behavior remain compatible; player-specific props may additionally carry the existing runner-supported optional `rec.feed` structured identity object required for exact issuance/repricing integrity.

This delta remains non-operational until that production cutover is explicitly approved.