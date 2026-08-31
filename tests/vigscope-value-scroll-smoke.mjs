import puppeteer from 'puppeteer-core';

const executablePath=process.env.CHROME;
if(!executablePath)throw new Error('CHROME is required');

const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
const page=await browser.newPage();
await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(String(error)));

await page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:45000});
await new Promise(resolve=>setTimeout(resolve,5200));

const engineButton=await page.$('.runnerNavPad .tabs>.btn[data-view="engine"],.tabs>.btn[data-view="engine"]');
if(!engineButton)throw new Error('VigScope Value menu button missing');
await engineButton.click();
await new Promise(resolve=>setTimeout(resolve,2800));

const state=await page.evaluate(()=>({
  primaryView:document.body?.dataset?.primaryView||'',
  valueDesk:Boolean(document.querySelector('#engine.resultsDesk')),
  valueTitle:document.querySelector('#engine.resultsDesk .resultsTitle')?.textContent||'',
  decisionBox:Boolean(document.getElementById('resultsDecisionValueBox')),
  pizzaBox:Boolean(document.getElementById('resultsPizzaValueBox')),
  modelBox:Boolean(document.getElementById('resultsModelCalibrationBox')),
  whyHeading:[...document.querySelectorAll('#engine.resultsDesk .resultsSection')].some(x=>String(x.textContent||'').includes('WHY VIGSCOPE MATTERS')),
  cardLog:Boolean([...document.querySelectorAll('#engine.resultsDesk .resultsSection')].some(x=>/ISSUED CARD LOG|UNIQUE SELECTION LOG/.test(String(x.textContent||'')))),
  iframeCount:document.querySelectorAll('iframe').length,
  scrollHeight:document.scrollingElement?.scrollHeight||0,
  viewport:window.innerHeight,
}));

await page.evaluate(()=>window.scrollTo(0,Math.max(0,(document.scrollingElement?.scrollHeight||0)*0.60)));
await new Promise(resolve=>setTimeout(resolve,350));
const down=await page.evaluate(()=>window.scrollY);
await page.evaluate(()=>window.scrollTo(0,0));
await new Promise(resolve=>setTimeout(resolve,150));
await page.evaluate(()=>window.scrollTo(0,Math.max(0,(document.scrollingElement?.scrollHeight||0)*0.82)));
await new Promise(resolve=>setTimeout(resolve,350));
const secondDown=await page.evaluate(()=>window.scrollY);

console.log(JSON.stringify({state,down,secondDown,pageErrors},null,2));
const fail=message=>{throw new Error(message)};
if(state.primaryView!=='engine')fail('VigScope Value did not open in the primary shell');
if(!state.valueDesk)fail('VigScope Value desk missing');
if(!state.valueTitle)fail('VigScope Value title missing');
if(!state.decisionBox||!state.pizzaBox||!state.modelBox||!state.whyHeading||!state.cardLog)fail('Value overlays did not finish rendering');
if(state.iframeCount!==0)fail('application iframe reappeared');
if(state.scrollHeight<=state.viewport+100)fail('Value page is not scrollable');
if(down<100||secondDown<100)fail('native Value-page scroll did not move');
if(pageErrors.length)fail(`page errors: ${pageErrors.join(' | ')}`);

await browser.close();
