import assert from 'node:assert/strict';
import fs from 'node:fs';
import {derivePrimarySelectionInventory, mergedFeedEvents} from '../tools/major-sport-market-coverage-gate.mjs';
import {primaryLineQuote, priceMovement, lineMovement} from '../tools/primary-lineage.mjs';
import {newestMoneylineQuote} from '../tools/moneyline-lineage.mjs';
import {exactBookQuotes} from '../tools/selection-availability.mjs';
import {deriveReportCoverageSummary, explainUnavailableSelections} from '../tools/report-coverage-summary.mjs';

const policy = JSON.parse(fs.readFileSync('data/major-sport-market-coverage-v1.json', 'utf8'));
const generatedAt = '2026-09-06T16:30:00Z';
const observedAt = '2026-09-06T16:29:00Z';
const updatedAt = '2026-09-06T12:00:00Z';
const report = {ts:'2026-09-06T09:35:00-07:00', feedGeneratedAt:generatedAt};
const key = (market, side, line = '') => ['fixture',market,side,'',line].join('|');
function market(marketKey, stamp = observedAt) {
  const line = marketKey === 'spread' ? -1.5 : marketKey === 'totals' ? 8.5 : '';
  const sides = marketKey === 'totals' ? ['over','under'] : ['home','away'];
  return {marketKey, name:marketKey, updatedAt, observedAt:stamp, odds:[{
    ...(line === '' ? {} : {hdp:line}), [sides[0]]:'1.91', [sides[1]]:'1.91',
    selectionKeys:Object.fromEntries(sides.map(side => [side,key(marketKey,side,line)]))
  }]};
}
function fixture() {
  return {quoteObservationVersion:1, generatedAt, events:[{
    id:'fixture', date:'2026-09-06T23:00:00Z', sport:{slug:'baseball'}, league:{slug:'usa-mlb'},
    bookmakers:{Bet365:['ml','spread','totals'].map(name => market(name))}
  }]};
}
const inventory = feed => derivePrimarySelectionInventory(report, feed, policy);
const event = feed => mergedFeedEvents(feed).get('fixture');
const selection = {feed:{eventId:'fixture', marketKey:'totals', side:'over', selectionKey:key('totals','over',8.5)}};
const quote = (feed, type) => type === 'ml' ? newestMoneylineQuote(event(feed),'Bet365','away',feed) : primaryLineQuote(event(feed),'Bet365', type === 'totals' ? 'over':'away',feed,type);

// Unchanged prices returned now are current in every server consumer, and the
// original provider timestamp remains attached to the exact receipt.
let feed = fixture();
const before = JSON.stringify(feed);
assert.equal(inventory(feed).selections.length,6);
for (const type of ['ml','spread','totals']) {
  assert.equal(quote(feed,type).state,'OK');
  assert.equal(quote(feed,type).updatedAt,updatedAt);
  assert.equal(quote(feed,type).observedAt,observedAt);
}
assert.equal(exactBookQuotes(feed,selection)[0].observedAt,observedAt);
assert.ok(inventory(feed).selections.every(selection => selection.quotes.every(quote => quote.quoteUpdatedAt === updatedAt && quote.quoteObservedAt === observedAt)));
assert.equal(JSON.stringify(feed),before,'server gates must not mutate source times');
assert.equal(priceMovement('-110','-110'),'PRICE UNCHANGED');
assert.equal(lineMovement('over',8.5,8.5,'totals'),'LINE UNCHANGED');
feed = fixture();
delete feed.events[0].bookmakers.Bet365[0].updatedAt;
const missingChangeTime = inventory(feed).selections.find(selection => selection.marketClass === 'moneyline').quotes[0];
assert.equal(missingChangeTime.quoteUpdatedAt,null,'an absent change time stays unknown, never replaced by the observation');
assert.deepEqual(JSON.parse(JSON.stringify(missingChangeTime)),missingChangeTime,'receipt survives JSON staging without dropping undefined fields');

// The existing 30-minute rule remains exact; a new provider change time cannot
// rescue an old observation, and invalid/missing/future v1 times fail closed.
for (const [stamp, count] of [
  ['2026-09-06T16:00:00Z',6], ['2026-09-06T15:59:59Z',0],
  ['2026-09-06T16:30:01Z',0], ['broken',0], [undefined,0]
]) {
  feed = fixture();
  for (const market of feed.events[0].bookmakers.Bet365) { market.observedAt = stamp; market.updatedAt = generatedAt; }
  assert.equal(inventory(feed).selections.length,count,String(stamp));
  for (const type of ['ml','spread','totals']) assert.equal(quote(feed,type).state,count ? 'OK':'STALE');
  assert.equal(exactBookQuotes(feed,selection).length,count ? 1:0);
}

// Legacy snapshots preserve their old interpretation and receipt shape.
feed = fixture(); delete feed.quoteObservationVersion;
assert.equal(inventory(feed).selections.length,0);
for (const market of feed.events[0].bookmakers.Bet365) market.updatedAt = observedAt;
assert.equal(inventory(feed).selections.length,6);
assert.ok(inventory(feed).selections.every(selection => selection.quotes.every(quote => !('quoteObservedAt' in quote))));

// Latest observation wins even when the old copy has a newer provider-change
// timestamp. Missing sides, suspended entries and unorderable current copies
// cannot fall back to an older still-current price.
for (const mode of ['missing-side','suspended','inactive','isActive-false','unavailable-state','missing-observation','future-observation']) {
  feed = fixture();
  for (const type of ['ml','spread','totals']) {
    const previous = feed.events[0].bookmakers.Bet365.find(item => item.marketKey === type);
    previous.updatedAt = generatedAt;
    const current = market(type,'2026-09-06T16:29:30Z');
    if (mode === 'missing-side') delete current.odds[0][type === 'totals' ? 'over':'away'];
    if (mode === 'suspended') current.suspended = true;
    if (mode === 'inactive') current.status = 'inactive';
    if (mode === 'isActive-false') current.isActive = false;
    if (mode === 'unavailable-state') current.state = 'unavailable';
    if (mode === 'missing-observation') delete current.observedAt;
    if (mode === 'future-observation') current.observedAt = '2026-09-06T16:31:00Z';
    feed.events[0].bookmakers.Bet365.push(current);
  }
  for (const type of ['ml','spread','totals']) assert.notEqual(quote(feed,type).state,'OK',mode + ' ' + type);
  if (mode !== 'missing-side') assert.equal(inventory(feed).selections.length,0,mode);
  assert.equal(exactBookQuotes(feed,selection).length,0,mode);
}

// A complete newer book response omitting markets is authoritative across
// core/deep collections. Older quotes cannot be resurrected by merge order.
feed = fixture();
const oldEvent = structuredClone(feed.events[0]);
oldEvent.bookmakerObservedAt = {Bet365:observedAt};
feed.events[0].bookmakers = {};
feed.events[0].bookmakerObservedAt = {Bet365:'2026-09-06T16:29:30Z'};
feed.deepMarkets = [oldEvent];
assert.equal(inventory(feed).selections.length,0);
assert.equal(exactBookQuotes(feed,selection).length,0);
for (const type of ['ml','spread','totals']) assert.equal(quote(feed,type).state,'MISSING');
// Reverse the collections: response recency still governs.
[feed.events[0],feed.deepMarkets[0]] = [feed.deepMarkets[0],feed.events[0]];
assert.equal(inventory(feed).selections.length,0);
// A book-specific omission does not erase the other book's verified quotes.
feed.events[0].bookmakers.DraftKings = ['ml','spread','totals'].map(name => market(name));
feed.events[0].bookmakerObservedAt.DraftKings = observedAt;
assert.equal(inventory(feed).selections.length,6);
assert.ok(inventory(feed).selections.every(selection => selection.quotes.every(quote => quote.book === 'DraftKings')));

// Coverage explanations must prove observed staleness, never infer it from an
// unchanged provider timestamp. Source metadata lets the renderer label clocks.
feed = fixture();
feed.diagnostics = {coreMarketAvailability:[{eventId:'fixture',markets:{totals:{available:false,
  books:{Bet365:'STALE_BEYOND_RETENTION',DraftKings:'NOT_RETURNED'},
  updatedAtByBook:{Bet365:updatedAt}, observedAtByBook:{Bet365:observedAt}
}}}]};
const audit = {availabilityLimitations:[{eventId:'fixture',sport:'MLB',marketDetail:'full_game_primary_total',selections:['over','under'],reason:'MARKET_NOT_RETURNED'}],
  totals:{gamesInScope:1,primaryRequired:6,primaryAvailable:0,primaryEvaluated:0,primaryBlocked:0,primaryUnavailable:6}};
assert.equal(explainUnavailableSelections(report,audit,feed).unavailableReasons[0].reason,'MARKET_NOT_RETURNED');
feed.diagnostics.coreMarketAvailability[0].markets.totals.observedAtByBook.Bet365 = updatedAt;
assert.equal(explainUnavailableSelections(report,audit,feed).unavailableReasons[0].reason,'STALE_BEYOND_RETENTION');
const summary = deriveReportCoverageSummary(report,{coverageAudit:audit,primaryAnalysis:{receipts:[]},provenance:{feedBlobSha:'test'}},feed);
assert.equal(summary.source.quoteObservationVersion,1);
assert.equal(summary.source.quoteFreshnessClock,'observedAt');
assert.equal(summary.source.quoteMaxAgeMinutes,30);
console.log('SERVER QUOTE OBSERVATION: PASS — current unchanged odds, strict observations, legacy receipts, latest unavailable authority, cross-collection omissions, clock diagnostics');
