from pathlib import Path
import re
import subprocess

runtime_path=Path('assets/runner-core-runtime.js')
s=runtime_path.read_text()

def exact(old,new,label):
    global s
    count=s.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 occurrence, found {count}')
    s=s.replace(old,new,1)

exact("const HISTORY_KEY='bettingEdge.runnerHistory.v1.3';",
      "const HISTORY_KEY='bettingEdge.runnerHistory.v1.4';",
      'history schema bump')
exact("const LEGACY_HISTORY_KEYS=['bettingEdge.runnerHistory.v1.2.5','bettingEdge.runnerHistory.v1.2.4','bettingEdge.runnerHistory.v1.2.3','bettingEdge.runnerHistory.v1.2.2'];",
      "const LEGACY_HISTORY_KEYS=['bettingEdge.runnerHistory.v1.3','bettingEdge.runnerHistory.v1.2.5','bettingEdge.runnerHistory.v1.2.4','bettingEdge.runnerHistory.v1.2.3','bettingEdge.runnerHistory.v1.2.2'];",
      'legacy cache list')
exact("const VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1';",
      "const VIG_METER_CALIBRATION_ID='vigscope-meter-calibration-v1';\nconst VIG_METER_TELEMETRY_CUTOVER='2026-09-02T08:43:00-07:00';\nconst RUN_HISTORY_URL='./run-history.json';",
      'telemetry cutoff')
exact("let statusFilter='ALL';",
      "let statusFilter='ALL';\nconst issuedSessionCatalog=new Map();",
      'issued catalog')

new_normalize=r'''function normalizeRun(run){
  const source=withoutComparison(run)||{},c=source.counts||{},out=deepClone(source)||{};
  out.slot=txt(source.slot,'');
  out.label=txt(source.label,'');
  out.ts=txt(source.ts,'');
  out.bankroll=source.bankroll;
  out.risk=source.risk;
  out.counts={bet:Number(c.bet)||0,lean:Number(c.lean)||0,wait:Number(c.wait)||0,pass:Number(c.pass)||0};
  out.summary=txt(source.summary,'');
  out.feedGeneratedAt=txt(source.feedGeneratedAt,'');
  out.repriceBaseLabel=txt(source.repriceBaseLabel,'');
  out.recs=Array.isArray(source.recs)?deepClone(source.recs):[];
  // prior_runs is a navigation envelope, not part of the individual issued report.
  delete out.prior_runs;
  return out
}'''
s,n=re.subn(r"function normalizeRun\(run\)\{[^\n]*\}",new_normalize,s,count=1)
if n!=1: raise SystemExit(f'normalizeRun replacement count {n}')

exact("function runKey(run){return [txt(run.ts,''),txt(run.slot,''),txt(run.label,'')].join('|')}",
      "function runKey(run){return [txt(run.ts,''),txt(run.slot,''),txt(run.label,'')].join('|')}\nfunction rememberIssuedRun(run,replace=false){\n  if(!run||run.__error||!run.ts)return null;\n  const issued=normalizeRun(run),key=runKey(issued);\n  if(replace||!issuedSessionCatalog.has(key))issuedSessionCatalog.set(key,issued);\n  return deepClone(issuedSessionCatalog.get(key))\n}\nfunction catalogRuns(){return [...issuedSessionCatalog.values()].map(deepClone)}",
      'issued catalog helpers')

new_safe=r'''function safeHistory(){try{const map=new Map();const raw=localStorage.getItem(HISTORY_KEY),parsed=raw?JSON.parse(raw):[];if(Array.isArray(parsed))parsed.forEach(x=>map.set(runKey(x),x));return [...map.values()]}catch(e){return []}}'''
s,n=re.subn(r"function safeHistory\(\)\{[^\n]*\}",new_safe,s,count=1)
if n!=1: raise SystemExit(f'safeHistory replacement count {n}')

new_save=r'''function saveCurrentRun(run){if(!run||run.__error||!run.ts)return;try{const current=rememberIssuedRun(run)||normalizeRun(run),key=runKey(current);let h=safeHistory().filter(x=>runKey(x)!==key);h.push(current);h.sort((a,b)=>String(a.ts||'').localeCompare(String(b.ts||'')));if(h.length>HISTORY_LIMIT)h=h.slice(-HISTORY_LIMIT);localStorage.setItem(HISTORY_KEY,JSON.stringify(h))}catch(e){console.warn('History save failed',e)}}'''
s,n=re.subn(r"function saveCurrentRun\(run\)\{[^\n]*\}",new_save,s,count=1)
if n!=1: raise SystemExit(f'saveCurrentRun replacement count {n}')

exact("  [...embedded,...safeHistory()].forEach(x=>{if(!x)return;const k=runKey(x);if(!k||k===currentKey)return;if(day&&localDateKey(x.ts)!==day)return;exact.set(k,normalizeRun(withoutComparison(x)))})",
      "  [...embedded,...catalogRuns(),...safeHistory()].forEach(x=>{if(!x)return;const k=runKey(x);if(!k||k===currentKey)return;if(day&&localDateKey(x.ts)!==day)return;if(!exact.has(k))exact.set(k,normalizeRun(x))})",
      'prior-run authority order')

new_without=r'''function withoutComparison(run){const out=deepClone(run);if(!out)return out;delete out.comparison;delete out.refreshDelta;out.recs=(out.recs||[]).map(r=>{const x={...r};delete x.priceComparison;return x});return out}'''
s,n=re.subn(r"function withoutComparison\(run\)\{[^\n]*\}",new_without,s,count=1)
if n!=1: raise SystemExit(f'withoutComparison replacement count {n}')

integrity=r'''function requiresPublisherTelemetry(run){const t=Date.parse(run?.ts),cut=Date.parse(VIG_METER_TELEMETRY_CUTOVER);return Number.isFinite(t)&&Number.isFinite(cut)&&t>=cut}
function hasPublisherTelemetry(run){
  const t=run?.instrumentTelemetry;
  return Boolean(t&&Number(t.schema)===1&&t.authority==='PUBLISHER_BOUND_FEED_V1'&&t.calibrationId===VIG_METER_CALIBRATION_ID&&t.derivedAt&&t.source?.state==='PINNED'&&t.heat&&t.pressure&&t.agreement)
}
function telemetryIntegrityState(run){return requiresPublisherTelemetry(run)?(hasPublisherTelemetry(run)?'VALID':'ERROR'):'LEGACY'}
async function recoverCanonicalIssuedRun(run){
  if(telemetryIntegrityState(run)!=='ERROR')return null;
  try{
    const indexRes=await fetch(`${RUN_HISTORY_URL}?t=${Date.now()}`,{cache:'no-store'});if(!indexRes.ok)return null;
    const index=await indexRes.json(),entry=(index?.runs||[]).find(x=>String(x?.ts||'')===String(run?.ts||'')&&String(x?.slot||'')===String(run?.slot||''));
    if(!entry?.path)return null;
    const reportRes=await fetch(`./${entry.path}?t=${Date.now()}`,{cache:'no-store'});if(!reportRes.ok)return null;
    const canonical=await reportRes.json();
    if(String(canonical?.ts||'')!==String(run?.ts||'')||String(canonical?.slot||'')!==String(run?.slot||''))return null;
    if(telemetryIntegrityState(canonical)!=='VALID')return null;
    rememberIssuedRun(canonical,true);
    return normalizeRun(canonical)
  }catch(e){return null}
}
function recoverActiveRunIfNeeded(){
  const candidate=activeRun;if(!candidate||telemetryIntegrityState(candidate)!=='ERROR')return;
  recoverCanonicalIssuedRun(candidate).then(recovered=>{
    if(!recovered||runKey(activeRun)!==runKey(candidate))return;
    activeRun=recovered;originalRun=deepClone(recovered);saveCurrentRun(recovered);updateRunnerHash(recovered);
    try{apply(activeRun)}catch(e){console.warn('Canonical run recovery render failed',e)}
  }).catch(e=>console.warn('Canonical run recovery failed',e))
}
'''
exact("function instrumentAgreement(run){return run?.instrumentTelemetry?.agreement||fallbackAgreement(run)}",
      integrity+"function instrumentAgreement(run){return run?.instrumentTelemetry?.agreement||fallbackAgreement(run)}",
      'integrity helpers')

exact("function deriveInstrumentReadings(run){\n  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));",
      "function deriveInstrumentReadings(run){\n  if(telemetryIntegrityState(run)==='ERROR'){\n    const failure={value:0,rawValue:0,label:'INTEGRITY ERROR',confidence:0};\n    return {heat:{...failure},pressure:{...failure},agreement:{...failure,rawConfidence:0,evidenceQuality:'INTEGRITY ERROR',pairs:0}}\n  }\n  const recs=Array.isArray(run?.recs)?run.recs:[],signals=recs.map(r=>({...moveSignal(r),weight:recWeight(r)}));",
      'fail-closed meter derivation')

exact("function marketState(run){\n  const r=deriveInstrumentReadings(run);",
      "function marketState(run){\n  if(telemetryIntegrityState(run)==='ERROR')return {emoji:'🔴',label:'TELEMETRY INTEGRITY ERROR',agreementState:'ERROR',agreementRender:'ERROR'};\n  const r=deriveInstrumentReadings(run);",
      'integrity market state')

old_session=r'''function sessionRuns(run){
  const day=localDateKey(run?.ts),map=new Map();
  const embedded=Array.isArray(run?.prior_runs)?run.prior_runs:[];
  [run,...embedded,...safeHistory()].forEach(x=>{
    const key=sessionKey(x);
    if(!x||x.__error||!key)return;
    if(day&&localDateKey(x.ts)!==day)return;
    if(day&&!sessionWindowApplicable(key,day))return;
    map.set(runKey(x),normalizeRun(withoutComparison(x)))
  });
  return [...map.values()]
}'''
new_session=r'''function sessionRuns(run){
  const day=localDateKey(run?.ts),map=new Map();
  const embedded=Array.isArray(run?.prior_runs)?run.prior_runs:[];
  [run,...catalogRuns(),...embedded,...safeHistory()].forEach(x=>{
    const key=sessionKey(x);
    if(!x||x.__error||!key)return;
    if(day&&localDateKey(x.ts)!==day)return;
    if(day&&!sessionWindowApplicable(key,day))return;
    const k=runKey(x);if(!map.has(k))map.set(k,normalizeRun(x))
  });
  return [...map.values()]
}'''
exact(old_session,new_session,'session authority order')
exact("  activeRun=withoutComparison(selected);","  activeRun=normalizeRun(selected);",'session selection')
exact("  updateRunnerHash(activeRun);\n  apply(activeRun)\n}","  updateRunnerHash(activeRun);\n  apply(activeRun);\n  recoverActiveRunIfNeeded()\n}",'session recovery hook')

old_reprice=r'''    activeRun={...deepClone(issued),
      comparison:{checkedAt:now,feedGeneratedAt:feed.generatedAt,schema:feed.schema||1,matched,retained,reasonText},
      refreshDelta:{matched,retained,improved,worsened,unchanged},
      instrumentTelemetry:buildInstrumentTelemetry(recs,feed),
      recs
    };'''
new_reprice=r'''    activeRun={...deepClone(issued),
      comparison:{checkedAt:now,feedGeneratedAt:feed.generatedAt,schema:feed.schema||1,matched,retained,reasonText,instrumentTelemetry:buildInstrumentTelemetry(recs,feed)},
      refreshDelta:{matched,retained,improved,worsened,unchanged},
      recs
    };'''
exact(old_reprice,new_reprice,'reprice overlay boundary')

old_init=r'''activeRun=payload();
if(activeRun&&!activeRun.__error){
  originalRun=withoutComparison(activeRun);
  (Array.isArray(activeRun.prior_runs)?activeRun.prior_runs:[]).forEach(saveCurrentRun);
  saveCurrentRun(originalRun)
}'''
new_init=r'''activeRun=payload();
if(activeRun&&!activeRun.__error){
  rememberIssuedRun(activeRun);
  (Array.isArray(activeRun.prior_runs)?activeRun.prior_runs:[]).forEach(x=>rememberIssuedRun(x));
  originalRun=normalizeRun(activeRun);
  (Array.isArray(activeRun.prior_runs)?activeRun.prior_runs:[]).forEach(saveCurrentRun);
  saveCurrentRun(originalRun);
  recoverActiveRunIfNeeded()
}'''
exact(old_init,new_init,'initial issued bundle')

runtime_path.write_text(s)

workflow_path=Path('.github/workflows/vigscope-meter-production-regression.yml')
permanent=subprocess.check_output(['git','show','origin/main:.github/workflows/vigscope-meter-production-regression.yml'],text=True)

def wf_exact(old,new,label):
    global permanent
    count=permanent.count(old)
    if count!=1:
        raise SystemExit(f'workflow {label}: expected 1 occurrence, found {count}')
    permanent=permanent.replace(old,new,1)

wf_exact("      - 'tests/vigscope-meter-sep2-live-fixture.test.mjs'\n",
         "      - 'tests/vigscope-meter-sep2-live-fixture.test.mjs'\n      - 'tests/runner-issued-session-boundary.test.mjs'\n",
         'new test path')
wf_exact("      - name: Run Sep 2 production telemetry fixture\n        run: node tests/vigscope-meter-sep2-live-fixture.test.mjs\n",
         "      - name: Run Sep 2 production telemetry fixture\n        run: node tests/vigscope-meter-sep2-live-fixture.test.mjs\n      - name: Run issued-session boundary regression\n        run: node tests/runner-issued-session-boundary.test.mjs\n",
         'new test step')
wf_exact("          grep -F \"<script src=\\\"./assets/runner-core-runtime.js\\\"></script>\" runner.html\n",
         "          grep -F \"<script src=\\\"./assets/runner-core-runtime.js\\\"></script>\" runner.html\n          grep -F \"HISTORY_KEY='bettingEdge.runnerHistory.v1.4'\" assets/runner-core-runtime.js\n          grep -F \"VIG_METER_TELEMETRY_CUTOVER='2026-09-02T08:43:00-07:00'\" assets/runner-core-runtime.js\n          grep -F \"TELEMETRY INTEGRITY ERROR\" assets/runner-core-runtime.js\n",
         'runner invariants')
workflow_path.write_text(permanent)
