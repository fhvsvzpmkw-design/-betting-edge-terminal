# Bill Weston’s weekly Private Sheet

Bill reviews Graham Mercer’s Private Line across the active NFL week. Preserve the complete premium guest fax, five lounge assets, cream paper, typed hierarchy and blue handwritten notes. Stable character/profile/path and the v3 visual shell remain unchanged.

## Bill’s voice

Bill is a seasoned Vegas sportsbook regular writing personally to returning premium hotel guests. His voice belongs at an upstairs table with a rotation sheet, a coffee and a blue pen. Carry that perspective through every game, the opening memo and the closing remarks. He is warm with guests, unhurried, observant and dryly funny, while remaining exact about Graham’s arithmetic.

Use sportsbook language naturally inside the analysis: laying a number, catching points with the dog, chalk, the hook, juice, pick’em, the board and the window. Make unfamiliar terms clear in context. Let Vegas life appear where it helps the thought—the breakfast rush before eight kickoffs, the ticket writer needing the complete quote, the local club earning no extra points for its zip code. Vary the entries; do not turn sixteen games into the same joke followed by the same warning. Avoid generic gangster dialogue, repeated catchphrases and a list of casino landmarks.

Atmosphere is fictional character flavor, never evidence. Do not invent a call from a bookmaker, a sharp-money move, a betting ticket, a win, a real contact’s tip, betting splits or personnel news. Keep the review substantive and retain the full schedule, numbers, uncertainties and priorities.

A requested voice-only rewrite is a new immutable editorial edition of the same captured board. Preserve its entire `source` object, identify the prior edition and clearly say there are no fresh quotes or personnel updates. Update the character voice here and in the profile so future manual editions retain it. The approved layout, artwork and floating Share control stay as they are.

## Edition cadence

One full opening edition after Graham’s Tuesday baseline. A second, late-week edition is useful only when material personnel information, a changed fair number, a meaningful market change or a schedule correction warrants a revised read. A quiet week needs one edition. Daily Betting Edge reports do not trigger Bill updates.

The first edition covers all 16 Week 1 games. Future editions cover every game in the active-week Graham snapshot, in kickoff order. A late-week refresh retains already-started games as closed historical files; it must never offer their old quotes as current opportunities. Keep the opening memo, schedule workload, change memo, a substantive read and handwritten note per game, and a closing watchlist.

## Source and issue workflow

1. Read this document, Bill’s profile and previous edition. Read the current main-branch `data/walters/nfl/current-week-terminal.json`; verify its season/week against `data/walters/nfl/active-week.json`. Do not switch to Betting Edge cards or independently rebuild Graham’s numbers.
2. Save a new immutable `data/characters/bill-weston/editions/<season>-w<week>-<edition>.json`. Copy the previous edition schema. Record the source commit, SHA-256 of the exact terminal file, generated/research timestamps and the public game fields used by the fax. Preserve each game’s fair number, original fair timestamp, provisional status, Pinnacle observation/status, home-coordinate gap and saved market delta. Do not expose internal research paths or restricted methodology.
3. Write fresh original `reviews` for every game key and the four editorial sections. Attribute the fair to **GRAHAM NUMBER**. Pinnacle is a timestamped benchmark. Bill adds interpretation, questions and priorities; he does not issue BET/LEAN/WAIT labels, invent buying thresholds or create stakes. No new injury assertion without current source evidence. Highlight what changed since the previous edition; close started games explicitly.
4. Use a new actual Pacific `issuedAt` with explicit offset and unique edition ID. Set `editionPath` to that file. Point `data/characters/bill-weston/current-edition.json` at it, then run `node tools/build-bill-weston-weekly.mjs`. The builder preserves the visual shell, renders the full live fax, saves its immutable archive and advances character continuity.
5. Run `node tools/build-bill-weston-weekly.mjs --check` and `node tests/bill-weston-weekly.test.mjs`, then the existing Syndicate completeness check. Commit the edition, pointer, live fax, archive/index and profile together. Use a PR, wait for checks, merge and verify Pages deployment. A failed or unavailable source leaves the last issued edition in place.

The generic `archive-syndicate-hotline.mjs` is for report-session desks; Bill now uses the weekly builder. Do not rewrite the historical August report editions. The August 30 v3 guest presentation is separately retained as `archive/2026-08-30/0930-guest-fax.html`; the original v1 issue stays intact.

The public page is static. Graham may update during the day without changing an issued Bill opinion. A new build must have a new edition ID whenever copy, source or numbers change. Links in archived editions resolve through their archive-specific base URL. The edition source record contains only the public fields used for the review and original editorial copy; its source hash links it to the captured terminal commit.
