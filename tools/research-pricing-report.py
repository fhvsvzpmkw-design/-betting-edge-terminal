"""Render the pricing study's summary and a compact audit sample."""
import collections
import json
import pathlib

root=pathlib.Path(__file__).resolve().parents[1]
out=root/'research/pricing-patterns-20261001'
s=json.loads((out/'summary.json').read_text())
e=json.loads((out/'entries.json').read_text())

def row(label,v):
    g=v['grades']; ci=v['eventBootstrap95Pct']
    interval=f'{ci[0]:+.1f}% to {ci[1]:+.1f}%' if ci else 'Insufficient events'
    return f"| {label} | {v['settled']} | {g.get('WIN',0)} / {g.get('LOSS',0)} / {g.get('PUSH',0)} | {v['netUnits']:+.2f} | {v['roiPct']:+.1f}% | {interval} |"

primary=s['tests']['primary_1pp'];mlb=s['mlbTotals']['at_least_1pp'];shadow=s['prospectiveShadow']
selected=[r for r in e['firstPairedMarkets'] if r['edgePp']>=1]
mlbselected=[r for r in selected if r['sport']=='MLB' and r['market']=='totals']
passaudit=[]
for r in mlbselected:
    if r['issuedStatus']!='PASS':continue
    run=json.loads((root/r['sourceRun']).read_text());rec=run['recs'][int(r['cardId'].rsplit('#',1)[1])]
    ctx=rec.get('coreAssessment',{}).get('context',{})
    passaudit.append({'cardId':r['cardId'],'date':r['date'],'title':r['title'],'grade':r['grade'],
                      'studyPrice':r['price'],'studyBook':r['book'],'issuedPrice':rec['price'],'issuedBook':rec['book'],
                      'edgePp':r['edgePp'],'personnelSensitivity':ctx.get('personnelSensitivity'),
                      'modelErrorState':rec.get('coreAssessment',{}).get('modelErrorState'),
                      'originalRationale':(rec.get('marketAssessment') or {}).get('decisionRationale') or rec.get('analysis')})
report=[
'# Betting Edge pricing study — October 1, 2026',
'',
'The history contains a promising MLB-total pricing signal. It does not yet establish a dependable profitable strategy. The primary all-market test remains statistically uncertain, and the existing prospective experiment weakened in its latest period.',
'',
'## Results',
'',
'Every return below is hypothetical flat one-unit risk at an archived quoted price. Pushes return zero and remain in the ROI denominator. These overlapping cohorts must not be added together.',
'',
'| Cohort | Settled entries | Win / Loss / Push | Net units | ROI | Event-bootstrap 95% interval |',
'|---|---:|---|---:|---:|---|',
row('Primary: reference advantage ≥1pp, all markets',primary['all']),
row('Exploratory subset: MLB totals, advantage ≥1pp',mlb['all']),
row('Existing prospective market experiment, all markets',shadow['all']),
row('Existing prospective experiment, MLB totals',shadow['sportMarket']['MLB / totals']),
'',
'The primary hypothesis, split date and sensitivity thresholds were fixed before this study calculated its results. MLB totals are an exploratory subgroup found during the study. Their favorable interval is unadjusted for subgroup searching and is not a confirmatory significance claim. Small empirical bootstrap samples can miss unobserved outcomes. Dates, teams and series can have dependence beyond the event clusters.',
'',
'## Chronological check',
'',
'The retrospective study splits by actual Vancouver kickoff date: before September 21 for discovery, September 21–30 for the later check. Both periods are historical; the later check is not newly collected blind forward evidence.',
'',
'| Cohort | Settled entries | Win / Loss / Push | Net units | ROI | Event-bootstrap 95% interval |',
'|---|---:|---|---:|---:|---|',
row('Primary, discovery',primary['periods']['discovery']),
row('Primary, later check',primary['periods']['validation']),
row('MLB totals ≥1pp, discovery',mlb['periods']['discovery']),
row('MLB totals ≥1pp, later check',mlb['periods']['validation']),
'',
'Only four later-check games qualify for the MLB-total subgroup. That is the central limitation despite its positive result.',
'',
'The already frozen prospective experiment uses any strictly positive discrepancy plus its existing information and settlement eligibility rules, and can enter at a later qualifying report. It differs from this study’s first paired-market observation rule. Its MLB-total entries returned +6.79 units on 15 games before September 25, then −1.24 units on seven games from September 25 onward. Its full cohort returned +4.01 on 29 early entries, then −2.84 on 19 settled later entries, with one later entry unresolved.',
'',
'## What the books suggest',
'',
f"On {s['pairedBooks']['bet365']['settled']:,} settled exact selections with both books available at the same archived snapshot, Bet365 returned {s['pairedBooks']['bet365']['roiPct']:+.2f}% and DraftKings {s['pairedBooks']['draftkings']['roiPct']:+.2f}%. Bet365’s same-selection advantage was only {s['pairedBooks']['bet365MinusDraftKings']['roiPct']:+.2f} percentage points. Both broad samples lost. This supports comparing obtainable prices, not automatically preferring a book.",
'',
f"The MLB-total ≥1pp subgroup contains {sum(r['book']=='bet365' for r in mlbselected)} Bet365 entries and {sum(r['book']=='draftkings' for r in mlbselected)} DraftKings entries. The lead is the exact price discrepancy, not a claim that one bookmaker systematically misprices every total.",
'',
'Across the first paired-market cohort, any positive discrepancy produced +25.39 units on 91 settled entries. One +12-unit college-football winner materially inflated that total. Removing that largest winner leaves +13.39 on 90 entries, with an interval still spanning losses. Raising the threshold to ≥3pp did not improve the result: six entries returned −0.04 units. Neither threshold sensitivity is a tuned production strategy.',
'',
'## Why PASS cards matter',
'',
f"The MLB-total ≥1pp subgroup was issued as {collections.Counter(r['issuedStatus'] for r in mlbselected).get('PASS',0)} PASS, one LEAN and one WAIT. The returns are hypothetical and do not affect the betting ledger. Positive outcomes do not prove those rejections were mistakes: this study deliberately does not require independent fair-value support, calibrated model error, current personnel clearance or all production BET checks. Review the original rejection reasons against the price signal before considering a policy change.",
'',
'The original 13 PASS reasons were inspected. Nine retain UNRESOLVED personnel and four record RESOLVED personnel. All 13 are ELEVATED model error. Their study prices and books match the prices/books on the original cards, so these cases are not created by substituting a newly selected bookmaker. Several rationales reject favorable market prices because DRatings score projections lean the other way while supplying no exact total probability or calibrated uncertainty. This is a decision-method question worth testing: an uncalibrated score projection may be getting veto authority over a separately measured price signal. The winning and losing cases must both remain visible.',
'',
'For example, the September 25 Cleveland–Kansas City Under 7.5 was rejected despite a 2.74pp price advantage because a DRatings score projection totaled 7.59 and supplied no exact under probability. That PASS subsequently lost as a hypothetical selection, so the example does not establish a missed winning bet. The September 23 St. Louis–Pittsburgh Under 7.5 had a 3.31pp price advantage and was rejected against an 8.09 score projection; it won. These opposing outcomes illustrate why the rejection rule needs prospective evaluation rather than anecdotal reversal.',
'',
'## Price movement',
'',
f"The existing prospective experiment has {shadow['observedComparisons']} usable later same-book observations. Entry prices beat the later observed price in {shadow['beatLaterPrice']} of those cases. Mean entry-to-later decimal-price advantage was {shadow['meanEntryVsLaterPct']:.2f}%. None is a verified closing price. Twenty-six experiment entries lack a usable later comparison, so this is a selected subset and cannot prove closing-line value or forecast accuracy.",
'',
'## Data and method',
'',
f"Source index generated: `{s['indexGeneratedAt']}`. It contains {s['sourceCoverage']['cards']:,} card appearances and {s['sourceCoverage']['completeCards']:,} settled appearances. Data commit: `{s['sourceCommit']}`. Index SHA-256: `{s['sourceIndexSha256']}`.",
'',
f"Reconstructed {s['audit']['reconstructedQuotes']:,} exact-price card records from 173 immutable Git odds blobs. All {s['audit']['reconstructedMatched']:,} matched their indexed issued analysis price. The reconstruction applies the repository’s collector-observation clocks, latest-market handling, suspension checks, exact selection-key identity, exact kickoff binding and 30-minute execution-quote freshness. It excludes post-start or post-report snapshots and ambiguous duplicates.",
'',
f"After scope and quality exclusions, {s['audit']['uniqueSelections']:,} first-observed primary selections remain, of which {s['baseline']['settled']:,} are settled and {s['baseline']['unresolved']} unresolved. The reference test uses {s['audit']['uniquePairedMarketsWithReference']:,} first paired exact markets. Both sides must be present at the same report, qualified complementary reference probabilities must sum to one, and the reference clock must precede the report by no more than 75 minutes.",
'',
'For each exact event/kickoff/market/line, choose the side and supported book with the greatest reference probability minus executable break-even probability at its first paired reference appearance. Main hypothesis: gap ≥1 percentage point. Sensitivities: strictly positive and ≥3pp. No winner, later price or later favorable appearance can replace an entry. A spread’s line is normalized to home orientation; totals with different lines remain distinct contracts. Moneylines, integer/half-point spreads and totals only. Event, market and line identity remain exact.',
'',
'Settlements come from immutable observations with `verificationState: verified`. Conflicting completed selection grades or final scores exclude the affected event. Repeated lanes do not add samples. Event-cluster bootstrap uses 5,000 resamples with seed 20261001 and preserves all markets from the same sport/event/kickoff together. It measures sampling variation, not certainty about book efficiency or data correctness.',
'',
'The broad first-selection baseline returned −5.32%. It includes both sides from the report inventory and is a price/friction baseline, not the result of a sensible wagering strategy or a measurement of placed-bet performance. The card population is selected by published report coverage; unissued/unresearched inventory cannot be inferred from it.',
'',
'Prices were recorded as fresh obtainable feed quotes, not verified customer fills. Pinnacle probabilities are proportional margin-adjusted references, generally conditional on no push. They are not independently established true probabilities or unconditional expected returns. The study does not infer bookmaker intent, sharp betting volume or “trap lines” from outcomes.',
'',
'## Quality findings',
'',
f"{s['audit']['conflictingEvents']} exact event identities have conflicting historical final scores, including {s['audit']['conflictingSelections']} exact selections with contradictory settled grades. Sixteen card appearances were excluded. These are separate grading-data follow-ups; this study does not rewrite their historical observations.",
'',
'```json',json.dumps(s['conflicts'],indent=2),'```',
'',
'Other card-level exclusions: 49 missing usable exact quotes, 203 unsupported/missing full-game scope, 86 outside primary market keys, six non-pregame records and six unsupported quarter-line contracts. These exclusions occur before selection deduplication.',
'',
'## Next validation',
'',
'Retain the existing prospective experiment. Freeze MLB full-game totals with an exact price advantage ≥1pp as a research candidate; keep both over and under eligible and use the best valid Bet365/DraftKings quote. Preserve its original entry time, price, paired reference, information clearance and exclusion reason. Collect genuinely observed later reference pairs and verified pre-start closing prices where possible. Do not use eventual grades to backfill missing pregame evidence.',
'',
'Evaluate future entries under the unchanged candidate rule, reporting returns, event counts, availability, calibration diagnostics where applicable and genuine closing comparisons. Check the original PASS reasons. The study does not authorize changing Core thresholds, official statuses, staking, schedules, report production or live odds.',
'',
'## Reproduce',
'',
'From the research branch checkout, with the repository’s historical Git blobs available:',
'',
'```bash',
'node tools/research-pricing-quotes.cjs',
'python tools/research-pricing-patterns.py',
'python tools/research-pricing-report.py',
'python tests/research-pricing-patterns-test.py',
'node --test tests/quote-observation.test.mjs tests/market-method-shadow.test.mjs',
'```',
'',
'Python requires NumPy. The quote and entry JSON files are reproducible intermediate outputs. The summary and compact ≥1pp candidate sample are retained with the study.',
]
(out/'README.md').write_text('\n'.join(report)+'\n')
(out/'primary-candidates.json').write_text(json.dumps({'rule':'first paired reference appearance; best supported quote; edge >= 1pp',
                                                    'sourceIndexSha256':s['sourceIndexSha256'],'entries':selected},indent=2)+'\n')
(out/'pass-reasons.json').write_text(json.dumps(passaudit,indent=2)+'\n')
print('Wrote README.md and primary-candidates.json')
