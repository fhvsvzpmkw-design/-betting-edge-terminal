"""Fixed exploratory movement tests on exact pregame contract trajectories.

Movement: >=0.5 percentage points in proportional no-vig probability.
Steady: <=0.1pp. Outlier: >=1pp cheaper break-even probability than other book.
Supported outlier: also >=1pp positive Pinnacle reference discrepancy.
Persistence: two observations 30 minutes to six hours apart.
One first qualifying entry per exact market and hypothesis. No outcome filtering.
"""
import collections
import importlib.util
import json
import pathlib
import numpy as np

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'research/pricing-patterns-20261001'
spec=importlib.util.spec_from_file_location('base',ROOT/'tools/research-pricing-patterns.py')
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
stamp=base.stamp
MOVE=.005
STEADY=.001
EDGE=1.0
MAX_GAP=6*3600

def orientation(side):return 1 if side in ('home','over') else -1

def selected_price(frame,book,side):
    return frame['books'][book]['anchor' if orientation(side)==1 else 'opposite']['price']

def ref_probability(frame,side):
    p=frame['pinnacle']['p'];return p if orientation(side)==1 else 1-p

def edge(frame,book,side):
    return 100*(ref_probability(frame,side)-1/selected_price(frame,book,side))

def book_gap(frame,book,side):
    other='draftkings' if book=='bet365' else 'bet365'
    return 100*(1/selected_price(frame,other,side)-1/selected_price(frame,book,side))

def joint(frame):return frame['pinnacle'] is not None and len(frame['books'])==2

def outcome_residual(rows):
    resolved=[r for r in rows if r['grade'] in ('WIN','LOSS')]
    if not resolved:return None
    groups=collections.defaultdict(lambda:[0.,0])
    for r in resolved:
        groups[r['eventKey']][0]+=(1 if r['grade']=='WIN' else 0)-r['referenceP']
        groups[r['eventKey']][1]+=1
    a=np.array(list(groups.values()));ci=None
    if len(a)>1:
        rng=np.random.default_rng(base.SEED);v=a[rng.integers(0,len(a),(5000,len(a)))].sum(axis=1)
        ci=np.percentile(v[:,0]/v[:,1]*100,[2.5,97.5]).round(3).tolist()
    return {'resolvedEntries':len(resolved),'meanReferenceP':sum(r['referenceP'] for r in resolved)/len(resolved),
            'winRate':sum(r['grade']=='WIN' for r in resolved)/len(resolved),
            'winRateMinusReferencePp':sum((1 if r['grade']=='WIN' else 0)-r['referenceP'] for r in resolved)/len(resolved)*100,
            'eventBootstrap95Pp':ci}

def describe(rows):
    s=base.summary(rows)
    s['referenceResidual']=outcome_residual(rows)
    later=[r['laterPrice'] for r in rows if r['laterPrice']['state']=='observed']
    s['laterPrice']={'observed':len(later),'missing':len(rows)-len(later),
                     'entryBeatLater':sum(r['entryBeatLater'] for r in later),
                     'meanPriceAdvantagePct':sum(r['entryVsLaterPct'] for r in later)/len(later) if later else None,
                     'verifiedClosingPrices':0}
    return s

def group(rows,keys):
    d=collections.defaultdict(list)
    for r in rows:d[' / '.join(str(r[k]) for k in keys)].append(r)
    return {k:describe(v) for k,v in sorted(d.items())}

def add_later(row,series):
    start=stamp(row['eventKey'].split('|')[2])
    future=[f for f in series if f['marketId']==row['marketId'] and f['eventKey']==row['eventKey'] and stamp(f['at'])>stamp(row['entryAt']) and stamp(f['at'])<start and stamp(f['at'])-stamp(row['entryAt'])<=MAX_GAP and row['book'] in f['books']]
    if not future:row['laterPrice']={'state':'unavailable'};return
    f=future[-1];p=selected_price(f,row['book'],row['side'])
    row['laterPrice']={'state':'observed','at':f['at'],'price':p,'entryBeatLater':row['price']>p+1e-9,
                       'entryVsLaterPct':(row['price']/p-1)*100,'minutesAfterEntry':(stamp(f['at'])-stamp(row['entryAt']))/60,
                       'label':'Last observed same-line pre-start price within six hours; not a verified close'}

def main():
    source=json.loads((OUT/'movement-frames.json').read_text());frames=source['frames']
    targets=json.loads((OUT/'entries.json').read_text())['firstSelections']
    target_map={(r['marketId'],r['side']):r for r in targets}
    series=collections.defaultdict(list)
    for f in frames:series[f['marketId']].append(f)
    hypotheses=collections.defaultdict(list);habits=[];line_changes=[];margin_rows=[]
    for market_id,all_frames in series.items():
        fs=sorted([f for f in all_frames if joint(f)],key=lambda f:stamp(f['at']))
        if not fs:continue
        first=fs[0]
        margin_rows.append({'marketId':market_id,'sport':first['sport'],'market':first['market'],
                            'bet365':first['books']['bet365']['marginPct'],'draftkings':first['books']['draftkings']['marginPct']})
        seen=set();last_pin_move=None
        for i,f in enumerate(fs):
            sides=[f['anchorSide'],'under' if f['market']=='totals' else 'away']
            pending=collections.defaultdict(list)
            prev=fs[i-1] if i>0 and stamp(f['at'])-stamp(fs[i-1]['at'])<=MAX_GAP else None
            delta_pin=f['pinnacle']['p']-prev['pinnacle']['p'] if prev else None
            delta_books={b:f['books'][b]['p']-prev['books'][b]['p'] for b in f['books']} if prev else {}
            for side in sides:
                target=target_map[(market_id,side)];sign=orientation(side)
                for book in ['bet365','draftkings']:
                    price=selected_price(f,book,side);gap=edge(f,book,side);cross=book_gap(f,book,side)
                    row={'marketId':market_id,'eventKey':f['eventKey'],'sport':f['sport'],'market':f['market'],'side':side,
                         'selectionKey':target['selectionKey'],'title':target['title'],'date':target['date'],'phase':target['phase'],
                         'entryAt':f['at'],'book':book,'price':price,'referenceP':ref_probability(f,side),'edgePp':gap,
                         'bookPriceGapPp':cross,'grade':target['grade'],'netUnits':base.units(target['grade'],price),
                         'feedSha':f['feedSha'],'observerSha':f['observerSha']}
                    if prev:
                        row['previousObservation']={'at':prev['at'],'price':selected_price(prev,book,side),
                            'bookDeltaPp':delta_books[book]*sign*100,'pinnacleDeltaPp':delta_pin*sign*100,
                            'feedSha':prev['feedSha'],'observerSha':prev['observerSha']}
                    if cross>=EDGE:
                        pending['generous_outlier'].append(row)
                        if gap>=EDGE:pending['generous_outlier_reference_supported'].append(row)
                        elif gap<=0:pending['generous_outlier_reference_unfavorable'].append(row)
                    if gap>=EDGE:
                        pending['any_reference_advantage_1pp'].append(row)
                        if prev:
                            elapsed=stamp(f['at'])-stamp(prev['at'])
                            if elapsed>=30*60 and book_gap(prev,book,side)>=EDGE and edge(prev,book,side)>=EDGE:
                                pending['persistent_supported_outlier'].append(row)
                            if delta_pin*sign>=MOVE and abs(delta_books[book])<=STEADY:
                                pending['pinnacle_moves_book_stays'].append(row)
                            other='draftkings' if book=='bet365' else 'bet365'
                            if delta_books[other]*sign>=MOVE and abs(delta_books[book])<=STEADY:
                                pending['other_book_moves_book_stays'].append(row)
                            if abs(delta_pin)>=MOVE and last_pin_move is not None and stamp(f['at'])-stamp(last_pin_move['at'])<=MAX_GAP and delta_pin*last_pin_move['delta']<0 and delta_pin*sign>0:
                                pending['pinnacle_reversal_supported_price'].append(row)
                    if prev and price<selected_price(prev,book,side) and delta_books[book]*sign>=MOVE and delta_pin*sign<=-MOVE:
                        pending['book_shortens_against_pinnacle'].append(row)
                    if prev and price>selected_price(prev,book,side) and delta_books[book]*sign<=-MOVE and delta_pin*sign<=-MOVE:
                        pending['price_gets_better_market_weakens'].append(row)
            for name,rs in pending.items():
                if name in seen:continue
                chosen=sorted(rs,key=lambda r:(-r['edgePp'],-r['bookPriceGapPp'],r['selectionKey'],r['book']))[0]
                add_later(chosen,all_frames);hypotheses[name].append(chosen);seen.add(name)
            if prev:
                one=[]
                for book in ['bet365','draftkings']:
                    other='draftkings' if book=='bet365' else 'bet365'
                    if abs(delta_books[book])>=MOVE and abs(delta_books[other])<=STEADY:
                        sign=1 if delta_books[book]>0 else -1
                        future=[a for a in fs[i+1:] if stamp(a['at'])-stamp(f['at'])<=MAX_GAP]
                        follow=next((a for a in future if (a['books'][other]['p']-f['books'][other]['p'])*sign>=.0025),None)
                        one.append({'leadingBook':book,'otherBook':other,'followedWithin6h':follow is not None,
                                    'laterComparableObservation':bool(future),
                                    'observedDelayMinutes':(stamp(follow['at'])-stamp(f['at']))/60 if follow else None})
                habits.append({'marketId':market_id,'eventKey':f['eventKey'],'sport':f['sport'],'market':f['market'],
                               'phase':target_map[(market_id,f['anchorSide'])]['phase'],'at':f['at'],
                               'intervalMinutes':(stamp(f['at'])-stamp(prev['at']))/60,'pinnacleDeltaPp':delta_pin*100,
                               'bet365DeltaPp':delta_books['bet365']*100,'draftkingsDeltaPp':delta_books['draftkings']*100,
                               'pinMove':abs(delta_pin)>=MOVE,'bet365Move':abs(delta_books['bet365'])>=MOVE,
                               'draftkingsMove':abs(delta_books['draftkings'])>=MOVE,'observedSingleBookLeads':one})
                if abs(delta_pin)>=MOVE:last_pin_move={'delta':delta_pin,'at':f['at']}
            else:last_pin_move=None
    # Sole returned line changes are descriptive; multiple returned lines are not forced into a main line.
    line_series=collections.defaultdict(list)
    for x in source['lines']:line_series[(x['eventKey'],x['market'],x['book'])].append(x)
    for key,ls in line_series.items():
        ls.sort(key=lambda f:stamp(f['at']));last=None
        for x in ls:
            if len(x['lines'])!=1:last=None;continue
            if last and 0<stamp(x['at'])-stamp(last['at'])<=MAX_GAP and x['lines'][0]!=last['lines'][0]:
                line_changes.append({'eventKey':x['eventKey'],'sport':x['sport'],'market':x['market'],'book':x['book'],
                                     'from':last['lines'][0],'to':x['lines'][0],'at':x['at'],
                                     'intervalMinutes':(stamp(x['at'])-stamp(last['at']))/60})
            last=x
    results={}
    for name,rs in hypotheses.items():
        results[name]={'all':describe(rs),'periods':group(rs,['phase']),'book':group(rs,['book']),
                       'sportMarket':group(rs,['sport','market'])}
    single=[dict(a,eventKey=h['eventKey'],marketId=h['marketId'],phase=h['phase']) for h in habits for a in h['observedSingleBookLeads']]
    leaders={}
    for book in ['bet365','draftkings']:
        rs=[r for r in single if r['leadingBook']==book];follow=[r['observedDelayMinutes'] for r in rs if r['followedWithin6h']]
        leaders[book]={'observedLeadIntervals':len(rs),'uniqueMarkets':len(set(r['marketId'] for r in rs)),
                       'withLaterComparableObservation':sum(r['laterComparableObservation'] for r in rs),
                       'otherFollowedWithin6h':len(follow),'medianObservedDelayMinutes':float(np.median(follow)) if follow else None}
    summary={'study':'book-movements-20261001','thresholds':{'movementPp':.5,'steadyPp':.1,'priceAdvantagePp':1,'maximumGapHours':6,'minimumPersistenceMinutes':30},
             'coverage':{'snapshots':len(source['snapshots']),'frames':len(frames),'markets':len(series),
                         'threeBookFrames':sum(joint(f) for f in frames),'shortComparableIntervals':len(habits)},
             'hypotheses':results,'adjustmentHabits':{'singleBookLeads':leaders,
                'materialMoves':{'pinnacle':sum(r['pinMove'] for r in habits),'bet365':sum(r['bet365Move'] for r in habits),'draftkings':sum(r['draftkingsMove'] for r in habits)},
                'opposingBookMoves':sum(r['bet365DeltaPp']*r['draftkingsDeltaPp']<0 and abs(r['bet365DeltaPp'])>=.5 and abs(r['draftkingsDeltaPp'])>=.5 for r in habits)},
             'lineChanges':dict(collections.Counter(x['book']+' / '+x['market'] for x in line_changes)),
             'lineChangesBySport':dict(collections.Counter(x['book']+' / '+x['sport']+' / '+x['market'] for x in line_changes)),
             'returnedLineCoverage':dict(collections.Counter(x['book']+' / '+x['market']+' / '+('single' if len(x['lines'])==1 else 'multiple') for x in source['lines'])),
             'meanInitialMarginPct':{b:sum(r[b] for r in margin_rows)/len(margin_rows) for b in ['bet365','draftkings']},
             'counters':source['counters']}
    (OUT/'movement-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
    (OUT/'movement-entries.json').write_text(json.dumps({'hypotheses':hypotheses,'habits':habits,'lineChanges':line_changes},indent=2)+'\n')
    print(json.dumps({'coverage':summary['coverage'],'habits':summary['adjustmentHabits'],'lines':summary['lineChanges'],
                      'hypotheses':{k:{'all':v['all'],'periods':v['periods']} for k,v in results.items()}},indent=2))

if __name__=='__main__':main()
