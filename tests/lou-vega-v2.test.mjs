#!/usr/bin/env node
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),json=p=>JSON.parse(read(p)),assert=(x,m)=>{if(!x)throw new Error(m)},repoPath=p=>String(p||'').replace(/^\.\//,'');

const profile=json('data/characters/lou-vega.json');
const shells=json('data/hotline-shells.json');
const live=read('syndicates/generated/lou-vega/hotline.html');
const shell=read('syndicates/generated/lou-vega/shell-v2.html');
const idx=json('syndicates/generated/lou-vega/archive/index.json');

const lastTs=profile.continuity?.lastReportSeen?.timestamp;
assert(lastTs,'Lou must have a current authoritative report timestamp');
const issue=idx.issues.find(x=>x.issuedAt===lastTs);
assert(issue,`Lou archive must contain current issue ${lastTs}`);
assert(fs.existsSync(issue.sourceReport),`Lou source report missing: ${issue.sourceReport}`);
const report=json(issue.sourceReport);
assert(report.ts===lastTs,'Lou continuity must match its authoritative source report');
const archivePath=`syndicates/generated/lou-vega/archive/${issue.path}`;
assert(fs.existsSync(archivePath),`Lou current archive missing: ${archivePath}`);
const archive=read(archivePath);
assert(live===archive,'Lou live must equal the archived edition for continuity.lastReportSeen');

assert(profile.hotlineStyle?.shell?.version===2,'Lou profile must use shell v2');
assert(profile.hotlineStyle?.generationEngine?.name==='VEGAS ROUTE VALUE ENGINE','Lou route generation engine missing');
assert(profile.hotlineStyle?.sceneRotation?.source==='./docs/source-material/lou-vega-scene-bank.md','Lou scene bank binding missing');
assert(profile.guardrails?.noIndependentFairValueMath===true,'Lou must not independently create fair-value math');
assert(profile.guardrails?.noUnsourcedRealCasinoConditions===true,'Lou must guard unsourced real casino conditions');
assert(profile.guardrails?.walkAwayIsValid===true,'Lou walk-away discipline guardrail missing');

const guide=repoPath(profile.sourceMaterial?.canonLanguageGuide);
const scenes=repoPath(profile.sourceMaterial?.sceneBank);
assert(guide&&fs.existsSync(guide),'Lou canon/language guide missing');
assert(scenes&&fs.existsSync(scenes),'Lou route scene bank missing');
const guideText=read(guide),sceneText=read(scenes);
for(const m of ['Lou “Two Slice” Vega','Vegas by the Slice','Betting Edge','Two Slice rule','Casino-floor character layer'])assert(guideText.includes(m),`Lou canon guide missing ${m}`);
for(const m of ['sportsbook route','coupon book','casino floor walk','food and Two Slice','Vegas logistics','Rotation safeguards'])assert(sceneText.toLowerCase().includes(m.toLowerCase()),`Lou scene bank missing ${m}`);

const reg=shells.shells.find(x=>x.id==='vegas-by-the-slice'&&x.characterId==='lou-vega');
assert(reg?.version===2&&reg?.defaultForCharacter===true,'Lou v2 must be default');
assert(reg?.path==='./syndicates/generated/lou-vega/shell-v2.html','Lou registry must point to v2 shell');
assert(issue.shellVersion===2,'Lou current archived issue must retain shell v2 metadata');

for(const m of ['data-shell-version="2"','VEGAS BY THE SLICE','two-slice-mark','COUPON BOOK','floor-walk','BEST NUMBER IN TOWN','LAST STOP'])assert(live.includes(m),`Lou live missing ${m}`);
for(const m of ['{{RECOMMENDATION_ITEMS}}','two-slice-mark','coupon-book','floor-walk','{{LAST_STOP}}'])assert(shell.includes(m),`Lou v2 shell zones missing ${m}`);
assert(fs.existsSync('syndicates/generated/lou-vega/shell.html'),'Lou v1 shell must remain preserved');

console.log(`LOU VEGA // VEGAS BY THE SLICE v2 ASSET PACK: PASS // ${issue.label}`);
