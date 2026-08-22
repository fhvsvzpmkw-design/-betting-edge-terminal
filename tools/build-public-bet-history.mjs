import fs from 'node:fs';

const RAW_PATH = 'data/betting-ledger.json';
const PUBLIC_PATH = 'data/bet-history-public.json';
const INDEX_PATH = 'index.html';

const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
if (!raw || !Array.isArray(raw.wagers) || !raw.validation) {
  throw new Error('Invalid raw betting ledger schema');
}

const wagers = raw.wagers.map((r, index) => [
  index + 1,          // public-only numeric row id; not the sportsbook/source id
  r[1] || '',         // book
  null,               // sportsbook bet/reference id deliberately removed
  r[3] || null,       // placed
  r[4] || null,       // settled
  r[5] || '',         // sport
  r[6] || '',         // league
  r[7] || '',         // description
  r[8] ?? 0,          // odds
  r[9] ?? 0,          // risk
  r[10] || '',        // result
  r[11] ?? 0,         // P/L
  r[12] || 'UNKNOWN', // timing
  r[13] ?? null,      // CLV
  Boolean(r[14]),     // boosted
  Array.isArray(r[15]) ? r[15] : [], // events
  Array.isArray(r[16]) ? r[16] : [], // legs
  r[17] || ''         // public tags
]);

const publicLedger = {
  schema: 2,
  publicProjection: true,
  generatedAt: raw.generatedAt || new Date().toISOString(),
  timezone: raw.timezone || 'America/Vancouver',
  bankrollCad: Number(raw.bankrollCad || 0),
  validation: {
    uniqueWagers: wagers.length,
    pagesAt10Rows: Math.ceil(wagers.length / 10),
    status: raw.validation.status === 'PASS' ? 'PASS' : 'CHECK'
  },
  summary: raw.summary || {},
  wagers
};

fs.writeFileSync(PUBLIC_PATH, JSON.stringify(publicLedger, null, 2) + '\n');

let html = fs.readFileSync(INDEX_PATH, 'utf8');
const replacements = [
  ["./data/betting-ledger.json", "./data/bet-history-public.json"],
  ["Loading betting-ledger.json", "Loading bet-history-public.json"],
  ["FULL LEDGER // MASTER DATABASE", "WAGERS // PERFORMANCE LEDGER"],
  ["wager, event, team, player, ID…", "wager, event, team, player…"],
  ["+' // BET ID '+x.id", ""],
  ["`Book: ${x.book} // Book bet ID: ${x.bookid}`", "`Book: ${x.book}`"],
  ["+' // '+Number(v.sourceRows||0).toLocaleString()+' SOURCE ROWS // '+Number(v.duplicateLegRowsCollapsed||0).toLocaleString()+' DUPLICATE LEG ROWS COLLAPSED'", "+' // PUBLIC F3 DATASET'"],
  ["Read-only checks from the published ledger, odds snapshot and run archive.", "Read-only checks from the public F3 dataset, odds snapshot and run archive."],
  ["External ledger count and page validation", "Public F3 count and page validation"]
];

for (const [from, to] of replacements) {
  if (html.includes(from)) html = html.split(from).join(to);
}

fs.writeFileSync(INDEX_PATH, html);

const leakedBookIds = wagers.some(r => r[2] !== null);
const sourceMetadataPresent = Object.prototype.hasOwnProperty.call(publicLedger.validation, 'sourceFile') ||
  Object.prototype.hasOwnProperty.call(publicLedger.validation, 'sourceRows') ||
  Object.prototype.hasOwnProperty.call(publicLedger.validation, 'duplicateLegRowsCollapsed');
if (leakedBookIds || sourceMetadataPresent) throw new Error('Public projection leak check failed');

console.log(`Public F3 projection built: ${wagers.length} wagers, ${publicLedger.validation.pagesAt10Rows} pages.`);
