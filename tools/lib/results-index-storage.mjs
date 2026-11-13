import fs from 'node:fs';

// Leave room below GitHub's 100 MiB blob limit. Source reports retain full research.
export const MAX_INDEX_BYTES = 95 * 1024 * 1024;
const FORECAST_FIELDS = ['recordId', 'sourceId', 'publisher', 'modelFamily', 'kind',
  'probability', 'probabilityBasis', 'marketDetail', 'period', 'side', 'line',
  'projection', 'eligibility', 'reasons', 'forecastAt', 'observedAt', 'timingBasis'];

export function forecastReviewSummary(review) {
  if (!review || typeof review !== 'object') return review || null;
  const {records, ...summary} = review;
  if (!Array.isArray(records)) return summary;
  return {...summary, records: records.map(record => Object.fromEntries(
    FORECAST_FIELDS.filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]])
  ))};
}

export function assertIndexSize(file, maxBytes = MAX_INDEX_BYTES) {
  const bytes = fs.statSync(file).size;
  if (bytes > maxBytes) throw new Error(`Results index is ${bytes} bytes; publication budget is ${maxBytes}. Split derived history before publishing.`);
  return bytes;
}

export function writeResultsIndex(file, index, maxBytes = MAX_INDEX_BYTES) {
  const serialized = JSON.stringify(index) + '\n';
  const bytes = Buffer.byteLength(serialized);
  if (bytes > maxBytes) throw new Error(`Results index is ${bytes} bytes; publication budget is ${maxBytes}. Split derived history before publishing.`);
  fs.writeFileSync(file, serialized, 'utf8');
  return bytes;
}
