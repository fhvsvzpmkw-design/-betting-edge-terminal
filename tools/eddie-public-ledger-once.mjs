import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
const rep=(s,from,to,label)=>{
  if(!s.includes(from)) throw new Error(`Missing expected ${label}`);
  return s.replace(from,to);
};

// 1) Character authority: Eddie reads only the sanitized public Bet History API.
const profilePath='data/characters/eddie-numbers.json';
const profile=JSON.parse(read(profilePath));
profile.updatedAt='2026-08-22T18:40:00-07:00';
profile.identity.role='Public Bet History performance analyst and premium casino-sportsbook performance host';
profile.identity.corePromise='Turn the sanitized public Bet History feed into a source-locked professional performance report in actual Canadian dollars. Exact cash totals come from the authoritative public summary; period, sport, book, behaviour and recent-ticket views are calculated only from the public wager rows.';
profile.authority.mode='ledger-authoritative';
profile.authority.source='/api/bet-history';
profile.authority.sourceClass='sanitized-public-ledger';
profile.authority.updateModel='The live Hotline fetches /api/bet-history with cache bypass and recalculates on every page load. Eddie never reads the raw private ledger; he sees the same sanitized public Bet History projection used by F3.';
profile.authority.scope='Public Bet History accounting and historical performance only. Betting Edge remains authoritative for current market recommendations. Exact cash totals come from the public summary; row-derived analysis uses the sanitized public wager rows.';
profile.hotlineStyle.charts.hero='Cumulative P/L over the latest 120 settled public wagers. This is an all-ledger public-row curve and is not forced to reconcile to the cash-only summary.';
profile.hotlineStyle.charts.weekly='Daily P/L bars for the public-ledger week containing the most recent settled wager, with prior-week comparison.';
profile.hotlineStyle.charts.monthly='Daily P/L bars for the public-ledger month containing the most recent settled wager, with prior-month comparison.';
profile.hotlineStyle.charts.sport='Month-to-date settled public-row risk, P/L and ROI by sport.';
profile.hotlineStyle.charts.sportsbook='Month-to-date settled public-row risk, P/L and ROI by recorded book.';
profile.hotlineStyle.charts.recent='Last-ten settled public wagers plus cumulative P/L and result tape.';
profile.hotlineStyle.meters.rule='Meters must expose literal ratios from settled public wager rows, not invented model scores and not inferred cash/free-bet classes.';
profile.hotlineStyle.ledgerRules.source='/api/bet-history';
profile.hotlineStyle.ledgerRules.moneyRule='Use actual CAD dollars from the public Bet History projection exactly as recorded. Never multiply bankroll, risk, profit/loss or stake for character presentation.';
profile.hotlineStyle.ledgerRules.allTimeRule='Use the public API summary for authoritative all-time cash bet count, cash risk, cash profit and cash ROI. These summary fields are the only exact cash-accounting figures exposed to Eddie.';
profile.hotlineStyle.ledgerRules.periodRule='Derive weekly and monthly performance from settled sanitized public wager rows and label those views as public/all-ledger performance rather than exact cash-only performance.';
profile.hotlineStyle.ledgerRules.freeBetRule='Do not infer free-bet status from public wager rows. Public row index 14 is the boosted flag, not a free-bet flag. Exact row-level cash/free-bet classification is not exposed.';
profile.hotlineStyle.ledgerRules.resultRule='Won, Lost, CashedOut, Push and Cancelled public records may appear in result mixes; profits and risks are read from their public recorded fields.';
profile.hotlineStyle.ledgerRules.never='Do not access or reference the raw private ledger, do not treat row index 14 as free-bet status, do not invent cash classifications, do not mix Betting Edge BET/LEAN/WAIT/PASS states into ledger accounting, and do not use fictional scaling.';
profile.continuity.mode='public-ledger-authority';
profile.continuity.stateRule='Do not preserve stale report-specific teams, prices or Betting Edge statuses in Eddie state. Recompute from the public Bet History projection at display time.';
profile.guardrails.ledgerAuthority='The sanitized public Bet History projection delivered through /api/bet-history is Eddie Numbers authoritative data source.';
profile.guardrails.privateLedgerForbidden=true;
profile.guardrails.row14Meaning='boosted';
write(profilePath,JSON.stringify(profile,null,2)+'\n');

// 2) Shell registry language.
const shellsPath='data/hotline-shells.json';
const shells=JSON.parse(read(shellsPath));
shells.updatedAt='2026-08-22T18:40:00-07:00';
const muddy=shells.shells.find(x=>x.id==='muddy-ledger-desk');
if(!muddy) throw new Error('Muddy Ledger Desk shell missing');
muddy.description='Premium casino-sportsbook public Bet History control room with exact cash-summary accounting, all-ledger public-row trends, breakdown charts, transparent meters and recent-ticket tape.';
write(shellsPath,JSON.stringify(shells,null,2)+'\n');

// 3) Live Hotline: remove private-ledger language and stop misreading row 14.
const livePath='syndicates/sharp-room/incoming.html';
let live=read(livePath);
live=rep(live,'<div class="ey">CASINO SPORTSBOOK PERFORMANCE INSERT // SOURCE-LOCKED</div><h1><span>MUDDY</span> NUMBERS</h1><h2>LEDGER DESK</h2><p>The current user ledger is the accounting authority. Bankroll, P/L, ROI, weekly and monthly splits, charts and meters are calculated in actual Canadian dollars. No 10× presentation scaling and no Betting Edge card status mixed into the ledger.</p>','<div class="ey">CASINO SPORTSBOOK PERFORMANCE INSERT // PUBLIC BET HISTORY</div><h1><span>MUDDY</span> NUMBERS</h1><h2>LEDGER DESK</h2><p>Eddie reads the sanitized public Bet History feed. Exact all-time cash totals come from its authoritative summary; weekly, monthly, sport, book, behaviour and recent-ticket views are calculated from settled public wager rows. No private-ledger access, no invented cash classification and no Betting Edge card status mixed into the accounting.</p>','hero authority copy');
live=rep(live,'<small>Authority</small><strong>BETTING LEDGER</strong>','<small>Authority</small><strong>PUBLIC BET HISTORY</strong>','authority label');
live=rep(live,'<div class="stat"><small>Cash Wagers</small><b id="bets">—</b><div class="sub">non-free-bet count</div></div>','<div class="stat"><small>Cash Wagers</small><b id="bets">—</b><div class="sub">authoritative summary</div></div>','cash wagers subtitle');
live=rep(live,'<div class="title">CONTROL ROOM // CASH-WAGER CUMULATIVE P/L</div><section class="panel chart" data-zone="ledger-hero"><div class="head"><div><h3>Bankroll Performance Curve</h3><p>Latest 120 cash tickets shown; finish reconciled to authoritative all-time cash P/L.</p></div>','<div class="title">CONTROL ROOM // ALL-LEDGER CUMULATIVE P/L</div><section class="panel chart" data-zone="ledger-hero"><div class="head"><div><h3>Settled Performance Curve</h3><p>Latest 120 settled public wagers from Bet History.</p></div>','curve labels');
live=rep(live,'<div class="title">WEEKLY + MONTHLY RECONCILIATION</div>','<div class="title">PUBLIC LEDGER // WEEKLY + MONTHLY RECONCILIATION</div>','period title');
live=rep(live,'<p>Cash risk, P/L and ROI by sport.</p>','<p>Settled public-row risk, P/L and ROI by sport.</p>','sport copy');
live=rep(live,'<p>Cash results by recorded book.</p>','<p>Settled public-row results by recorded book.</p>','book copy');
live=live.replaceAll('Month cash risk placed before start.','Month settled public-row risk placed before start.');
live=live.replaceAll('Month cash risk recorded after start.','Month settled public-row risk recorded after start.');
live=live.replaceAll('Wins ÷ wins + losses, month cash tickets.','Wins ÷ wins + losses, month settled wagers.');
live=live.replaceAll('Month cash tickets recorded as cashed out.','Month settled wagers recorded as cashed out.');
live=rep(live,'<p>Ten most recent cash wagers, actual stake and P/L.</p>','<p>Ten most recent settled public wagers, actual stake and P/L.</p>','recent copy');
live=rep(live,'<div class="foot" data-zone="footer">MUDDY NUMBERS // LEDGER DESK. Authority: private ledger via Cloudflare Worker. All money is actual CAD from the current ledger. Betting Edge remains authoritative for current market recommendations; Eddie owns the ledger analysis.</div>','<div class="foot" data-zone="footer">MUDDY NUMBERS // LEDGER DESK. Authority: public Bet History via /api/bet-history. Exact cash totals come from the authoritative public summary; row-derived trends use sanitized public wager rows. Betting Edge remains authoritative for current market recommendations.</div>','footer');
live=rep(live,"function W(r){return{id:r[0],book:String(r[1]||'Unknown'),d:new Date(r[3]),sport:String(r[5]||'Other').trim()||'Other',label:String(r[7]||'Untitled'),odds:+r[8],risk:+r[9]||0,result:String(r[10]||''),p:+r[11]||0,phase:String(r[12]||''),free:!!r[14],legs:Array.isArray(r[16])?r[16]:[]}}","function W(r){return{id:r[0],book:String(r[1]||'Unknown'),d:new Date(r[3]),sport:String(r[5]||'Other').trim()||'Other',label:String(r[7]||'Untitled'),odds:+r[8],risk:+r[9]||0,result:String(r[10]||''),p:+r[11]||0,phase:String(r[12]||''),boosted:!!r[14],legs:Array.isArray(r[16])?r[16]:[]}}",'row mapping');
live=rep(live,"const settled=w=>['Won','Lost','CashedOut','Push','Cancelled'].includes(w.result),cash=w=>!w.free&&settled(w)&&isFinite(w.d);","const settled=w=>['Won','Lost','CashedOut','Push','Cancelled'].includes(w.result),publicSettled=w=>settled(w)&&isFinite(w.d);",'settled predicate');
live=rep(live,"r.innerHTML=s.length?s.map(x=>`<div class=\"row\"><div class=\"name\">${x.name}</div><div class=\"track\"><div class=\"fill ${x.p<0?'loss':''}\" style=\"width:${Math.max(2,Math.abs(x.p)/mx*100)}%\"></div></div><div class=\"num\"><b class=\"${x.p>0?'up':x.p<0?'dn':'gold'}\">${sm(x.p)}</b><small>${money(x.risk)} · ${pct(x.roi)}</small></div></div>`).join(''):'<div class=\"compare\">No cash tickets in this ledger month.</div>'","r.innerHTML=s.length?s.map(x=>`<div class=\"row\"><div class=\"name\">${x.name}</div><div class=\"track\"><div class=\"fill ${x.p<0?'loss':''}\" style=\"width:${Math.max(2,Math.abs(x.p)/mx*100)}%\"></div></div><div class=\"num\"><b class=\"${x.p>0?'up':x.p<0?'dn':'gold'}\">${sm(x.p)}</b><small>${money(x.risk)} · ${pct(x.roi)}</small></div></div>`).join(''):'<div class=\"compare\">No settled public wagers in this ledger month.</div>'",'empty row copy');
live=rep(live,"function render(j){let all=(j.wagers||[]).map(W).filter(cash).sort((a,b)=>a.d-b.d);if(!all.length)throw Error('No settled cash wagers in ledger');","function render(j){let all=(j.wagers||[]).map(W).filter(publicSettled).sort((a,b)=>a.d-b.d);if(!all.length)throw Error('No settled public wagers in Bet History');",'render filter');
live=rep(live,"set('gen',j.generatedAt?DT.format(new Date(j.generatedAt)):'—');set('through',D.format(all.at(-1).d));set('file',j.publicProjection?'PRIVATE MASTER // CLOUDFLARE':(j.validation?.sourceFile||'LEDGER'));set('status',j.validation?.status==='PASS'?'SOURCE VERIFIED // LIVE':'SOURCE LOADED');","set('gen',j.generatedAt?DT.format(new Date(j.generatedAt)):'—');set('through',D.format(all.at(-1).d));set('file',j.publicProjection?'PUBLIC BET HISTORY // API':'PUBLIC BET HISTORY');set('status',j.validation?.status==='PASS'?'PUBLIC SOURCE VERIFIED // LIVE':'PUBLIC SOURCE LOADED');",'source status');
live=rep(live,"let cum=0,full=all.map(x=>(cum+=x.p)),src=+j.summary?.cashProfit;if(isFinite(src)&&full.length){let off=src-full.at(-1);full=full.map(x=>x+off)}chart('curve',full.slice(-120));set('curveNet',sm(isFinite(src)?src:full.at(-1)));tone($('curveNet'),isFinite(src)?src:full.at(-1));","let cum=0,full=all.map(x=>(cum+=x.p));chart('curve',full.slice(-120));set('curveNet',sm(full.at(-1)));tone($('curveNet'),full.at(-1));",'curve calculation');
live=rep(live,"$('read').innerHTML=`<p><b>WEEK:</b> ${sm(Wk.p)} on ${Wk.bets} cash tickets, ${pct(Wk.roi)} ROI, ${money(Wk.avg)} average stake. P/L change versus prior-week same-day: ${sm(Wk.p-OW.p)}.</p><p><b>MONTH:</b> ${sm(Mo.p)} on ${Mo.bets} tickets with ${money(Mo.risk)} risked. P/L change versus prior-month same-date: ${sm(Mo.p-OM.p)}.</p>${best&&worst&&best.name!==worst.name?`<p><b>SPORTS:</b> ${best.name} leads at ${sm(best.p)}; ${worst.name} trails at ${sm(worst.p)}. Those are ledger results, not forecasts.</p>`:''}<p><b>BEHAVIOUR:</b> ${pct(mr?pr/mr*100:0)} pregame risk, ${pct(mr?lr/mr*100:0)} after-start, ${pct(mr?par/mr*100:0)} parlays.</p>`;","$('read').innerHTML=`<p><b>WEEK:</b> ${sm(Wk.p)} on ${Wk.bets} settled public wagers, ${pct(Wk.roi)} ROI, ${money(Wk.avg)} average stake. P/L change versus prior-week same-day: ${sm(Wk.p-OW.p)}.</p><p><b>MONTH:</b> ${sm(Mo.p)} on ${Mo.bets} settled public wagers with ${money(Mo.risk)} risked. P/L change versus prior-month same-date: ${sm(Mo.p-OM.p)}.</p>${best&&worst&&best.name!==worst.name?`<p><b>SPORTS:</b> ${best.name} leads at ${sm(best.p)}; ${worst.name} trails at ${sm(worst.p)}. Those are public ledger results, not forecasts.</p>`:''}<p><b>BEHAVIOUR:</b> ${pct(mr?pr/mr*100:0)} pregame risk, ${pct(mr?lr/mr*100:0)} after-start, ${pct(mr?par/mr*100:0)} parlays.</p>`;",'Eddie read copy');
live=rep(live,"set('walk',`Current bankroll ${money(j.bankrollCad)}. All-time cash P/L ${sm(j.summary?.cashProfit)} at ${pct(j.summary?.cashRoiPercent)} ROI. Latest ledger week ${sm(Wk.p)}; ledger month ${sm(Mo.p)}. The next ledger upload becomes the next authoritative Muddy Numbers report.`)}","set('walk',`Current bankroll ${money(j.bankrollCad)}. Authoritative cash P/L ${sm(j.summary?.cashProfit)} at ${pct(j.summary?.cashRoiPercent)} ROI. Public-row week ${sm(Wk.p)}; public-row month ${sm(Mo.p)}. The next public Bet History update becomes the next Muddy Numbers report.`)}",'walk copy');
write(livePath,live);

// 4) Guardrail test: future changes must preserve the public-ledger contract.
const test=`import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const json=p=>JSON.parse(read(p));
const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
const profile=json('data/characters/eddie-numbers.json');
const roster=json('data/syndicates.json');
const shells=json('data/hotline-shells.json');
const live=read('syndicates/sharp-room/incoming.html');
const fallback=json('data/bet-history-public.json');
assert(profile.authority?.mode==='ledger-authoritative','Eddie must remain ledger-authoritative');
assert(profile.authority?.source==='/api/bet-history','Eddie authority source must be /api/bet-history');
assert(profile.authority?.sourceClass==='sanitized-public-ledger','Eddie must identify the sanitized public ledger');
assert(profile.guardrails?.privateLedgerForbidden===true,'Eddie must never read the raw private ledger');
assert(profile.hotlineStyle?.ledgerRules?.freeBetRule?.includes('index 14 is the boosted flag'),'Eddie free-bet guardrail missing');
assert(profile.authority?.actualDollars===true,'Eddie must use actual CAD dollars');
assert(profile.authority?.fictionalScaling===false,'Eddie fictional scaling must be disabled');
assert(roster.profiles.find(x=>x.characterId==='eddie-numbers')?.title==='MUDDY NUMBERS // LEDGER DESK','Eddie roster title changed');
assert(roster.slots[0]?.title==='MUDDY NUMBERS // LEDGER DESK','Eddie slot title changed');
assert(shells.shells.find(x=>x.id==='muddy-ledger-desk'&&x.defaultForCharacter===true),'Muddy Ledger Desk shell is not default');
for(const marker of ['ACTUAL CAD DOLLARS','ALL-LEDGER CUMULATIVE P/L','PUBLIC LEDGER // WEEKLY + MONTHLY RECONCILIATION','Sport Desk','Sportsbook Windows','MUDDY METERS','MUDDY LEDGER // LAST 10 TICKETS','EDDIE: WHAT THE NUMBERS SAY','THE WALK TO THE CAGE']) assert(live.includes(marker),\`Missing Ledger Desk marker: ${marker}\`);
assert(live.includes("const URL='/api/bet-history'"),'Live desk must fetch /api/bet-history');
assert(live.includes('boosted:!!r[14]'),'Public row index 14 must remain boosted');
assert(!live.includes('free:!!r[14]'),'Eddie must not treat row index 14 as free-bet status');
assert(!live.includes('PRIVATE MASTER // CLOUDFLARE'),'Private-master label leaked into Eddie Hotline');
assert(!live.includes('Authority: private ledger'),'Private-ledger authority leaked into Eddie Hotline');
assert(!live.includes('../../data/betting-ledger.json'),'Live desk still exposes raw ledger path');
assert(live.includes("cache:'no-store'"),'Ledger fetch must bypass browser cache');
assert(fallback.publicProjection===true,'Static fallback must remain sanitized');
assert(Array.isArray(fallback.wagers)&&fallback.wagers.length>0,'Fallback wagers missing');
assert(fallback.wagers.every(r=>r[2]===null),'Fallback sportsbook reference leaked');
console.log('MUDDY NUMBERS // PUBLIC BET HISTORY guardrails: PASS');
`;
write('tests/muddy-ledger-desk.test.mjs',test);

console.log('Eddie Numbers re-anchored to sanitized public Bet History.');
