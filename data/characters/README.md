# Syndicate Character Profiles

This directory stores the editable personality and continuity layer for Syndicate characters.

## Boundaries

- `data/syndicates.json` remains the lightweight roster and four-slot manifest.
- Each roster profile may point to a `characterFile` in this directory.
- The character file does not control Betting Edge recommendations, prices, status, stake, risk, odds freshness, or report authority.
- Hotline pages remain independent presentation files and can be updated without a runner change.
- The current slot host does not need to parse these files; they are build/editing context for maintaining each character consistently.

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

## Continuity rule

When building a new Hotline edition, use:

1. the newest authoritative Betting Edge issued report;
2. the character profile in this directory;
3. the character's previous Hotline/current state.

Update `continuity.lastReportSeen`, `currentMood`, and `ongoingThreads` only when the character actually advances to a newer report or the user deliberately changes the character's state.

The previous issued report and previous Hotline remain available through Git history. Do not backdate character state or use fictional continuity as betting evidence.
