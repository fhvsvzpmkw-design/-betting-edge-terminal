# Issued Price Observations

This directory stores small deterministic retrospective price observations for already-issued Betting Edge recommendation cards.

Rules:

- Observations use only odds snapshots already indexed in `data/history/odds-index.json`; they do not request fresh odds.
- Matching is exact: the issued `rec.feed.selectionKey` and the issued sportsbook must match the stored snapshot.
- A comparison snapshot must be generated after the issued run's `feedGeneratedAt` and before that recommendation's scheduled start time.
- The latest eligible stored snapshot is the observation point.
- If no eligible snapshot or exact quote exists, the record remains explicitly unavailable. Do not infer or fuzzy-match a price.
- An observed price is a **last observed pre-start price**, not a verified closing line or formal CLV unless separately established.
- Observations never rewrite the issued status, price, fair value, stake, or analysis.
- Full odds snapshots are not duplicated here; observation records reference their immutable Git blob SHA.

The observer is intentionally lightweight and manual while validated:

`node tools/observe-issued-prices.mjs data/history/runs/YYYY-MM-DD/<run>.json`

No workflow or scheduler is required for the validation phase.
