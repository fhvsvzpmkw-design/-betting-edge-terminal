# Novig market-data trial

Started October 9, 2026, with user-authorized NHL moneyline collection. This adds one optional market reference to the existing shared collection after each successful scheduled odds refresh. Existing Bet365/DraftKings execution, Pinnacle benchmark, forecasts, report gates, grading thresholds and stakes keep their authority.

`node tools/novig-market-data.mjs` reads the existing event inventory and public production `/v3/public/catalog` routes. It needs no account credentials, places no orders, consumes no primary odds API quota and makes no model calls. The initial scope is upcoming NHL `MONEY` markets within 48 hours. Requests run one at a time, at most one per second, within a 45-second total budget. A 429 stops all remaining requests for that collection and saves Retry-After; there are no same-run retries. The workflow's optional step cannot block the core collection or odds refresh.

## Captured numbers

- Match both explicit NHL team aliases, exact kickoff, source NHL league/sport and pregame status. Require one unique open two-outcome MONEY market; retain source event, market and outcome IDs. Array order and market description never determine the selected team.
- Each resting order is a bid. The available buy price for a team is `1 - best opposing bid`, with available quantity summed across every order at that opposing price. Retain the team's own bid and bid/ask spread separately. Empty and one-sided books stay explicit; crossed or malformed books are unavailable.
- Prices display as American odds. Raw API quantities stay available for audit. The v3 API documents a 1-cent payout unit, unlike the daily reporting files' $1 contract unit; payout/cost equivalents follow the API definition, not reporting-file quantities.
- Capture up to 20 recent trades with their actual timestamps and the last-trade time. This is a sample, not total volume, trader identity or a smart-money indicator. Failed tape retrieval does not discard a valid book.
- Store book sequence, original observation time, HTTP cache metadata, source fees, void rule and movement from the previous actual capture. Refresh failures retain old observations with their original clocks and an explicit unavailable receipt.

Immutable captures are in `data/novig/captures/`; `data/novig/current.json` is the latest collection. Failed collections cannot replace old quote clocks with a new success time. Publication retries reuse the same candidate bytes and preserve a newer current snapshot.

## Use in report research

The shared dossier pins `gameIntelligenceInputs.novigMarketData` separately from forecast records. NHL moneyline quote dossiers include `supplementalMarketReferences`, with American price, depth, freshness, movement and a descriptive sportsbook payout comparison when both snapshots are fresh. These references have no forecast, execution or decision authority. They never enter model consensus, an EV calculation, candidate grading, the betting ledger or Guy's selection/tracking rules.

Settlement remains `REVIEW_REQUIRED`: the public MONEY label alone does not establish the exact NHL overtime/shootout contract or equivalence between Novig fair-market-value void settlement and a sportsbook refund. Preserve these limitations before analytical adoption. Store market data for the trial now; broader/customer-facing redistribution, source weights and new sports require a separate assessed extension. No affiliate enrolment or commercial data licence is asserted.

## Verification and sources

`node --test tests/novig-market-data.test.mjs tests/game-intelligence.test.mjs` checks bid complements, units, empty books, exact identity, duplicate rejection, clocks, failure retention, historical isolation and separation from forecast/decision authority.

- [Official API specification](https://docs.novig.com/api-reference/spec-files/openapi-v3.json): no-key public catalogue, book and trade routes; cacheable responses.
- [Odds screens](https://docs.novig.com/affiliates/odds-screens): opposing-bid conversion and quantities.
- [Monetary representations](https://docs.novig.com/api/concepts/money): API price strings and payout unit.
- [Contracts](https://support.novig.com/en/articles/16083642-contracts) and [market rules](https://support.novig.com/en/articles/9612523-market-rules): settlement governed by each contract.
