import puppeteer from 'puppeteer-core';

const executablePath=process.env.CHROME;
const payload=process.env.PAYLOAD;
if(!executablePath||!payload)throw new Error('CHROME and PAYLOAD are required');

const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));

await page.goto(`http://127.0.0.1:8765/runner.html#run=${payload}`,{waitUntil:'domcontentloaded',timeout:45000});
await new Promise(resolve=>setTimeout(resolve,7000));

const state=await page.evaluate(()=>{
  const core=document.getElementById('core');
  const app=document.getElementById('app');
  const text=document.documentElement.textContent||'';
  return {
    iframeCount:document.querySelectorAll('iframe').length,
    coreTag:core?.tagName||'',
    appTag:app?.tagName||'',
    coreDocSame:core?.contentDocument===document,
    appDocSame:app?.contentDocument===document,
    title:document.querySelector('.top .title')?.textContent||'',
    runnerLive:Boolean(document.getElementById('runnerLive')),
    runnerTitle:document.querySelector('#runnerLive .runnerTitle')?.textContent||'',
    historyPreserved:Boolean(document.getElementById('summaryOverallRoi')&&document.getElementById('ledgerBody')),
    oldArchive:text.includes('CORE v1.4 RUN ARCHIVE'),
    oldLiberty:text.includes('NEW YORK LIBERTY @ INDIANA FEVER'),
    oldSourceMonitor:text.includes('CORE v1.4 SOURCE MONITOR // FREE STACK'),
    oldMarket:text.includes('CURRENT REFERENCE BOARD // SNAPSHOT + ATTRIBUTION'),
  };
});

// Force a tall direct document so this specifically verifies that the top-level
// page can scroll natively and is not still locked like the old iframe shell.
await page.evaluate(()=>{
  const probe=document.createElement('div');
  probe.id='nativeScrollProbe';
  probe.style.height='2600px';
  probe.style.width='1px';
  probe.style.pointerEvents='none';
  document.body.appendChild(probe);
});
await new Promise(resolve=>setTimeout(resolve,100));
await page.evaluate(()=>window.scrollTo(0,1800));
await new Promise(resolve=>setTimeout(resolve,400));
const scrollState=await page.evaluate(()=>({y:window.scrollY,max:(document.scrollingElement?.scrollHeight||0)-window.innerHeight,htmlOverflow:getComputedStyle(document.documentElement).overflowY,bodyOverflow:getComputedStyle(document.body).overflowY}));

console.log(JSON.stringify({state,scrollState,pageErrors},null,2));
const fail=message=>{throw new Error(message)};
if(state.iframeCount!==0)fail('single document still has an iframe at boot');
if(state.coreTag!=='DIV'||state.appTag!=='DIV')fail('compatibility shims are not DIVs');
if(!state.coreDocSame||!state.appDocSame)fail('compatibility shims do not point at the direct document');
if(!state.title.includes('VIGSCOPE TERMINAL UI v1.5'))fail('current v1.5 header missing');
if(!state.runnerLive||!state.runnerTitle.includes('18:15'))fail('current runner report did not render');
if(!state.historyPreserved)fail('F3 history/ledger structure was not preserved');
if(state.oldArchive||state.oldLiberty||state.oldSourceMonitor||state.oldMarket)fail('legacy visible content remains');
if(scrollState.max<1000||scrollState.y<500)fail(`native document scroll is locked: ${JSON.stringify(scrollState)}`);
if(pageErrors.length)fail(`page errors: ${pageErrors.join(' | ')}`);

await browser.close();
