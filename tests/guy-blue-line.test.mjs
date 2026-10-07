import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(import.meta.url),api=require('../assets/guy-blue-line.js');
const asOf='2026-10-06T22:10:00Z';
function game(id,homeProbability,startTime='2026-10-07T02:00:00Z'){
  const g={eventId:id,sport:'NHL',home:'Home '+id,away:'Away '+id,startTime,markets:[],facts:[]};
  g.externalModels=['home','away'].map(side=>({sourceId:'moneypuck',kind:'OUTCOME_PROBABILITY',marketDetail:'full_game_moneyline',period:'FULL_GAME',state:'PRE_GAME',line:null,probabilityBasis:'UNCONDITIONAL',pushProbability:0,settlement:{includesOvertime:true,pushRule:'NO_PUSH'},side,probability:side==='home'?homeProbability:1-homeProbability,eventId:id,home:g.home,away:g.away,startTime,observedAt:'2026-10-06T22:00:00Z',sourceGameId:id,recordId:id+'-'+side,url:'https://moneypuck.com/example.csv',marketBlendObservation:{modelHomeProbability:homeProbability+.02,bookmakerHomeProbability:homeProbability-.02,observedEqualWeightBlend:true}}));
  return g;
}
function quotes(g,side,prices,marketDetail='full_game_moneyline'){
  g.markets.push({marketDetail,side,quotes:prices.map(([book,priceDecimal,edge])=>({book,priceDecimal,side,line:null,observedAt:'2026-10-06T22:05:00Z',selectionKey:g.eventId+'|ml|'+side+'||',benchmark:{edgeProbabilityPoints:edge}}))});
  return g;
}
const board=(games)=>({asOf,feedGeneratedAt:'2026-10-06T22:05:00Z',games});

test('rank by MoneyPuck gap rather than favourite probability or Pinnacle; choose best offered price and one side per game',()=>{
  const favourite=game('favourite',.8);quotes(favourite,'home',[['Book A',1.2,4],['Book B',1.25,3]]);quotes(favourite,'away',[['Book A',4,5]]);
  const underdog=game('underdog',.46);quotes(underdog,'home',[['Book A',2.3,-2],['Book B',2.4,-3],['Pinnacle',9,10]]);quotes(underdog,'away',[['Book A',1.7,2]]);
  const result=api.selectBoard(board([favourite,underdog]));
  assert.equal(result.rows.length,2);assert.equal(result.rows[0].eventId,'underdog');assert.equal(result.rows[0].book,'Book B');
  assert.equal(result.rows[0].price,'+140');assert.ok(Math.abs(result.rows[0].edge-4.3333333333)<1e-8);assert.equal(result.rows[0].marketEdge,-3);
  assert.equal(result.rows[1].price,'-400');assert.ok(Math.abs(result.rows[1].edge)<1e-8);
});

test('Pacific daily board includes late UTC games, excludes other sports and non-full-game moneylines, and deduplicates events',()=>{
  const late=game('late',.6);quotes(late,'home',[['Book',2,0]]);quotes(late,'away',[['Book',99,0]],'regulation_moneyline');quotes(late,'away',[['Book',99,0]],'full_game_total');
  const tomorrow=game('tomorrow',.6,'2026-10-07T23:00:00Z');quotes(tomorrow,'home',[['Book',2,0]]);
  const other=structuredClone(late);other.eventId='nba';other.sport='NBA';
  const result=api.selectBoard(board([late,late,tomorrow,other]));
  assert.equal(result.date,'2026-10-06');assert.equal(result.rows.length,1);assert.equal(result.rows[0].side,'home');
});

test('unmatched, conflicting, future and post-start forecasts remain missing rather than inventing zero edge',()=>{
  const mutations=[g=>g.externalModels.pop(),g=>g.externalModels[0].home='Wrong team',g=>g.externalModels[1].settlement.includesOvertime=false,g=>g.externalModels.push({...g.externalModels[0],probability:.7}),g=>g.externalModels.forEach(r=>r.observedAt='2026-10-06T22:11:00Z'),g=>g.externalModels.forEach(r=>r.observedAt=g.startTime)];
  for(const mutate of mutations){const g=game('missing',.6);quotes(g,'home',[['Book',2,0]]);mutate(g);const row=api.selectBoard(board([g])).rows[0];assert.equal(row.edge,null);assert.equal(row.probability,null);assert.match(api.render({rows:[row]}),/Not measured/);}
  const noQuote=game('no-quote',.6);assert.equal(api.selectBoard(board([noQuote])).rows[0].breakEven,null);
  const inPlay=game('in-play',.6,'2026-10-06T22:00:00Z');quotes(inPlay,'home',[['Book',2,0]]);assert.equal(api.selectBoard(board([inPlay])).rows[0].priceDecimal,null);
});

test('a positive model comparison keeps the issued PASS and recorded price; later quote is not promoted to BET',()=>{
  const g=game('pass',.6);quotes(g,'home',[['New Book',2.1,-1]]);
  const report={ts:'2026-10-06T22:08:00Z',recs:[{status:'PASS',feed:{eventId:'pass',side:'home',marketKey:'ml',market:'full_game_moneyline',eventDate:g.startTime,book:'Old Book',priceDecimal:2}}]};
  const result=api.selectBoard(board([g]),{report});const row=result.rows[0];
  assert.ok(row.edge>0);assert.equal(row.call,'PASS');assert.equal(row.callPrice,'+100');assert.equal(row.callQuoteMatches,false);assert.equal(row.price,'+110');assert.equal(row.modelComponent,.62);
  const html=api.render(result,{now:'2026-10-07T03:00:00Z'});assert.match(html,/Pinnacle disagrees/);assert.match(html,/<b>PASS<\/b>/);assert.match(html,/STARTED · PREGAME RECORD/);assert.match(html,/includes market input/);
});

test('slot host and preferences both migrate Guy to four, Lou to five and preserve optional characters',()=>{
  const defaults=['eddie-numbers','graham-mercer','vic-fremont','guy-laflame','lou-vega',null,null,null];
  const old=['eddie-numbers','graham-mercer','vic-fremont','lou-vega','alex-daventry','larry-luck',null,'jesse-bains'];
  for(const [file,fn,nextFn,normalizer] of [['syndicates/slot-host.html','migrateDefaultOrder','loadAssignments','normalizedAssignments'],['assets/preferences-framework.js','migrateSyndicateOrder','defaultSyndicateAssignments','normalizedSyndicateAssignments']]){
    const source=fs.readFileSync(file,'utf8'),start=source.indexOf('function '+fn+'('),end=source.indexOf('\nfunction '+nextFn+'(',start);
    const context={};vm.runInNewContext(`const SYNDICATE_SLOT_COUNT=8;function ${normalizer}(source){return Array.from({length:8},(_,i)=>source[i]??null)}\n`+source.slice(start,end)+`\nglobalThis.migrate=${fn}`,context);
    assert.deepEqual(Array.from(context.migrate(old,defaults)),[...defaults.slice(0,5),'larry-luck','alex-daventry','jesse-bains']);
    assert.deepEqual(Array.from(context.migrate(defaults,defaults)),defaults);
  }
});

test('deliberate editions are idempotent and retain older archive entries and content',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'guy-archive-'));
  try{
    for(const folder of ['data/game-intelligence','data/characters','syndicates/generated/guy-laflame'])fs.mkdirSync(path.join(dir,folder),{recursive:true});
    fs.copyFileSync('syndicates/generated/guy-laflame/shell.html',path.join(dir,'syndicates/generated/guy-laflame/shell.html'));
    fs.writeFileSync(path.join(dir,'run-history.json'),'{"runs":[]}');fs.writeFileSync(path.join(dir,'data/characters/guy-laflame.json'),'{"continuity":{}}');
    const g=game('archive',.6);quotes(g,'home',[['Book',2,0]]);const data=board([g]);
    const build=()=>{fs.writeFileSync(path.join(dir,'data/game-intelligence/board.json'),JSON.stringify(data));const r=spawnSync(process.execPath,[path.resolve('tools/build-guy-hotline.mjs')],{cwd:dir,encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
    build();const first=JSON.parse(fs.readFileSync(path.join(dir,'data/characters/guy-laflame/current-edition.json')));const frozen=fs.readFileSync(path.join(dir,first.archivePath),'utf8');
    build();data.games[0].markets[0].quotes[0].priceDecimal=2.2;build();
    const index=JSON.parse(fs.readFileSync(path.join(dir,'syndicates/generated/guy-laflame/archive/index.json')));assert.equal(index.issues.length,2);assert.equal(fs.readFileSync(path.join(dir,first.archivePath),'utf8'),frozen);assert.ok(!frozen.includes('data-blue-line-live>'));assert.match(frozen,/<base href="\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/">/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('current captured NHL feed renders every game once in descending edge order',()=>{
  const captured=JSON.parse(fs.readFileSync('data/game-intelligence/board.json'));const result=api.selectBoard(captured);
  const games=captured.games.filter(g=>g.sport==='NHL'&&api.day(g.startTime)===result.date);
  assert.equal(result.rows.length,new Set(games.map(g=>g.eventId)).size);
  for(let i=1;i<result.rows.length;i++)assert.ok((result.rows[i-1].edge??-Infinity)>=(result.rows[i].edge??-Infinity));
  assert.equal((api.render(result).match(/class="game-card"/g)||[]).length,result.rows.length);
});
