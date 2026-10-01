"""Reproducible historical pricing study; never edits production or issued data.

Run after `node tools/research-pricing-quotes.cjs`.
Fixed retrospective split: kickoff before September 21 discovery, later validation.
Primary hypothesis: first paired exact market, best offered price, >=1pp reference gap.
Sensitivities (>0 and >=3pp) and subgroups are exploratory, not tuned strategies.
"""
import collections
import hashlib
import json
import pathlib
import subprocess
from datetime import datetime
from zoneinfo import ZoneInfo
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'research/pricing-patterns-20261001'
SPLIT = '2026-09-21'
SEED = 20261001

def stamp(s):
    try: return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
    except (ValueError, TypeError, AttributeError): return None

def norm(s): return ''.join(c for c in str(s).lower() if c.isalnum())

def units(grade, price):
    return {'WIN':price-1, 'LOSS':-1, 'PUSH':0, 'VOID':0,
            'HALF_WIN':(price-1)/2, 'HALF_LOSS':-.5}.get(grade)

def event_key(c):
    return f"{c.get('_canonicalSport',c.get('sport'))}|{c.get('eventId')}|{c.get('commenceTime')}"

def selection_id(c): return f"{event_key(c)}|{c.get('selectionKey')}"

def phase(date): return 'discovery' if date < SPLIT else 'validation'

def summary(rows, field='netUnits', bootstrap=True):
    settled = [r for r in rows if r.get(field) is not None]
    groups = collections.defaultdict(lambda:[0.,0])
    for r in settled:
        groups[r['eventKey']][0] += r[field]
        groups[r['eventKey']][1] += 1
    n = len(settled); total = sum(r[field] for r in settled)
    result = {'entries':len(rows), 'settled':n, 'unresolved':len(rows)-n,
              'events':len(groups), 'netUnits':round(total,6),
              'roiPct':round(total/n*100,4) if n else None,
              'grades':dict(collections.Counter(r['grade'] for r in settled))}
    if bootstrap and len(groups)>1:
        a=np.array(list(groups.values())); rng=np.random.default_rng(SEED)
        draws=rng.integers(0,len(a),size=(5000,len(a)))
        sums=a[draws].sum(axis=1)
        result['eventBootstrap95Pct']=np.percentile(sums[:,0]/sums[:,1]*100,[2.5,97.5]).round(4).tolist()
    else: result['eventBootstrap95Pct']=None
    return result

def grouped(rows, keys):
    groups=collections.defaultdict(list)
    for r in rows: groups[' / '.join(str(r[k]) for k in keys)].append(r)
    return {k:summary(v) for k,v in sorted(groups.items())}

def main():
    raw=(ROOT/'data/history/results-index.json').read_bytes(); index=json.loads(raw)
    quotes=json.loads((OUT/'quotes.json').read_text())
    qmap={r['cardId']:r for r in quotes['rows']}
    cards=index['cards']; runs={}; observations={}; counters=collections.Counter()
    for c in cards:
        if c['sourceRun'] not in runs:runs[c['sourceRun']]=json.loads((ROOT/c['sourceRun']).read_text())
        rec=runs[c['sourceRun']]['recs'][int(c['cardId'].rsplit('#',1)[1])]
        cs=(rec.get('coreAssessment') or {}).get('context',{}).get('sport')
        raw_sport=cs or c['sport']
        c['_canonicalSport']={'Basketball/WNBA':'NBA_WNBA','WNBA':'NBA_WNBA','NBA':'NBA_WNBA','Hockey':'NHL','ice-hockey':'NHL'}.get(raw_sport,raw_sport)
    outcome=collections.defaultdict(set); scores=collections.defaultdict(set)
    for c in cards:
        if not c.get('eventId') or not c.get('commenceTime') or not c.get('selectionKey'):continue
        if c['completionState']=='complete':
            outcome[selection_id(c)].add(c['grade'])
            s=c.get('finalScore') or {}
            if s.get('homeScore') is not None and s.get('awayScore') is not None:
                scores[event_key(c)].add((s['homeScore'],s['awayScore']))
    conflict_selections={k for k,v in outcome.items() if len(v)>1}
    conflict_events={k for k,v in scores.items() if len(v)>1}
    records=[]
    for c in sorted(cards,key=lambda c:(stamp(c['runId']),c['cardId'])):
        q=qmap.get(c['cardId'])
        if not q or not q['issuedPriceMatches'] or q['reason']:
            counters['quote_unusable']+=1; continue
        if selection_id(c) in conflict_selections or event_key(c) in conflict_events:
            counters['conflicting_grade_or_score']+=1; continue
        if c['marketKey'] not in ('ml','spread','totals'):
            counters['outside_primary_markets']+=1; continue
        if not c['commenceTime'] or stamp(c['runId'])>=stamp(c['commenceTime']):
            counters['not_pregame']+=1; continue
        if c['sourceRun'] not in runs:
            runs[c['sourceRun']]=json.loads((ROOT/c['sourceRun']).read_text())
        run=runs[c['sourceRun']];rec=run['recs'][int(c['cardId'].rsplit('#',1)[1])]
        detail=(rec.get('coreAssessment') or {}).get('context',{}).get('marketDetail')
        if not detail or not detail.startswith('full_game_') or 'three_way' in detail:
            counters['unsupported_scope']+=1;continue
        line=c['selectedLine']
        if c['marketKey']!='ml' and (line is None or abs(line*2-round(line*2))>1e-8):
            counters['unsupported_line']+=1;continue
        b=rec.get('pinnacleBenchmark') or {};m=rec.get('marketAssessment') or {}
        p=b.get('noVigProbability') if b.get('state')=='QUALIFIED' and b.get('selectionKey')==c['selectionKey'] else None
        ref_time=m.get('referenceGeneratedAt') or b.get('quoteObservedAt') or b.get('quoteChangedAt')
        ref_clock='referenceGeneratedAt' if m.get('referenceGeneratedAt') else 'quoteObservedAt' if b.get('quoteObservedAt') else 'quoteChangedAt'
        age=(stamp(c['runId'])-stamp(ref_time))/60 if stamp(ref_time) is not None else None
        if p is not None and not (0<p<1 and age is not None and 0<=age<=75):
            counters['reference_clock_rejected']+=1;p=None
        grade=next(iter(outcome.get(selection_id(c),[])),None)
        if grade is not None:
            # Independently check immutable observation verification, not just a grade label.
            complete=[a for a in cards if selection_id(a)==selection_id(c) and a['completionState']=='complete']
            verified=False
            for a in complete:
                path=a.get('observationPath')
                if not path:continue
                if path not in observations:observations[path]=json.loads((ROOT/path).read_text())
                o=observations[path]['recommendations'][int(a['cardId'].rsplit('#',1)[1])]
                if o.get('completion',{}).get('verificationState')=='verified':verified=True;break
            if not verified:grade=None
        date=datetime.fromtimestamp(stamp(c['commenceTime']),ZoneInfo('America/Vancouver')).date().isoformat()
        canonical_line=-line if c['marketKey']=='spread' and c['side']=='away' else line
        market_key=f"{event_key(c)}|{detail}|{canonical_line}"
        row={'cardId':c['cardId'],'sourceRun':c['sourceRun'],'runAt':c['runId'],'date':date,'phase':phase(date),
             'eventKey':event_key(c),'selectionId':selection_id(c),'selectionKey':c['selectionKey'],
             'marketId':market_key,'sport':c['_canonicalSport'],'market':c['marketKey'],'detail':detail,'side':c['side'],
             'line':line,'title':c['title'],'issuedStatus':c['status'],'slot':c['slot'],
             'book':norm(c['analysisPrice']['book']),'price':c['analysisPrice']['decimal'],
             'prices':{x['book']:x['decimal'] for x in q['prices']},'referenceP':p,
             'referenceAt':ref_time if p is not None else None,'referenceClock':ref_clock if p is not None else None,
             'grade':grade,'netUnits':units(grade,c['analysisPrice']['decimal']),
             'edgePp':(p-1/c['analysisPrice']['decimal'])*100 if p is not None else None}
        records.append(row)
    first={}
    for r in records:first.setdefault(r['selectionId'],r)
    baseline=list(first.values())
    paired=[dict(r,net365=units(r['grade'],r['prices']['bet365']),netDK=units(r['grade'],r['prices']['draftkings']))
            for r in baseline if len(r['prices'])==2]
    # Build a paired-market first-entry cohort before looking at outcomes.
    appearances=collections.defaultdict(list)
    for r in records:
        if r['referenceP'] is not None:appearances[(r['marketId'],r['runAt'])].append(r)
    first_markets={}
    for (key,time),rs in sorted(appearances.items(),key=lambda kv:stamp(kv[0][1])):
        sides={'over','under'} if rs[0]['market']=='totals' else {'home','away'}
        if set(r['side'] for r in rs)!=sides:continue
        if len(rs)!=2 or abs(sum(r['referenceP'] for r in rs)-1)>1e-5:
            counters['paired_reference_not_complementary_or_duplicate']+=1;continue
        if key in first_markets:continue
        candidates=[]
        for r in rs:
            for book,price in r['prices'].items():
                candidates.append(dict(r,book=book,price=price,edgePp=(r['referenceP']-1/price)*100,netUnits=units(r['grade'],price)))
        first_markets[key]=sorted(candidates,key=lambda r:(-r['edgePp'],r['selectionKey'],r['book']))[0]
    market_rows=list(first_markets.values())
    tests={}
    for name,threshold in [('positive_gap',0),('primary_1pp',1),('sensitivity_3pp',3)]:
        selected=[r for r in market_rows if r['edgePp']>1e-8 if threshold==0 or r['edgePp']>=threshold]
        tests[name]={'thresholdPp':threshold,'all':summary(selected),'periods':grouped(selected,['phase']),
                     'book':grouped(selected,['book']),'sportMarket':grouped(selected,['sport','market']),
                     'side':grouped(selected,['side']),'lane':grouped(selected,['slot']),
                     'status':grouped(selected,['issuedStatus'])}
    def band(r):
        if r['edgePp']<-3:return 'below -3pp'
        if r['edgePp']<0:return '-3 to 0pp'
        if r['edgePp']<1:return '0 to 1pp'
        if r['edgePp']<3:return '1 to 3pp'
        return '3pp or more'
    refs=[dict(r,band=band(r)) for r in market_rows]
    # Existing prospectively frozen experiment is a separate cohort.
    shadow=[]
    for r in index['marketMethodTest']['rows']:
        date=datetime.fromtimestamp(stamp(r['eventDate']),ZoneInfo('America/Vancouver')).date().isoformat()
        shadow.append({'eventKey':f"{r['sport']}|{r['eventId']}|{r['eventDate']}",'date':date,
                       'phase':'early' if date<'2026-09-25' else 'later','grade':r['result'].get('grade'),
                       'netUnits':r['result'].get('netUnits') if r['result']['state']=='settled' else None,
                       'sport':r['sport'],'market':r['marketKey'],'book':norm(r['quote']['book']),
                       'price':r['quote']['priceDecimal'],'edgePp':r['edgeProbabilityPoints'],
                       'priceDiagnostic':r['priceDiagnostic'],'sourceRun':r['sourceRun'],
                       'selectionKey':r['selectionKey']})
    changes=[r['priceDiagnostic'] for r in shadow if r['priceDiagnostic']['state']=='observed_exact']
    paired_delta=[dict(r,delta=r['net365']-r['netDK'] if r['net365'] is not None and r['netDK'] is not None else None) for r in paired]
    result={'study':'pricing-patterns-20261001','splitDate':SPLIT,'seed':SEED,
            'sourceCommit':subprocess.check_output(['git','log','-1','--format=%H','--','data/history/results-index.json'],cwd=ROOT,text=True).strip(),
            'sourceIndexSha256':hashlib.sha256(raw).hexdigest(),'indexGeneratedAt':index['generatedAt'],'sourceCoverage':index['coverage'],
            'audit':{'exclusions':dict(counters),'conflictingSelections':len(conflict_selections),'conflictingEvents':len(conflict_events),
                     'reconstructedQuotes':len(quotes['rows']),'reconstructedMatched':sum(q['issuedPriceMatches'] for q in quotes['rows']),
                     'uniqueSelections':len(baseline),'uniquePairedMarketsWithReference':len(market_rows)},
            'baseline':summary(baseline),'baselinePeriods':grouped(baseline,['phase']),
            'pairedBooks':{'bet365':summary(paired,'net365'),'draftkings':summary(paired,'netDK'),
                           'bet365MinusDraftKings':summary(paired_delta,'delta'),
                           'priceWins':dict(collections.Counter('bet365' if r['prices']['bet365']>r['prices']['draftkings'] else 'draftkings' if r['prices']['draftkings']>r['prices']['bet365'] else 'tie' for r in paired)),
                           'bySportMarket':{k:{'bet365':summary(v,'net365'),'draftkings':summary(v,'netDK')}
                               for k,v in _groups(paired,['sport','market']).items()}},
            'tests':tests,'referenceBandsByPeriod':grouped(refs,['phase','band']),
            'mlbTotals':{name:{'all':summary([r for r in market_rows if r['sport']=='MLB' and r['market']=='totals' and r['edgePp']>1e-8 and r['edgePp']>=threshold]),
                              'periods':grouped([r for r in market_rows if r['sport']=='MLB' and r['market']=='totals' and r['edgePp']>1e-8 and r['edgePp']>=threshold],['phase']),
                              'side':grouped([r for r in market_rows if r['sport']=='MLB' and r['market']=='totals' and r['edgePp']>1e-8 and r['edgePp']>=threshold],['side'])}
                         for name,threshold in [('positive_gap',0),('at_least_1pp',1)]},
            'prospectiveShadow':{'all':summary(shadow),'periods':grouped(shadow,['phase']),
                                 'sportMarket':grouped(shadow,['sport','market']),'book':grouped(shadow,['book']),
                                 'observedComparisons':len(changes),'beatLaterPrice':sum(x['beatLaterPrice'] for x in changes),
                                 'verifiedClosingPrices':sum(x['verifiedClosingLine'] for x in changes),
                                 'meanEntryVsLaterPct':sum(x['entryVsLaterPricePct'] for x in changes)/len(changes) if changes else None}}
    result['prospectiveShadow']['mlbTotalsPeriods']=grouped([r for r in shadow if r['sport']=='MLB' and r['market']=='totals'],['phase'])
    result['prospectiveShadow']['mlbTotalsBook']=grouped([r for r in shadow if r['sport']=='MLB' and r['market']=='totals'],['book'])
    result['positiveGapWithoutLargestWinner']=summary([r for r in market_rows if r['edgePp']>0 and r['netUnits'] is not None and r['cardId']!=max([a for a in market_rows if a['edgePp']>0 and a['netUnits'] is not None],key=lambda a:a['netUnits'])['cardId']])
    result['conflicts']={'selectionIds':sorted(conflict_selections),'eventKeys':sorted(conflict_events)}
    result['primaryByPeriodSportMarket']=grouped([r for r in market_rows if r['edgePp']>=1],['phase','sport','market'])
    (OUT/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
    (OUT/'entries.json').write_text(json.dumps({'firstSelections':baseline,'firstPairedMarkets':market_rows,'prospectiveShadow':shadow},indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ['audit','baseline','tests','prospectiveShadow']},indent=2))

def _groups(rows,keys):
    out=collections.defaultdict(list)
    for r in rows:out[' / '.join(str(r[k]) for k in keys)].append(r)
    return out

if __name__=='__main__':main()
