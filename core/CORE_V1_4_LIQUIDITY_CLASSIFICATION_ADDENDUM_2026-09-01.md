# Betting Edge Core 1.4 — Liquidity Classification Addendum

**Date:** 2026-09-01  
**State:** OPERATIONAL CLARIFICATION  
**Applies to:** Core 1.4 candidates produced after this clarification  
**Machine authority:** `core/core-liquidity-classification-v1.4.json`

## Purpose

This addendum clarifies Core 1.4 Section 1.5, **Tail and liquidity awareness**, after the September 1, 2026 15:15 report exposed a context-classification defect in which nine mainstream MLB full-game moneylines were labeled `THIN`.

The defect was not in the Core model-error evaluator itself. Core correctly applied the `thin-liquidity` rule to the context it was given. The defect was that the upstream context builder treated execution-book availability and other uncertainty as evidence that the underlying MLB market was structurally thin.

Issued reports remain immutable. The September 1 15:15 report is preserved as issued and is used as a regression/audit case only.

---

## 1. LiquidityRisk means structural market liquidity

`liquidityRisk` describes the underlying competition and exact market structure. It is **not** a count of fresh sportsbook quotes and it is not a substitute for other Core uncertainty dimensions.

The following are separate from liquidity classification and may not, by themselves, justify `THIN`:

- only one fresh Bet365 or DraftKings quote;
- one execution book being absent or stale;
- Pinnacle being unavailable or unmatched;
- unresolved lineup, starter, role, bullpen or personnel information;
- large positive or negative American odds by themselves.

Those conditions retain their own execution, personnel, price-quality, freshness or model-error treatment.

---

## 2. Deterministic MLB primary-market classification

For standard pregame MLB full-game primary markets, Core 1.4 requires:

| Market | Required `liquidityRisk` |
|---|---|
| Full-game moneyline | `NORMAL` |
| Full-game run line / spread | `NORMAL` |
| Full-game total | `NORMAL` |

These are mainstream primary markets and must not be classified `THIN` merely because the currently executable feed exposes only one supported book or because personnel information remains unresolved.

MLB player props, alternates and other derivatives are **not** covered by this deterministic primary-market rule. They continue to require exact-market structural classification under Core 1.4.

---

## 3. When `THIN` is valid

`THIN` requires affirmative structural evidence that the exact competition or market is meaningfully less liquid or robust than a mainstream primary market. Valid evidence may include:

- a niche or low-turnover competition;
- a fragile derivative or alternate market;
- documented sparse market-making or materially restricted market depth.

If structural liquidity cannot be established for a market outside deterministic scope, use `UNKNOWN` rather than inferring `THIN` from quote availability.

---

## 4. Relationship to model error

The Core 1.4 `thin-liquidity` base rule remains valid. When a market is legitimately `THIN`, it may raise the model-error floor to `ELEVATED`.

The correction is to the **classification feeding that rule**, not to the rule itself.

Example: a mainstream MLB full-game moneyline with unresolved final lineups may still be `ELEVATED` because `personnelSensitivity=UNRESOLVED`, while its `liquidityRisk` remains `NORMAL`. Once personnel resolves, the candidate may return to `STANDARD` if no other Core rule requires a higher floor.

This prevents double-purpose labels and preserves the distinction between:

- structural liquidity;
- personnel uncertainty;
- exact-market calibration;
- book dispersion;
- tail risk;
- executable quote availability.

---

## 5. Production enforcement

This clarification is operationally enforced by:

- `core/core-liquidity-classification-v1.4.json` — canonical liquidity policy;
- `core/core-v1.4-production.json` — pins the policy into production Core 1.4;
- `tools/core-liquidity-classification.mjs` — deterministic classifier/auditor;
- `tools/core-assessment-trace-gate.mjs` — rejects future Core contexts that violate deterministic liquidity rules;
- `.github/workflows/core-liquidity-classification-v14.yml` — regression and immutable-history audit.

The September 1 regression explicitly verifies that all nine 15:15 MLB primary moneylines would now be identified as classification defects while the issued historical report remains untouched.

---

## 6. Governing interpretation of Core 1.4 Section 1.5

Section 1.5 of the original Core 1.4 Consolidation Plan remains correct in principle: extreme prices, genuinely thin competitions and fragile derivative markets deserve wider uncertainty treatment.

This addendum governs the operational interpretation:

> **Liquidity is structural market evidence, not sportsbook availability. Mainstream MLB primary game markets are `NORMAL` unless a later governed policy explicitly establishes otherwise.**

Any later expansion or change to deterministic liquidity classes must be versioned, pinned in the Core 1.4 production manifest (or a successor Core version), regression-tested, and applied prospectively without rewriting issued history.
