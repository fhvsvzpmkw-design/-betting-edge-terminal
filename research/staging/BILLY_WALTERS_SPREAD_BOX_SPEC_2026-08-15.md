# Betting Edge — Billy Walters Spread Box Specification

**Date:** 2026-08-15  
**State:** STAGING DESIGN ONLY — NO PRODUCTION AUTHORITY  
**Working name:** `BILLY WALTERS // SPREAD`  
**Primary initial sport:** NFL  
**Production Research Library:** v1.7 unchanged  
**v1.8 candidate:** frozen / promotion hold unchanged

## Purpose

Create a dedicated Betting Edge analysis box that isolates and operationalizes the sports-betting methodology described in Billy Walters' *Gambler*, especially Chapters 21 (`Master Class`) and 22 (`Advanced Master Class`), with emphasis on football point-spread handicapping and against-the-spread decision structure.

This module is intended to be a transparent specialist lens, not an automatic bet engine and not an extra vote that can bypass current Betting Edge gates.

## Source boundary

The module may contain:

- structured summaries of Chapter 21 and Chapter 22 concepts;
- derived formulas, normalized factor definitions and Betting Edge implementations;
- independently reconstructed charts/tables from lawful source data;
- user-supplied excerpts, photos or scans analyzed for exact factor values and chart structure;
- source references and provenance.

The repository should not store unauthorized full chapter text or copied book-page graphics. Exact graph/table reconstruction should be based on user-supplied pages or independently sourced/derived data, with provenance recorded.

## Core Billy Walters spread workflow

1. Establish an independent neutral-field team power rating before looking for a wager.
2. Update ratings incrementally rather than overreacting to one game.
3. Convert relevant player availability and effectiveness into point-value adjustments.
4. Account for clustered injuries / position-group depth effects when evidence supports it.
5. Apply home-field adjustment using current, league-appropriate calibration rather than a permanent fixed assumption.
6. Apply game-specific situational factors: rest, travel, schedule sequencing, venue/surface, weather and other historically supported special situations.
7. Produce an independent projected spread / predicted game state.
8. Compare the independent line with the live sportsbook spread.
9. Measure the difference while respecting NFL key numbers and unequal half-point value.
10. Compare point spread versus moneyline when both are viable expressions of the same team view.
11. Shop Bet365 / DraftKings and any later approved books for the best executable number.
12. Apply timing logic only as a market-execution consideration, not a standalone edge.
13. Size only after edge, uncertainty and bankroll constraints are known; current Betting Edge risk gates remain authoritative.
14. Record the closing outcome and CLV later without rewriting the original issued analysis.

## Required subcomponents

### BW-1 — Power ratings

Display:

- team A neutral rating;
- team B neutral rating;
- raw rating differential;
- prior-week rating;
- current update amount;
- confidence / uncertainty note.

The module must preserve the distinction between a team-strength rating and a market-betting edge.

### BW-2 — Player / injury value

For material players record:

- player;
- position;
- expected participation;
- effectiveness if playing hurt;
- estimated point impact;
- replacement quality;
- position-group cluster impact;
- uncertainty.

No injury headline becomes an automatic side signal.

### BW-3 — Game factors

Structured factor families:

- home field;
- rest / short week;
- travel / time-zone burden;
- prior-game / schedule sequencing;
- weather;
- venue / playing surface;
- coaching / prevent / game-management tendencies;
- emotional / special-situation factors only when historically supported;
- other sport-specific adjustments with explicit provenance.

Every factor requires a numeric adjustment or an explicit `NO ADJUSTMENT / INSUFFICIENT EVIDENCE` state.

### BW-4 — Fair spread build

Show the complete arithmetic path:

`neutral rating differential`
`+ home field`
`+ player/injury adjustments`
`+ game-factor adjustments`
`= Billy Walters fair spread`

The box should expose each component so the user can see exactly where the final number came from.

### BW-5 — Market comparison

Display:

- BW fair spread;
- current best market spread;
- market price / juice;
- difference in points;
- key-number crossings;
- opener and important same-day moves;
- `playTo` boundary;
- spread-vs-moneyline comparison when relevant.

A difference alone is not a BET. Existing Betting Edge price, identity, freshness and risk gates remain controlling.

### BW-6 — Key-number / half-point value table

Dedicated NFL table for the economic value of moving between spread numbers. The table must distinguish ordinary half-points from high-value crossings around common NFL margins.

Exact values should be calibrated to a stated data era / sample and should not be copied blindly from historical book tables.

### BW-7 — Spread versus moneyline table

Reconstruct the decision framework for comparing a point-spread position with the corresponding moneyline price. Store the underlying conversion logic and assumptions, not a screenshot of a copyrighted chart.

### BW-8 — Master Class bankroll / execution rules

Track:

- bankroll;
- current unit;
- proposed units;
- percent of bankroll;
- line-shopping result;
- timing rationale;
- no-chase rule;
- straight-bet preference versus parlay/teaser economics.

Production Betting Edge staking policy remains authoritative even where the Billy Walters framework is shown for comparison.

## Terminal presentation

Proposed compact terminal box:

`BILLY WALTERS // SPREAD`

- `POWER`: raw neutral-field differential
- `PLAYER`: injury / availability adjustment
- `GAME`: home / weather / travel / situational adjustment
- `BW FAIR`: independent final spread
- `MARKET`: best current spread + price
- `EDGE`: point difference with key-number context
- `EXECUTION`: best book / playTo / spread-vs-ML note
- `BW VERDICT`: aligned / marginal / value candidate / no value / insufficient data

The visual treatment may be distinctive, but the box must remain subordinate to the primary Betting Edge recommendation status.

## Relationship to Research Library

The Billy Walters box is a specialist methodology layer, not a canonical Research Library evidence vote.

It must not:

- create a BET by itself;
- override current fair-value gates;
- override exact identity or quote freshness;
- override production `playTo` or stake rules;
- count Chapter 21 and Chapter 22 concepts as multiple independent research sources;
- treat historical factor tables as permanently transportable without recalibration.

## Completeness target

Before calling the module complete:

1. fully map Chapter 21 concepts into structured rules;
2. fully map Chapter 22 football methodology into structured factors;
3. inventory every table / graph / chart used in the two chapters;
4. obtain exact values from lawful source material, preferably user-supplied book pages for any book-specific chart;
5. reconstruct those charts as original Betting Edge tables/graphs with provenance;
6. test a full NFL card in shadow;
7. compare BW fair spreads against actual market closes and current Betting Edge analysis;
8. verify no double counting with Research Fit or same-day market movement;
9. promote only through a separate explicit approval step after the current v1.7 soak / v1.8 hold is resolved.

## Current status

Design checkpoint only. No runner, production contract, scheduled prompt, Research Library manifest or v1.8 candidate file is changed by this specification.
