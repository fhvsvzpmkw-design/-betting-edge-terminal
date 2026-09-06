/* Shared quote clock for collector-observed Odds-API.io snapshots.
 * updatedAt remains the provider's market-change timestamp.
 * Unmarked historical snapshots retain their original timestamp interpretation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BettingEdgeQuoteObservation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
  const timeMs = value => typeof value === 'string' && value.trim() && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  const requiresObservation = feed => own(feed, 'quoteObservationVersion');
  const rawMarket = market => market && market.marketObj || market || {};
  function quoteTimestamp(market, feed) {
    const raw = rawMarket(market);
    if (requiresObservation(feed)) return feed.quoteObservationVersion === 1 ? raw.observedAt : undefined;
    // String-only legacy APIs can still carry an explicit new observation.
    if (typeof feed === 'string' && own(raw, 'observedAt')) return raw.observedAt;
    return raw.updatedAt;
  }
  const quoteTimeMs = (market, feed) => timeMs(quoteTimestamp(market, feed));
  function quoteAgeMinutes(market, feed) {
    const reference = timeMs(typeof feed === 'string' ? feed : feed && feed.generatedAt);
    const observed = quoteTimeMs(market, feed);
    if (reference === null || observed === null || observed > reference) return Infinity;
    return (reference - observed) / 60000;
  }
  function isSuspended(market) {
    const raw = rawMarket(market);
    return raw.suspended === true || raw.isSuspended === true || raw.active === false || raw.isActive === false ||
      /^(suspended|closed|settled|inactive|canceled|cancelled|unavailable|disabled)$/i.test(String(raw.status || raw.state || ''));
  }
  const quoteIsFresh = (market, feed, maximum = 30) => !isSuspended(market) && quoteAgeMinutes(market, feed) <= maximum;
  // Array.sort comparator: newest observations first. Invalid stamps come first
  // so consumers cannot silently fall back past an unorderable current copy.
  function compareMarketRecency(a, b, feed) {
    const first = quoteTimeMs(a, feed), second = quoteTimeMs(b, feed);
    if (first === null) return second === null ? 0 : -1;
    if (second === null) return 1;
    return second - first || Number(isSuspended(b)) - Number(isSuspended(a));
  }
  const eventId = event => String(event && (event.eventId || event.identity && event.identity.eventId || event.id) || '');
  function mergeObservedEvents(feed) {
    const sources = [feed && feed.events, feed && feed.deepMarkets, feed && feed.baseballProps]
      .flatMap(events => Array.isArray(events) ? events : []);
    const groups = new Map();
    for (const event of sources) {
      const id = eventId(event);
      if (!id) continue;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(event);
    }
    return [...groups.values()].map(events => {
      const output = Object.assign({}, ...events, {bookmakers: {}, bookmakerObservedAt: {}});
      const books = new Set(events.flatMap(event => [...Object.keys(event.bookmakers || {}), ...Object.keys(event.bookmakerObservedAt || {})]));
      for (const book of books) {
        const scopes = events.filter(event => own(event.bookmakerObservedAt, book)).map(event => event.bookmakerObservedAt[book]);
        const invalidScope = scopes.some(stamp => timeMs(stamp) === null || timeMs(stamp) > timeMs(feed.generatedAt));
        const scope = scopes.filter(stamp => timeMs(stamp) !== null).sort((a, b) => timeMs(b) - timeMs(a))[0];
        if (scope !== undefined) output.bookmakerObservedAt[book] = scope;
        let markets = events.flatMap(event => Array.isArray(event.bookmakers && event.bookmakers[book]) ? event.bookmakers[book] : []);
        if (invalidScope || feed.quoteObservationVersion !== 1) markets = [];
        else if (scope !== undefined) markets = markets.filter(market => {
          const observed = timeMs(market.observedAt);
          // Keep malformed candidates visible to fail-closed consumer checks.
          return observed === null || observed >= timeMs(scope);
        });
        output.bookmakers[book] = [...new Map(markets.map(market => [JSON.stringify(market), market])).values()];
      }
      return output;
    });
  }
  return Object.freeze({requiresObservation, quoteTimestamp, quoteTimeMs, quoteAgeMinutes,
    quoteIsFresh, compareMarketRecency, isSuspended, mergeObservedEvents});
});
