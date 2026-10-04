import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import Odds from '../assets/odds-format.js';

for(const [decimal,american] of [[1.3,'-333'],[1.91,'-110'],[2,'+100'],[2.2,'+120'],[3.7,'+270'],[3.9860030704978855,'+299']])assert.equal(Odds.fromDecimal(decimal),american);
for(const invalid of [null,undefined,'',0,1,NaN,Infinity])assert.equal(Odds.fromDecimal(invalid),'—');
assert.equal(Odds.price(270),'+270');assert.equal(Odds.price('-110'),'-110');assert.equal(Odds.price('−110'),'-110');assert.equal(Odds.price('1.91'),'-110');
assert.equal(Odds.text('+270 at decimal 3.7'),'+270');
assert.equal(Odds.text('Price at 3.7. Odds 1.91.'),'Price +270. Odds -110.');
assert.equal(Odds.text('Price at 3.7%.'),'Price at 3.7%.');
assert.equal(Odds.text('recorded DraftKings 1.72 price'),'recorded DraftKings -139 price');
assert.equal(Odds.text('recorded Bet365 1.64 price'),'recorded Bet365 -156 price');
assert.equal(Odds.text('At 2 odds; 2.2 price.'),'At +100 odds; +120 price.');
assert.equal(Odds.text('66.2% price support; -1.5 price line; $1.72 price; 0.49 probability points.'),'66.2% price support; -1.5 price line; $1.72 price; 0.49 probability points.');
assert.equal(Odds.text('+270 (3.7)'),'+270');
assert.equal(Odds.text('+100 (2); decimal odds 2.'),'+100; +100.');
assert.equal(Odds.text('Approximately 1.004 decimal.',[1.0044]),'Approximately -22727.','known exact odds take precedence over rounded narrative prices');
assert.equal(Odds.price('3.7 or better'),'+270 or better');
assert.equal(Odds.text('Approximately 3.986 decimal comparison boundary.'),'Approximately +299 comparison boundary.');
const unrelated='Edge is 2.16 probability points. Total 5.5 goals; fair home -3.5; stake $3.70; probability 27.60%; observed 08:18.';
assert.equal(Odds.text(unrelated,[2.16,5.5,3.7]),unrelated);
assert.equal(Odds.text('Total moved from 5.5 to 6.5; margin at 3.7 points.',[5.5,6.5,3.7]),'Total moved from 5.5 to 6.5; margin at 3.7 points.');
const issued={price:'+270',feed:{priceDecimal:3.7},analysis:'Break-even rate at 3.7; 0.57 probability points.',source:'The quote was +270 at decimal 3.7.',marketAssessment:{decisionRationale:'Price at 3.7.'}};
const before=JSON.stringify(issued),view=Odds.record(issued);
assert.equal(view.analysis,'Break-even rate at +270; 0.57 probability points.');
assert.equal(view.source,'The quote was +270.');
assert.equal(JSON.stringify(issued),before,'rendering must preserve issued records and decimal calculation inputs');
assert.equal(view.feed.priceDecimal,3.7);
assert.equal(Odds.text(view.analysis,[3.7]),view.analysis,'formatting is idempotent');
const browser={};vm.runInNewContext(fs.readFileSync('assets/odds-format.js','utf8'),browser);
assert.equal(browser.VigScopeOddsFormat.fromDecimal(3.7),Odds.fromDecimal(3.7),'browser and producer use the same formatter');
for(const entry of ['runner.html','runner-app.html','runner-core.html','index.html']){
 const html=fs.readFileSync(entry,'utf8');assert.match(html,/<script src="\.\/assets\/odds-format\.js\?v=american-only-20261004"><\/script>/);
 assert.ok(html.indexOf('assets/odds-format.js')<html.indexOf('</head>'),'formatter loads before renderers');
}
assert.doesNotMatch(fs.readFileSync('assets/game-intelligence.js','utf8'),/'DECIMAL'|priceDecimal\?\.toFixed|`decimal \$/);
assert.doesNotMatch(fs.readFileSync('assets/runner-core-runtime.js','utf8'),/americanText\(d\)\} \(\$\{d\}\)/);
assert.match(fs.readFileSync('tools/candidate-assessment.mjs','utf8'),/OddsFormat\.fromDecimal\(value\.priceDecimal\)/);

// Exercise the actual renderers, including collapsed card analysis and both
// shortlist sides. This small DOM implements only their standard node APIs.
class Element {
 constructor(tag,text=''){this.tagName=tag;this.nodeType=tag==='#text'?3:1;this.children=[];this._text=text;this.style={};this.dataset={};this.attributes={};this._value='';}
 set textContent(v){this._text=String(v);this.children=[];}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}
 append(...nodes){this.children.push(...nodes);}
 appendChild(node){this.append(node);return node;}
 replaceChildren(...nodes){this._text='';this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=String(v);}
 get value(){return this._value||(this.tagName==='select'?this.children[0]?.textContent:'')||'';}
 set value(v){this._value=v;}
}
const d={head:new Element('head'),createElement:tag=>new Element(tag),createTextNode:text=>new Element('#text',String(text)),getElementById:()=>null};
const context={console,Intl,Date,URL,URLSearchParams,document:d,location:{hash:''},localStorage:{getItem:()=>null}};
vm.runInNewContext(fs.readFileSync('assets/odds-format.js','utf8'),context);
const runtime=fs.readFileSync('assets/runner-core-runtime.js','utf8');
assert.ok(runtime.includes('\nactiveRun=payload();'));
vm.runInNewContext(runtime.slice(0,runtime.indexOf('\nactiveRun=payload();'))+'\nglobalThis.oddsApi={card,candidateAssessmentPanel,pickReason,displayPrice};})();',context);
vm.runInNewContext(fs.readFileSync('assets/game-intelligence.js','utf8'),context);
const example={...issued,title:'Dallas moneyline',status:'LEAN',book:'Bet365',support:'Break-even at decimal 3.7.',marketAssessment:{decisionRationale:'Break-even rate at 3.7. Further review required.'}};
const selection={...example,selectionId:'home',quote:{book:'Bet365',side:'home',marketKey:'ml',priceDecimal:3.7},priceCondition:{state:'PRICE_THRESHOLD',hypothetical:true,basis:'MARKET_REFERENCE_BREAK_EVEN',text:'Approximately 3.986 decimal comparison boundary.',priceDecimal:3.9860030704978855}};
const fixture={recs:[example],candidateAssessment:{schema:1,version:'candidate-assessment-v1',shortlist:[{label:'Dallas @ Seattle',selections:[selection]}]},gameIntelligence:{games:[{eventId:'test',label:'Dallas @ Seattle',sport:'NFL',home:'Seattle',away:'Dallas',summary:{},markets:[{marketDetail:'full_game_moneyline',side:'away',quotes:[{book:'Bet365',priceDecimal:3.7,breakEvenProbability:1/3.7,movement:{previousPrice:3.5}}]}]}]}};
const run=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2],'utf8')):fixture;
const runBefore=JSON.stringify(run),cards=run.recs.map(r=>context.oddsApi.card(d,r).textContent);
const shortlist=context.oddsApi.candidateAssessmentPanel(d,run)?.textContent||'';
const intelligence=context.BettingEdgeIntelligence.render(d,run.gameIntelligence)?.textContent||'';
const rendered=[...cards,shortlist,intelligence].join('\n');
assert.doesNotMatch(rendered,/\bdecimal\s+(?:odds\s+)?\d|\d+\.\d+\s+decimal\b|[+-]\d{3,}\s*\(\d+\.\d+\)/i,'no decimal or dual-format odds in rendered views');
assert.match(intelligence,/AMERICAN ODDS/);
assert.match(cards[0],/[+-]\d{3,}/);
assert.equal(context.oddsApi.displayPrice('3.7'),'+270');
assert.equal(context.oddsApi.displayPrice('+10000'),'+10000');
assert.equal(context.oddsApi.pickReason(example),'Break-even rate at +270.');
for(const [team,book,decimal,american,point] of [['Milwaukee Brewers','DraftKings',1.72,'-139',66.2],['Los Angeles Dodgers','Bet365',1.64,'-156',66.7]]){
 const rationale=`PROVISIONAL LEAN — ESPN’s ${point}% whole-game point supports ${team} at the recorded ${book} ${decimal} price after the current official personnel review.`;
 const rec={...example,title:team,book,price:american,feed:{priceDecimal:decimal},analysis:rationale,marketAssessment:{decisionRationale:rationale}};
 const frozen=JSON.stringify(rec),expected=rationale.replace(`${decimal} price`,`${american} price`);
 assert.equal(context.oddsApi.pickReason(rec),expected,'collapsed lean reason uses American odds');
 const renderedCard=context.oddsApi.card(d,rec).textContent;
 assert.ok(renderedCard.includes(expected),'real lean renderer formats the exact reported sentence');
 assert.ok(!renderedCard.includes(`${decimal} price`),'expanded lean analysis also uses American odds');
 assert.ok(renderedCard.includes(`${point}%`),'forecast probability is preserved');
 assert.equal(JSON.stringify(rec),frozen,'issued snapshot remains immutable');
 assert.equal(Odds.text(expected),expected,'American price text is idempotent');
}
assert.equal(JSON.stringify(run),runBefore,'all actual renderers preserve issued records');
console.log(`Rendered cards (${cards.length}), Exclusive shortlist and Game Intelligence: PASS`);
console.log('American odds: conversion, units, immutable records, browser/producer parity and entrypoints PASS');
