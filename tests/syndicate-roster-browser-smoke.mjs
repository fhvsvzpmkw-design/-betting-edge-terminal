import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let page;
try{
  page=await browser.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.evaluateOnNewDocument(()=>{
    if(location.pathname.endsWith('/runner.html')&&!sessionStorage.getItem('syndicateRecoverySeeded')){
      localStorage.setItem('bettingEdge.syndicateSlots.v4',JSON.stringify([null,null,null,null,'lou-vega',null,null,null]));
      localStorage.setItem('bettingEdge.syndicateSlots.defaultOrderRevision','2');
      sessionStorage.setItem('syndicateRecoverySeeded','1');
    }
  });
  await page.setViewport({width:1024,height:900,deviceScaleFactor:1});
  const ready=async()=>page.waitForFunction(()=>document.documentElement.dataset.primaryNavShellBound==='5'&&(!document.getElementById('splash2')||getComputedStyle(document.getElementById('splash2')).display==='none'||getComputedStyle(document.getElementById('splash2')).visibility==='hidden'),{timeout:60000});
  const loaded=async()=>page.waitForFunction(()=>document.querySelector('.syndicateFrame')?.contentDocument?.querySelector('#loadedCount')?.textContent==='5 / 8',{timeout:30000});
  const names=async()=>page.$$eval('.syndicateTab .syndicateName',els=>els.map(e=>e.textContent));
  const expected=['EDDIE NUMBERS','GRAHAM MERCER','BILL WESTON','GUY LAFLAME','LOU VEGA','EMPTY 6','EMPTY 7','EMPTY 8'];
  await page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:60000});await ready();
  await page.evaluate(()=>{
    window.syndicatePaints=[];
    new MutationObserver(()=>{const names=[...document.querySelectorAll('.syndicateTab .syndicateName')].map(e=>e.textContent);if(names.length===8)window.syndicatePaints.push(names)}).observe(document.body,{subtree:true,childList:true});
  });
  await page.click('#runnerSyndicateF5');await loaded();
  assert.deepEqual(await names(),expected);
  assert.ok((await page.evaluate(()=>window.syndicatePaints)).every(row=>JSON.stringify(row)===JSON.stringify(expected)),'the first five must never flash to empty');
  fs.mkdirSync('.qa',{recursive:true});
  for(const width of [390,1024,1440]){await page.setViewport({width,height:900,deviceScaleFactor:1});await page.screenshot({path:`.qa/syndicate-${width}.png`,fullPage:true});assert.deepEqual(await names(),expected);}
  await page.click('[data-syndicate-tab="3"]');
  await page.waitForFunction(()=>document.querySelector('.syndicateFrame')?.contentDocument?.querySelector('#currentName')?.textContent?.startsWith('GUY LAFLAME'),{timeout:30000});
  await page.click('[data-syndicate-tab="5"]');
  await page.waitForFunction(()=>document.querySelector('.syndicateFrame')?.contentDocument?.querySelector('#currentName')?.textContent==='EMPTY // SLOT AVAILABLE',{timeout:30000});
  let host=page.frames().find(f=>f.url().includes('slot-host.html?slot=6'));
  await host.click('#manageButton');
  let selected=false;
  for(const card of await host.$$('.profileCard')){if(await card.$eval('.profileName',e=>e.textContent)==='JESSE BAINS'){await card.click();selected=true;break;}}
  assert.ok(selected);await page.waitForFunction(()=>document.querySelector('[data-syndicate-tab="5"] .syndicateName')?.textContent==='JESSE BAINS');
  await page.click('[data-syndicate-tab="0"]');
  await page.waitForFunction(()=>document.querySelector('.syndicateFrame')?.contentDocument?.querySelector('#currentName')?.textContent?.startsWith('EDDIE NUMBERS'),{timeout:30000});
  host=page.frames().find(f=>f.url().includes('slot-host.html?slot=1'));
  await host.click('#manageButton');await host.click('.emptyCard');
  await page.waitForFunction(()=>document.querySelector('[data-syndicate-tab="0"] .syndicateName')?.textContent==='EMPTY 1');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});await ready();await page.click('#runnerSyndicateF5');await loaded();
  const custom=[...expected];custom[0]='EMPTY 1';custom[5]='JESSE BAINS';assert.deepEqual(await names(),custom);
  await page.click('#runnerSyndicateF5');await page.click('#runnerPreferencesF6');
  await page.waitForSelector('[data-pref-syndicate-slot="5"]');
  const saved=await page.$$eval('[data-pref-syndicate-slot]',els=>els.map(e=>e.value));
  assert.equal(saved[0],'');assert.equal(saved[3],'guy-laflame');assert.equal(saved[4],'lou-vega');assert.equal(saved[5],'jesse-bains');
  assert.deepEqual(errors,[]);
  console.log('SYNDICATE ROSTER BROWSER: PASS // legacy recovery, first paint, Guy four/Lou five, custom member, deliberate empty, reload, Preferences, three widths');
}catch(error){
  if(page){console.error(await page.evaluate(()=>({view:document.body.dataset.primaryView,load:document.getElementById('runnerSyndicateF5')?.textContent,slots:[...document.querySelectorAll('.syndicateTab .syndicateName')].map(e=>e.textContent),host:document.querySelector('.syndicateFrame')?.contentDocument?.body?.innerText?.slice(0,800)})));fs.mkdirSync('.qa',{recursive:true});await page.screenshot({path:'.qa/syndicate-failure.png',fullPage:true});}
  throw error;
}finally{await browser.close();}
