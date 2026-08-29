import fs from 'node:fs';

const target = process.argv[2];
if (!target) {
  throw new Error('Usage: node tools/apply-crypto-watch-priority.mjs <worker.js>');
}

let source = fs.readFileSync(target, 'utf8');

function replaceOnce(marker, replacement, label) {
  const first = source.indexOf(marker);
  if (first < 0) throw new Error(`Crypto watch overlay marker missing: ${label}`);
  if (source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`Crypto watch overlay marker is not unique: ${label}`);
  }
  source = source.replace(marker, replacement);
}

replaceOnce(
  "const TMPFILE = path.join('data', 'live-odds.next.json');",
  `const TMPFILE = path.join('data', 'live-odds.next.json');\nconst CRYPTO_WATCHFILE = path.join('data', 'crypto-fight-watch.json');\nlet cryptoFightWatchlist = [];\nconst CRYPTO_WATCH_PRIORITY_BOOST = { MAIN: 1200, CO_MAIN: 1100, FEATURED: 1000 };`,
  'watchlist constants'
);

replaceOnce(
  'function canonicalMarketKey(value) {',
  `function loadCryptoFightWatchlist(now) {\n  try {\n    if (!fs.existsSync(CRYPTO_WATCHFILE)) return [];\n    const parsed = JSON.parse(fs.readFileSync(CRYPTO_WATCHFILE, 'utf8'));\n    const rows = Array.isArray(parsed?.fights) ? parsed.fights : [];\n    return rows.filter(row => {\n      if (!row || row.active === false) return false;\n      const start = Date.parse(row.eventStartPt || '');\n      if (!Number.isFinite(start)) return false;\n      const hours = (start - now.getTime()) / 3600000;\n      return hours >= -12 && hours <= HORIZON_HOURS;\n    });\n  } catch (error) {\n    console.warn('CRYPTO WATCHLIST WARNING:', String(error?.message || error));\n    return [];\n  }\n}\n\nfunction cryptoWatchSideTokens(row, side) {\n  const primary = side === 'A' ? row?.fighterA : row?.fighterB;\n  const aliases = side === 'A' ? row?.fighterAAliases : row?.fighterBAliases;\n  return [primary, ...(Array.isArray(aliases) ? aliases : [])]\n    .map(canonicalToken)\n    .filter(Boolean);\n}\n\nfunction cryptoWatchMatch(event) {\n  const home = canonicalToken(event?.home || '');\n  const away = canonicalToken(event?.away || '');\n  if (!home || !away) return null;\n\n  for (const row of cryptoFightWatchlist) {\n    const a = cryptoWatchSideTokens(row, 'A');\n    const b = cryptoWatchSideTokens(row, 'B');\n    const direct = a.includes(home) && b.includes(away);\n    const reverse = a.includes(away) && b.includes(home);\n    if (direct || reverse) return row;\n  }\n  return null;\n}\n\nfunction cryptoWatchBoost(event) {\n  const match = cryptoWatchMatch(event);\n  if (!match) return 0;\n  return CRYPTO_WATCH_PRIORITY_BOOST[String(match.priority || '').toUpperCase()] || 900;\n}\n\nfunction canonicalMarketKey(value) {`,
  'watchlist matching functions'
);

replaceOnce(
  "if (sport === 'american-football') score += 15;\n\n    return score;",
  "if (sport === 'american-football') score += 15;\n\n    // Crypto Specials fight-week targets receive a dominant ranking boost only\n    // after they enter the shared 30-hour horizon. Exact fighter-pair identity is\n    // required; unrelated boxing/MMA events never inherit this priority.\n    score += cryptoWatchBoost(event);\n\n    return score;",
  'core priority boost'
);

replaceOnce(
  "const now = new Date();\n    const to = new Date(now.getTime() + HORIZON_HOURS * 3600000);",
  "const now = new Date();\n    cryptoFightWatchlist = loadCryptoFightWatchlist(now);\n    console.log(`Crypto watchlist active in 30-hour window: ${cryptoFightWatchlist.length}.`);\n    const to = new Date(now.getTime() + HORIZON_HOURS * 3600000);",
  'watchlist load'
);

replaceOnce(
  "eventCandidatesTotal: 0,\n\n        coreCandidatesSelected: 0,",
  "eventCandidatesTotal: 0,\n        cryptoWatchActive: cryptoFightWatchlist.length,\n        cryptoWatchMatched: 0,\n        cryptoWatchUnmatched: [],\n\n        coreCandidatesSelected: 0,",
  'watchlist diagnostics fields'
);

replaceOnce(
  "snapshot.diagnostics.eventCandidatesTotal = candidates.length;\n\n    // PASS 2: rank and balance BEFORE spending live-odds requests.",
  "snapshot.diagnostics.eventCandidatesTotal = candidates.length;\n\n    const matchedCryptoWatchIds = new Set();\n    for (const event of candidates) {\n      const watch = cryptoWatchMatch(event);\n      if (watch?.id) matchedCryptoWatchIds.add(String(watch.id));\n    }\n    snapshot.diagnostics.cryptoWatchMatched = matchedCryptoWatchIds.size;\n    snapshot.diagnostics.cryptoWatchUnmatched = cryptoFightWatchlist\n      .filter(row => !matchedCryptoWatchIds.has(String(row.id || '')))\n      .map(row => ({\n        id: row.id || null,\n        priority: row.priority || null,\n        fighterA: row.fighterA || null,\n        fighterB: row.fighterB || null,\n        reason: 'EXACT EVENT NOT FOUND IN 30-HOUR DISCOVERY; NO SUBSTITUTE USED'\n      }));\n\n    // PASS 2: rank and balance BEFORE spending live-odds requests.",
  'watchlist match diagnostics'
);

replaceOnce(
  "if (hours < 0 || hours > PROP_HORIZON_HOURS) {\n          snapshot.diagnostics.deepEventsSkippedHorizon++;\n          return false;\n        }\n\n        return propEligible(event);",
  "const watched = Boolean(cryptoWatchMatch(event));\n        const deepHorizon = watched ? HORIZON_HOURS : PROP_HORIZON_HOURS;\n\n        if (hours < 0 || hours > deepHorizon) {\n          snapshot.diagnostics.deepEventsSkippedHorizon++;\n          return false;\n        }\n\n        return watched || propEligible(event);",
  'watched deep-market horizon'
);

replaceOnce(
  "strategy:\n        'broad discovery; separate sequential Bet365/DraftKings core pulls; merged by exact event identity; deep markets by league/start-time priority'",
  "strategy:\n        'broad discovery; Crypto fight-watch exact-pair priority inside 30 hours; separate sequential Bet365/DraftKings core pulls; merged by exact event identity; watched combat deep markets may enter at 30 hours while ordinary deep markets remain 8 hours'",
  'request policy description'
);

fs.writeFileSync(target, source, 'utf8');
console.log('Applied Crypto Specials fight-watch priority overlay.');
