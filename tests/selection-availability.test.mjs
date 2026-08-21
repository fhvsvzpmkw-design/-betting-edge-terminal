#!/usr/bin/env node
import assert from 'node:assert/strict';
import { auditTrackedAvailability, exactBookQuotes } from '../tools/selection-availability.mjs';

const selectionKey = '63301097|player-props|over|ernie-clement-runs-scored|0.5';
const prior = {
  slot: 'main', ts: '2026-08-21T08:05:29-07:00', recs: [{
    status: 'WAIT', title: 'Ernie Clement over 0.5 runs scored',
    feed: { eventId: '63301097', marketKey: 'player-props', market: 'Player Props', side: 'over', selectionKey, eventDate: '2026-08-21T23:05:00Z', label: 'Ernie Clement (Runs Scored)', hdp: 0.5 }
  }]
};
const feed = {
  generatedAt: '2026-08-21T16:24:45.308Z',
  baseballProps: [{
    id: '63301097', bookmakers: {
      Bet365: [{ name: 'Player Props', marketKey: 'player-props', updatedAt: '2026-08-21T16:13:46.599Z', odds: [{
        label: 'Ernie Clement (Runs Scored)', hdp: 0.5, over: '3.65', under: '1.27',
        selectionKeys: { over: selectionKey, under: '63301097|player-props|under|ernie-clement-runs-scored|0.5' }
      }]}],
      DraftKings: [{ name: 'Player Props', marketKey: 'player-props', updatedAt: '2026-08-21T16:16:05.258Z', odds: [{
        label: 'George Lombard Jr. (Runs Scored)', hdp: 0.5, over: '4.20', under: '1.20',
        selectionKeys: { over: '63301097|player-props|over|george-lombard-jr-runs-scored|0.5', under: '63301097|player-props|under|george-lombard-jr-runs-scored|0.5' }
      }]}]
    }
  }]
};
const baseReport = {
  slot: 'final_morning', ts: '2026-08-21T09:36:18-07:00', feedGeneratedAt: feed.generatedAt,
  recs: [{ status: 'WAIT', title: 'Ernie Clement over 0.5 runs scored', book: 'Bet365', price: '+265 B365 (09:13 PT)', stake: '$0', feed: prior.recs[0].feed }]
};

const quotes = exactBookQuotes(feed, prior.recs[0]);
assert.deepEqual(quotes.map(q => [q.book, q.american]), [['Bet365', '+265']]);

const correct = auditTrackedAvailability({ previous: prior, report: baseReport, feed });
assert.equal(correct.ok, true, correct.violations.join('; '));

const falseUnavailable = structuredClone(baseReport);
falseUnavailable.recs[0].price = 'MARKET UNAVAILABLE';
const missingFresh = auditTrackedAvailability({ previous: prior, report: falseUnavailable, feed });
assert.equal(missingFresh.ok, false);
assert.match(missingFresh.violations.join(' '), /Bet365 \+265 exists/i);

const ghostDraftKings = structuredClone(baseReport);
ghostDraftKings.recs[0].price = '+265 B365 (09:13 PT); +196 DK (09:16 PT)';
const staleBook = auditTrackedAvailability({ previous: prior, report: ghostDraftKings, feed });
assert.equal(staleBook.ok, false);
assert.match(staleBook.violations.join(' '), /no fresh exact DraftKings quote/i);

const mlPrior = {
  recs: [{
    status: 'WAIT', title: 'Toronto Blue Jays moneyline',
    feed: { eventId: 'ml-event', marketKey: 'ml', market: 'ML', side: 'away', selectionKey: 'ml-event|ml|away||', eventDate: '2026-08-21T23:05:00Z' }
  }]
};
const mlFeed = {
  generatedAt: '2026-08-21T16:24:45.308Z', events: [{ id: 'ml-event', bookmakers: {
    Bet365: [{ name: 'ML', marketKey: 'ml', updatedAt: '2026-08-21T16:20:00.000Z', odds: [{ home: '1.49', away: '3.05', selectionKeys: { home: 'ml-event|ml|home||', away: 'ml-event|ml|away||' } }] }],
    DraftKings: [{ name: 'ML', marketKey: 'ml', updatedAt: '2026-08-21T16:18:00.000Z', odds: [{ home: '1.55', away: '2.79', selectionKeys: { home: 'ml-event|ml|home||', away: 'ml-event|ml|away||' } }] }]
  }}]
};
const mlReport = {
  ts: '2026-08-21T09:36:18-07:00', recs: [{ status: 'WAIT', title: 'Toronto Blue Jays moneyline', price: '+205 B365; +179 DK', stake: '$0', feed: mlPrior.recs[0].feed }]
};
const mlAudit = auditTrackedAvailability({ previous: mlPrior, report: mlReport, feed: mlFeed });
assert.equal(mlAudit.ok, true, mlAudit.violations.join('; '));

console.log('SELECTION AVAILABILITY TEST OK');
