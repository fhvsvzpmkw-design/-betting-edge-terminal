# Bill Weston’s weekly Private Sheet

Bill reviews Graham Mercer’s Private Line across the active NFL week. Preserve the complete premium guest fax, five lounge assets, cream paper, typed hierarchy and blue handwritten notes. Stable character/profile/path and the v3 visual shell remain unchanged.

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
