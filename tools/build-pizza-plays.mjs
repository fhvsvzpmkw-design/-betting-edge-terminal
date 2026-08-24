import fs from 'node:fs';

const SOURCE_PATH = 'data/live-odds.json';
const OUTPUT_PATH = 'data/pizza-plays.json';
const STAKE_UNITS = 0.25;
const MIN_BOOKS = 2;
const MIN_LEG_EV = 0.01;
const MIN_DECIMAL = 1.25;
const MAX_DECIMAL = 2.50;
const MIN_START_LEAD_MINUTES = 15;
const ELIGIBLE_MARKET_NAMES = new Set(['ML', 'Spread']);

function n(value) {
  const x = Number(value);
  return Number.isFinite(x) ? x : null;
}

function round(value, digits = 3) {
  if (!Number.isFinite(value)) return null;
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

function decimalToAmerican(decimal) {
  const d = n(decimal);
  if (!d || d <= 1) return null;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}

function implied(decimal) {
  const d = n(decimal);
  return d && d > 1 ? 1 / d : null;
}

function noVigProbabilities(row, includeDraw = false) {
  const labels = includeDraw ? ['home', 'draw', 'away'] : ['home', 'away'];
  const raw = {};
  let sum = 0;
  for (const label of labels) {
    const p = implied(row?.[label]);
    if (!p) return null;
    raw[label] = p;
    sum += p;
  }
  if (!(sum > 0)) return null;
  return Object.fromEntries(labels.map(label => [label, raw[label] / sum]));
}

function displayMarket(event, market, selection, row) {
  if (market.name === 'ML') return 'Moneyline';
  const sport = String(event?.sport?.slug || '').toLowerCase();
  if (sport === 'baseball') return 'Run Line';
  if (sport === 'ice-hockey') return 'Puck Line';
  return 'Spread';
}

function displayLine(market, selection, row) {
  if (market.name !== 'Spread') return null;
  const hdp = n(row?.hdp);
  if (hdp === null) return null;
  return selection === 'away' ? -hdp : hdp;
}

function selectionName(event, selection) {
  if (selection === 'home') return event.home;
  if (selection === 'away') return event.away;
  if (selection === 'draw') return 'Draw';
  return selection;
}

function marketRows(event, bookName) {
  const markets = event?.bookmakers?.[bookName];
  if (!Array.isArray(markets)) return [];
  const out = [];
  for (const market of markets) {
    if (!ELIGIBLE_MARKET_NAMES.has(market?.name)) continue;
    if (!Array.isArray(market.odds)) continue;
    for (const row of market.odds) {
      if (!row || typeof row !== 'object') continue;
      const hdp = market.name === 'Spread' ? n(row.hdp) : null;
      if (market.name === 'Spread' && hdp === null) continue;
      out.push({ market, row, hdp });
    }
  }
  return out;
}

function rowKey(marketName, hdp) {
  return marketName === 'ML' ? 'ML' : `Spread|${hdp}`;
}

function extractCandidates(source) {
  const books = Array.isArray(source.bookmakers) ? source.bookmakers : [];
  const sourceTime = Date.parse(source.generatedAt || '');
  if (!Number.isFinite(sourceTime)) throw new Error('live-odds.json is missing a valid generatedAt');
  if (books.length < MIN_BOOKS) throw new Error(`Pizza requires at least ${MIN_BOOKS} books`);

  const candidates = [];
  for (const event of source.events || []) {
    if (String(event?.status || '').toLowerCase() !== 'pending') continue;
    const start = Date.parse(event?.date || '');
    if (!Number.isFinite(start) || start - sourceTime < MIN_START_LEAD_MINUTES * 60_000) continue;

    const byBook = new Map();
    for (const book of books) {
      const rows = new Map();
      for (const item of marketRows(event, book)) rows.set(rowKey(item.market.name, item.hdp), item);
      byBook.set(book, rows);
    }

    const allKeys = new Set();
    for (const rows of byBook.values()) for (const key of rows.keys()) allKeys.add(key);

    for (const key of allKeys) {
      const matched = [];
      for (const book of books) {
        const item = byBook.get(book)?.get(key);
        if (item) matched.push({ book, ...item });
      }
      if (matched.length < MIN_BOOKS) continue;

      const first = matched[0];
      const selections = first.market.name === 'ML' ? ['home', 'away'] : ['home', 'away'];
      const includeDrawForFair = first.market.name === 'ML' && matched.some(x => n(x.row.draw));

      for (const selection of selections) {
        const offers = [];
        const fairSamples = [];
        let valid = true;
        for (const item of matched) {
          const price = n(item.row?.[selection]);
          if (!price || price <= 1) { valid = false; break; }
          const fair = noVigProbabilities(item.row, includeDrawForFair);
          if (!fair || !Number.isFinite(fair[selection])) { valid = false; break; }
          offers.push({ book: item.book, decimal: price, updatedAt: item.market.updatedAt || null });
          fairSamples.push(fair[selection]);
        }
        if (!valid || offers.length < MIN_BOOKS) continue;

        const best = offers.reduce((a, b) => b.decimal > a.decimal ? b : a);
        if (best.decimal < MIN_DECIMAL || best.decimal > MAX_DECIMAL) continue;
        const fairProbability = fairSamples.reduce((a, b) => a + b, 0) / fairSamples.length;
        const ev = fairProbability * best.decimal - 1;
        if (!(ev >= MIN_LEG_EV)) continue;

        const line = displayLine(first.market, selection, first.row);
        candidates.push({
          eventId: String(event.eventId ?? event.id),
          eventKey: event.eventKey || null,
          event: `${event.away} @ ${event.home}`,
          startTime: event.date,
          sport: event?.sport?.name || event?.sport?.slug || 'Unknown',
          sportKey: event?.sport?.slug || null,
          league: event?.league?.name || null,
          market: displayMarket(event, first.market, selection, first.row),
          marketKey: first.market?.marketKey || first.market?.identity?.marketKey || first.market.name.toLowerCase(),
          selection: selectionName(event, selection),
          side: selection,
          line,
          bestBook: best.book,
          decimal: round(best.decimal, 3),
          american: decimalToAmerican(best.decimal),
          fairProbability: round(fairProbability, 5),
          fairDecimal: round(1 / fairProbability, 3),
          fairAmerican: decimalToAmerican(1 / fairProbability),
          evPct: round(ev * 100, 2),
          books: offers.map(o => ({
            book: o.book,
            decimal: round(o.decimal, 3),
            american: decimalToAmerican(o.decimal),
            updatedAt: o.updatedAt
          }))
        });
      }
    }
  }

  candidates.sort((a, b) => b.evPct - a.evPct || b.fairProbability - a.fairProbability);
  return candidates;
}

function combinations(items, size) {
  const out = [];
  function walk(start, chosen) {
    if (chosen.length === size) { out.push([...chosen]); return; }
    for (let i = start; i <= items.length - (size - chosen.length); i++) {
      chosen.push(items[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  }
  walk(0, []);
  return out;
}

function buildParlay(label, candidates, size) {
  const pool = candidates.slice(0, 24);
  let best = null;
  for (const legs of combinations(pool, size)) {
    const eventIds = new Set(legs.map(x => x.eventId));
    if (eventIds.size !== size) continue;

    const offeredDecimal = legs.reduce((p, x) => p * x.decimal, 1);
    const fairProbability = legs.reduce((p, x) => p * x.fairProbability, 1);
    const fairDecimal = 1 / fairProbability;
    const ev = fairProbability * offeredDecimal - 1;
    const uniqueSports = new Set(legs.map(x => x.sportKey || x.sport)).size;
    const minLegEv = Math.min(...legs.map(x => x.evPct));
    const score = ev + uniqueSports * 0.002 + minLegEv * 0.0001;

    if (!best || score > best.score) best = { legs, offeredDecimal, fairProbability, fairDecimal, ev, score };
  }

  if (!best) {
    return {
      status: 'NO_PLAY',
      label,
      reason: `Fewer than ${size} independent qualifying legs survived the Pizza value gates.`
    };
  }

  return {
    status: 'PLAY',
    label,
    legs: best.legs,
    combined: {
      priceType: 'ESTIMATED',
      decimal: round(best.offeredDecimal, 3),
      american: decimalToAmerican(best.offeredDecimal),
      fairProbability: round(best.fairProbability, 5),
      fairDecimal: round(best.fairDecimal, 3),
      fairAmerican: decimalToAmerican(best.fairDecimal),
      evPct: round(best.ev * 100, 2)
    },
    stakeUnits: STAKE_UNITS,
    potentialProfitUnits: round(STAKE_UNITS * (best.offeredDecimal - 1), 3),
    expectedValueUnits: round(STAKE_UNITS * best.ev, 3)
  };
}

function build(source) {
  const candidates = extractCandidates(source);
  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    mode: 'MANUAL',
    status: 'READY',
    source: {
      file: SOURCE_PATH,
      generatedAt: source.generatedAt || null,
      generatedAtVancouver: source.generatedAtVancouver || null,
      provider: source.source || null,
      eventCount: Array.isArray(source.events) ? source.events.length : null,
      bookmakers: source.bookmakers || []
    },
    methodology: {
      engine: 'PIZZA MARKET VALUE PASS v1',
      eligibleMarkets: ['Moneyline', 'Spread', 'Run Line', 'Puck Line'],
      minBooks: MIN_BOOKS,
      minLegEvPct: MIN_LEG_EV * 100,
      legDecimalRange: [MIN_DECIMAL, MAX_DECIMAL],
      minStartLeadMinutes: MIN_START_LEAD_MINUTES,
      stakeUnits: STAKE_UNITS,
      combinedPriceType: 'ESTIMATED',
      notes: [
        'Reads the latest committed Betting Edge odds snapshot only; it makes no Odds API requests.',
        'Each leg must show positive no-vig value across both tracked books.',
        'Same-event combinations are excluded.',
        'Combined parlay prices are mathematical estimates from independent leg prices, not sportsbook parlay quotes.'
      ]
    },
    candidateCount: candidates.length,
    twoTopping: buildParlay('TWO-TOPPING', candidates, 2),
    threeTopping: buildParlay('THREE-TOPPING', candidates, 3)
  };
}

function selfTest() {
  const fixture = {
    generatedAt: '2026-08-24T16:00:00Z',
    generatedAtVancouver: '2026-08-24 09:00:00 America/Vancouver',
    source: 'TEST',
    bookmakers: ['Bet365', 'DraftKings'],
    events: [1, 2, 3].map((id, idx) => ({
      id,
      eventId: String(id),
      eventKey: `test:${id}`,
      home: `Home ${id}`,
      away: `Away ${id}`,
      date: `2026-08-24T${18 + idx}:00:00Z`,
      status: 'pending',
      sport: { name: idx === 0 ? 'Baseball' : idx === 1 ? 'Football' : 'Ice Hockey', slug: idx === 0 ? 'baseball' : idx === 1 ? 'football' : 'ice-hockey' },
      league: { name: 'Test League' },
      bookmakers: {
        Bet365: [{ name: 'ML', marketKey: 'ml', updatedAt: '2026-08-24T15:59:00Z', odds: [{ home: '1.80', away: '2.10' }] }],
        DraftKings: [{ name: 'ML', marketKey: 'ml', updatedAt: '2026-08-24T15:59:00Z', odds: [{ home: '1.95', away: '1.95' }] }]
      }
    }))
  };
  const out = build(fixture);
  if (out.twoTopping.status !== 'PLAY') throw new Error('self-test failed: two-topping not built');
  if (out.threeTopping.status !== 'PLAY') throw new Error('self-test failed: three-topping not built');
  if (out.twoTopping.combined.priceType !== 'ESTIMATED') throw new Error('self-test failed: price label');
  console.log('Pizza self-test OK');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const output = build(source);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  console.log(`Pizza Plays built from ${source.generatedAt}: ${output.twoTopping.status} / ${output.threeTopping.status}`);
}
