# VigScope — Brand Architecture

**Last updated:** 2026-08-16  
**Status:** Active product-brand convention

This document defines the public naming hierarchy for the current Betting Edge repository without renaming or breaking the established internal governance, history, storage, or deployment lineage.

## Public identity

- **Brand / product family:** `VigScope`
- **Descriptor:** `Market Intelligence`
- **Studio / company brand:** `VigWire Labs`
- **Primary interface:** `VigScope Terminal UI v1.3`

Preferred splash hierarchy:

```text
VIGSCOPE
MARKET INTELLIGENCE
POWERED BY VIGWIRE LABS
```

Preferred terminal identity:

```text
VIGSCOPE TERMINAL UI v1.3
```

## Version boundary

The VigScope naming change is a branding change only. It does **not** increment the terminal software version.

- Terminal/UI version remains **v1.3**.
- Production governance remains **BETTING_EDGE_CONTRACT.md v0.9 OPERATIONAL**.
- Research Library production/staging versions are unaffected by the brand change.

A future UI version increment should represent an actual interface or runtime change, not a naming-only substitution.

## Internal continuity

The public rebrand does not require renaming established internal technical identifiers. Preserve these unless a separately approved migration is designed:

- repository name: `fhvsvzpmkw-design/-betting-edge-terminal`;
- production contract and historical Betting Edge governance documents;
- archived report/history paths and issued payloads;
- deterministic short-link identifiers;
- legacy browser storage keys such as `bettingEdge.runnerHistory.v1.3` and `bettingEdgeBooks`;
- historical Git commits, acceptance records, source material, and provenance records.

Those identifiers are continuity mechanisms, not current public-facing brand copy.

## Naming roles

**VigScope** is the visible market-intelligence product identity.  
**Market Intelligence** describes the product category.  
**VigWire Labs** is the studio/company identity behind VigScope.  
**VigScope Terminal UI** is the primary user-facing terminal interface.

“Betting Edge” remains valid where it refers to the repository lineage, production governance contract, historical project records, issued-report infrastructure, or other existing internal technical objects. New user-facing interface copy should use the VigScope hierarchy unless a specific product/module is intentionally given its own name.

## Legal-status boundary

`VigWire Labs` is the selected working company/studio brand. This repository convention does not itself constitute a B.C. business-name reservation, incorporation, or Canadian trademark clearance. Formal legal registration/clearance remains a separate process.
