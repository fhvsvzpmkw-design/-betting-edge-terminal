#!/usr/bin/env python3
import csv, hashlib, json, math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
import numpy as np

ROOT=Path.cwd()
CONTRACT=ROOT/'data/walters/nfl/home-field/h3v-selective-venue-contract-v1.json'
H2_RELEASE=ROOT/'data/walters/nfl/home-field/home-field-release-2026-v1.json'
H2_AUDIT=ROOT/'data/walters/nfl/home-field/h2-validation-audit-v1.json'
H3=ROOT/'data/walters/nfl/home-field/h3-week-01-shadow-result.json'
H3_CURRENT=ROOT/'data/walters/nfl/home-field/h3-current.json'
ACTIVE=ROOT/'data/walters/nfl/active-week.json'
POWER=ROOT/'data/walters/nfl-power-ratings-ledger.json'
REGISTRY=ROOT/'data/walters/nfl/player-values/player-values-2026-v1.json'
SNAPSHOT=ROOT/'data/walters/nfl/home-field/source/nflverse-schedules-hfa-snapshot-2026-09-01.csv'
OUT=ROOT/'data/walters/nfl/home-field/h3v-selective-venue-result-v1.json'
CURRENT=ROOT/'data/walters/nfl/home-field/h3v-current.json'
TEAM_MAP={'LA':'LAR'}

def readj(p): return json.loads(p.read_text())
def writej(p,o): p.parent.mkdir(parents=True,exist_ok=True); p.write_text(json.dumps(o,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def now(): return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
def fail(m): raise RuntimeError('WALTERS HOME FIELD H3V FAILED // '+m)
def normteam(v):
    s=str(v or '').strip().upper(); return TEAM_MAP.get(s,s)
def stadium_key(r):
    sid=str(r.get('stadium_id') or '').strip()
    if sid and sid.lower() not in {'nan','none','na'}: return 'id:'+sid
    s=''.join(ch.lower() if ch.isalnum() else '-' for ch in str(r.get('stadium') or '')).strip('-')
    while '--' in s: s=s.replace('--','-')
    return 'name:'+(s or 'unknown')
def ishome(r): return str(r.get('location') or '').strip().lower()=='home'
def isneutral(r): return str(r.get('location') or '').strip().lower()=='neutral'
def r3(x): return None if x is None else round(float(x),3)
def sign(x,eps=1e-9): return 1 if x>eps else (-1 if x<-eps else 0)
def metrics(errs):
    if not errs: return {'n':0,'meanError':None,'mae':None,'rmse':None,'absoluteMeanBias':None}
    a=np.array(errs,dtype=float); m=float(a.mean())
    return {'n':len(errs),'meanError':r3(m),'mae':r3(np.abs(a).mean()),'rmse':r3(np.sqrt(np.mean(a*a))),'absoluteMeanBias':r3(abs(m))}

def load_rows():
    rows=[]
    with SNAPSHOT.open(newline='',encoding='utf-8') as f:
        for r in csv.DictReader(f):
            try: season=int(float(r['season']))
            except: continue
            try: hs=float(r['home_score']); aw=float(r['away_score'])
            except: hs=aw=None
            rr=dict(r); rr['season']=season; rr['home_team']=normteam(r.get('home_team')); rr['away_team']=normteam(r.get('away_team')); rr['home_score']=hs; rr['away_score']=aw
            rows.append(rr)
    return rows

def completed(rows,seasons):
    return [r for r in rows if r['season'] in seasons and str(r.get('game_type') or '').upper()=='REG' and r['home_score'] is not None and r['away_score'] is not None and (ishome(r) or isneutral(r))]

def fit_ridge(rows,pen):
    sn=sorted({f'S:{r["season"]}:{r["home_team"]}' for r in rows}|{f'S:{r["season"]}:{r["away_team"]}' for r in rows})
    hn=sorted({f'H:SEASON:{r["season"]}' for r in rows if ishome(r)})
    tv=sorted({f'H:TV:{r["home_team"]}:{stadium_key(r)}' for r in rows if ishome(r)})
    names=sn+['H:BASE']+hn+tv; idx={n:i for i,n in enumerate(names)}
    X=np.zeros((len(rows),len(names))); y=np.zeros(len(rows)); lam=np.zeros(len(names))
    for n,i in idx.items():
        if n.startswith('S:'): lam[i]=pen['teamSeasonStrength']
        elif n=='H:BASE': lam[i]=pen['leagueHomeBaseline']
        elif n.startswith('H:SEASON:'): lam[i]=pen['seasonHomeDeviation']
        elif n.startswith('H:TV:'): lam[i]=pen['teamVenueHomeDeviation']
    for q,r in enumerate(rows):
        X[q,idx[f'S:{r["season"]}:{r["home_team"]}']]=1; X[q,idx[f'S:{r["season"]}:{r["away_team"]}']]=-1
        if ishome(r):
            X[q,idx['H:BASE']]=1; X[q,idx[f'H:SEASON:{r["season"]}']]=1; X[q,idx[f'H:TV:{r["home_team"]}:{stadium_key(r)}']]=1
        y[q]=r['home_score']-r['away_score']
    A=X.T@X+np.diag(lam)+np.eye(len(names))*1e-10; b=X.T@y; beta=np.linalg.solve(A,b)
    return {'idx':idx,'beta':beta,'rows':rows}
def coef(fit,name):
    i=fit['idx'].get(name); return float(fit['beta'][i]) if i is not None else 0.0
def forecast_baseline(fit,seasons):
    use=sorted(seasons)[-3:]; weights=list(range(1,len(use)+1)); dev=[coef(fit,f'H:SEASON:{s}') for s in use]
    return coef(fit,'H:BASE')+sum(w*d for w,d in zip(weights,dev))/sum(weights)
def fit_test_strength(rows,baseline,penalty):
    teams=sorted({r['home_team'] for r in rows}|{r['away_team'] for r in rows}); idx={t:i for i,t in enumerate(teams)}
    X=np.zeros((len(rows),len(teams))); y=np.zeros(len(rows))
    for q,r in enumerate(rows):
        X[q,idx[r['home_team']]]=1; X[q,idx[r['away_team']]]=-1
        y[q]=r['home_score']-r['away_score']-(baseline if ishome(r) else 0)
    beta=np.linalg.solve(X.T@X+np.eye(len(teams))*penalty,X.T@y)
    return {t:float(beta[i]) for t,i in idx.items()}

for p in [CONTRACT,H2_RELEASE,H2_AUDIT,H3,H3_CURRENT,ACTIVE,POWER,REGISTRY,SNAPSHOT]:
    if not p.exists(): fail('missing '+str(p.relative_to(ROOT)))
c=readj(CONTRACT); release=readj(H2_RELEASE); audit=readj(H2_AUDIT); h3=readj(H3); h3c=readj(H3_CURRENT); active=readj(ACTIVE)
if c['stage']!='H3V' or c['state']!='MODEL_LOCKED_PRE_2025_CONFIRMATION' or c['productionAuthority'] or c['liveBoardMutationAllowed'] or c['marketViewed']: fail('FAIL_CLOSED_H3V_MODEL_BOUNDARY')
if release.get('state')!='PASS_CURRENT_CALIBRATION_SHADOW_RELEASE' or release.get('marketViewed') is not False: fail('H2 release not accepted')
if audit.get('validation',{}).get('pass') is not True: fail('H2 validation not passed')
if h3c.get('state')!='PASS_SHADOW_ACCEPTANCE_LEAGUE_BASELINE_H4_CANDIDATE_TEAM_VENUE_DIAGNOSTIC': fail('H3 scope mismatch')
if h3c.get('h4ScopeCandidate',{}).get('leagueBaseline') is not True or h3c.get('h4ScopeCandidate',{}).get('teamVenue') is not False: fail('H3 candidate boundary mismatch')
if active.get('state')!='ACTIVE' or active.get('authority')!='GRAHAM_WEEK_ROLLOVER': fail('active week invalid')
week=int(active['week']); season=int(active['season']); numbers=ROOT/f'data/walters/nfl/{season}/week-{week:02d}-current-numbers.json'; personnel=ROOT/f'data/walters/nfl/{season}/week-{week:02d}-personnel-ledger.json'
for p in [numbers,personnel]:
    if not p.exists(): fail('active file missing '+str(p.relative_to(ROOT)))
protected_before={'currentNumbers':sha(numbers),'personnelLedger':sha(personnel),'powerRatings':sha(POWER),'playerValueRegistry':sha(REGISTRY)}
rows=load_rows(); pen=c['internalRollingCalibration']['ridgePenalties']; folds=c['internalRollingCalibration']['folds']; current_est={x['team']:x for x in release['teamVenueEstimates']}
rolling_rows=[]; fold_summaries=[]; by_team_fold=defaultdict(list)
for fold in folds:
    train_seasons=fold['trainSeasons']; test_year=int(fold['testSeason']); tr=completed(rows,train_seasons); te=completed(rows,[test_year]); fit=fit_ridge(tr,pen); baseline=forecast_baseline(fit,train_seasons); strengths=fit_test_strength(te,baseline,pen['validationTeamStrength'])
    domestic=0
    team_bucket=defaultdict(list)
    for r in te:
        if not ishome(r): continue
        domestic+=1; strengthdiff=strengths.get(r['home_team'],0)-strengths.get(r['away_team'],0); resid=(r['home_score']-r['away_score'])-(strengthdiff+baseline)
        tvname=f'H:TV:{r["home_team"]}:{stadium_key(r)}'; d=coef(fit,tvname) if tvname in fit['idx'] else 0.0
        rec={'testSeason':test_year,'team':r['home_team'],'stadiumKey':stadium_key(r),'deviation':d,'leagueResidual':resid}; rolling_rows.append(rec); team_bucket[(r['home_team'],stadium_key(r))].append(rec)
    for key,recs in team_bucket.items():
        by_team_fold[key].append({'testSeason':test_year,'n':len(recs),'deviation':float(np.mean([x['deviation'] for x in recs])),'meanLeagueResidual':float(np.mean([x['leagueResidual'] for x in recs]))})
    fold_summaries.append({'trainSeasons':train_seasons,'testSeason':test_year,'trainGames':len(tr),'testGames':len(te),'domesticGames':domestic,'leagueBaselineForecast':r3(baseline)})
num=sum(x['deviation']*x['leagueResidual'] for x in rolling_rows); den=sum(x['deviation']**2 for x in rolling_rows); k_raw=(num/den if den>1e-12 else 0.0); k=max(0.0,min(1.0,k_raw))
post=[x['leagueResidual']-k*x['deviation'] for x in rolling_rows]; pre=[x['leagueResidual'] for x in rolling_rows]
internal={'leagueOnly':metrics(pre),'allVenueAttenuated':metrics(post),'rawSlope':r3(k_raw),'survivalCoefficientK':r3(k),'rows':len(rolling_rows)}
# Freeze the venue set using only information available through 2024.
pre_rows=completed(rows,[2021,2022,2023,2024]); pre_fit=fit_ridge(pre_rows,pen); pre_baseline=forecast_baseline(pre_fit,[2021,2022,2023,2024])
req=c['venueQualification']['requirements']; min_k=float(c['internalRollingCalibration']['survivalCoefficient']['minimumForSelectiveQualification']); venue_records=[]; qualified=set()
for team,e in sorted(current_est.items()):
    sk=e.get('stadiumKey'); tvname=f'H:TV:{team}:{sk}'; d_pre=coef(pre_fit,tvname) if sk and tvname in pre_fit['idx'] else 0.0; f=by_team_fold.get((team,sk),[]); s=sign(d_pre)
    proj=sum(1 for z in f if sign(z['deviation'])==s and s!=0); obs=sum(1 for z in f if sign(z['meanLeagueResidual'])==s and s!=0)
    rr=[x for x in rolling_rows if x['team']==team and x['stadiumKey']==sk]; base_m=metrics([x['leagueResidual'] for x in rr]); adj_m=metrics([x['leagueResidual']-k*x['deviation'] for x in rr])
    checks={
      'kMinimum':k>=min_k,
      'rollingFolds':len(f)>=int(req['minimumRollingFoldsWithEstimate']),
      'rawDeviationMagnitude':abs(d_pre)>=float(req['minimumAbsolutePre2025RawDeviationPoints']),
      'projectionSignAgreement':proj>=int(req['minimumProjectionSignAgreementFolds']),
      'observedResidualSignAgreement':obs>=int(req['minimumObservedResidualSignAgreementFolds']),
      'aggregateMaeNoWorse':base_m['mae'] is not None and adj_m['mae']<=base_m['mae']+1e-12,
      'aggregateRmseNoWorse':base_m['rmse'] is not None and adj_m['rmse']<=base_m['rmse']+1e-12,
      'same2026VenueIdentity':bool(sk)
    }
    q=all(checks.values())
    if q: qualified.add((team,sk))
    venue_records.append({'team':team,'stadiumKey':sk,'stadium':e.get('stadium'),'pre2025RawDeviationPoints':r3(d_pre),'rollingFoldCount':len(f),'projectionSignAgreementFolds':proj,'observedResidualSignAgreementFolds':obs,'rollingLeagueOnly':base_m,'rollingAttenuated':adj_m,'checks':checks,'qualifiedPre2025':q})
# Untouched 2025 confirmation: venue set and k are frozen now.
te2025=completed(rows,[2025]); strengths25=fit_test_strength(te2025,pre_baseline,pen['validationTeamStrength']); base_err=[]; sel_err=[]; selected_games=0
for r in te2025:
    if not ishome(r): continue
    resid=(r['home_score']-r['away_score'])-(strengths25.get(r['home_team'],0)-strengths25.get(r['away_team'],0)+pre_baseline); base_err.append(resid)
    key=(r['home_team'],stadium_key(r)); adj=0.0
    if key in qualified:
        tvname=f'H:TV:{r["home_team"]}:{stadium_key(r)}'; adj=k*coef(pre_fit,tvname); selected_games+=1
    sel_err.append(resid-adj)
base25=metrics(base_err); sel25=metrics(sel_err); acc=c['final2025Confirmation']['acceptance']
confirm_checks={
 'minimumDomesticGames':base25['n']>=int(acc['minimumDomesticGames']),
 'maeNoWorse':sel25['mae']<=base25['mae']+1e-12,
 'rmseNoWorse':sel25['rmse']<=base25['rmse']+1e-12,
 'biasWithinTolerance':sel25['absoluteMeanBias']<=base25['absoluteMeanBias']+float(acc['selectiveAbsoluteBiasMayExceedLeagueOnlyByAtMost'])+1e-12
}
confirm_pass=all(confirm_checks.values())
if not qualified: state=c['final2025Confirmation']['noVenueState']
elif confirm_pass: state=c['final2025Confirmation']['passState']
else: state=c['final2025Confirmation']['failState']
# Build 2026 selective registry. Final 2021-2025 H2 deviations supply magnitude only after confirmation; the venue set and k were frozen pre-2025.
league=float(release['leagueBaselineHomeAdvantagePoints']); registry26=[]
for e in release['teamVenueEstimates']:
    key=(e['team'],e.get('stadiumKey')); q=key in qualified; raw=float(e.get('teamVenueDeviationPoints') or 0); atten=r3(k*raw) if q and confirm_pass else 0.0; hfa=r3(league+atten)
    registry26.append({'team':e['team'],'stadiumKey':e.get('stadiumKey'),'stadium':e.get('stadium'),'qualifiedPre2025':q,'confirmationAccepted':bool(q and confirm_pass),'rawH2DeviationPoints':r3(raw),'survivalCoefficientK':r3(k),'selectiveVenueDeviationPoints':atten,'homeLocationAdvantagePoints':hfa,'sampleGames':e.get('sampleGames'),'h2UncertaintyPoints':e.get('uncertaintyPoints')})
regmap={x['team']:x for x in registry26}; shadow=[]; display_moves=0
for g in h3['games']:
    if g.get('screeningStatus')!='PASS': fail('H3 unresolved game '+g.get('gameKey','?'))
    nonloc=float(g['preservedNonLocationExactFairHome']); current_display=float(g['current']['grahamDisplayFairHome']); vc=g['venueClass']
    if vc in {'NEUTRAL','INTERNATIONAL_NEUTRAL'}: hfa=0.0; venue_adj=0.0; q=False
    elif vc=='DOMESTIC_HOME':
        e=regmap.get(g['home']);
        if not e: fail('FAIL_CLOSED_H3V_VENUE_IDENTITY:'+g['gameKey'])
        hfa=float(e['homeLocationAdvantagePoints']); venue_adj=float(e['selectiveVenueDeviationPoints']); q=bool(e['confirmationAccepted'])
    else: fail('FAIL_CLOSED_H3V_VENUE_IDENTITY:'+g['gameKey']+':'+vc)
    exact=r3(nonloc-hfa); display=round(float(exact)*2)/2; move=r3(display-current_display)
    if abs(move)>1e-12: display_moves+=1
    shadow.append({'gameKey':g['gameKey'],'away':g['away'],'home':g['home'],'venueClass':vc,'qualifiedSelectiveVenue':q,'leagueBaselineHomeAdvantagePoints':league if vc=='DOMESTIC_HOME' else 0,'selectiveVenueDeviationPoints':venue_adj,'shadowHomeLocationAdvantagePoints':hfa,'preservedNonLocationExactFairHome':nonloc,'currentDisplayFairHome':current_display,'shadowExactFairHome':exact,'shadowDisplayFairHome':display,'displayMove':move,'personnelOverlayPointsToHomeSpread':g['current'].get('personnelOverlayPointsToHomeSpread',0),'liveBoardChanged':False})
protected_after={'currentNumbers':sha(numbers),'personnelLedger':sha(personnel),'powerRatings':sha(POWER),'playerValueRegistry':sha(REGISTRY)}
if protected_before!=protected_after: fail('FAIL_CLOSED_H3V_LIVE_ARTIFACT_MUTATION')
result={'schema':1,'resultId':'walters-nfl-home-field-h3v-selective-venue-2026-v1','h3vId':c['h3vId'],'calibrationId':c['calibrationId'],'stage':'H3V','state':state,'season':season,'week':week,'generatedAt':now(),'productionAuthority':False,'liveBoardMutationAllowed':False,'marketViewed':False,'leagueBaselineHomeAdvantagePoints':r3(league),'internalRollingCalibration':{'folds':fold_summaries,'metrics':internal},'qualification':{'qualifiedVenueCount':len(qualified),'qualifiedTeamVenueKeys':[{'team':t,'stadiumKey':s} for t,s in sorted(qualified)],'venues':venue_records},'final2025Confirmation':{'qualifiedVenueSetFrozenBefore2025':True,'selectedVenueGames':selected_games,'leagueOnly':base25,'selectiveVenue':sel25,'checks':confirm_checks,'pass':confirm_pass},'h4ScopeCandidate':{'leagueBaseline':True,'neutralZeroBase':True,'selectiveVenueAdjustments':bool(qualified and confirm_pass),'teamVenueBlanket':False,'survivalCoefficientK':r3(k),'qualifiedVenueCount':len(qualified) if confirm_pass else 0},'registry2026':registry26,'activeWeekShadow':{'gamesReviewed':len(shadow),'displayMovesVersusCurrentLive':display_moves,'liveMoves':0,'games':shadow},'protectedArtifactSha256':protected_after}
if state==c['final2025Confirmation']['passState']: result['conclusion']='H3V validates a selective, additionally shrunk team-at-venue layer for the prequalified venue set. H4 may consider only these attenuated deviations on top of the league baseline; blanket team/venue authority remains prohibited.'
elif state==c['final2025Confirmation']['noVenueState']: result['conclusion']='H3V found no team-at-venue pair that cleared the locked pre-2025 qualification rules. H4 remains league-baseline plus neutral-zero only.'
else: result['conclusion']='H3V selective venue layer failed the untouched 2025 confirmation. H4 remains league-baseline plus neutral-zero only and all individual venue deviations stay diagnostic.'
writej(OUT,result); writej(CURRENT,{'schema':1,'stage':'H3V','state':state,'season':season,'week':week,'updatedAt':result['generatedAt'],'productionAuthority':False,'liveBoardMutationAllowed':False,'marketViewed':False,'leagueBaselineHomeAdvantagePoints':r3(league),'survivalCoefficientK':r3(k),'qualifiedVenueCount':result['h4ScopeCandidate']['qualifiedVenueCount'],'h4ScopeCandidate':result['h4ScopeCandidate'],'resultPath':str(OUT.relative_to(ROOT)),'nextGate':['Use H3V scope when building H4.','Never activate blanket team/stadium deviations.','If selectiveVenueAdjustments is false, H4 remains league baseline 2.082 plus explicit neutral zero.','Preserve all personnel, QB/game-factor and carried-rating layers during H4 recomputation.']})
print(f"WALTERS HOME FIELD H3V: {state} // k={k:.3f} // PREQUALIFIED {len(qualified)} // 2025 MAE {sel25['mae']} vs {base25['mae']} // RMSE {sel25['rmse']} vs {base25['rmse']} // WEEK1 SHADOW MOVES {display_moves} // 0 LIVE MOVES")
