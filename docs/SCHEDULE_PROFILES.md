# Betting Edge Seasonal Schedule Profiles

## Purpose

Betting Edge has a hard operational target of five primary Odds-API refreshes per Vancouver operating day. The five pulls should move with the sports calendar rather than remain fixed all year.

The scheduler therefore uses three profiles:

| Profile | Pulse → report pairs (America/Vancouver) | Featured Vig Scope checkpoints |
|---|---|---|
| MLB / SUMMER | 05:45→06:00, 07:45→08:00, 09:15→09:30, 14:55→15:15, 17:55→18:15 | S2, S3, S4 |
| NFL / FOOTBALL | 05:45→06:00, 07:45→08:00, 08:45→09:00, 12:00→12:15, 16:45→17:00 | S3, S4, S5 |
| NBA + NHL / WINTER | 05:45→06:00, 10:45→11:00, 13:45→14:00, 15:45→16:00, 17:45→18:00 | S3, S4, S5 |

These times are planned checkpoints. Actual GitHub execution and report issue timestamps remain authoritative historical facts.

## Daily lock

One Vancouver operating day uses one profile. A profile change is queued for the next eligible 06:00 operating boundary. The selection cutoff is 05:30 so the 05:45 opening odds pulse cannot be split from the 06:00 report it supplies.

Only one profile change is permitted per Vancouver local day. The five-pull cap does not reset or expand when the profile changes.

## Canonical slot translation

Clock times are profile-specific, but the five canonical slot identities are permanent:

1. S1 / open
2. S2 / main
3. S3 / final_morning
4. S4 / evening
5. S5 / late

History navigation compares canonical slots across profiles rather than pretending the clock times match. For example, MLB S4 (15:15 report) translates to NFL S4 (12:15 report) and NBA/NHL S4 (16:00 report).

The actual issue timestamp, actual feed generation timestamp, report payload, odds blob SHA and archived files are never rewritten by schedule translation.

## Historical metadata

New report-index entries may include:

- `scheduleProfileId`
- `scheduleProfileLabel`
- `scheduleProfileSchema`
- `canonicalSlot`
- `scheduledPulseTime`
- `scheduledReportTime`
- `scheduledLabel`
- `featuredVigScope`

New odds snapshots include matching `scheduleMeta` whenever the refresh came from a scheduled profile slot.

Existing history remains valid. Runs without schedule-profile metadata resolve through the legacy MLB/Summer schedule because that is the schedule under which the existing archive was created.

## Vig Scope

Vig Scope still derives its condition from the real Heat, Price Pressure and Market Agreement inputs. A schedule profile does **not** choose a favorable Vig state.

The profile only marks three of the five canonical checkpoints as the most useful featured Vig Scope readings for that sports season. The terminal may visually emphasize those three readings while retaining all underlying meter data and states.

## Preferences / Operations

The terminal F6 Preferences pane reads `data/schedule-profiles.json` and `data/schedule-state.json`. It shows:

- current profile locked for the operating day;
- next 06:00 profile;
- all five pulse/report pairs for each profile;
- the three featured Vig Scope checkpoints;
- translated History times for the date being viewed.

Because the terminal is static GitHub Pages, it does not store a GitHub write credential in the browser. Profile changes are made through the repository-controlled `Set Betting Edge schedule profile` workflow (or an authorized connected GitHub operation), then the terminal reads the resulting state.

## Daylight saving time

Profile times are Vancouver-local. The refresh workflow contains UTC trigger coverage for both PDT and PST and resolves the active local checkpoint before spending Odds-API quota. Non-matching triggers exit without making Odds-API requests.
