#!/usr/bin/env python3
"""Reproduce the September 7, 2026 Wong research audit. No live betting authority.

Default: standard-library calculations and frozen repo snapshot checks.
Optional --epub: recheck all appendix image positions and chapter-17 game grades
from the exact user-supplied source. Requires Pillow and NumPy only for images.
The EPUB is never uploaded or written into the repository by this tool.
"""
import argparse, csv, hashlib, io, json, math, statistics, re, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import Counter
from functools import lru_cache
REPO = Path(__file__).resolve().parents[1]
SOURCE_SHA = "505a64f62592c191a1918276c64a447e3ce9819a938cb1afcf45417d918b9746"

def dec(a): return 1+100/(-a) if a<0 else 1+a/100

def ev(pw, odds, pp=0): return pw*(dec(odds)-1)-(1-pw-pp)

def state(pw,pp,odds):
 pl=1-pw-pp
 return dict(win=pw,push=pp,loss=pl,decimal_odds=dec(odds),roi=ev(pw,odds,pp),fair_decimal=(1-pp)/pw if pw else None)

def bp(n,k,p=.5): return math.comb(n,k)*p**k*(1-p)**(n-k) if 0<=k<=n else 0

def bt(n,k,p=.5): return sum(bp(n,j,p) for j in range(k,n+1))

def bc(n,k,p=.5): return sum(bp(n,j,p) for j in range(0,min(k,n)+1))

@lru_cache(maxsize=None)
def pois(lam):
 r=[math.exp(-lam)]
 for k in range(1,400):
  r.append(r[-1]*lam/k)
  if k>lam+15 and r[-1]<1e-17:break
 return r

def pc(lam,k):return sum(pois(lam)[:max(0,math.floor(k)+1)])

def pp(lam,k):
 r=pois(lam);return r[k] if k<len(r) and k>=0 else 0

@lru_cache(maxsize=None)
def diff(a,b,cut=0):
 # Distribution of A-B; exact integer comparison, no shifting of Poisson means.
 x,y=pois(a),pois(b);w=t=l=0.
 for i,px in enumerate(x):
  for j,py in enumerate(y):
   v=px*py
   if i-j>cut:w+=v
   elif i-j==cut:t+=v
   else:l+=v
 return dict(win=w,push=t,loss=l)

def wilson(w,n):
 z=1.959963984540054;p=w/n;den=1+z*z/n;c=(p+z*z/(2*n))/den;h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
 return [c-h,c+h]

APPENDIX_VISUALLY_CONFIRMED_DIFFERENCES = [
  {
    "image": 323,
    "row": 28,
    "col": 5,
    "x": 46,
    "mean": 33,
    "printed": 0
  },
  {
    "image": 342,
    "row": 9,
    "col": 14,
    "A": 1.0,
    "B": 1.0,
    "outcome": "B_more",
    "printed": 34
  },
  {
    "image": 342,
    "row": 11,
    "col": 12,
    "A": 1.2,
    "B": 0.9,
    "outcome": "tie",
    "printed": 29
  },
  {
    "image": 342,
    "row": 11,
    "col": 14,
    "A": 1.2,
    "B": 1.0,
    "outcome": "B_more",
    "printed": 30
  },
  {
    "image": 342,
    "row": 18,
    "col": 1,
    "A": 1.9,
    "B": 0.6,
    "outcome": "A_more",
    "printed": 68
  },
  {
    "image": 342,
    "row": 29,
    "col": 13,
    "A": 3.0,
    "B": 1.0,
    "outcome": "A_more",
    "printed": 77
  },
  {
    "image": 343,
    "row": 27,
    "col": 13,
    "A": 3.8,
    "B": 1.5,
    "outcome": "A_more",
    "printed": 78
  },
  {
    "image": 344,
    "row": 11,
    "col": 7,
    "A": 2.2,
    "B": 1.8,
    "outcome": "A_more",
    "printed": 47
  },
  {
    "image": 344,
    "row": 19,
    "col": 13,
    "A": 3.0,
    "B": 2.0,
    "outcome": "A_more",
    "printed": 58
  },
  {
    "image": 344,
    "row": 20,
    "col": 14,
    "A": 3.1,
    "B": 2.0,
    "outcome": "B_more",
    "printed": 23
  },
  {
    "image": 344,
    "row": 22,
    "col": 1,
    "A": 3.3,
    "B": 1.6,
    "outcome": "A_more",
    "printed": 70
  },
  {
    "image": 344,
    "row": 24,
    "col": 4,
    "A": 3.5,
    "B": 1.7,
    "outcome": "A_more",
    "printed": 71
  },
  {
    "image": 344,
    "row": 25,
    "col": 1,
    "A": 3.6,
    "B": 1.6,
    "outcome": "A_more",
    "printed": 74
  },
  {
    "image": 344,
    "row": 25,
    "col": 8,
    "A": 3.6,
    "B": 1.8,
    "outcome": "B_more",
    "printed": 15
  },
  {
    "image": 344,
    "row": 28,
    "col": 4,
    "A": 3.9,
    "B": 1.7,
    "outcome": "A_more",
    "printed": 76
  },
  {
    "image": 344,
    "row": 29,
    "col": 10,
    "A": 4.0,
    "B": 1.9,
    "outcome": "A_more",
    "printed": 74
  },
  {
    "image": 351,
    "row": 26,
    "col": 10,
    "A": 23.0,
    "B": 12.5,
    "outcome": "A_more",
    "printed": 95
  },
  {
    "image": 351,
    "row": 29,
    "col": 13,
    "A": 24.5,
    "B": 13.0,
    "outcome": "A_more",
    "printed": 96
  },
  {
    "image": 352,
    "row": 25,
    "col": 13,
    "A": 22.5,
    "B": 15.5,
    "outcome": "A_more",
    "printed": 85
  },
  {
    "image": 352,
    "row": 29,
    "col": 10,
    "A": 24.5,
    "B": 15.0,
    "outcome": "A_more",
    "printed": 92
  }
]

def appendix_expected(x):
    if x['image'] < 341:
        value = pp(x['mean'], x['x']) if x['image'] < 325 else pc(x['mean'], x['x'])
    else:
        value = diff(x['A'], x['B'])[{'A_more':'win','B_more':'loss','tie':'push'}[x['outcome']]]
    return math.floor(100 * value + .5)


def image_source_audit(zf):
    import numpy as np
    from PIL import Image

    def bands(v, gap=0):
        runs=[]
        for i in np.where(v)[0]:
            if not runs or i-runs[-1][1]-1>gap: runs.append([int(i),int(i)])
            else: runs[-1][1]=int(i)
        return runs

    nums=list(range(309,324))+list(range(325,340))+list(range(341,353))
    I={n:Image.open(io.BytesIO(zf.read(f'OEBPS/html/docimages/img{n}.jpg'))).convert('L') for n in nums}
    G={}
    for n,im in I.items():
        a=np.asarray(im)<170
        yy=bands(a.sum(1)>0)[5:]
        xx=bands(a[yy[0][0]:].sum(0)>0, 3 if n<341 else 2)
        if len(xx)!=(11 if n<341 else 16): raise ValueError(f'Unexpected table geometry: {n}')
        G[n]={'x':xx,'y':yy}

    def glyphs(n,r,c):
        x0,x1=G[n]['x'][c]; y0,y1=G[n]['y'][r]
        a=np.asarray(I[n])[y0:y1+1,x0:x1+1]
        parts=bands((a<170).sum(0)>0); split=[]
        for l,h in parts:
            if h-l+1>=8:
                count=max(2,round((h-l+1)/6))
                points=[l]+[l+round((h-l+1)*i/count) for i in range(1,count)]+[h+1]
                split.extend((points[i],points[i+1]-1) for i in range(count))
            else: split.append((l,h))
        out=[]
        for l,h in split:
            z=a[:,l:h+1]; ys=np.where((z<170).sum(1)>0)[0]; z=z[ys[0]:ys[-1]+1]
            out.append(1-np.asarray(Image.fromarray(z).resize((16,24)),dtype=float).flatten()/255)
        return out
    # Labels independently read from displayed originals.
    rows309=[[90,82,74,67,61,55,50,45,41,37],[9,16,22,27,30,33,35,36,37,37],[0,2,3,5,8,10,12,14,16,18],[0,0,0,1,1,2,3,4,5,6],[0,0,0,0,0,0,0,1,1,2],[0]*10]
    labels=[(309,r,c+1,str(v)) for r,row in enumerate(rows309) for c,v in enumerate(row)]
    for r,row in enumerate([[9,9,83,8,17,76,7,24,69,7,30,63,6,36,58],[17,8,76,15,15,70,14,22,64,13,28,59,12,34,55],[24,7,69,22,14,64,20,20,60,18,26,56,17,31,52],[30,7,63,28,13,59,26,18,56,24,24,52,22,29,49],[36,6,58,34,12,55,31,17,52,29,22,49,27,27,47]]):
     labels +=[(341,r,c+1,str(v)) for c,v in enumerate(row)]
    # A14 represents the smaller, narrow font.
    for r,row in [(0,[1,1,0,0,0,0,0,0,0,0]),(1,[2,1,1,0,0,0,0,0,0,0]),(2,[3,2,1,1,0,0,0,0,0,0]),(3,[4,3,2,1,1,1,0,0,0,0]),(4,[5,4,3,2,1,1,1,0,0,0]),(5,[7,5,4,3,2,1,1,1,0,0]),(6,[8,6,5,4,3,2,2,1,1,0]),(7,[9,8,6,5,4,3,2,2,1,1])]:labels +=[(322,r,c+1,str(v)) for c,v in enumerate(row)]
    train=[]; ys=[]
    for n,r,c,label in labels:
        digits=glyphs(n,r,c)
        if len(digits)!=len(label): raise ValueError('Unexpected training glyph count')
        train.extend(digits); ys.extend(label)
    train=np.asarray(train); ys=np.asarray(ys)
    starts=[0,0,0,0,0,0,0,1,2,3,5,6,8,10,18]
    c_ranges=[(.1,.1,.1,.1),(.1,.1,.6,.1),(1.1,.1,1.1,.1),(1.1,.1,1.6,.1),(2.2,.2,2.2,.2),(2.2,.2,3.2,.2),(4.2,.2,4.2,.2),(4.2,.2,5.2,.2),(6,.5,6,.5),(6,.5,8.5,.5),(10,.5,11,.5),(10,.5,13.5,.5)]
    cells=0; matches=0; differences=[]; tables=[]
    for n in nums:
        count=matched=0
        for row in range(len(G[n]['y'])):
            for col in range(1,len(G[n]['x'])):
                x={'image':n,'row':row,'col':col}
                if n<341:
                    j=n-309 if n<325 else n-325
                    lam=j+col/10 if j<8 else 8+(j-8)*2+col/5 if j<13 else 19+(j-13)*10+col-1
                    x.update(x=starts[j]+row,mean=round(lam,8))
                else:
                    a0,da,b0,db=c_ranges[n-341]
                    x.update(A=round(a0+da*row,8), B=round(b0+db*((col-1)//3),8), outcome=['A_more','B_more','tie'][(col-1)%3])
                predicted=''
                for digit in glyphs(n,row,col):
                    costs=np.mean((train-digit)**2,axis=1)
                    class_costs=[min(costs[ys==str(k)]) for k in range(10)]
                    predicted+=str(int(np.argmin(class_costs)))
                actual=int(predicted) if predicted else None
                expected=appendix_expected(x)
                cells+=1; count+=1
                if actual==expected: matches+=1; matched+=1
                else: differences.append({**x,'printed':actual,'calculated':expected})
        tables.append({'image':n,'positions':count,'matches':matched})
    return {'positions':cells,'matching_positions':matches,'differences':differences,'tables':tables,'method':'Image geometry and digit templates trained on visually read cells; independently calculated probabilities; all observed differences visually checked in the September 7 review. Automatic matches are not a manual transcription of every cell.'}

def chapter17_source_audit(zf):
    r=ET.fromstring(zf.read('OEBPS/html/24_chap17.html'));ns={'h':'http://www.w3.org/1999/xhtml'};b=r.find('h:body',ns)
    rows=[];yr=None;wk=None;role=0
    for child in b:
     s=' '.join(''.join(child.itertext()).split());tag=child.tag.split('}')[-1]
     if tag in ['h2','h3','h4']:
      m=re.match(r'(19\d\d|20\d\d):',s)
      if m:yr=int(m[1])
     if tag!='table':continue
     for tr in child.findall('h:tr',ns):
      cells=[' '.join(''.join(x.itertext()).split()) for x in tr.findall('h:td',ns)]
      if len(cells)!=2:continue
      a,c=cells;m=re.search(r'Bet watch for week (\d+)',a)
      if m:wk=int(m[1]);role=0;continue
      row=dict(year=yr,week=wk,role=['champ','total','next','previous'][role] if role<4 else 'extra',description=a,printed=c)
      role+=1
      m=re.search(r'([+-]\d+(?:\.\d+)?|pk|pick [‘’\']?em)\s+(?:vs\.?|at)',a,re.I);sco=re.fullmatch(r'([WLP]) (\d+)-(\d+)',c)
      if m and sco:
       spread=0 if m[1].lower().startswith(('pk','pick')) else float(m[1]);pts=int(sco[2])-int(sco[3])+spread
       row.update(spread=spread,score_for=int(sco[2]),score_against=int(sco[3]),recomputed='W' if pts>0 else 'L' if pts<0 else 'P',printed_grade=sco[1])
      rows.append(row)
    # Total grading uses the paired champion game's score; exclude unknown quote.
    for row in rows:
     if row['role']!='total':continue
     m=re.search(r'total (\d+(?:\.\d+)?)',row['description'])
     champ=next((x for x in rows if x['year']==row['year'] and x['week']==row['week'] and x['role']=='champ' and 'score_for' in x),None)
     if m and champ:
      tot=champ['score_for']+champ['score_against'];line=float(m[1]);row['recomputed']='Over' if tot>line else 'Under' if tot<line else 'P';row['printed_grade']=row['printed'] or ('Over' if 'Over' in row['description'] else 'Under' if 'Under' in row['description'] else '')
    summary={}
    for lo,hi in [(1985,2000),(2001,2010)]:
     for role in ['champ','total','next','previous']:
      x=[r for r in rows if lo<=r['year']<=hi and r['role']==role];summary[f'{lo}-{hi}_{role}']=dict(printed=dict(Counter(r['printed_grade'] for r in x if 'printed_grade' in r)),recomputed=dict(Counter(r['recomputed'] for r in x if 'recomputed' in r)),rows=len(x))
    errors=[x for x in rows if 'recomputed' in x and x['recomputed']!=x['printed_grade']]
    unknown=[x for x in rows if ('unknown' in x['description'])]
    o={'parsed_rows':len(rows),'side_rows_graded':sum('spread' in x for x in rows),'total_rows_graded':sum(x['role']=='total' and 'recomputed'in x for x in rows),'internal_grading_conflicts':errors,'unknown_totals':unknown,'summary':summary,'limitations':'Internal consistency check of printed inputs, not independent certification of historical scores/lines. Published summaries may disagree separately.'}
    return o

def build_audit():
    r={"scope":"RESEARCH_ONLY_NO_LIVE_FAIR_OR_BET","epub_sha256":"505a64f62592c191a1918276c64a447e3ce9819a938cb1afcf45417d918b9746"}
    r['chapter2']={"risks_for_six_sample_problems":[10,1200,80,40,100/2.6,100/6],"full_kelly_p55_minus110":(.55*(10/11)-.45)/(10/11),"flat_300_bets_p55_minus110":{"expected_roi":ev(.55,-110),"probability_net_loss":bc(300,157,.55),"roi_sd":dec(-110)*math.sqrt(.55*.45/300)},"probability_net_loss_flat_400_bets_p55_minus110":bc(400,209,.55)}
    r['chapter3']={"free_bet_minus110_p50":.5*10/11,"free_bet_minus110_p_implied":(11/21)*10/11,"three_leg_free_bet_6to1_p50":.5**3*6}
    r['chapter4']={"problems":{"1":ev(.5,-105),"2":1/dec(-105),"3":ev(.57,-110),"4":ev(.95,-800),"5":1/dec(185),"6":ev(.4,185),"7":ev(.75,-400),"8_hold_minus115":15/230,"9_exact_roi":ev(7/9,-280),"10_maximum_favorite_price_for_10percent_roi":-100/(1.1/(7/9)-1)},"push_example_ticket":.55*210+.10*110,"push_example_roi":ev(.55,-110,.1)}
    r['chapter6']={"boxing_two_way_equal_return_roi":1/(1/3.1+1/1.5)-1,"three_way_equalized_roi":1/(1/3.5+1/3.5+1/2.6)-1,"three_way_literal_stakes_min_roi":700/670-1,"three_way_literal_stakes_max_roi":702/670-1}
    # Printed table4 thresholds, visually transcribed; null .5, one-sided exact upper tail.
    raw='''6 0 0 0
    7 7 0 0
    8 8 0 0
    9 8 0 0
    10 9 10 0
    11 10 11 0
    12 11 12 0
    13 11 12 0
    14 12 13 14
    15 13 14 15
    16 13 15 16
    17 14 15 17
    18 15 16 17
    19 15 17 18
    20 16 18 19
    21 17 18 19
    22 17 19 20
    23 18 20 21
    24 19 20 22
    25 19 21 22
    26 20 22 23
    27 20 22 24
    28 21 23 24
    29 21 23 25
    30 22 24 26
    35 25 27 29
    40 28 30 32
    50 34 37 39
    60 40 43 45
    70 45 49 51
    80 51 54 57
    90 57 60 63
    100 62 66 69
    150 90 95 98
    200 117 122 127
    250 144 150 155
    300 171 177 183
    350 198 205 210
    400 224 231 238
    450 250 259 265
    500 277 285 292
    600 329 338 346
    700 381 391 400
    800 434 444 453
    900 486 497 506
    1000 537 549 559'''
    t4=[]
    for line in raw.splitlines():
     n,*ks=map(int,line.split())
     for alpha,k in zip([.01,.001,.0001],ks):
      exact=next((j for j in range(n//2,n+1) if bt(n,j)<=alpha),None)
      t4.append(dict(n=n,alpha=alpha,printed_min_wins=k or None,exact_min_wins=exact,printed_tail=bt(n,k) if k else None,meets_rarity=None if not k else bt(n,k)<=alpha,exact_match=(k or None)==exact))
    r['chapter7']={"table4_cells":len(t4),"table4_exact_matches":sum(x['exact_match'] for x in t4),"table4_printed_threshold_too_lenient":sum(x['meets_rarity'] is False for x in t4),"table4":t4,"examples":[dict(w=w,l=l,pvalue50=bt(w+l,w),pvalue_profitability_minus110=bt(w+l,w,11/21)) for w,l in [(35,20),(27,8),(15,5),(65,35),(150,100),(86,57)]],"four_sigma_one_tail":1-statistics.NormalDist().cdf(4)}
    r['chapter8']={"five_dollar_minus160_plus170_return":5*dec(-160)*dec(170),"ten_dollar_minus120_minus150_return":10*dec(-120)*dec(-150),"two_leg_roi_p55_D3_6":.55**2*3.6-1,"three_leg_roi_p55_D7":.55**3*7-1,"p50_pay_grid_rois":{str(n):.5**n*d-1 for n,d in [(2,3.6),(3,7),(4,13)]},"three_of_four_equal_stakes_joint95_roi":.95*3.6/3-1}
    c9={"under2_5_mean1_5":pc(1.5,2),"rounded81pct_minus190_roi":ev(.81,-190),"rounded81pct_plus125_roi":ev(.81,125),"sacks_under5_mean4_7_minus120":state(pc(4.7,4),pp(4.7,5),-120),"fieldgoals_2_2_vs1_2":diff(2.2,1.2),"fieldgoals_shift_one":diff(2.2,1.2,1),"difference7_6_vs6_4_minus1":diff(7.6,6.4,1),"problems":{}}
    c9['problems']['1']=state(pc(4.8,4),pp(4.8,5),100)
    z=diff(2.5,1.6);c9['problems']['2']=state(z['win'],0,-115)
    z=diff(12,7.3,2);c9['problems']['3']=state(z['win'],z['push'],-115)
    c9['problems']['4']='Poisson yards/points inappropriate; no probability supplied'
    c9['problems']['5']=state(math.exp(-.4),0,-200)
    c9['problems']['6']='Path-dependent tie; no suitable probability model supplied'
    c9['problems']['7']=state(.9*.7,0,100)
    c9['problems']['8']=state(1-pc(10.6,10),0,120)
    c9['problems']['9']=state(1-pc(20,19),0,100)
    z=diff(26.6,18,6.5);c9['problems']['10']=state(z['win'],0,-110)
    z=diff(15.4,12.4,1.5);c9['problems']['11']=state(z['win'],0,-120)
    c9['table7_same_difference_2']=[dict(a=a,b=b,**diff(a,b),decisive_win=diff(a,b)['win']/(1-diff(a,b)['push'])) for a,b in [(12,10),(22,20),(102,100)]]
    r['chapter9']=c9
    r['chapter10']={"middle_at_minus110":[dict(p=p,roi=(200*p-10*(1-p))/220) for p in [.063,.124,.184]],"middle_nfl_rounded_example":(200*.196-12.5*(1-.196))/225,"middle_MLB_exact_center_81":bp(162,81),"mean82_MLB_over80_5_minus115":state(bt(162,81,82/162),0,-115),"16_game_p50_total7_integer":state(bt(16,8),bp(16,7),-110),"table11_1_game_pseudo_probability":(bt(16,7)+bt(16,8))/2}
    # Counterexample equal season mean, unequal independent game probabilities.
    dis=[1.]
    for p in [.9]*8+[.1]*8:
     nxt=[0.]*(len(dis)+1)
     for i,x in enumerate(dis):nxt[i]+=x*(1-p);nxt[i+1]+=x*p
     dis=nxt
    r['chapter10']['equal_mean_different_schedule']={"mean":8,"iid_p50_variance":4,"heterogeneous_variance":1.44,"iid_probability_8":bp(16,8),"heterogeneous_probability_8":dis[8]}
    def tournament_seed_expectations(exponent):
     order=[1,16,8,9,5,12,4,13,6,11,3,14,7,10,2,15]*4
     strengths=[2**(exponent*(16-k)) for k in order]
     nodes=[{i:1.} for i in range(64)];wins=[0.]*64
     while len(nodes)>1:
      nxt=[]
      for j in range(0,len(nodes),2):
       a,b=nodes[j:j+2];z={}
       for i,pi in a.items():z[i]=pi*sum(pj*strengths[i]/(strengths[i]+strengths[k]) for k,pj in b.items())
       for i,pi in b.items():z[i]=pi*sum(pj*strengths[i]/(strengths[i]+strengths[k]) for k,pj in a.items())
       for i,pi in z.items():wins[i]+=pi
       nxt.append(z)
      nodes=nxt
     return dict(exponent=exponent,expected_total=sum(wins),expected_wins_by_seed={str(k):sum(wins[i] for i,s in enumerate(order) if s==k)/4 for k in range(1,17)})
    r['tournament_sensitivity_counterexample']=[tournament_seed_expectations(e) for e in [.05,.25,1]]
    r['chapter11']={"PAC10_under10_5_mean9_3":state(pc(9.3,10),0,-115),"ACC_under13_5_mean11_1":state(pc(11.1,13),0,-130),"SEC_under9_mean8_4":state(pc(8.4,8),pp(8.4,9),120),"Big10_over11_mean12_2":state(1-pc(12.2,11),pp(12.2,11),-110),"Big12_under7_5_mean7_1":state(pc(7.1,7),0,-115),"Big12_mistaken_under7":state(pc(7.1,6),pp(7.1,7),-115),"BigEast_question_under7_5_minus105_mean4_7":state(pc(4.7,7),0,-105),"BigEast_solution_line_under5_5_minus105_mean4_7":state(pc(4.7,5),0,-105),"BigEast_solution_line_under5_5_wrong_minus125_mean4_7":state(pc(4.7,5),0,-125)}
    r['chapter14']={"balanced_fair_minus3_p3_10pct":{"minus3_minus110":state(.45,.1,-110),"minus2_5_minus110":state(.55,0,-110),"minus2_5_minus120":state(.55,0,-120),"minus2_5_fair_decimal":1/.55},"true_minus6_to_minus4":{"win":.485+.03+.02,"push":.03,"roi":ev(.535,-110,.03)},"minus2_5_plus3_side_combo_roi":(.1*100-.9*10)/220,"minus2_5_plus3_5_middle_roi":(.1*200-.9*10)/220,"halfpoint_purchase_thresholds":{"push_to_win_minus110_to120_assume_equal_decisive_at_old_line":1/23,"loss_to_push_minus110_to120_assume_pwin50":.5*(10/11-10/12)},"table21_minus3_minus110_SU_breakeven_assuming_1_2_mass04_3_mass10":.04+.1+.9*(11/21)}
    r['chapter14']['six_sample_problems']={
     '1_at_hypothetical_SU_p50': {'PK_plus110_roi':ev(.5,110),'plus1_minus110_roi':ev(.5,-110,.02)},
     '2_at_hypothetical_dog_SU_p41': {'ML_plus135_roi':ev(.41,135),'plus3_minus110_roi':ev(.45,-110,.10)},
     '3_at_hypothetical_favorite_SU_p59': {'ML_minus155_roi':ev(.59,-155),'minus3_minus110_roi':ev(.45,-110,.10)},
     '3_counterexample_favorite_SU_p70': {'ML_minus155_roi':ev(.70,-155),'minus3_minus110_roi':ev(.56,-110,.10)},
     '4': 'Compare every settlement state after repricing; historical r3=.10 favors a ten-cent half-point purchase in the balanced examples, not a universal rule.',
     '5': 'NFL estimates cannot value Ohio State-Wisconsin college football.',
     '6': 'Compare price savings p_win*(100/105-100/110) with the payoff of the exact gained state; see detailed half-point equations in review.'
    }
    r['chapter15']={"fair_total37_push05_under37_5_minus110":state(.525,0,-110),"total_middle_43_5_to45_5_using_T25":(.06*200-.94*10)/220}
    q=.68;l=.293;t=.027
    r['chapter16']={"two_leg_minus110_decisive_threshold":math.sqrt(11/21),"minus9_to_plus3_rounded_rates":{"single_decisive_p":q/(q+l),"two_leg_roi_any_push_refund":(10/11)*q*q-(2*q*l+l*l),"two_leg_roi_push_loss_loses":(10/11)*q*q-(l*l+2*l*q+2*l*t)},"six_point_book_aggregate":dict(win=461,loss=169,push=5,decisive_p=461/630),"seven_point_visiting_dogs":218/(218+78),"seven_point_total":679/(679+236),"six_point_raw_T29_reconstructed":dict(win=460,loss=168,push=4,decisive_p=460/628),"teaser_breakevens":[dict(n=n,odds=o,p=dec(o)**(-1/n)) for n,os in [(2,[110,100,-110,-120,-130,-140]),(3,[180,170,160,150,140,130,120,110,100]),(4,[300])] for o in os]}
    # Same hypothetical full-game regulation score model supports ML/totals/margins,
    # but is not a fitted MLB model. Regulation ties resolved by separate 0.5 assumption.
    a,b=4.2,4.8;z=diff(a,b)
    r['full_game_demonstration']={"status":"HYPOTHETICAL_UNVALIDATED_INPUTS_NOT_CURRENT_RESEARCH_EVIDENCE","regulation_run_means":[a,b],"regulation_tie":z['push'],"away_full_game_moneyline_p_with_equal_extra_innings":z['win']+.5*z['push'],"regulation_total_under9":state(pc(a+b,8),pp(a+b,9),-110),"regulation_away_plus1_5_p":1-diff(b,a,1.5)['win'],"restriction":"Cannot call regulation total or run line full-game MLB; extra innings and game-ending rules change both."}
    # Frozen modern descriptive HFA, with exact filters/provenance.
    p=REPO/'data/walters/nfl/home-field/source/nflverse-schedules-hfa-snapshot-2026-09-01.csv'
    if hashlib.sha256(p.read_bytes()).hexdigest() != '5c3f02dfe4357d8debfa95ed923a79a622fcaabfc9f098a1d71c10a45d277bc7':
     raise ValueError('HFA snapshot differs from the frozen review input')
    rows=list(csv.DictReader(p.open()));h=[]
    for lo,hi in [(2021,2024),(2025,2025),(2021,2025)]:
     x=[float(t['home_score'])-float(t['away_score']) for t in rows if lo<=int(t['season'])<=hi and t['game_type']=='REG' and t['location']=='Home' and t['home_score']!='' and t['away_score']!='']
     h.append(dict(seasons=[lo,hi],games=len(x),home_minus_away_mean=statistics.mean(x),standard_error=statistics.stdev(x)/math.sqrt(len(x)),home_wins=sum(v>0 for v in x),ties=sum(v==0 for v in x)))
    r['historical_HFA_comparison']={"snapshot":str(p.relative_to(REPO)),"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"descriptive_not_causal":True,"samples":h,"book_T13_1990_2010_raw_mean":(113086-99198)/5114,"already_active_governed_baseline":2.082}
    r['appendix_observed_differences']=[{**x,'calculated':appendix_expected(x)} for x in APPENDIX_VISUALLY_CONFIRMED_DIFFERENCES]
    return r

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--epub',type=Path)
    args=parser.parse_args()
    result=build_audit()
    if args.epub:
        if hashlib.sha256(args.epub.read_bytes()).hexdigest()!=SOURCE_SHA:
            raise ValueError('EPUB differs from the reviewed source; do not reuse its glyph/layout assumptions')
        with zipfile.ZipFile(args.epub) as zf:
            result['appendix_source_audit']=image_source_audit(zf)
            result['chapter17_source_audit']=chapter17_source_audit(zf)
    text=json.dumps(result,indent=2)+'\n'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(text)
        print(json.dumps({'output':str(args.output),'table4_cells':result['chapter7']['table4_cells'],'table4_deficient_thresholds':result['chapter7']['table4_printed_threshold_too_lenient'],'appendix_source_audited':bool(args.epub)}))
    else:print(text,end='')

if __name__=='__main__': main()
