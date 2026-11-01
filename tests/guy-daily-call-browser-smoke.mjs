import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createRequire} from 'node:module';

// Every response is a synthetic fixture or a whitelisted shipped asset. This
// harness never reads, writes, or publishes the real call/benchmark ledgers.
const require=createRequire(import.meta.url);
const callUI=require('../assets/guy-daily-call.js');
const benchmarkUI=require('../assets/guy-value.js');
const assets=new Map(['guy-daily-call.js','guy-daily-call.css','guy-value.css','guy-blue-line.css'].map(name=>[
  '/assets/'+name,fs.readFileSync(new URL('../assets/'+name,import.meta.url),'utf8')
]));
const valueSource=fs.readFileSync(new URL('../assets/results-value-desk-v2.js',import.meta.url),'utf8');
const valueStyle=valueSource.match(/s\.textContent=`([\s\S]*?)`;/)?.[1];
assert.ok(valueStyle,'use the shipped Value desk styles');
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const now='2026-11-01T17:00:00Z';
const source={url:'https://www.nhl.com/news/starting-goalies',observedAt:'2026-11-01T16:40:00Z'};
function fixture(name='current'){
  const call={publicationId:'synthetic-publication',researchId:'synthetic-research',eventId:'synthetic-nhl',away:'Away Club',home:'Home Club',startTime:'2026-11-01T19:00:00Z',side:'home',team:'Home Club',book:'DraftKings',priceDecimal:1+100/110,quoteObservedAt:'2026-11-01T16:45:00Z',publishedAt:'2026-11-01T16:50:00Z',modelObservedAt:'2026-11-01T16:55:00Z',researchedAt:'2026-11-01T16:45:00Z',minDecimalPrice:1+100/120,
    reason:'MoneyPuck shortlisted Away Club. Guy independently prefers Home Club after the hockey review.',supportReason:'Five-on-five slot chances support the home matchup.',contraryReason:'Away Club has the rest advantage.',pinnacleAssessment:{status:'DISAGREES',reason:'Pinnacle favors the other side; Guy reviewed that disagreement and kept his independent selection.'},
    research:{goalies:[{team:'Home Club',name:'Home Goalie',status:'CONFIRMED',observedAt:source.observedAt,sourceRefs:[source]},{team:'Away Club',name:'Away Goalie',status:'CONFIRMED',observedAt:source.observedAt,sourceRefs:[source]}],...Object.fromEntries(['lineup','restTravel','fiveOnFive'].map(key=>[key,{summary:key+' checked against a captured source.',observedAt:source.observedAt,sourceRefs:[source]}]))}};
  const ledger={schema:1,characterId:'guy-laflame',policyId:'guy-researched-daily-call-v1',startedAt:'2026-11-01T07:00:00Z',effectiveFrom:'2026-11-01T07:00:00Z',updatedAt:now,entries:[{date:'2026-11-01',state:'WATCHING',lockAt:'2026-11-01T18:59:00Z',call,publications:[structuredClone(call)],liveStatus:{state:'CURRENT',checkedAt:now,currentQuote:{book:'FanDuel',priceDecimal:1+100/115,observedAt:'2026-11-01T16:55:00Z',modelObservedAt:'2026-11-01T16:55:00Z'}}}]};
  const entry=ledger.entries[0];let at=now;
  if(name==='limit')entry.liveStatus.currentQuote.priceDecimal=1.7;
  if(name==='quote-expiry')entry.liveStatus.currentQuote.observedAt='2026-11-01T15:45:00Z';
  if(name==='model-expiry')entry.liveStatus.currentQuote.modelObservedAt='2026-11-01T15:45:00Z';
  if(name==='research-expiry')call.researchedAt='2026-11-01T11:00:00Z';
  if(name==='projected'||name==='locked')Object.assign(call.research.goalies[1],{status:'PROJECTED',recheckAt:'2026-11-01T17:01:00Z'});
  if(name==='locked'){
    at='2026-11-01T18:58:50Z';call.researchedAt='2026-11-01T18:40:00Z';
    entry.liveStatus.currentQuote={book:'FanDuel',priceDecimal:2.2,observedAt:'2026-11-01T18:58:00Z',modelObservedAt:'2026-11-01T18:58:00Z'};
    call.research.goalies[1].recheckAt='2026-11-01T18:58:55Z';
  }
  // The legacy benchmark has its own already-settled November 1 game. Its win
  // must never turn into a win in the actual published-call record.
  const benchmark={schema:1,characterId:'guy-laflame',startedAt:'2026-11-01T07:00:00Z',updatedAt:now,entries:[{date:'2026-11-01',state:'LOCKED',lockAt:'2026-11-01T13:59:00Z',pick:{eventId:'synthetic-early-game',away:'Benchmark Away',home:'Benchmark Home',team:'Benchmark Away',side:'away',book:'Benchmark Book',priceDecimal:2.3,edge:5,probability:.49,breakEven:1/2.3,quoteObservedAt:'2026-11-01T13:30:00Z',recordedAt:'2026-11-01T13:35:00Z'},result:{grade:'WIN',netUnits:1.3}}]};
  return {ledger,benchmark,at};
}
const scenarios=['current','limit','quote-expiry','model-expiry','research-expiry','projected','locked','offline'];
const fixtures=new Map(scenarios.map(name=>[name,fixture(name)]));
const originals=new Map([...fixtures].map(([name,f])=>[name,json(f)]));

function pageHTML(route,name){
  const f=fixtures.get(name),id=route==='value'?'resultsGuyCall':'guyActualCall',benchmarkId=route==='value'?'resultsGuyValue':'guyDailyPick';
  const contents=callUI.render(f.ledger,{now:f.at,id})+`<details class="methodDetails guy-benchmark-record" id="guyMoneyPuckBenchmark"><summary>MONEYPUCK BENCHMARK // HISTORICAL TOP-EDGE TRACKING</summary>${benchmarkUI.render(f.benchmark,{now:f.at,id:benchmarkId,history:true})}</details>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic Guy ${route} QA</title><link rel="stylesheet" href="/assets/guy-blue-line.css"><link rel="stylesheet" href="/assets/guy-value.css"><style>${route==='value'?valueStyle:''}body{background:#101a19}main{max-width:1100px;padding:16px}.fixture-label{font:12px monospace;color:#ddd}.resultsScroll{max-width:100%;overflow:auto}</style><link rel="stylesheet" href="/assets/guy-daily-call.css"></head><body><main><p class="fixture-label">SYNTHETIC FIXTURE · ${route}</p><div ${route==='value'?'id="engine" class="resultsDesk"':'class="sheet body-pad"'}>${contents}</div></main><script>
  // Advance the clock without waiting or causing another source request.
  const RealDate=Date;let fixtureNow=RealDate.parse(${json(f.at)}),sequence=0;const pending=new Map();
  window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixtureNow]));}static now(){return fixtureNow;}};
  window.setTimeout=(fn,delay=0)=>{const key=++sequence;pending.set(key,{fn,due:fixtureNow+Number(delay)});return key;};
  window.clearTimeout=key=>pending.delete(key);
  window.fixtureAdvance=iso=>{fixtureNow=RealDate.parse(iso);let runs=0;for(;;){const next=[...pending].find(([,timer])=>timer.due<=fixtureNow);if(!next)break;pending.delete(next[0]);next[1].fn();if(++runs>100)throw Error('fixture timer loop');}};
  window.fixtureLedger=${json(f.ledger)};window.fixtureBefore=JSON.stringify(window.fixtureLedger);
  window.fixtureSnapshot=JSON.stringify(JSON.parse(document.querySelector('[data-guy-call-snapshot]').textContent));
  const fixtureFetch=window.fetch.bind(window);window.fetch=async(...args)=>{const response=await fixtureFetch(...args);if(response.ok){const readJSON=response.json.bind(response);response.json=async()=>{const ledger=await readJSON();window.fixtureLedger=ledger;window.fixtureBefore=JSON.stringify(ledger);return ledger;};}return response;};
  </script><script src="/assets/guy-daily-call.js"></script><script>
  window.fixtureReady=false;GuyDailyCall.boot({base:new URL('/fixture/${name}/',location.href),id:${json(id)}}).then(()=>{window.fixtureReady=true;});
  </script></body></html>`;
}
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');let body,contentType='text/html; charset=utf-8',status=200;
  const page=url.pathname.match(/^\/(hotline|value)\/([a-z-]+)$/),data=url.pathname.match(/^\/fixture\/([a-z-]+)\/data\/characters\/guy-laflame\/calls-ledger\.json$/);
  if(page&&fixtures.has(page[2]))body=pageHTML(page[1],page[2]);
  else if(data&&fixtures.has(data[1])){status=data[1]==='offline'?503:200;body=data[1]==='offline'?'Synthetic feed unavailable':json(fixtures.get(data[1]).ledger);contentType='application/json';}
  else if(assets.has(url.pathname)){body=assets.get(url.pathname);contentType=url.pathname.endsWith('.js')?'text/javascript':'text/css';}
  else if(url.pathname==='/assets/syndicates/guy-laflame/tavern-background.png'){body='<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';contentType='image/svg+xml';}
  else {status=404;body='Fixture route not found';}
  response.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store'});response.end(body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,page;
try{
  // This mode validates fixture isolation in environments without Chrome.
  for(const route of ['hotline','value'])for(const name of scenarios){const response=await fetch(`${origin}/${route}/${name}`);assert.equal(response.status,200);assert.match(await response.text(),/GUY’S PLAY \/\/ DAILY NHL MONEYLINE/);}
  assert.equal((await fetch(origin+'/data/characters/guy-laflame/calls-ledger.json')).status,404,'production data paths are inaccessible');
  assert.equal((await fetch(origin+'/fixture/offline/data/characters/guy-laflame/calls-ledger.json')).status,503);
  const sample=await(await fetch(origin+'/fixture/current/data/characters/guy-laflame/calls-ledger.json')).json();assert.equal(sample.entries[0].call.publicationId,'synthetic-publication');
  if(process.argv.includes('--self-check'))console.log('GUY BROWSER FIXTURES: PASS // synthetic routes, source assets, isolated feed, offline fallback');
  else{
    assert.ok(process.env.CHROME,'CHROME is required (use --self-check for fixture-only validation)');
    const {default:puppeteer}=await import('puppeteer-core');
    browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
    page=await browser.newPage();const errors=[],external=[],dataRequests=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.setRequestInterception(true);
    page.on('request',request=>{const url=new URL(request.url());if(url.origin!==origin){external.push(request.url());void request.abort();}else{if(url.pathname.includes('/calls-ledger.json'))dataRequests.push(url.pathname);void request.continue();}});
    fs.mkdirSync('.qa',{recursive:true});
    const open=async(route,name)=>{await page.goto(`${origin}/${route}/${name}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.fixtureReady===true);return route==='value'?'#resultsGuyCall':'#guyActualCall';};
    const state=selector=>page.$eval(selector,node=>node.dataset.guyCallState);
    const text=selector=>page.$eval(selector,node=>node.innerText);
    const unchanged=async()=>{
      assert.equal(await page.evaluate(()=>JSON.stringify(window.fixtureLedger)),await page.evaluate(()=>window.fixtureBefore),'the browser never rewrites the fetched published fixture ledger');
      assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(document.querySelector('[data-guy-call-snapshot]').textContent))),await page.evaluate(()=>window.fixtureSnapshot),'local status changes preserve the embedded published call, price, research, result and audit');
    };
    for(const route of ['hotline','value'])for(const width of [390,834,1440]){
      await page.setViewport({width,height:900,deviceScaleFactor:1});const id=await open(route,'current');
      assert.equal(await state(id),'CURRENT');const body=await text(id);
      for(const expected of ['Home Club -110','-115','-120','DON’T CHASE PAST','independently prefers Home Club','Biggest concern:','0–0'])assert.ok(body.includes(expected),expected);
      assert.doesNotMatch(body,/1\.909090|1\.869565|1\.833333/,'the displayed odds are American');
      assert.equal(await page.$eval('#guyMoneyPuckBenchmark',node=>node.open),false,'the benchmark starts collapsed');
      await page.click(`${id} > details > summary`);
      const research=await text(id);for(const expected of ['Home Goalie','Confirmed','Away Goalie','Disagreement reviewed','Pinnacle favors the other side','Rest & travel','Five-on-five play'])assert.ok(research.includes(expected),expected);
      assert.ok(await page.$$eval(`${id} details a`,links=>links.length>=5&&links.every(link=>link.href.startsWith('https://')&&link.rel.includes('noopener'))));
      await page.click('#guyMoneyPuckBenchmark > summary');
      const benchmarkId=route==='value'?'#resultsGuyValue':'#guyDailyPick';assert.match(await text(benchmarkId),/Benchmark Away \+130/);assert.match(await text(benchmarkId),/1–0/);
      assert.match(await page.$eval(`${id} .guy-call-record`,node=>node.innerText),/0–0/,'the benchmark win does not enter Guy’s actual-call record');
      await page.click(`${benchmarkId} > details:last-of-type > summary`);assert.match(await text(benchmarkId),/one minute before its own game starts/);
      const size=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.client+2,`${route} body overflow at ${width}: ${JSON.stringify(size)}`);
      await unchanged();await page.screenshot({path:`.qa/guy-call-${route}-${width}.png`,fullPage:true});
    }
    await page.setViewport({width:390,height:844,deviceScaleFactor:1});
    let id=await open('hotline','limit');assert.equal(await state(id),'PRICE_OUTSIDE_LIMIT');assert.match(await text(id),/Do not chase/);assert.match(await text(id),/Home Club -110/);await page.screenshot({path:'.qa/guy-call-limit.png',fullPage:true});
    for(const [name,expected,message]of [['quote-expiry','PRICE_EXPIRED','fresh sportsbook quote'],['model-expiry','PRICE_EXPIRED','fresh MoneyPuck forecast'],['research-expiry','RESEARCH_REQUIRED','hockey review needs refreshing']]){
      id=await open('value',name);assert.equal(await state(id),'CURRENT','the exact freshness boundary passes');const requests=dataRequests.length;
      await page.evaluate(()=>window.fixtureAdvance('2026-11-01T17:00:00.001Z'));
      assert.equal(await state(id),expected);assert.ok((await text(id)).includes(message));assert.doesNotMatch(await text(id),/PRICE CHECK PASSED|Latest captured quote passes/);assert.equal(dataRequests.length,requests,'local expiry makes no source request');await unchanged();await page.screenshot({path:`.qa/guy-call-${name}.png`,fullPage:true});
    }
    id=await open('hotline','projected');await page.click(`${id} > details > summary`);assert.match(await text(id),/Projected/);let requests=dataRequests.length;
    await page.evaluate(()=>window.fixtureAdvance('2026-11-01T17:01:00.001Z'));assert.equal(await state(id),'GOALIE_RECHECK_REQUIRED');assert.equal(await page.$eval(`${id} > details`,node=>node.open),true,'local updates retain the open research');assert.equal(dataRequests.length,requests);await unchanged();await page.screenshot({path:'.qa/guy-call-goalie-recheck.png',fullPage:true});
    id=await open('value','locked');assert.equal(await state(id),'CURRENT');requests=dataRequests.length;
    await page.evaluate(()=>window.fixtureAdvance('2026-11-01T18:58:55.001Z'));assert.equal(await state(id),'GOALIE_RECHECK_REQUIRED');
    await page.evaluate(()=>window.fixtureAdvance('2026-11-01T18:59:00.001Z'));assert.equal(await state(id),'LOCKED');const locked=await text(id);for(const expected of ['Home Club -110','+120','GOALIE RECHECK NEEDED','published selection remains frozen','frozen published selection','0–0'])assert.ok(locked.includes(expected),expected);
    assert.equal(dataRequests.length,requests,'cutoff audit makes no source request');await unchanged();await page.screenshot({path:'.qa/guy-call-locked-audit.png',fullPage:true});
    id=await open('hotline','offline');assert.equal(await state(id),'CURRENT','a failed fetch uses the embedded saved call');await page.evaluate(()=>window.fixtureAdvance('2026-11-01T18:20:00Z'));assert.equal(await state(id),'PRICE_EXPIRED','embedded fallback still expires locally');assert.doesNotMatch(await text(id),/PRICE CHECK PASSED/);await unchanged();
    assert.deepEqual(external,[],'fixture QA makes no external or odds API requests');assert.deepEqual(errors,[]);
    console.log('GUY DAILY CALL BROWSER: PASS // mobile/tablet/desktop, Hotline + Value, independent choice, limit, separate benchmark, quote/model/research expiry, projected goalie, frozen audit, offline fallback');
  }
  for(const [name,f]of fixtures)assert.equal(json(f),originals.get(name),'fixtures stay immutable');
}catch(error){
  if(page){fs.mkdirSync('.qa',{recursive:true});await page.screenshot({path:'.qa/guy-call-failure.png',fullPage:true});console.error(await page.evaluate(()=>({url:location.href,ready:window.fixtureReady,state:document.querySelector('[data-guy-call-state]')?.dataset.guyCallState,text:document.querySelector('[data-guy-call-state]')?.innerText})));}
  throw error;
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
