#!/usr/bin/env node
// Read-only projection. The canonical validators still own issuance eligibility.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {loadMainSchedule, scheduleMetadataForReport} from './main-schedule.mjs';
import {resolveCoreRelease} from './core-release.mjs';
import {derivePrimarySelectionInventory, mergedFeedEvents} from './major-sport-market-coverage-gate.mjs';
import {bindIntelligence,buildGameIntelligence,projectGameIntelligence} from './game-intelligence.mjs';

function readBound(root, relative, parse = true) {
  const bytes = fs.readFileSync(path.join(root, relative));
  const blobSha = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  return {binding: {path: relative, blobSha, bytes: bytes.length}, value: parse ? JSON.parse(bytes) : null};
}

export function buildReportInputs({root = process.cwd(), at, reportTime, eventId = null}) {
  if (!at || !Number.isFinite(Date.parse(at)) || !/(Z|[+-]\d{2}:\d{2})$/.test(at))
    throw new Error('--at requires the actual report timestamp with timezone');
  const schedule = loadMainSchedule(root);
  const lane = schedule.slots.find(slot => slot.reportTime === reportTime);
  if (!lane) throw new Error('--report-time must identify a current Main report lane');
  const feed = readBound(root, 'data/live-odds.json');
  const policy = readBound(root, 'data/major-sport-market-coverage-v1.json');
  if (policy.value.schema !== 1 || policy.value.state !== 'OPERATIONAL' || policy.value.authorityId !== 'major-sport-market-coverage-v1')
    throw new Error('Primary coverage authority conflict');
  const report = {ts: at, slot: lane.slot, feedGeneratedAt: feed.value.generatedAt};
  const inventory = derivePrimarySelectionInventory(report, feed.value, policy.value);
  const sourceEvents = mergedFeedEvents(feed.value);
  const events = Object.entries(inventory.sports).flatMap(([sport, summary]) => summary.eventIds.map(id => {
    const event = sourceEvents.get(id);
    const selections = inventory.selections.filter(row => row.eventId === id && row.sport === sport);
    return {eventId: id, sport, home: event.home, away: event.away,
      startTime: event.date || event.identity?.startTime, available: selections.length,
      unavailable: [...inventory.limitations.keys()].filter(key => key.startsWith(`${sport}|${id}|`)).length};
  })).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime) || a.eventId.localeCompare(b.eventId));
  const selected = eventId === null ? null : events.find(event => event.eventId === String(eventId));
  if (eventId !== null && !selected) throw new Error(`Event ${eventId} is not in this report inventory`);
  const sidecar={};
  bindIntelligence({root,report,sidecar,feed:feed.value,universe:inventory});
  const intelligence=buildGameIntelligence({report,sidecar,feed:feed.value,universe:inventory});
  return {
    schema: 1, kind: 'REPORT_INPUT_PROJECTION', decisionAuthority: false,
    validationState: 'NOT_RUN',
    limitation: 'Inventory availability is not completed research or issuance clearance. Run existing feed, evidence, Core and publication gates on the exact source bytes. Rebuild if bindings change. Spread line is home-oriented for both sides.',
    report: {...report, ...scheduleMetadataForReport(report, root), ...resolveCoreRelease(root, at)},
    bindings: {feed: feed.binding, coverage: policy.binding,
      observer: readBound(root, 'data/oddspapi-observer.json', false).binding},
    feed: {generatedAt: feed.value.generatedAt,
      ageMinutesAtReport: (Date.parse(at) - Date.parse(feed.value.generatedAt)) / 60000,
      scheduleMeta: feed.value.scheduleMeta ?? null},
    counts: {events: events.length, available: inventory.selections.length,
      unavailable: inventory.limitations.size,
      required: Object.values(inventory.sports).reduce((sum, sport) => sum + sport.primary.required, 0)},
    gameIntelligence:intelligence?(selected?projectGameIntelligence(intelligence,selected.eventId):
      {collectedAt:intelligence.collectedAt,counts:intelligence.counts,sources:intelligence.sources,
        instruction:'Use --event-id for the complete dossier; report-run start binds these observations to the draft.'}):null,
    ...(selected ? {event: selected,
      selections: inventory.selections.filter(row => row.eventId === selected.eventId),
      limitations: Object.fromEntries([...inventory.limitations].filter(([key]) => key.split('|')[1] === selected.eventId))}
      : {events, limitations: Object.fromEntries(inventory.limitations)})
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), options = {};
    const names = {'--root': 'root', '--at': 'at', '--report-time': 'reportTime', '--event-id': 'eventId'};
    for (let i = 0; i < args.length; i += 2) {
      if (!names[args[i]] || !args[i + 1] || args[i + 1].startsWith('--') || names[args[i]] in options)
        throw new Error('Usage: report-inputs.mjs --at <actual-ISO-timestamp> --report-time <HH:MM> [--event-id <id>] [--root <repo>]');
      options[names[args[i]]] = args[i + 1];
    }
    console.log(JSON.stringify(buildReportInputs(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
