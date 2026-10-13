import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({headless:true,executablePath:process.env.CHROME,args:['--no-sandbox','--disable-dev-shm-usage']});
let page;
try{
  page=await browser.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.evaluateOnNewDocument(()=>{
    if(location.pathname.endsWith('/runner.html')&&!sessionStorage.getItem('preferencesSeeded')){
      localStorage.setItem('bettingEdge.preferences.cardView','neon');
      localStorage.setItem('bettingEdge.preferences.meterPresentation','rails');
      localStorage.setItem('bettingEdge.preferences.historyLanding','ledger');
      localStorage.setItem('bettingEdge.preferences.meatDeskAnalysisMode','god_mode');
      localStorage.setItem('bettingEdge.preferences.cryptoSpecialsAnalysisMode','in_depth_report');
      localStorage.setItem('bettingEdge.syndicateSlots.v4',JSON.stringify(['lou-vega','graham-mercer','vic-fremont','eddie-numbers','alex-daventry',null,null,null]));
      localStorage.setItem('bettingEdge.syndicateSlots.defaultOrderRevision','3');
      localStorage.setItem('bettingEdge.savedHistoryTest','issued-history-sentinel');
      sessionStorage.setItem('preferencesSeeded','1');
    }
  });
  const ready=()=>page.waitForFunction(()=>window.VigScopeMenuHome?.ready&&document.body.classList.contains('vigMenuStyled')&&!document.getElementById('splash2'),{timeout:60000});
  const preferences=async()=>{await page.click('#vigMainMenu>[data-vig-menu-id="preferences"]');await page.waitForSelector('[data-pref-group="appearance"]',{visible:true})};
  await page.setViewport({width:834,height:1000,deviceScaleFactor:1});
  await page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:60000});await ready();await preferences();
  assert.deepEqual(await page.$$eval('[data-pref-group]',elements=>elements.map(element=>element.dataset.prefGroup)),['appearance','navigation','syndicate','research']);
  assert.equal(await page.$$eval('[data-preference-module]',elements=>elements.length),9);
  assert.equal(await page.$('.prefStateCounts,.prefStateBadge,.prefFrameworkRule,[data-preference-module="terminal_interface"]'),null);
  const characters=await page.$$eval('[data-pref-shell-character]',elements=>elements.map(element=>element.dataset.prefShellCharacter));
  assert.equal(characters.length,8);assert.equal(new Set(characters).size,8);
  assert.deepEqual(characters.slice(0,5),['eddie-numbers','graham-mercer','bill-weston','guy-laflame','lou-vega']);
  assert.deepEqual(await page.$$eval('.prefSlotControl>span',elements=>elements.map(element=>element.textContent)),Array.from({length:8},(_,i)=>'Slot '+(i+1)));
  const startupLabels=await page.$$eval('[data-pref-choice="startup_screen"] option',elements=>elements.map(element=>element.textContent));
  assert.deepEqual(startupLabels,['Main Menu','VigScope','Market','Bet History','VigScope Value','Last used']);
  fs.mkdirSync('.qa',{recursive:true});
  for(const [width,height] of [[390,650],[834,1000],[1194,650]]){
    await page.setViewport({width,height,deviceScaleFactor:1});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll('.prefSelect,.prefReset')].map(element=>{const r=element.getBoundingClientRect();return {x:r.x,right:r.right,height:r.height}})}));
    assert.ok(layout.scroll<=width+1,`${width}: Preferences may scroll vertically but must not overflow sideways`);
    for(const control of layout.controls){assert.ok(control.x>=0&&control.right<=width+1);assert.ok(control.height>=44,'preference controls need comfortable touch targets')}
    await page.screenshot({path:`.qa/preferences-${width}x${height}.png`,fullPage:true});
    console.log(`PREFERENCES LAYOUT ${width}x${height}: PASS // four groups, 9 settings cards, 44px targets, no horizontal overflow`);
  }
  await page.click('.prefShellDetails summary');
  await page.select('[data-pref-choice="card_view"]','excited');
  await page.waitForFunction(()=>document.documentElement.dataset.cardView==='excited'&&document.querySelector('[data-pref-status="card_view"]').textContent==='Saved on this device.');
  assert.ok(await page.$eval('.prefShellDetails',element=>element.open),'saving another setting preserves the expanded designs');
  await page.select('[data-pref-choice="startup_screen"]','market');
  await page.click('[data-pref-reset="appearance"]');
  await page.waitForFunction(()=>document.documentElement.dataset.cardView==='normal'&&document.querySelector('[data-pref-choice="meter_presentation"]').value==='blocks');
  const afterAppearance=await page.evaluate(()=>Object.fromEntries(['bettingEdge.preferences.cardView','bettingEdge.preferences.meterPresentation','bettingEdge.preferences.startupScreen','bettingEdge.preferences.historyLanding','bettingEdge.preferences.meatDeskAnalysisMode','bettingEdge.preferences.cryptoSpecialsAnalysisMode','bettingEdge.syndicateSlots.v4','bettingEdge.savedHistoryTest'].map(key=>[key,localStorage.getItem(key)])));
  assert.equal(afterAppearance['bettingEdge.preferences.startupScreen'],'market');assert.equal(afterAppearance['bettingEdge.preferences.historyLanding'],'ledger');
  assert.equal(afterAppearance['bettingEdge.preferences.meatDeskAnalysisMode'],'god_mode');assert.equal(afterAppearance['bettingEdge.preferences.cryptoSpecialsAnalysisMode'],'in_depth_report');
  assert.equal(afterAppearance['bettingEdge.savedHistoryTest'],'issued-history-sentinel');assert.equal(JSON.parse(afterAppearance['bettingEdge.syndicateSlots.v4'])[0],'lou-vega');
  await page.click('[data-pref-reset="syndicate"]');
  await page.waitForFunction(()=>document.querySelector('[data-pref-syndicate-slot="0"]').value==='eddie-numbers'&&document.querySelector('[data-pref-syndicate-slot="3"]').value==='guy-laflame');
  assert.deepEqual(await page.$$eval('[data-pref-syndicate-slot]',elements=>elements.map(element=>element.value)),['eddie-numbers','graham-mercer','vic-fremont','guy-laflame','lou-vega','','','']);
  assert.match(await page.$eval('[data-pref-status="syndicate"]',element=>element.textContent),/Default lineup restored\. Saved on this device\./);
  assert.equal(await page.$eval('[data-pref-choice="startup_screen"]',element=>element.value),'market');
  assert.equal(await page.$eval('[data-pref-choice="card_view"]',element=>element.value),'normal');
  assert.equal(await page.$eval('[data-pref-syndicate-slot="5"] option[value="guy-laflame"]',element=>element.disabled),true,'an assigned member cannot be duplicated in another slot');
  await page.click('#runnerPreferencesF6');await ready();
  await page.click('#vigMainMenu>[data-vig-menu-id="syndicate"]');
  await page.waitForFunction(()=>document.querySelectorAll('.syndicateTab').length===8);
  assert.deepEqual(await page.$$eval('.syndicateTab .syndicateName',elements=>elements.map(element=>element.textContent)),['EDDIE NUMBERS','GRAHAM MERCER','BILL WESTON','GUY LAFLAME','LOU VEGA','EMPTY 6','EMPTY 7','EMPTY 8']);
  await page.waitForFunction(()=>!document.getElementById('runnerSyndicateF5').disabled,{timeout:30000});
  await page.click('#runnerSyndicateF5');await ready();
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.body.dataset.primaryView==='market'&&!document.getElementById('splash2'),{timeout:60000});
  await page.click('.runnerNavPad .btn[data-view="market"]');await ready();await preferences();
  assert.equal(await page.$eval('[data-pref-choice="startup_screen"]',element=>element.value),'market');
  assert.equal(await page.$eval('[data-pref-choice="card_view"]',element=>element.value),'normal');
  assert.equal(await page.evaluate(()=>localStorage.getItem('bettingEdge.savedHistoryTest')),'issued-history-sentinel');
  await page.select('[data-pref-choice="startup_screen"]','last_used');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.body.dataset.primaryView==='market'&&!document.getElementById('splash2'),{timeout:60000});
  assert.deepEqual(errors,[]);
  console.log('PREFERENCES BROWSER: PASS // unique approved shells; grouped controls; save feedback; focused resets preserve history/research/navigation; lineup loads correctly; saved Market and Last used survive reload; clean menu returns');
}catch(error){
  if(page){fs.mkdirSync('.qa',{recursive:true});await page.screenshot({path:'.qa/preferences-failure.png',fullPage:true});console.error(await page.evaluate(()=>({classes:document.body.className,view:document.body.dataset.primaryView,statuses:[...document.querySelectorAll('.prefSaveStatus')].map(element=>element.textContent)})))}
  throw error;
}finally{await browser.close()}
