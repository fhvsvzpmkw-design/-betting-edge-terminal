#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
function assert(condition,message){if(!condition)throw new Error(message)}
function readJson(p){return JSON.parse(fs.readFileSync(p,'utf8'))}
function read(p){return fs.readFileSync(p,'utf8')}
function repoRel(v){return String(v||'').replace(/^\.\//,'').split('?')[0]}
const manifest=readJson('data/syndicates.json');
const roster=(manifest.profiles||[]).filter(p=>p?.characterId&&p?.characterFile&&p?.url);
assert(roster.length>=5,'expected at least five Syndicate profiles');
const required={
'eddie-numbers':['MUDDY NUMBERS','LEDGER DESK','ACTUAL CAD DOLLARS','MUDDY LEDGER // LAST 10 TICKETS','<canvas','MUDDY METERS','THE WALK TO THE CAGE','EDDIE:'],
'bill-weston':['Last-Session Reconciliation','Change Memo','Current Window Entries','FINAL DESK DISPOSITION'],
'larry-lombardo':["Larry's Opening Come-On","Tonight's Rejections",'NARRATOR CORRECTION','LOUNGE LIZARD NOTE','CAB-FARE CHECK','VISITOR COUNTER','UNDER CONSTRUCTION','LAST CALL'],
'jesse-bains':['SPORTS DESK','HOTEL DELPHORIA','The Evening at the Delphoria','House Board','JESSE SAYS','PHONE SLIP','Delphoria House Note','Back Room','Last Word'],
'lou-vega':['LATE-NIGHT MENU','COUPON BOOK','BEST NUMBER IN TOWN','FLOOR WALK','PROGRESSIVE WATCH','VIDEO POKER CHECK','TWO-SLICE DINNER','TIP THE WAITRESS','PARKING LOT COUPON','LAST STOP']};
for(const profile of roster){
 const id=profile.characterId;if(!required[id])continue;
 const character=readJson(repoRel(profile.characterFile));
 const live=repoRel(profile.url);assert(fs.existsSync(live),`${id}: live Hotline missing`);
 const liveText=read(live);assert(liveText.length>=6000,`${id}: latest Hotline appears abbreviated (${liveText.length} chars)`);
 for(const marker of required[id])assert(liveText.includes(marker),`${id}: missing full-edition marker "${marker}"`);
 if(character?.authority?.mode==='ledger-authoritative'){
  assert(character.authority.source==='/api/bet-history',`${id}: ledger authority source mismatch`);
  assert(character.authority.actualDollars===true,`${id}: ledger authority must use actual dollars`);
  assert(character.authority.fictionalScaling===false,`${id}: fictional scaling must be disabled`);
  assert(liveText.includes("/api/bet-history"),`${id}: live desk does not fetch the authoritative public ledger`);
  assert(liveText.includes("cache:'no-store'"),`${id}: live desk must bypass stale ledger cache`);
  continue;
 }
 if(character?.authority?.mode==='graham-terminal-authoritative'){
  assert(character.authority.source==='data/walters/nfl/current-week-terminal.json',`${id}: Graham terminal authority source mismatch`);
  assert(character.authority.scope==='NFL_ONLY',`${id}: Graham derivative must remain NFL-only`);
  assert(character.authority.bettingAuthority===false,`${id}: Jesse must not become betting authority`);
  assert(liveText.includes("../../data/walters/nfl/current-week-terminal.json"),`${id}: live desk does not fetch the Graham terminal`);
  assert(liveText.includes("cache:'no-store'"),`${id}: live desk must bypass stale Graham cache`);
  assert(liveText.includes('ATTENTION_GAP=1.5'),`${id}: 1.5-point Graham attention guard missing`);
  continue;
 }
 const last=character?.continuity?.lastReportSeen;assert(last?.timestamp&&last?.label&&last?.slot,`${id}: continuity.lastReportSeen incomplete`);
 const date=last.timestamp.slice(0,10),m=String(last.label).match(/\b(\d{1,2}):(\d{2})\b/);assert(m,`${id}: cannot derive session from ${last.label}`);
 const session=`${m[1].padStart(2,'0')}${m[2]}`,root=path.posix.dirname(live),archive=`${root}/archive/${date}/${session}.html`,indexPath=`${root}/archive/index.json`;
 assert(fs.existsSync(archive),`${id}: latest archive missing ${archive}`);assert(fs.existsSync(indexPath),`${id}: archive index missing`);
 const archiveText=read(archive);assert(liveText===archiveText,`${id}: live Hotline does not match latest archived edition`);
 const index=readJson(indexPath),issue=(index.issues||[]).find(x=>x.path===`${date}/${session}.html`);assert(issue,`${id}: archive index missing ${date}/${session}.html`);
 assert(issue.issuedAt===last.timestamp,`${id}: archive/index continuity timestamp mismatch`);assert(issue.label===last.label,`${id}: archive/index continuity label mismatch`);
 assert(fs.existsSync(issue.sourceReport),`${id}: authoritative source report missing ${issue.sourceReport}`);const report=readJson(issue.sourceReport);
 assert(report.ts===last.timestamp,`${id}: character continuity is not on authoritative report timestamp`);assert(report.slot===last.slot,`${id}: character continuity slot mismatch`);assert(report.label===last.label,`${id}: character continuity label mismatch`);
}
console.log('SYNDICATE HOTLINES OK // SOURCE-SPECIFIC DESKS USE DECLARED AUTHORITY // REPORT HOTLINES=LIVE ARCHIVE CONTINUITY');
