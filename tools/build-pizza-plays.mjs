import fs from 'node:fs';

const ODDS_PATH='data/live-odds.json';
const HISTORY_PATH='run-history.json';
const OUT_PATH='data/pizza-plays.json';
const TIMEZONE='America/Vancouver';
const MIN_START_LEAD_MINUTES=20;
const MIN_DECIMAL=1.18;
const MAX_DECIMAL=2.80;
const MIN_LEG_EV=0.0125;
const MAX_FAIR_DISPERSION=0.07;
const MIN_TWO_EV=0.025;
const MIN_THREE_EV=0.04;
const STAKE_UNITS=0.25;
const ACCEPTED_MARKETS=new Set(['ml','moneyline','money-line','match-winner','h2h','spread','run-line','puck-line','handicap','point-spread']);

const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const mean=a=>{const x=a.filter(Number.isFinite);return x.length?x.reduce((s,v)=>s+v,0)/x.length:null};
const round=(v,d=4)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
function americanFromDecimal(d){d=Number(d);if(!Number.isFinite(d)||d<=1)return null;return d>=2?Math.round((d-1)*100):Math.round(-100/(d-1))}
function americanText(d){const n=americanFromDecimal(d);return n==null?'—':`${n>0?'+':''}${n}`}
function ptStamp(v){const d=new Date(v);if(!Number.isFinite(d.getTime()))return null;return new Intl.DateTimeFormat('en-CA',{timeZone:TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d).replace(',','')+' PT'}
function rowLine(row){for(const k of ['hdp','line','points']){const n=num(row?.[k]);if(n!=null)return n}return null}
function rowSides(row){const out=[];for(const side of ['home','away','draw']){const d=num(row?.[side]);if(d!=null&&d>1.001)out.push({side,decimal:d})}return out}
function noVig(row){const sides=rowSides(row);if(sides.length<2)return null;const raw=sides.map(x=>({...x,p:1/x.decimal}));const sum=raw.reduce((s,x)=>s+x.p,0);if(!(sum>0))return null;return Object.fromEntries(raw.map(x=>[x.side,x.p/sum]))}
function marketKey(m){return String(m?.marketKey||m?.name||'').trim().toLowerCase().replace(/\s+/g,'-')}
function marketAllowed(k){return ACCEPTED_MARKETS.has(k)||/(^|-)spread$/.test(k)||/(^|-)handicap$/.test(k)||/run-line|puck-line/.test(k)}
function selectionKey(row,side,eventId,k,line){return String(row?.selectionKeys?.[side]||row?.identity?.selectionKeys?.[side]||`${eventId}|${k}|${side}||${line==null?'':line}`)}
function selectionLabel(event,side,k,line){const name=side==='home'?event.home:side==='away'?event.away:'Draw';if(k==='ml'||/money|match-winner|h2h/.test(k))return `${name} ML`;if(line==null)return `${name} ${k.toUpperCase()}`;const x=side==='away'?-line:line;const suffix=/run-line/.test(k)?'RL':/puck-line/.test(k)?'PL':'SPREAD';return `${name} ${x>0?'+':''}${x} ${suffix}`}
function latestReportMeta(odds,history){const runs=Array.isArray(history?.runs)?history.runs.filter(r=>r?.path):[];const exact=runs.filter(r=>r.feedGeneratedAt===odds.generatedAt).sort((a,b)=>Date.parse(b.ts||0)-Date.parse(a.ts||0));return exact[0]||runs.sort((a,b)=>Date.parse(b.ts||0)-Date.parse(a.ts||0))[0]||null}
function reportMap(report){const m=new Map();for(const r of Array.isArray(report?.recs)?report.recs:[]){if(r?.feed?.selectionKey)m.set(String(r.feed.selectionKey),r)}return m}
function bettingEdgeGate(rec){if(!rec)return{allowed:true,status:'NOT TRACKED',note:'Not present on the issued Betting Edge shortlist.'};const s=String(rec.status||'').toUpperCase();if(['PASS','WAIT'].includes(s))return{allowed:false,status:s,note:rec.analysis||rec.contrary||`${s} in Betting Edge`};return{allowed:true,status:s||'TRACKED',note:rec.analysis||rec.support||'Tracked by Betting Edge'}}

function extractCandidates(odds,report,clock=Date.now()){
  const rmap=reportMap(report), groups=new Map();
  const diagnostics={eventsScanned:0,marketRowsScanned:0,priceQuotesScanned:0,excludedStartedSoon:0,excludedUnsupportedMarket:0,excludedOneBook:0,excludedPriceBand:0,excludedWeakEv:0,excludedDisagreement:0,excludedBettingEdge:0};
  for(const event of odds.events||[]){
    diagnostics.eventsScanned++;
    const start=Date.parse(event?.date||'');
    if(!Number.isFinite(start)||start<=clock+MIN_START_LEAD_MINUTES*60000){diagnostics.excludedStartedSoon++;continue}
    if(event?.status&&!['pending','scheduled','not_started'].includes(String(event.status).toLowerCase()))continue;
    const eventId=String(event?.eventId||event?.id||'');if(!eventId)continue;
    for(const [book,markets] of Object.entries(event?.bookmakers||{})){
      if(!Array.isArray(markets))continue;
      for(const market of markets){
        const k=marketKey(market);if(!marketAllowed(k)){diagnostics.excludedUnsupportedMarket++;continue}
        for(const row of Array.isArray(market?.odds)?market.odds:[]){
          diagnostics.marketRowsScanned++;const fair=noVig(row);if(!fair)continue;const line=rowLine(row);
          for(const {side,decimal} of rowSides(row)){
            diagnostics.priceQuotesScanned++;const sk=selectionKey(row,side,eventId,k,line);
            if(!groups.has(sk))groups.set(sk,{selectionKey:sk,eventId,eventKey:event.eventKey||`odds-api-io:${eventId}`,event,marketKey:k,marketName:market?.name||k,line,side,quotes:[],fairByBook:[]});
            const g=groups.get(sk);g.quotes.push({book,decimal,updatedAt:market?.updatedAt||null});if(Number.isFinite(fair[side]))g.fairByBook.push({book,probability:fair[side]});
          }
        }
      }
    }
  }
  const rows=[];
  for(const g of groups.values()){
    const books=[...new Set(g.fairByBook.map(x=>x.book))];if(books.length<2){diagnostics.excludedOneBook++;continue}
    const best=g.quotes.slice().sort((a,b)=>b.decimal-a.decimal)[0];if(!best||best.decimal<MIN_DECIMAL||best.decimal>MAX_DECIMAL){diagnostics.excludedPriceBand++;continue}
    const fairs=books.map(b=>mean(g.fairByBook.filter(x=>x.book===b).map(x=>x.probability))).filter(Number.isFinite);const fairProb=mean(fairs);if(!Number.isFinite(fairProb)||fairProb<=0||fairProb>=1)continue;
    const dispersion=Math.max(...fairs)-Math.min(...fairs);if(dispersion>MAX_FAIR_DISPERSION){diagnostics.excludedDisagreement++;continue}
    const ev=fairProb*best.decimal-1;if(ev<MIN_LEG_EV){diagnostics.excludedWeakEv++;continue}
    const gate=bettingEdgeGate(rmap.get(g.selectionKey));if(!gate.allowed){diagnostics.excludedBettingEdge++;continue}
    const fairDecimal=1/fairProb, sport=g.event?.sport?.name||g.event?.sport?.slug||'Unknown';
    const score=ev*100-dispersion*35+(gate.status==='BET'?1:gate.status==='LEAN'?.5:0);
    rows.push({eventId:g.eventId,eventKey:g.eventKey,selectionKey:g.selectionKey,sport,league:g.event?.league?.name||'',event:`${g.event?.away||'Away'} @ ${g.event?.home||'Home'}`,eventStart:g.event?.date||null,selection:selectionLabel(g.event,g.side,g.marketKey,g.line),market:g.marketName,marketKey:g.marketKey,side:g.side,line:g.line,book:best.book,decimal:round(best.decimal),american:americanText(best.decimal),fairProbability:round(fairProb,6),fairDecimal:round(fairDecimal),fairAmerican:americanText(fairDecimal),ev:round(ev,6),evPercent:round(ev*100,2),bookFairDispersion:round(dispersion,6),updatedAt:best.updatedAt,bettingEdgeStatus:gate.status,bettingEdgeNote:gate.note,score:round(score,6)});
  }
  const bestByEvent=new Map();for(const c of rows.sort((a,b)=>b.score-a.score)){if(!bestByEvent.has(c.eventId))bestByEvent.set(c.eventId,c)}
  return{pool:[...bestByEvent.values()].sort((a,b)=>b.score-a.score).slice(0,30),diagnostics};
}
function combinations(rows,n){const out=[];function go(start,pick){if(pick.length===n){out.push(pick.slice());return}for(let i=start;i<rows.length;i++)go(i+1,[...pick,rows[i]])}go(0,[]);return out}
function parlayFromLegs(legs,kind){const combinedDecimal=legs.reduce((p,l)=>p*l.decimal,1),fairProbability=legs.reduce((p,l)=>p*l.fairProbability,1),fairDecimal=1/fairProbability,ev=fairProbability*combinedDecimal-1;return{kind,status:'PLAY',priceType:'ESTIMATED FROM INDEPENDENT LEG PRICES',legs,combinedDecimal:round(combinedDecimal),combinedAmerican:americanText(combinedDecimal),fairProbability:round(fairProbability,6),fairDecimal:round(fairDecimal),fairAmerican:americanText(fairDecimal),ev:round(ev,6),evPercent:round(ev*100,2),stakeUnits:STAKE_UNITS,potentialProfitUnits:round(STAKE_UNITS*(combinedDecimal-1),3),expectedValueUnits:round(STAKE_UNITS*ev,3),distinctSports:new Set(legs.map(l=>l.sport)).size,independenceAssumption:'Different-event legs treated as independent for fair-price math.'}}
function bestParlay(pool,n){const min=n===2?MIN_TWO_EV:MIN_THREE_EV;let best=null,bestScore=-Infinity;for(const legs of combinations(pool,n)){if(new Set(legs.map(l=>l.eventId)).size!==n)continue;const p=parlayFromLegs(legs,n===2?'TWO-TOPPING':'THREE-TOPPING');if(p.ev<min)continue;const s=legs.reduce((x,l)=>x+l.score,0)+(p.distinctSports-1)*.2+p.ev*10;if(s>bestScore){best=p;bestScore=s}}return best}
function noPlay(kind,n,min){return{kind,status:'NO PLAY',legs:[],reason:`No ${n}-leg independent combination cleared the Pizza price, two-book no-vig, disagreement, Betting Edge veto and ${(min*100).toFixed(1)}% parlay-EV gates.`,stakeUnits:0}}
function build(odds,history,report,clock=Date.now()){
  if(!Array.isArray(odds?.events))throw new Error('live-odds.json does not contain events[]');if(!Number.isFinite(Date.parse(odds.generatedAt||'')))throw new Error('live-odds.json generatedAt is invalid');
  const reportMeta=latestReportMeta(odds,history);const {pool,diagnostics}=extractCandidates(odds,report,clock);const two=bestParlay(pool,2)||noPlay('TWO-TOPPING',2,MIN_TWO_EV),three=bestParlay(pool,3)||noPlay('THREE-TOPPING',3,MIN_THREE_EV);
  return{schema:1,title:'Pizza Plays',description:'Manual cross-sport Two-Topping and Three-Topping value parlays.',mode:'MANUAL',timezone:TIMEZONE,generatedAt:new Date(clock).toISOString(),generatedAtVancouver:ptStamp(clock),sourceOdds:{path:ODDS_PATH,generatedAt:odds.generatedAt||null,generatedAtVancouver:odds.generatedAtVancouver||ptStamp(odds.generatedAt),schema:odds.schema||null,bookmakers:Array.isArray(odds.bookmakers)?odds.bookmakers:[]},sourceBettingEdge:reportMeta?{path:reportMeta.path||null,slot:reportMeta.slot||null,label:reportMeta.label||null,ts:reportMeta.ts||null,feedGeneratedAt:reportMeta.feedGeneratedAt||null}:null,policy:{trigger:'WORKFLOW_DISPATCH ONLY',oddsApiRequests:0,eligibleMarkets:['Moneyline','Spread','Run Line','Puck Line','Side/Handicap'],minimumStartLeadMinutes:MIN_START_LEAD_MINUTES,decimalPriceBand:[MIN_DECIMAL,MAX_DECIMAL],minimumStandaloneEvPercent:round(MIN_LEG_EV*100,2),maxTwoBookFairDispersionPoints:round(MAX_FAIR_DISPERSION*100,1),minimumTwoToppingEvPercent:round(MIN_TWO_EV*100,1),minimumThreeToppingEvPercent:round(MIN_THREE_EV*100,1),defaultStakeUnits:STAKE_UNITS,bettingEdgeVeto:['PASS','WAIT'],noPlayIsValid:true},candidateCount:pool.length,diagnostics,twoTopping:two,threeTopping:three};
}
function loadCurrent(){const odds=readJson(ODDS_PATH),history=fs.existsSync(HISTORY_PATH)?readJson(HISTORY_PATH):{runs:[]},meta=latestReportMeta(odds,history),report=meta?.path&&fs.existsSync(meta.path)?readJson(meta.path):null;return{odds,history,report}}
function selfTest(){const now=Date.parse('2026-08-24T16:00:00Z');const mk=(id,sport,home,away,a,b)=>({id,eventId:String(id),eventKey:`test:${id}`,home,away,date:'2026-08-24T22:00:00Z',status:'pending',sport:{name:sport,slug:sport.toLowerCase().replace(/ /g,'-')},league:{name:'Test'},bookmakers:{Bet365:[{name:'ML',marketKey:'ml',updatedAt:'2026-08-24T15:59:00Z',odds:[{home:String(a),away:String(b),selectionKeys:{home:`${id}|ml|home||`,away:`${id}|ml|away||`}}]}],DraftKings:[{name:'ML',marketKey:'ml',updatedAt:'2026-08-24T15:59:00Z',odds:[{home:String(a+.08),away:String(Math.max(1.05,b-.04)),selectionKeys:{home:`${id}|ml|home||`,away:`${id}|ml|away||`}}]}]}});const odds={schema:5,generatedAt:new Date(now).toISOString(),bookmakers:['Bet365','DraftKings'],events:[mk(1,'Baseball','A','B',1.7,2.25),mk(2,'Football','C','D',1.72,2.2),mk(3,'Ice Hockey','E','F',1.75,2.15)]};const out=build(odds,{runs:[]},null,now);if(!['PLAY','NO PLAY'].includes(out.twoTopping.status)||!['PLAY','NO PLAY'].includes(out.threeTopping.status))throw new Error('Pizza self-test failed');console.log('Pizza self-test OK')}

if(process.argv.includes('--self-test'))selfTest();else{const {odds,history,report}=loadCurrent();const out=build(odds,history,report);fs.writeFileSync(OUT_PATH,JSON.stringify(out,null,2)+'\n');JSON.parse(fs.readFileSync(OUT_PATH,'utf8'));console.log(`Pizza Plays: ${out.twoTopping.status} / ${out.threeTopping.status} // ${out.candidateCount} candidates // source ${out.sourceOdds.generatedAt}`)}
