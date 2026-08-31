import puppeteer from 'puppeteer-core';

const executablePath=process.env.CHROME;
const payload=process.env.PAYLOAD;
if(!executablePath||!payload)throw new Error('CHROME and PAYLOAD are required');

const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));

await page.goto(`http://127.0.0.1:8765/runner.html#run=${payload}`,{waitUntil:'domcontentloaded',timeout:20000});
await new Promise(resolve=>setTimeout(resolve,8000));

const state=await page.evaluate(()=>{
  const core=document.getElementById('core');
  const coreDoc=core?.contentDocument||null;
  const shim=coreDoc?.getElementById('app')||null;
  const appDoc=shim?.contentDocument||null;
  const text=appDoc?.documentElement?.textContent||'';
  return {
    coreSrc:core?.getAttribute('src')||'',
    nestedIframes:coreDoc?coreDoc.querySelectorAll('iframe').length:-1,
    shimTag:shim?.tagName||'',
    title:appDoc?.querySelector('.top .title')?.textContent||'',
    runnerLive:Boolean(appDoc?.getElementById('runnerLive')),
    runnerTitle:appDoc?.querySelector('#runnerLive .runnerTitle')?.textContent||'',
    historyPreserved:Boolean(appDoc?.getElementById('summaryOverallRoi')&&appDoc?.getElementById('ledgerBody')),
    oldArchive:text.includes('CORE v1.4 RUN ARCHIVE'),
    oldLiberty:text.includes('NEW YORK LIBERTY @ INDIANA FEVER'),
    oldSourceMonitor:text.includes('CORE v1.4 SOURCE MONITOR // FREE STACK'),
    oldMarket:text.includes('CURRENT REFERENCE BOARD // SNAPSHOT + ATTRIBUTION'),
  };
});

console.log(JSON.stringify({state,pageErrors},null,2));
const fail=message=>{throw new Error(message)};
if(!state.coreSrc.includes('runner-app.html'))fail('runner did not target canonical app');
if(state.nestedIframes!==0)fail('canonical app still contains an inner iframe');
if(state.shimTag!=='DIV')fail('compatibility shim is not a DIV');
if(!state.title.includes('VIGSCOPE TERMINAL UI v1.5'))fail('v1.5 title overlay missing');
if(!state.runnerLive||!state.runnerTitle.includes('18:15'))fail('current runner report did not render');
if(!state.historyPreserved)fail('F3 history/ledger structure was not preserved');
if(state.oldArchive||state.oldLiberty||state.oldSourceMonitor||state.oldMarket)fail('legacy visible page content remains');
if(pageErrors.length)fail(`page errors: ${pageErrors.join(' | ')}`);

await browser.close();
