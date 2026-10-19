// Process-local formatting and exact receipt lookups. No validation result is cached.
const dayFormatters = new Map();

export function localDateKey(timestamp, timeZone) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  let formatter = dayFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    dayFormatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return values.year && values.month && values.day ? `${values.year}-${values.month}-${values.day}` : null;
}

// Keep every signature for duplicate keys: the prior search accepted any exact
// EVALUATED decision match. JSON serialization intentionally retains its original
// property-order-sensitive equality, including all evidence and decision fields.
export function evaluatedDecisionLookup(receipts) {
  const signatures = new Map();
  for (const receipt of receipts) {
    if (receipt.state !== 'EVALUATED') continue;
    const key = receipt.decision?.feed?.selectionKey;
    if (!signatures.has(key)) signatures.set(key, new Set());
    signatures.get(key).add(JSON.stringify(receipt.decision));
  }
  return card => signatures.get(card?.feed?.selectionKey)?.has(JSON.stringify(card)) === true;
}
