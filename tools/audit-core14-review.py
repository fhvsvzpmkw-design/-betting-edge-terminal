#!/usr/bin/env python3
"""Read-only Core 1.4 audit. No prices, cards, grades, history or runtime files change."""
import collections as C
import datetime as dt
import hashlib
import json
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CUTOVER = '2026-08-25T17:20:00-07:00'
BASE = 'd4e1bf4ca6827d5123c054be78eb6da6d4648eaf'

def load(p):
    return json.loads((ROOT / p).read_text())

def stamp(s):
    try:
        return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except (ValueError, TypeError, AttributeError):
        return None

def count(rows, f):
    return dict(C.Counter(str(f(r)) for r in rows))

def compact(r):
    c = r['context']
    return {k:r.get(k) for k in ['path','ts','title','status','price','fair','edge','key']} | {
        'basis':c.get('fairValueBasis'), 'support':c.get('independentCurrentSupport'),
        'error':r.get('error'), 'eligible':r.get('eligible'), 'dispersion':c.get('bookDispersion'),
        'liquidity':c.get('liquidityRisk'), 'calibration':c.get('directCalibration'),
        'personnel':c.get('personnelSensitivity'), 'rules':r.get('rules'),
        'analysis':r.get('analysis','')[:900], 'fairEvidence':r.get('fairEvidence')}

history = load('run-history.json')['runs']
rows, coverage, failures, receipts, forecasts = [], [], [], [], []
for entry in history:
    if not stamp(entry.get('ts')) or stamp(entry['ts']) < stamp(CUTOVER):
        continue
    try:
        report = load(entry['path'])
    except Exception as e:
        failures.append({'path':entry.get('path'),'error':str(e)})
        continue
    for i, rec in enumerate(report.get('recs', [])):
        a = rec.get('coreAssessment') or {}
        c = a.get('context') or {}
        f = rec.get('feed') or {}
        rows.append({'path':entry['path'],'ts':report['ts'],'ordinal':i+1,
            'title':rec.get('title'),'status':rec.get('status'),'price':rec.get('price'),
            'fair':rec.get('fair'),'edge':rec.get('edge'),'context':c,
            'error':a.get('modelErrorState'),'eligible':a.get('betEligibleByModelError'),
            'rules':a.get('appliedRules', []),'analysis':rec.get('analysis',''),
            'key':json.dumps([c.get('sport'),f.get('eventId'),f.get('marketKey'),f.get('side'),f.get('line')]),
            'fairEvidence':rec.get('fairValueEvidence'), 'quote':f,
            'marketAssessment':rec.get('marketAssessment'),
            'benchmarkComparison':rec.get('benchmarkComparison'),
            'personnelEvidence':rec.get('personnelEvidence'),
            'waitQualification':rec.get('waitQualification'),
            'waltersEvidence':rec.get('waltersEvidence'),
            'sourceEvidence':rec.get('sourceEvidence', [])})
    cs = report.get('coverageSummary') or {}
    if cs:
        coverage.append({'path':entry['path'],'ts':report['ts'],'games':cs.get('games'),
            'selections':cs.get('selections'), 'researchCompletion':cs.get('researchCompletion'),
            'blockers':dict(C.Counter(b.get('reason') for b in cs.get('blockers', []))),
            'forecastTotals':(report.get('forecastCoverage') or {}).get('totals')})
    p = entry.get('researchFitPath')
    if p:
        try:
            side = load(p)
            for rc in (side.get('primaryAnalysis') or {}).get('receipts', []):
                receipts.append({'path':p,'ts':report['ts'],'selectionId':rc.get('selectionId'),
                    'state':rc.get('state'),'blocker':rc.get('blocker'),
                    'decision':rc.get('decision'), 'candidateAssessment':rc.get('candidateAssessment')})
            fe = side.get('forecastEvidence') or {}
            for record in fe.get('records', []):
                forecasts.append({'path':p,'ts':report['ts'],'record':record})
        except Exception as e:
            failures.append({'path':p,'error':str(e)})

first = {}
for r in sorted(rows, key=lambda x:stamp(x['ts'])):
    first.setdefault(r['key'], r)
unique = list(first.values())
cohorts = {}
for name, since in [('all_core14',CUTOVER),('since_primary_scope','2026-09-06T00:00:00-07:00'),('since_candidate_review','2026-09-15T18:15:00-07:00')]:
    cohort = [r for r in rows if stamp(r['ts']) >= stamp(since)]
    cohorts[name] = {'issuedCardAppearances':len(cohort),'reports':len({r['path'] for r in cohort}),
        'status':count(cohort,lambda r:r['status']), 'basis':count(cohort,lambda r:r['context'].get('fairValueBasis')),
        'error':count(cohort,lambda r:r['error']), 'support':count(cohort,lambda r:r['context'].get('independentCurrentSupport')),
        'dispersion':count(cohort,lambda r:r['context'].get('bookDispersion')),
        'calibration':count(cohort,lambda r:r['context'].get('directCalibration')),
        'modelErrorEligible':count(cohort,lambda r:r['eligible']),
        'withFairEvidence':sum(bool(r['fairEvidence']) for r in cohort),
        'rules':dict(C.Counter(rule for r in cohort for rule in r['rules']))}

node = r"""
import fs from 'node:fs';
import {evaluate, matchCondition} from './tools/core-handicap-framework.mjs';
const rows = JSON.parse(fs.readFileSync(process.argv[1],'utf8'));
const fw = JSON.parse(fs.readFileSync('core/core-handicap-framework-v1.4.json','utf8'));
const scenarios = {};
for (const id of ['material-book-dispersion','calibration-gap','market-derived-only','unresolved-personnel','thin-liquidity']) {
 const changed = structuredClone(fw); changed.baseRules = changed.baseRules.filter(r=>r.id!==id);
 const affected = [], newlyEligible = [];
 rows.forEach((r,i)=>{if(!r.context.fairValueBasis)return; const a=evaluate(fw,r.context),b=evaluate(changed,r.context);
  if(a.modelErrorState!==b.modelErrorState)affected.push(i);
  if(!a.betEligibleByModelError&&b.betEligibleByModelError)newlyEligible.push(i);});
 scenarios[id]={classificationChanges:affected.length,modelErrorOnlyNewEligibility:newlyEligible.length,exampleIndexes:newlyEligible.slice(0,8)};
}
const mismatches=[];
rows.forEach((r,i)=>{if(!r.context.fairValueBasis)return;const a=evaluate(fw,r.context);
 if(a.modelErrorState!==r.error||a.betEligibleByModelError!==r.eligible)mismatches.push({index:i,actual:a});});
const liq=JSON.parse(fs.readFileSync('core/core-liquidity-classification-v1.4.json','utf8'));
const missingLiquidity=rows.map((r,i)=>({r,i})).filter(({r})=>r.context.sport==='MLB'&&['full_game_primary_total','full_game_primary_run_line'].includes(r.context.marketDetail))
 .map(({r,i})=>({index:i,detail:r.context.marketDetail,value:r.context.liquidityRisk,matched:liq.deterministicRules.filter(x=>matchCondition(x.when,r.context)).map(x=>x.id)}));
console.log(JSON.stringify({scenarios,mismatches,missingLiquidity}));
"""
with tempfile.NamedTemporaryFile(mode='w',suffix='.json') as f:
    json.dump(rows,f); f.flush()
    run = subprocess.run(['node','--input-type=module','-e',node,f.name],cwd=ROOT,text=True,capture_output=True,check=True)
    effects = json.loads(run.stdout)
for s in effects['scenarios'].values():
    s['examples'] = [compact(rows[i]) for i in s.pop('exampleIndexes')]

recent = [r for r in rows if stamp(r['ts']) >= stamp('2026-09-06T00:00:00-07:00')]
interesting = [r for r in rows if r['status'] != 'PASS' or r['context'].get('fairValueBasis') in ['INDEPENDENT_MODEL','MARKET_ANCHORED_MODEL']]
# Deduplicate examples by event/selection and explanation, not by eventual results.
examples, example_seen = [], set()
for r in reversed(interesting):
    if r['key'] in example_seen: continue
    example_seen.add(r['key']); examples.append(compact(r))
    if len(examples)>=24: break

report = {'schema':1,'auditBase':BASE,'cutover':CUTOVER,'latestReport':max((r['ts'] for r in rows),default=None),
    'limitations':['Counts are issued appearances, not independent bets or outcome evidence.',
        'Rule-removal sensitivity is model-error eligibility only; no hypothetical change is a BET.',
        'Unfinished/unavailable selections are not failed forecasts. No runtime or issued history changed.'],
    'cohorts':cohorts,'firstExactSelection':{'count':len(unique),'status':count(unique,lambda r:r['status'])},
    'recentCoverage':coverage[-16:],'receiptStates':count(receipts,lambda r:r['state']),
    'receiptBlockerReasons':count([r for r in receipts if r['state']=='BLOCKED'],lambda r:(r.get('blocker') or {}).get('reason')),
    'structuredForecasts':{'appearances':len(forecasts),'uniqueIds':len({r['record'].get('recordId') for r in forecasts}),
        'bySource':count(forecasts,lambda r:r['record'].get('sourceId'))},
    'labelCounts':count(recent,lambda r:(r['context'].get('sport'),r['context'].get('marketClass'),r['context'].get('marketDetail'))),
    'WNBACombinedExamples':[compact(r) for r in recent if r['context'].get('sport')=='NBA_WNBA'][:2],
    'liquidityAliasMisses':{'count':sum(not r['matched'] for r in effects['missingLiquidity']),
        'labels':count(effects['missingLiquidity'],lambda r:(r['detail'],r['value'],str(r['matched'])))},
    'modelErrorSensitivity':effects['scenarios'],'recomputeMismatchCount':len(effects['mismatches']),
    'recomputeMismatchExamples':[compact(rows[x['index']])|{'recomputed':x['actual']} for x in effects['mismatches'][:4]],
    'examples':examples,'readFailures':failures}
output = pathlib.Path(tempfile.gettempdir())/'core14-review-audit.json'
output.write_text(json.dumps(report,indent=2))
print('CORE14_AUDIT_BEGIN')
print(json.dumps(report,indent=2))
print('CORE14_AUDIT_END')

# Locate decision rules and active numerical/source requirements, without reading outcomes.
patterns = re.compile(r'(?i)(material.*dispersion|dispersion.*material|two.book|second.book|3.5.source|independent.current.support|conservative.bound|uncertainty.*range|1%.{0,25}(lean|pass)|lean.{0,25}1%|researchMay|bounded|calibrat)')
paths = [ROOT/'BETTING_EDGE_CONTRACT.md',ROOT/'BETTING_EDGE_SCHEDULED_REPORT_AUTHORITY.md',ROOT/'BETTING_EDGE_PERSONNEL_SWEEP.md',ROOT/'tools/report-evidence-gate.mjs',ROOT/'tools/market-price-assessment.mjs',ROOT/'tools/forecast-evidence.mjs']
print('RULE_TEXT_SCAN_BEGIN')
for p in paths:
    if not p.exists(): continue
    hits=[]
    lines=p.read_text().splitlines()
    for i,line in enumerate(lines):
        if patterns.search(line):
            hits.append({'line':i+1,'text':'\n'.join(lines[max(0,i-1):min(len(lines),i+2)])[:1400]})
    print(json.dumps({'path':str(p.relative_to(ROOT)),'hits':hits[:45]}))
print('RULE_TEXT_SCAN_END')
print('RELEVANT_RUNTIME_FILES',json.dumps([str(p.relative_to(ROOT)) for p in (ROOT/'tools').glob('*.mjs') if any(s in p.name for s in ['core','liquidity','personnel','fair','evidence','forecast'])]))
print('CORE_WORKFLOWS',json.dumps([str(p.relative_to(ROOT)) for p in (ROOT/'.github/workflows').glob('*') if 'core' in p.name]))
