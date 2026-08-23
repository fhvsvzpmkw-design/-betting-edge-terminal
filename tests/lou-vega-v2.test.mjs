#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),assert=(x,m)=>{if(!x)throw new Error(m)};
const profile=json('data/characters/lou-vega.json'),shells=json('data/hotline-shells.json'),live=read('syndicates/generated/lou-vega/hotline.html'),shell=read('syndicates/generated/lou-vega/shell-v2.html'),archive=read('syndicates/generated/lou-vega/archive/2026-08-22/1815.html'),idx=json('syndicates/generated/lou-vega/archive/index.json'),report=json('data/history/runs/2026-08-22/late-181841.json');
assert(profile.continuity?.lastReportSeen?.timestamp===report.ts,'Lou continuity must match Aug 22 late report');
assert(profile.hotlineStyle?.shell?.version===2,'Lou profile must use shell v2');
const reg=shells.shells.find(x=>x.id==='vegas-by-the-slice'&&x.characterId==='lou-vega');assert(reg?.version===2&&reg?.defaultForCharacter===true,'Lou v2 must be default');assert(reg?.path==='./syndicates/generated/lou-vega/shell-v2.html','Lou registry must point to v2 shell');
for(const m of ['data-shell-version="2"','VEGAS BY THE SLICE','two-slice-mark','LATE-NIGHT MENU','COUPON BOOK','FLOOR WALK','PROGRESSIVE WATCH','VIDEO POKER CHECK','TIP THE WAITRESS','PARKING LOT COUPON','TWO-SLICE DINNER','BEST NUMBER IN TOWN','LAST STOP'])assert(live.includes(m),`Lou live missing ${m}`);
for(const m of ['FC DALLAS MONEYLINE','Bet365 +700','DK +550','RHYNE HOWARD OVER 3.5 THREES','PHOENIX MERCURY MONEYLINE','DALLAS COWBOYS MONEYLINE','SAN JOSE EARTHQUAKES MONEYLINE','0 BET · 0 LEAN · 1 WAIT · 4 PASS · $0'])assert(live.includes(m),`Lou live report mismatch: ${m}`);
assert(!live.includes('CENTRAL COAST RHINOS'),'Stale Aug 21 selection leaked into Lou v2');assert(live===archive,'Lou live must equal latest archived edition');
const issue=idx.issues.find(x=>x.path==='2026-08-22/1815.html');assert(issue?.issuedAt===report.ts&&issue?.sourceReport==='data/history/runs/2026-08-22/late-181841.json'&&issue?.shellVersion===2,'Lou v2 archive metadata mismatch');
assert(shell.includes('{{RECOMMENDATION_ITEMS}}')&&shell.includes('two-slice-mark')&&shell.includes('coupon-book')&&shell.includes('floor-walk'),'Lou v2 shell zones missing');
assert(fs.existsSync('syndicates/generated/lou-vega/shell.html'),'Lou v1 shell must remain preserved');
console.log('LOU VEGA // VEGAS BY THE SLICE v2: PASS');
