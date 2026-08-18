# Syndicate Character Profiles

This directory stores the editable personality and continuity layer for Syndicate characters.

## Boundaries

- `data/syndicates.json` remains the lightweight roster and four-slot manifest.
- Each roster profile may point to a `characterFile` in this directory.
- The character file does not control Betting Edge recommendations, prices, status, stake, risk, odds freshness, or report authority.
- Hotline pages remain independent presentation files and can be updated without a runner change.
- The current slot host does not need to parse these files; they are build/editing context for maintaining each character consistently.

## Stable identity and editable names

The character `id`, `profileId`, roster `characterId`, and existing live Hotline path are continuity keys. Keep them stable for a rename.

Visible identity is editable. `displayName`, nickname, publication/title text, avatar, voice, and Hotline styling may change without creating a new character.

A rename does not rewrite old Hotline issues. Archived issues keep the name and presentation that were actually published at that date and session; new issues use the new visible name while remaining attached to the same stable character ID.

## Editable trait groups

### `identity`
Who the character is, their role, publication name, and core promise.

### `voice`
Tone, humor, slang level, verbosity, seriousness, and catchphrase style.

### `hotlineStyle`
Visual theme, era, layout, headline treatment, information density, and signature sections.

### `editorial`
What the character emphasizes and how they react to BET, LEAN, WAIT, and PASS.

### `continuity`
The evolving part of the character: current mood, ongoing threads, recurring world details, and `lastReportSeen`.

### `guardrails`
Hard separation between fictional/presentation flavor and the authoritative Betting Edge report.

## Natural-language editing

A descriptive request is the preferred editing interface. For example:

> Make Eddie feel more like a glossy ESPN-level casino insert. Keep him direct, less jokey, and focused on the price at the window.

That description can be translated into changes such as:

- `voice.tone`
- `voice.humor`
- `hotlineStyle.visualTheme`
- `hotlineStyle.headlineStyle`
- `editorial.primaryFocus`

Another example:

> Jesse is getting too wordy. Make him drier, more like a hotel desk clerk who has seen everything, but keep the Delphoria newspaper feel.

That can update voice traits while preserving his stable setting, visual identity, and continuity.

## Hotline issue archive

Each character keeps one live Hotline page plus immutable issued copies beside it.

Example for Bill Weston:

```text
syndicates/downtown-booth/wire.html
syndicates/downtown-booth/archive/index.json
syndicates/downtown-booth/archive/2026-08-18/0930.html
```

`archive/index.json` records the stable character ID, the visible name and publication at issue time, the session label, exact authoritative report timestamp, source report path, and archived HTML path. This makes a Hotline recallable by character, date, session, or historical display name without changing the runner.

Archive files are immutable. If the same date/session already exists with different HTML or metadata, stop rather than overwrite history.

From a checkout, save the character's current issued Hotline with:

```sh
node tools/archive-syndicate-hotline.mjs --character bill-weston
```

The helper reads `continuity.lastReportSeen`, derives the date/session and authoritative report path, copies the current live Hotline, and updates the character's archive index. Use `--dry-run` to preview or `--session HHMM` only when the report label does not provide the intended session code.

## Continuity rule

When building a new Hotline edition, use:

1. the newest authoritative Betting Edge issued report;
2. the character profile in this directory;
3. the character's previous Hotline/current state;
4. the character's most recent archived issued Hotline when session-to-session continuity matters.

Update `continuity.lastReportSeen`, `currentMood`, and `ongoingThreads` only when the character actually advances to a newer report or the user deliberately changes the character's state.

After a Hotline edition is finalized, archive that issued copy immediately. The live page may then be replaced by a later issue while the earlier edition remains directly addressable. Git history remains an additional recovery layer, not the primary Hotline archive.

Do not backdate character state, rewrite an archived issue after a rename, or use fictional continuity as betting evidence.
