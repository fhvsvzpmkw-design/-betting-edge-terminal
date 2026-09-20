#!/usr/bin/env python3
"""Apply the reviewed, hash-checked source delta on the isolated fix branch only."""
from pathlib import Path
import hashlib
import os

assert os.environ.get('GITHUB_REF') == 'refs/heads/fix/core14-decision-paths-20260920'
BASE = {
'.github/workflows/card-evidence-review.yml':'ec2bde3adefbd5b80d59d0ada5c76275a961e79b',
'BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md':'724c6e3134936dc93802dc984f9111ed73926e56',
'docs/CANDIDATE_ASSESSMENT.md':'704148077feb5ba44f8c6793c54f7437ab02ba47',
 'tools/candidate-assessment.mjs':'bac13ce41eead244132b2f7f8983baf5d2d92c50',
 'tools/core-handicap-framework.mjs':'d183f00bb061ba81a2c0f2f827987e01ed6a1ead',
 'tools/core-liquidity-classification.mjs':'aa02cea404d1adeb2fef56f3ce306bbc97805453',
 'tools/event-research-plan.mjs':'c37a658c55a1df7a5b920942227b2a8cdd89d9f7',
 'tools/major-sport-market-coverage-gate.mjs':'500b5d97d488dc407334e18d6807a0f9800469d4',
 'tools/report-evidence-repair.mjs':'c6310c49754fe03c0e44707ee59c819a7db8c119'}
EXPECTED={
'.github/workflows/card-evidence-review.yml':'9f3b180a7814a5f35a0a302c0ba62ecbfe955926',
'BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md':'d60592055a818effe508d1b638998ce67c8d56bc',
'docs/CANDIDATE_ASSESSMENT.md':'c975b837835820da551db3fe88f66c1591a55e63',
'tools/candidate-assessment.mjs':'1f6d781c345f87a4599b1d63afe8b937b667782a',
'tools/core-handicap-framework.mjs':'46fc76f1c2ddb31980344226edaf6663b51d0cec',
'tools/core-liquidity-classification.mjs':'cf71ae81784ade419ce5c6f8b5f3fd4706c9db84',
'tools/event-research-plan.mjs':'63b532baef664217866fec7a1794feb2c38ab087',
'tools/major-sport-market-coverage-gate.mjs':'dd8b05fe6e81270f8b9ad0c08de31b5ca7eac641',
'tools/report-evidence-repair.mjs':'f108c2cf32d673c57614985a8e95b99494da964d'}
def sha(p):
 b=Path(p).read_bytes();return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
for p,v in BASE.items():assert sha(p)==v,(p,'unexpected base')
def change(p,old,new,n=1):
 s=Path(p).read_text();assert s.count(old)==n,(p,old,s.count(old));Path(p).write_text(s.replace(old,new))
p='tools/major-sport-market-coverage-gate.mjs'
change(p,'function receiptCore(decision, evidence, framework, label, marketAssessment = false) {','function receiptCore(decision, evidence, framework, label, marketAssessment = false, reportTs = null) {')
change(p,"    ensure(['MODERATE', 'STRONG'].includes(context.independentCurrentSupport), `${label} evaluated value decision requires independent current support`);", "    // September 20: the primary-receipt floor was incorrectly applied to all\n    // statuses. It remains a BET requirement, not a second BET-level gate on\n    // sourced zero-risk LEAN/PASS/WAIT decisions. Historical semantics stay fixed.\n    const statusSpecific = Date.parse(reportTs || '') >= Date.parse('2026-09-20T18:15:00-07:00');\n    if (!statusSpecific || decision.status === 'BET') {\n      ensure(['MODERATE', 'STRONG'].includes(context.independentCurrentSupport), `${label} evaluated value decision requires independent current support`);\n    }")
change(p,'receiptCore(decision, evidence, runtime, label, marketAssessment);','receiptCore(decision, evidence, runtime, label, marketAssessment, report.ts);')
p='tools/core-liquidity-classification.mjs'
change(p,'  const matches=(policy.deterministicRules||[]).filter(rule=>matchCondition(rule.when,context));',"  // Current inventory labels are aliases of the existing full-game contracts.\n  // This restores the already-governed NORMAL rule; it does not widen its scope.\n  const aliases={full_game_primary_run_line:'full_game_run_line',full_game_primary_total:'full_game_total'};\n  const canonical={...context,marketDetail:aliases[context?.marketDetail]||context?.marketDetail};\n  const matches=(policy.deterministicRules||[]).filter(rule=>matchCondition(rule.when,canonical));")
p='tools/core-handicap-framework.mjs'
change(p,'    return values.some(value=>context[key]===value);',"    // Opt-in draft taxonomy repair only. Older issued contexts retain exact\n    // matching; the inventory's singular total is the rule's totals family.\n    const canonical = value => key==='marketClass' && context.coreTaxonomyVersion==='2026-09-20.1' && value==='totals' ? 'total' : value;\n    return values.some(value=>canonical(context[key])===canonical(value));")
p='tools/report-evidence-repair.mjs'
change(p,"import {buildEventResearchPlan} from './event-research-plan.mjs';","import {buildEventResearchPlan} from './event-research-plan.mjs';\nimport {repairDraftCoreTaxonomy} from './core-draft-taxonomy.mjs';")
old='  const before = JSON.stringify(list(draftReport.recs).map(rec =>'
change(p,old,"  const taxonomy = repairDraftCoreTaxonomy(draftReport, draftSidecar, {feed:ctx.feed, framework:optional(path.join(root, 'core/core-handicap-framework-v1.4.json'))});\n"+old)
change(p,'  audit.warnings.push(...list(assembled.warnings));','  audit.warnings.push(...list(assembled.warnings), ...taxonomy.warnings);\n  audit.coreTaxonomyRepair = taxonomy;')
change(p,'cardEvidenceDeferrals:audit.cardEvidenceDeferrals, researchCompletion:','cardEvidenceDeferrals:audit.cardEvidenceDeferrals, coreTaxonomyRepair:audit.coreTaxonomyRepair, researchCompletion:')
p='tools/candidate-assessment.mjs'
change(p,"import {forecastPriceComparison} from './forecast-evidence.mjs';","import {forecastPriceComparison} from './forecast-evidence.mjs';\nimport {compareRecordedFair} from './native-fair-review.mjs';")
change(p,'function compareQuote(report, selection, quote, observer, forecast, records) {','function compareQuote(report, selection, quote, observer, forecast, records, receipt) {')
change(p,'  return {quote, marketComparison: market, marketUnavailable, forecastComparisons: forecasts,','  const nativeFairComparison = compareRecordedFair(report, selection, quote, receipt);\n  return {quote, marketComparison: market, marketUnavailable, forecastComparisons: forecasts, nativeFairComparison,')
change(p,'    promising: scores.some(score => score > 1e-8)};','    promising: scores.some(score => score > 1e-8) || nativeFairComparison?.supportsPointReview === true};')
change(p,'    const options = list(selection.quotes).map(quote => compareQuote(report, selection, quote, observer, forecast, records))','    const options = list(selection.quotes).map(quote => compareQuote(report, selection, quote, observer, forecast, records, receipt))')
change(p,'    const best = options[0] ||','    const best = options.find(option => option.nativeFairComparison?.supportsPointReview && !options.some(other => other.promising && !other.nativeFairComparison?.supportsPointReview)) || options[0] ||')
change(p,"best.forecastComparisons.some(row => row.direction === 'SUPPORTS_PRICE') ? 'Eligible exact forecast supports the price' : null].filter","best.forecastComparisons.some(row => row.direction === 'SUPPORTS_PRICE') ? 'Eligible exact forecast supports the price' : null,\n        best.nativeFairComparison?.supportsPointReview ? 'Recorded native-unit fair supports a separate LEAN/BET review' : null].filter")
p='tools/event-research-plan.mjs'
change(p,"    option.marketComparison?.direction === 'FAVORABLE'","    option.nativeFairComparison?.supportsPointReview === true || option.marketComparison?.direction === 'FAVORABLE'")
change(p,'      priceComparison:row.marketComparison || null, blocker:','      priceComparison:row.marketComparison || null, nativeFairComparison:row.nativeFairComparison || null, blocker:')
p='docs/CANDIDATE_ASSESSMENT.md'
change(p,'## Event-first completion amendment','''## Core decision-path clarification — September 20, 2026

From `2026-09-20T18:15:00-07:00`, read `docs/CORE14_DEEP_REVIEW_2026-09-20.md`. The extra primary-receipt MODERATE/STRONG support floor is a BET requirement, not a universal non-wager completion requirement. All other source, fair/range, personnel, exact-identity and status-specific checks remain. A failed BET conservative bound must receive a separate LEAN/PASS assessment; it is not an automatic PASS. No grade is forced.

The queue also retains source-linked current `fairValueEvidence` in native probability, spread or total units. `nativeFairComparison` identifies a review lead, not calibrated EV or betting authority. Different contracts do not inherit comparisons. Review existing governed Walters/Graham fairs explicitly rather than discarding them solely because no external exact cover probability was found. Keep one coherent adopted basis for opposing selections, and reject or retain each conflicting source explicitly. Do not use a universal fixed band or compulsory min/max of all publishers as a substitute for justified uncertainty.

## Event-first completion amendment''')
p='BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md'
change(p,'**Repository:**','''**Core decision-path review amendment:** `2026-09-20.1`, effective at/after `2026-09-20T18:15:00-07:00`. Read `docs/CORE14_DEEP_REVIEW_2026-09-20.md` with the current candidate authority. Apply status-specific support requirements, retain sourced native-fair opportunities, and inspect `coreTaxonomyRepair` from shared draft preparation. The extra receipt support floor applies to BET, not every non-wager assessment. Do not use a failed BET bound as an automatic PASS, and do not invent universal uncertainty bands. Actual NBA/WNBA league identity comes from the exact bound event; no blind league mapping. All BET, price, identity, freshness, personnel, risk and immutable-publication safeguards remain.

**Repository:**''')
p='.github/workflows/card-evidence-review.yml'
change(p,'      - tools/event-research-plan.mjs','      - tools/event-research-plan.mjs\n      - tools/core-draft-taxonomy.mjs\n      - tools/native-fair-review.mjs\n      - tools/core-handicap-framework.mjs\n      - tools/core-liquidity-classification.mjs\n      - tests/core14-review.test.mjs\n      - docs/CORE14_DEEP_REVIEW_2026-09-20.md',2)
change(p,'      - run: node tests/event-research-plan.test.mjs --integration','      - run: node tests/event-research-plan.test.mjs --integration\n      - run: node tests/core14-review.test.mjs --integration')
for p,v in EXPECTED.items():assert sha(p)==v,(p,'unexpected after',sha(p),v)
print('Reviewed source delta matches all nine locally verified output hashes. No runtime data or history modified.')
