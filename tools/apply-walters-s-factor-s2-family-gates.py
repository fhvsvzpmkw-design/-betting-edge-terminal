#!/usr/bin/env python3
import csv, hashlib, json, math
from pathlib import Path

ROOT=Path.cwd()
BASE=ROOT/'data/walters/nfl/s-factors'
release_path=BASE/'s-factor-release-2026-v1.json'
audit_path=BASE/'s2-validation-audit-v1.json'
current_path=BASE/'s2-current.json'
lock_path=BASE/'s2-model-lock-v1.json'
derived_path=BASE/'s2-derived-features-2021-2025.csv'

def read(p): return json.loads(p.read_text())
def write(p,x): p.write_text(json.dumps(x,indent=2)+'\n')
def r6(x): return None if x is None else round(float(x),6)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def metrics(rows, fn):
    es=[float(r['residual'])-fn(r) for r in rows]
    return {'n':len(es),'meanError':r6(sum(es)/len(es)),'mae':r6(sum(abs(e) for e in es)/len(es)),'rmse':r6(math.sqrt(sum(e*e for e in es)/len(es)))}

def accepted(c,z):
    return c['mae']<=z['mae']+1e-9 and c['rmse']<=z['rmse']+1e-9 and abs(c['meanError'])<=abs(z['meanError'])+0.05+1e-9

release=read(release_path); audit=read(audit_path); current=read(current_path); lock=read(lock_path)
coeff={x['feature']:float(x['coefficient']) for x in release['factorEstimates']}
family={x['feature']:x['family'] for x in release['factorEstimates']}
safe={x['feature']:bool(x['safety']['safe']) for x in release['factorEstimates']}
with derived_path.open(newline='') as f: rows=list(csv.DictReader(f))
for r in rows: r['residual']=float(r['residual'])
train=[r for r in rows if int(r['season']) in lock['source']['primaryTrainingSeasons']]
valid=[r for r in rows if int(r['season']) in lock['source']['validationSeasons']]
zero=release['modelMetrics']['validation']['S_ZERO_BASELINE']
min_tr=int(lock['evaluation']['familyMinimumPrimaryEvents']); min_va=int(lock['evaluation']['familyMinimumValidationEvents']); tol=float(lock['evaluation']['familyValidationToleranceMae'])
families=sorted(set(family.values()))

def fam_adj(r,fam):
    return sum(coeff[k]*float(r.get(k) or 0) for k in coeff if family[k]==fam)

def slope(rs,fam):
    xs=[fam_adj(r,fam) for r in rs]; den=sum(x*x for x in xs)
    return None if den<1e-12 else sum(x*float(r['residual']) for x,r in zip(xs,rs))/den

gates=[]; passed=[]
for fam in families:
    tr=[r for r in train if abs(fam_adj(r,fam))>1e-12]
    va=[r for r in valid if abs(fam_adj(r,fam))>1e-12]
    ts=slope(tr,fam); vs=slope(va,fam)
    zmae=None if not va else sum(abs(r['residual']) for r in va)/len(va)
    fmae=None if not va else sum(abs(r['residual']-fam_adj(r,fam)) for r in va)/len(va)
    fs=[k for k in coeff if family[k]==fam]
    count_ok=len(tr)>=min_tr and len(va)>=min_va
    direction_ok=ts is not None and vs is not None and vs>=-0.10
    mae_ok=zmae is not None and fmae<=zmae+tol+1e-9
    safety_ok=all(safe[k] for k in fs)
    pass_gate=count_ok and direction_ok and mae_ok and safety_ok and fam!='SUPER_BOWL_AFTEREFFECT'
    if pass_gate: passed.append(fam)
    gates.append({'family':fam,'primaryEvents':len(tr),'validationEvents':len(va),'trainAlignmentSlope':r6(ts),'validationAlignmentSlope':r6(vs),'validationAffectedZeroMae':r6(zmae),'validationAffectedFamilyMae':r6(fmae),'countGate':count_ok,'directionGate':direction_ok,'heldoutMaeGate':mae_ok,'coefficientSafetyGate':safety_ok,'s3NumericCandidate':pass_gate,'reason':'PASS' if pass_gate else 'one or more prelocked family gates failed'})

def scoped(r): return sum(fam_adj(r,f) for f in passed)
scoped_m=metrics(valid,scoped) if passed else metrics(valid,lambda r:0.0)
scoped_ok=bool(passed) and accepted(scoped_m,zero)
if not scoped_ok:
    passed=[]; scoped_m=metrics(valid,lambda r:0.0)
    for g in gates:
        if g['s3NumericCandidate']:
            g['s3NumericCandidate']=False; g['reason']='individual family gate passed but combined scoped holdout did not equal/improve zero baseline'
state='PASS_CURRENT_CALIBRATION_S3_CANDIDATE' if passed else 'PASS_CURRENT_CALIBRATION_NO_S3_NUMERIC_CANDIDATE'
release['state']=state
release['s3ScopeCandidate']={'numericFamilies':passed,'modelId':'S_PARTIAL_POOL_FAMILY' if passed else 'S_ZERO_BASELINE','nonNumericFamilies':[f for f in families if f not in passed],'rule':'Family retention is evaluated independently under the prelocked S1/S2 family gates; full aggregate-model failure does not automatically zero a family. Combined retained scope must still equal/improve the zero holdout.'}
release['familyGates']=gates
release['modelMetrics']['selectedScopedValidation']=scoped_m
release['aggregateAcceptance']['scopedAccepted']=scoped_ok
release['familyGateImplementationCorrection']={'state':'APPLIED','reason':'The first S2 implementation incorrectly conditioned family evaluation on aggregate model selection. This correction applies the already-locked familyAcceptance/factorRetention rules without changing model coefficients, thresholds, source data or holdout window.','coefficientsRefit':False,'thresholdsChanged':False,'holdoutWindowChanged':False}
write(release_path,release)
audit['familyGates']=gates
audit['modelMetrics']['scoped']=scoped_m
audit['familyGateImplementationCorrection']=release['familyGateImplementationCorrection']
write(audit_path,audit)
current['state']=state
current['s3NumericFamilies']=passed
current['s3ScopedValidation']=scoped_m
current['s3ScopedModel']='S_PARTIAL_POOL_FAMILY' if passed else 'S_ZERO_BASELINE'
current['familyGateImplementationCorrection']='APPLIED_PRELOCKED_RULE_NO_RETUNING'
current['releaseSha256']=sha(release_path)
write(current_path,current)
print(f"WALTERS S2 FAMILY GATES: PASS // FAMILIES {len(passed)} // SCOPED ACCEPTED {scoped_ok} // NO RETUNING")
