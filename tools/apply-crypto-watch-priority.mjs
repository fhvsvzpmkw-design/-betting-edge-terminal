import fs from 'node:fs';

const target = process.argv[2];
if (!target) {
  throw new Error('Usage: node tools/apply-crypto-watch-priority.mjs <worker.js>');
}

let source = fs.readFileSync(target, 'utf8');

function replaceStringOnce(marker, replacement, label) {
  const first = source.indexOf(marker);
  if (first < 0) throw new Error(`Crypto watch overlay marker missing: ${label}`);
  if (source.indexOf(marker, first + marker.length) >= 0) {
    throw new Error(`Crypto watch overlay marker is not unique: ${label}`);
  }
  source = source.replace(marker, replacement);
}

function replaceRegexOnce(regex, replacement, label) {
  const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
  const global = new RegExp(regex.source, flags);
  const matches = [...source.matchAll(global)];
  if (matches.length !== 1) {
    throw new Error(`Crypto watch overlay regex count ${matches.length}: ${label}`);
  }
  source = source.replace(regex, replacement);
}

replaceStringOnce(
  "const TMPFILE = path.join('data', 'live-odds.next.json');",
  `const TMPFILE = path.join('data', 'live-odds.next.json');\nconst CRYPTO_WATCHFILE = path.join('data', 'crypto-fight-watch.json');\nlet cryptoFightWatchlist = [];\nconst CRYPTO_WATCH_PRIORITY_BOOST = { MAIN: 1200, CO_MAIN: 1100, FEATURED: 1000 };`,
  'watchlist constants'
);

replaceStringOnce(
  'function canonicalMarketKey(value) {',
  `function loadCryptoFightWatchlist(now) {\n  try {\n    if (!fs.existsSync(CRYPTO_WATCHFILE)) return [];\n    const parsed = JSON.parse(fs.readFileSync(CRYPTO_WATCHFILE, 'utf8'));\n    const rows = Array.isArray(parsed?.fights) ? parsed.fights : [];\n    return rows.filter(row => {\n      if (!row || row.active === false) return false;\n      const start = Date.parse(row.eventStartPt || '');\n      if (!Number.isFinite(start)) return false;\n      const hours = (start - now.getTime()) / 3600000;\n      return hours >= -12 && hours <= HORIZON_HOURS;\n    });\n  } catch (error) {\n    console.warn('CRYPTO WATCHLIST WARNING:', String(error?.message || error));\n    return [];\n  }\n}\n\nfunction cryptoWatchSideTokens(row, side) {\n  const primary = side === 'A' ? row?.fighterA : row?.fighterB;\n  const aliases = side === 'A' ? row?.fighterAAliases : row?.fighterBAliases;\n  return [primary, ...(Array.isArray(aliases) ? aliases : [])]\n    .map(canonicalToken)\n    .filter(Boolean);\n}\n\nfunction cryptoWatchMatch(event) {\n  const home = canonicalToken(event?.home || '');\n  const away = canonicalToken(event?.away || '');\n  if (!home || !away) return null;\n\n  for (const row of cryptoFightWatchlist) {\n    const a = cryptoWatchSideTokens(row, 'A');\n    const b = cryptoWatchSideTokens(row, 'B');\n    const direct = a.includes(home) && b.includes(away);\n    const reverse = a.includes(away) && b.includes(home);\n    if (direct || reverse) return row;\n  }\n  return null;\n}\n\nfunction cryptoWatchBoost(event) {\n  const match = cryptoWatchMatch(event);\n  if (!match) return 0;\n  return CRYPTO_WATCH_PRIORITY_BOOST[String(match.priority || '').toUpperCase()] || 900;\n}\n\nfunction canonicalMarketKey(value) {`,
  'watchlist matching functions'
);

replaceRegexOnce(
  /([ \t]*)if \(Number\(event\.bookmakerCount\) > 0\) score \+= 100;/,
  (match, indent) => `${match}\n${indent}score += cryptoWatchBoost(event);`,
  'core priority boost'
);

replaceRegexOnce(
  /([ \t]*)const now = new Date\(\);\n([ \t]*)const to = new Date\(now\.getTime\(\) \+ HORIZON_HOURS \* 3600000\);/,
  (match, nowIndent, toIndent) =>
    `${nowIndent}const now = new Date();\n` +
    `${toIndent}cryptoFightWatchlist = loadCryptoFightWatchlist(now);\n` +
    `${toIndent}console.log(\`Crypto watchlist active in 30-hour window: \${cryptoFightWatchlist.length}.\`);\n` +
    `${toIndent}const to = new Date(now.getTime() + HORIZON_HOURS * 3600000);`,
  'watchlist load'
);

replaceRegexOnce(
  /([ \t]*)eventCandidatesTotal: 0,\n(?:[ \t]*\n)?([ \t]*)coreCandidatesSelected: 0,/,
  (match, eventIndent, coreIndent) =>
    `${eventIndent}eventCandidatesTotal: 0,\n` +
    `${coreIndent}cryptoWatchActive: cryptoFightWatchlist.length,\n` +
    `${coreIndent}cryptoWatchMatched: 0,\n` +
    `${coreIndent}cryptoWatchUnmatched: [],\n\n` +
    `${coreIndent}coreCandidatesSelected: 0,`,
  'watchlist diagnostics fields'
);

replaceRegexOnce(
  /([ \t]*)snapshot\.diagnostics\.eventCandidatesTotal = candidates\.length;\n\n([ \t]*)\/\/ PASS 2: rank and balance BEFORE spending live-odds requests\./,
  (match, statementIndent, commentIndent) =>
    `${statementIndent}snapshot.diagnostics.eventCandidatesTotal = candidates.length;\n\n` +
    `${statementIndent}const matchedCryptoWatchIds = new Set();\n` +
    `${statementIndent}for (const event of candidates) {\n` +
    `${statementIndent}  const watch = cryptoWatchMatch(event);\n` +
    `${statementIndent}  if (watch?.id) matchedCryptoWatchIds.add(String(watch.id));\n` +
    `${statementIndent}}\n` +
    `${statementIndent}snapshot.diagnostics.cryptoWatchMatched = matchedCryptoWatchIds.size;\n` +
    `${statementIndent}snapshot.diagnostics.cryptoWatchUnmatched = cryptoFightWatchlist\n` +
    `${statementIndent}  .filter(row => !matchedCryptoWatchIds.has(String(row.id || '')))\n` +
    `${statementIndent}  .map(row => ({\n` +
    `${statementIndent}    id: row.id || null,\n` +
    `${statementIndent}    priority: row.priority || null,\n` +
    `${statementIndent}    fighterA: row.fighterA || null,\n` +
    `${statementIndent}    fighterB: row.fighterB || null,\n` +
    `${statementIndent}    reason: 'EXACT EVENT NOT FOUND IN 30-HOUR DISCOVERY; NO SUBSTITUTE USED'\n` +
    `${statementIndent}  }));\n\n` +
    `${commentIndent}// PASS 2: rank and balance BEFORE spending live-odds requests.`,
  'watchlist match diagnostics'
);

replaceRegexOnce(
  /([ \t]*)strategy:\n([ \t]*)'primary major sports before ancillary games; college soccer excluded; sequential Bet365\/DraftKings primary game markets only; disabled player props not requested'/,
  (match, strategyIndent, valueIndent) =>
    `${strategyIndent}strategy:\n` +
    `${valueIndent}'primary major sports before ancillary games; college soccer excluded; Crypto exact-pair watch priority inside 30 hours; sequential Bet365/DraftKings primary game markets only; disabled player props not requested; watched combat deep markets enabled'`,
  'request policy description'
);

fs.writeFileSync(target, source, 'utf8');
console.log('Applied Crypto Specials fight-watch priority overlay.');
