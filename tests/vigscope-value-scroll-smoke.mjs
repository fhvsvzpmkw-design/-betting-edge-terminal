import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import A from '../assets/value-analytics.js';
const comparison=JSON.parse(fs.readFileSync(new URL('../data/history/graham-pinnacle-value.json',import.meta.url)));
const expectedGraham=A.summary(A.strategyRows(comparison.rows,'graham')).grades;
const executablePath=process.env.CHROME;
if(!executablePath)throw new Error('CHROME is required');
const browser=await puppeteer.launch({headless:true,executablePath,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const page=await browser.newPage(),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{if(r.url().includes('/data/history/results-index.json'))requests.push(r.url());});
 await page.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:false,hasTouch:false});
 await page.goto('http://127.0.0.1:8765/runner.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForSelector('.tabs>.btn[data-view="engine"]',{timeout:60000});
 await page.waitForSelector('#resultsGrahamValue .comparisonTable',{timeout:60000,visible:false});
 await page.waitForFunction(()=>document.documentElement.dataset.primaryNavShellBound==='5'&&(!document.getElementById('splash2')||getComputedStyle(document.getElementById('splash2')).display==='none'||getComputedStyle(document.getElementById('splash2')).visibility==='hidden'),{timeout:60000});
 await page.click('.tabs>.btn[data-view="engine"]');
 await page.waitForFunction(()=>document.body.dataset.primaryView==='engine',{timeout:10000});
 const initial=await page.evaluate(()=>({view:document.body.dataset.primaryView,title:document.querySelector('#engine .resultsTitle')?.textContent,proof:document.querySelectorAll('.whyProofCard').length,pizza:!!document.querySelector('#resultsPizzaValueBox'),shadow:!!document.querySelector('#resultsDecisionValueBox'),archive:!!document.querySelector('#resultsCardLog'),filters:!!document.querySelector('#valueHistoryFilters'),graham:document.querySelector('.comparisonTable').innerText,iframe:document.querySelectorAll('iframe').length}));
 assert.equal(initial.view,'engine');assert.equal(initial.title,undefined);assert.equal(initial.proof,6);assert.ok(initial.pizza&&initial.shadow&&initial.archive&&initial.filters);assert.equal(initial.iframe,0);assert.ok(initial.graham.includes(`${expectedGraham.WIN}–${expectedGraham.LOSS}–${expectedGraham.PUSH}`),'display reflects the current saved ATS population');assert.equal(requests.length,1,'one shared history request');
 assert.match(await page.$eval('#resultsGuyValue',e=>e.innerText),/GUY’S BLUE LINE/);
 assert.match(await page.$eval('#resultsGuyValue',e=>e.innerText),/Flat 1u risk/);
 await page.select('#gWeek','1');
 assert.match(await page.$eval('.comparisonTable',e=>e.innerText),/7–8–1/);
 await page.select('#gWeek','ALL');await page.click('[data-strategy="dogs"]');
 assert.match(await page.$eval('#grahamGameLog summary',e=>e.innerText),/Pinnacle dogs/);
 await page.select('#valueGrade','OPEN');
 assert.ok(await page.$$eval('#resultsCardLog tbody tr',rows=>rows.every(r=>r.innerText.includes('OPEN'))));
 await page.select('#valueGrade','ALL');await page.select('#valueSize','25');
 const n=await page.$$eval('#resultsCardLog tbody tr',rows=>rows.length);assert.ok(n>10&&n<=25);
 await page.click('[data-page="1"]');assert.match(await page.$eval('#resultsCardLog .valuePager',e=>e.innerText),/Page 2/);
 await page.click('#resultsCardLog .archiveCard summary');
 await page.waitForFunction(()=>{const el=document.querySelector('#resultsCardLog .archiveCard[open]');return el?.dataset.loaded==='1';},{timeout:30000});
 await page.select('#valueSport','NFL');
 await page.click('[data-period="ALL"]');
 fs.mkdirSync('.qa',{recursive:true});
 for(const width of [390,1024,1440]){
  await page.setViewport({width,height:900,deviceScaleFactor:1});await page.evaluate(()=>window.scrollTo(0,0));
  const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,height:document.scrollingElement.scrollHeight}));
  assert.ok(size.scroll<=size.width+2,`body overflow at ${width}: ${size.scroll}/${size.width}`);assert.ok(size.height>1200,JSON.stringify(size));
  await page.screenshot({path:`.qa/value-${width}.png`,fullPage:true});
  await page.evaluate(()=>window.scrollTo(0,document.scrollingElement.scrollHeight*.6));assert.ok(await page.evaluate(()=>scrollY)>100);
 }
 assert.deepEqual(errors,[]);console.log('VIGSCOPE VALUE BROWSER: PASS // mobile/tablet/desktop, archive, filters, strategies, source analysis, scrolling, one history request');
}finally{await browser.close();}
