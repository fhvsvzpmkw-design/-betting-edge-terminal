// Presentation/accounting helpers. They never change issued decisions or settlements.
export function finiteValue(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

export function exactSettledUnits(card) {
  return card?.completionState === 'complete' && card?.analysisPrice?.state === 'exact'
    && finiteValue(card.analysisPrice.decimal) && Number(card.analysisPrice.decimal) > 1
    && finiteValue(card.units) ? Number(card.units) : null;
}

export function finalSelectionCards(cards) {
  const latest = new Map();
  for (const card of cards || []) {
    const key = card.selectionKey || `card:${card.cardId}`;
    const prior = latest.get(key);
    const time = Date.parse(card.runId || '') - Date.parse(prior?.runId || '');
    if (!prior || (Number.isFinite(time) ? time >= 0 : String(card.runId || '').localeCompare(String(prior.runId || '')) >= 0)) latest.set(key, card);
  }
  return [...latest.values()];
}

export function opposingMarketCoverage(cards) {
  const groups = new Map();
  for (const card of finalSelectionCards(cards)) {
    // Canonical keys store the same home handicap for both spread sides.
    // Keep the exact line, player and market; never collapse alternate lines.
    const parts = String(card.selectionKey || '').split('|');
    const [event, market, side, player, line] = parts;
    const recognized = parts.length === 5 && event && ['ml', 'moneyline', 'spread', 'totals'].includes(market)
      && (market === 'ml' || market === 'moneyline' || (line !== '' && finiteValue(line)))
      && (['totals'].includes(market) ? ['over', 'under'].includes(side) : ['home', 'away'].includes(side));
    const groupKey = recognized ? [event, market, player, line].join('|') : `selection:${card.selectionKey || card.cardId}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { groupKey, eventId: card.eventId || event || null, market: card.market, canonicalLine: recognized ? line || null : null, rows: [] });
    groups.get(groupKey).rows.push(card);
  }
  const rows = [...groups.values()].map(({ rows, ...group }) => {
    const sides = new Set(rows.map(row => String(row.selectionKey || '').split('|')[2]));
    const paired = !group.groupKey.startsWith('selection:') && rows.length === 2
      && ((sides.has('over') && sides.has('under')) || (sides.has('home') && sides.has('away') && !rows.some(row => row.sport === 'Soccer')));
    const priced = rows.filter(row => exactSettledUnits(row) !== null);
    return { ...group, selectionKeys: rows.map(row => row.selectionKey), statuses: rows.map(row => row.status),
      opposingSidesPresent: paired, selections: rows.length, priced: priced.length,
      netUnits: Number(priced.reduce((n, row) => n + exactSettledUnits(row), 0).toFixed(4)) };
  });
  return { groups: rows.length, pairedGroups: rows.filter(row => row.opposingSidesPresent).length,
    selectionsInPairedGroups: rows.filter(row => row.opposingSidesPresent).reduce((n, row) => n + row.selections, 0),
    unpairedSelections: rows.filter(row => !row.opposingSidesPresent).reduce((n, row) => n + row.selections, 0),
    note: 'Opposing sides remain in the audit and are grouped by exact market and line. They are dependent outcomes. Bookmaker margin can make their combined hypothetical return negative without demonstrating filter skill. Final prices may come from different books or times; no simultaneous hedge or margin-adjusted edge is claimed.',
    rows };
}
