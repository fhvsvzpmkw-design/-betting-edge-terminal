# Apply evidence to Betting Edge cards

Operational for new, unfrozen Main report drafts; consolidated repair version `2026-09-12-r1`. This clarifies the existing card fields and research process under Contract 1.0 and shared scheduled authority section 6. It does not regrade issued reports or add a publication gate.

## Complete the assessment, then write the card

Keep the market-first sequence: exact executable quote and qualified reference, current event information, targeted deeper work where a concrete question can change the decision, then final status. A supported `marketAssessment` can still complete a zero-stake PASS/LEAN/qualified WAIT without an independent numerical fair/range. Forecast-based decisions and BET retain their existing requirements. The WAIT independent-signal rule, BET authority, pricing clocks, stake rules and props pause are unchanged by this repair.

An assembly script may copy a completed decision and its evidence. It must not initialize every matched market to PASS, clear all `fairValueEvidence`, stamp every History Fit B, or replace specific findings with boilerplate. Select a final status from the actual assessment of each side. Neither favorable price alone nor unposted lineups alone determines status. Zero BETs and all-PASS remain valid conclusions when supported by the work.

Use actual current source findings and the event's shared research. Name the affected team/player, what is known, what is projected, and the remaining material question. Determine whether that question affects this exact moneyline/run line/spread/total; do not mark every market unresolved merely because an official lineup field is blank. Keep genuinely unresolved dependencies explicit. Follow the existing personnel process, including credible projections when applicable, targeted 3-to-5-source fallback depth when required and the closing authoritative recheck. Official confirmation is mandatory only where an existing rule or the particular decision requires it.

Retain original publication/forecast and observation times. An assembly run cannot refresh a source by replacing its timestamp with `report.ts`. Read the source before recording a fresh check; reused historical findings keep their original checks and require a current applicability assessment.

## Put the useful information in its intended field

| Field | Required purpose |
| --- | --- |
| `support` | State the actual relevant findings and how they affect the selection. Examples of useful subjects include the identified starting pitchers, available batting order, bullpen availability, material injuries or a verified applicable forecast. If the information is neutral, say so. A price comparison may be included but cannot stand in for the information review. |
| `contrary` | State the strongest actual opposing evidence and the specific unresolved dependency, source conflict or uncertainty that limits the conclusion. Name the team/player when known. Do not manufacture contrary evidence or substitute a generic lack-of-model disclaimer for recorded facts. |
| `analysis` | Connect price, the relevant information and its impact to the decision. Explain what changed from the prior assessment, or why the new information made no material difference. Where useful, identify the concrete fact or price condition that would warrant reassessment; an informational trigger does not authorize a wager or create WAIT. |
| `source` | Give recognizable source names, roles and concise Pacific check times. For example, distinguish the execution book, Pinnacle reference, MLB personnel source and any adopted forecast publisher. Keep exact source URLs, findings and original timestamps in `sourceEvidence` and the personnel record. Do not fill this box with blob identifiers or an ISO timestamp inventory. |
| `hist` | Apply the canonical historical research under the section below: verdict, relevant finding/mechanism, applicability and principal limitation. This is distinct from today's price or information grade. |
| `fair` / `edge` | Preserve the actual basis and units. A market assessment stays labelled `Market reference`; compare exact decimal prices to the no-vig probability. An adopted forecast requires the existing exact-market fair/range evidence. Do not invent model numbers to make a card look complete. |
| `move`, `playTo`, `stake` | Preserve existing lineage and execution rules. Keep line changes separate from price changes. Market-assessment PASS/LEAN/WAIT retains `NO BET` and zero stake. |

Write enough to explain this decision, without repeating all research in every field. As guidance, SUPPORT and CONTRARY can each be one or two specific sentences, and ANALYSIS a short paragraph. Shared event facts may recur across cards where relevant, but explain their market-specific implications. There is no word-count publication gate.

Keep the report recommendation, sidecar recommendation and EVALUATED receipt decision/evidence consistent before freeze. Presentation improvements must not be used to relabel market facts as independent predictive support or to hide incomplete research.

## Structured assembly for new drafts

Supply `cardEvidence` on each new card after completing its assessment. This is an explicit presentation handoff, not evidence manufactured by assembly:

```json
{
  "schema": 1,
  "selectionKey": "EXACT_CURRENT_SELECTION_KEY",
  "findings": [{
    "sourceIds": ["ACTUAL_SOURCE_ID"],
    "stance": "CONTEXT",
    "finding": "The actual named player, starter, availability or other source finding.",
    "application": "How that finding affects this exact side, line and price.",
    "limitation": "The actual uncertainty or scope limit."
  }],
  "decisionExplanation": "The completed reasoning, including disagreement and the existing status/stake conclusion.",
  "waitCondition": {
    "trigger": "The observable fact or exact price condition to reassess.",
    "checkSource": "The source that can establish the condition.",
    "remainingBetRequirements": "The actual existing BET requirements still missing after that condition clears."
  },
  "historyFit": {
    "grade": "NR",
    "priorIds": [],
    "synthesisIds": [],
    "clusterIds": [],
    "finding": "The actual historical finding or explicit gap.",
    "application": "Its application to this candidate's sport, market and mechanism.",
    "limitation": "The principal evidence or transportability limitation.",
    "directness": "gap",
    "transportability": "not_applicable"
  }
}
```

Finding stances are `SUPPORT`, `CONTRARY`, `CONTEXT` or `UNRESOLVED`. Use `waitCondition` only for WAIT; its existence does not qualify that status. `historyFit` retains the producer's actual research judgment and IDs. Do not copy the example prose as a finding. Missing or invalid structured input produces advice, not a new report-wide gate.

The shared preparation path calls `assembleCardEvidence(report, sidecar, {library, draft:true})` from `tools/assemble-card-evidence.mjs` after forecast coverage attachment and before freezing. It returns cloned report/sidecar objects, changes and warnings. It renders findings into the intended boxes and mirrors presentation to the matching EVALUATED receipt. It never adopts a probability, changes a quote/status/stake, completes a BLOCKED receipt, updates source check times or rewrites an archive. Legacy cards without the handoff receive advice without text mutation. Ambiguous identity or invalid source references leave the card unchanged.

Forecast interpretation uses matched `forecastReview` records from `tools/forecast-evidence.mjs`. Compare eligible exact probabilities with the exact decimal execution price and recorded settlement basis. An opposing forecast goes in CONTRARY even when Pinnacle supports the price. Team-win forecasts and projected scores on run lines, spreads or totals belong in ANALYSIS as context, not exact cover/settlement support. MODEL source findings are routed through this reviewed forecast metadata instead of trusting a handwritten SUPPORT label. Retain the actual provider market-dependence and calibration limitations.

The known examples illustrate the rule: DRatings' 56.6% Padres team-win estimate is below 58.48% break-even at decimal 1.71; if currently applicable its implication opposes the price. The Rays' 61.7% team-win estimate supplies no probability of covering −1.5. A +0.23 probability-point paired total comparison is favorable to the benchmark even when the final status remains PASS. These historical examples do not authorize new wagers or retrospective decision changes.

Assembly renders the already validated benchmark arithmetic; it does not repair malformed numeric evidence to pass a gate. The producer's `decisionExplanation` still needs substantive review, particularly source disagreement. When every linked canonical history item explicitly has a gap role, existing policy requires NR/gap: assembly renders that policy and retains the originally requested grade in `cardEvidence` for audit. Unknown IDs cannot generate a grade. Library failure leaves the prior draft history for the producer's unavailable handling. An NR that claims priors were considered must still retain the actual considered IDs.

For separate-file draft preparation:

```bash
node tools/assemble-card-evidence.mjs assemble --report <draft-report.json> --sidecar <draft-sidecar.json> --out-report <new-report.json> --out-sidecar <new-sidecar.json> --draft
```

Outputs must be new files, separate from inputs and outside `data/history/`. Use the shared preparation workflow for normal runs so forecast reconciliation and assembly happen together.

## Restore actual History Fit

Read the active `research/manifest.json`, `research/research-library.json`, `research/source-registry.json`, `research/taxonomy.json` and `research/history-fit-policy.json`. Follow the existing policy's small relevant retrieval set, normally 1–4 primary priors and at most one useful synthesis, with cluster deduplication. Retrieve by sport, exact market, timing and mechanism; assess the finding itself, directness, era and contrary studies, rather than trusting a broad tag alone. Shared retrieval is appropriate for genuinely similar markets, with applicability checked for each card.

Write the actual historical finding, how it applies here and its limitation, normally 25–50 words. Use the existing A/B/C/D/NR meanings. B means supportive historical research with caveats; it never means the current price comparison supports PASS. Broad market-efficiency or moneyline evidence must not be presented as direct run-line calibration.

Retain the actual canonical `priorIds`, `synthesisIds` and `clusterIds`, supported grade, directness, transportability, mechanism and limitation in the existing sidecar. Preserve `displayText === rec.hist`. Do not assign research IDs after writing an unrelated conclusion merely to fill the fields. No reliable applicable evidence means NR with the real gap. Research access failure means `HISTORY LIBRARY UNAVAILABLE`; it does not prevent an otherwise valid current market decision from publishing. This repair does not make historical research an additional BET vote or change Core's fixed graduated-research allowlist.

## Preserve useful earlier work without inheriting old decisions

Use `research-plan` at the start and before closing work. Its `priorResearch` remains the latest same-day receipt, while `priorForecastResearch` supplies the most recent earlier sourced fair for that logical side, even if an intervening report used only a market reference. Original sources, checks, exact selection and line-change flag remain attached. This is historical context only, never current evaluation credit.

Recheck the forecast's date, exact market/line, settlement, version and personnel assumptions. If it remains relevant to a candidate, investigate the discrepancy and either adopt it through the existing fair/range process or explain why it is not being used. Put that explanation and relevant source evidence in the existing analysis/evidence fields. An unavailable, superseded, mismatched or unsupported forecast may be rejected; do not silently discard it just because Pinnacle now matches. A changed line requires a new exact-line assessment. Apply current information and do not copy the old probability, status, stake or timestamp automatically.

Favorable comparisons with material unresolved dependencies and relevant forecast disagreements receive targeted attention in event-start order. Research-depth priority is not a new WAIT/LEAN/BET threshold. Ordinary negative prices do not require a universal model search. Where no exact qualified reference exists, attempt the current sport/market forecast fallback and record its actual result; a generic promise to try again is not an attempted fallback.

## Review without a new publication bottleneck

Before freezing, run:

```bash
node tools/review-card-evidence.mjs review --report <report.json> --sidecar <sidecar.json>
```

This read-only advisory identifies generic text, gap-only or unlinked historical claims, numerical/prose direction disagreements, forecast price conflicts, missing market-translation limits, personnel questions, earlier forecast leads, incomplete WAIT triggers and imprecise blockers. Limited explicit legacy templates receive advice only; broad prose is not treated as a machine-readable probability or proof of current applicability. Review the actual findings; it neither certifies research nor generates decisions. Resolve correctable content while the draft is unfrozen, then run unchanged publication validators. Warning counts are not a gate and need not reach zero. Frozen cards are never rewritten.

If current evidence genuinely cannot support a selection, record its actual missing input, attempts, stopping reason and next step in the existing selection-level receipt. Continue the useful work and publish every other completed, validated selection. Missing historical research alone is handled by NR/unavailable, not `RESEARCH_INCOMPLETE` for an otherwise supported current decision. A text-review warning cannot turn an EVALUATED market into BLOCKED. Preserve the supported market-assessment route, honest partial publication and all existing execution/evidence safeguards.

Report completion honestly: count applicable published forecasts from extracted forecast numbers and source evidence, and describe market-reference assessments separately. Ninety qualified reference comparisons do not mean ninety independent forecasts. Keep publisher-owned evaluated/unfinished counts unchanged.

Reconcile each reviewed blocker to a supported completed assessment, targeted follow-up with a concrete next action, or a genuine remaining blocker with its observed stopping reason. These are explanatory dispositions, not new receipt states. Check recorded points and the qualified exact paired reference route before declaring a missing independent model. An otherwise valid market-reference PASS/LEAN/WAIT assessment does not need an additional independent numerical fair; the existing WAIT independent-signal and BET requirements still apply. A found projected score can leave the exact probability missing. Do not clear a blocker merely because a URL or point estimate exists.
