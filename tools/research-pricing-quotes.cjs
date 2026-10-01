// Offline quote reconstruction. Writes research output only.
const fs = require('node:fs');
const cp = require('node:child_process');
const Q = require('../assets/quote-observation.js');
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ms = x => Number.isFinite(Date.parse(x)) ? Date.parse(x) : null;
const index = JSON.parse(fs.readFileSync('data/history/results-index.json', 'utf8'));
const groups = new Map(), rows = [], failures = [];
for (const card of index.cards) {
  if (card.analysisPrice?.state !== 'exact' || !card.analysisPrice.snapshotBlobSha || !card.selectionKey) continue;
  const sha = card.analysisPrice.snapshotBlobSha;
  if (!groups.has(sha)) groups.set(sha, []);
  groups.get(sha).push(card);
}
for (const [sha, cards] of groups) {
  let snapshot;
  try { snapshot = JSON.parse(cp.execFileSync('git', ['cat-file','blob',sha], {encoding:'utf8',maxBuffer:96*1024*1024})); }
  catch (e) { failures.push({sha, cards:cards.length, reason:'snapshot_blob_unavailable'}); continue; }
  const observed = Q.requiresObservation(snapshot);
  const events = new Map((observed ? Q.mergeObservedEvents(snapshot) : snapshot.events || []).map(e => [String(e.eventId || e.identity?.eventId || e.id),e]));
  for (const card of cards) {
    const event = events.get(card.eventId), prices = [];
    let reason = null;
    if (!event) reason = 'exact_event_missing';
    else if (ms(event.date || event.identity?.startTime) !== ms(card.commenceTime)) reason = 'kickoff_mismatch';
    else if (Q.isSuspended(event) || ms(snapshot.generatedAt) >= ms(card.commenceTime) || ms(snapshot.generatedAt) > ms(card.runId)) reason = 'not_pregame_snapshot';
    else for (const [book, markets] of Object.entries(event.bookmakers || {})) {
      if (!['bet365','draftkings'].includes(norm(book))) continue;
      let candidates = markets || [];
      if (observed) {
        const matches = candidates.filter(m => String(m.marketKey || m.identity?.marketKey).toLowerCase() === card.marketKey).sort((a,b) => Q.compareMarketRecency(a,b,snapshot));
        const latest = matches[0];
        const tied = latest && matches.filter(m => Q.compareMarketRecency(latest,m,snapshot) === 0);
        candidates = latest && new Set(tied.map(m => JSON.stringify(m))).size === 1 ? [latest] : [];
      }
      for (const market of candidates) {
        if (!Q.quoteIsFresh(market,snapshot,30)) continue;
        for (const row of market.odds || []) {
          if (Q.isSuspended(row)) continue;
          for (const [field,key] of Object.entries(row.selectionKeys || row.identity?.selectionKeys || {})) {
            const decimal = Number(row[field]);
            if (key === card.selectionKey && Number.isFinite(decimal) && decimal > 1) prices.push({book:norm(book),decimal,observedAt:Q.quoteTimestamp(market,snapshot),changedAt:market.updatedAt});
          }
        }
      }
    }
    // An ambiguous duplicate is not a usable quote.
    const clean = [];
    for (const book of ['bet365','draftkings']) {
      const quotes = prices.filter(p => p.book === book);
      if (quotes.length && new Set(quotes.map(p => p.decimal)).size === 1) clean.push(quotes[0]);
    }
    const issued = clean.find(p => p.book === norm(card.analysisPrice.book));
    rows.push({cardId:card.cardId,sha,snapshotAt:snapshot.generatedAt,reason,prices:clean,issuedPriceMatches:!!issued && Math.abs(issued.decimal-card.analysisPrice.decimal)<1e-9});
  }
}
fs.mkdirSync('research/pricing-patterns-20261001',{recursive:true});
fs.writeFileSync('research/pricing-patterns-20261001/quotes.json',JSON.stringify({rows,failures},null,2)+'\n');
console.log(JSON.stringify({snapshots:groups.size,rows:rows.length,matched:rows.filter(r=>r.issuedPriceMatches).length,paired:rows.filter(r=>r.prices.length===2).length,failures}));
