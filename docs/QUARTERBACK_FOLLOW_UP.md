# Quarterback follow-up

Effective for new Betting Edge reports from **2026-09-28T07:30:00-07:00**. Issued history keeps its original rules and bytes.

An unresolved or projected material football quarterback dependency requires a current targeted search at every report, including morning reports far from kickoff. A generic injury/game page and a repeated uncertainty sentence do not complete that research. Read the exact event dossier and `data/game-intelligence/personnel-news.json` for original leads, then recheck the team source and current starter reporting. News leads retain their original observation times and never confer current clearance.

Record the results in the existing `personnelEvidence.officialSources` and `fallbackSources`. Keep origin, URL, actual `asOf`, factual finding and `sourceType` (`OFFICIAL` or `REPORTING`). Mark the closing team check `finalRecheck:true`. For reporting sources, record `independentOrigin` as the originating publisher/reporter, not a syndicating website. `directReporting:true` means the source actually reports the starter information firsthand; it is not a confidence shortcut for a generic news page. A single high-quality direct report can support an expectation under the existing personnel policy. Otherwise seek the existing three independent fallback origins, or document a genuine source shortfall with actual search attempts.

Add `personnelEvidence.quarterbackFollowUp`:

```json
{
  "checkedAt": "actual current check time",
  "queries": ["ordered teams, game date, quarterback starter and player names"],
  "status": "EXPECTED_STARTER",
  "playerName": "named player",
  "sourceUrls": ["exact URLs from officialSources and fallbackSources"],
  "remainingUncertainty": "What remains unconfirmed and what would change the assessment"
}
```

The review and linked source checks must fall between this report's bound feed generation and actual issue time. Never change an older observation timestamp to meet this requirement; retain the old lead and record a real current check separately.

Allowed status meanings:

- `CONFIRMED_STARTER`: a current official source explicitly names the player. Its evidence has `confirmsStarter:true`; an inactive list showing another player out is insufficient.
- `EXPECTED_STARTER`: current reporting supports a named likely starter. Do not mark the personnel state `CONFIRMED`; retain the precise limitation. This may complete research without establishing betting or Graham numeric clearance.
- `UNRESOLVED`: the targeted investigation actually failed to resolve the starter. Record `remainingUncertainty`. If fewer than three credible originating fallback sources are available, add `sourceShortfall` and `searchAttempts:[{query,checkedAt,result}]` inside `quarterbackFollowUp`. The result must explain what was searched/found/inaccessible, not repeat “starter unresolved.” If the current team channel is inaccessible, additionally set `authoritativeSourceUnavailable:true` and document that attempt.

The planner exposes `QB_STARTER_FOLLOW_UP` before treating an assessment as complete, even for unfavorable price comparisons. Draft preparation defers only affected unfinished selections as `RESEARCH_INCOMPLETE`; unrelated completed selections can publish. The publication semantic gate independently rejects an issued card missing this investigation. A completed unresolved review may still support a reasoned PASS or otherwise qualified WAIT. This check never forces a pick, changes a price or invents a fair.

After discovering a likely or confirmed replacement, reassess whether each external forecast incorporates that player. Keep the expected-starter fact separate from unknown model assumptions. Graham/Walters production retains its confirmed-starter, market-isolation, approved-player and repository-calculator rules. The Betting Edge producer cannot write QB production or change a fair itself. A stale Graham binding is a numeric handoff limitation, not a reason to suppress known current news.

For Chicago–Philadelphia on September 28: the shared dossier records Williams OUT, Keenum EXPECTED_STARTER, Bagent available, and the Bears' continuing lack of a named starter in the official preview. Revalidate those sources at the next run; do not carry the September 22 concussion state forward as current.
