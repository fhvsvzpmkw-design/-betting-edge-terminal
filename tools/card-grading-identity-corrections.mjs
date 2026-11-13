// Reviewed historical identity bindings only; never edit issuance or supply grades.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const CORRECTIONS = {'70898886': 'data/history/grading/corrections/event-70898886-20261027-v1.json'};
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const git = (...args) => execFileSync('git', args, {encoding:'utf8', maxBuffer:128*1024*1024, timeout:30000}).trim();
const key = row => `${row.sourceRun}#${row.index}`;

export function resolvePinnedIdentity(group, correction, {readSource, sourceHash, readSnapshot, oddsEntries}) {
  assert.equal(correction.schema, 1);
  assert.equal(correction.eventId, group.id);
  assert.equal(correction.kind, 'reviewed-historical-event-identity');
  const identity = correction.identity;
  const expectedRows = [];
  for (const binding of correction.issuedRuns) {
    assert.equal(sourceHash(binding.path), binding.blobSha, 'Pinned issued source changed');
    const run = readSource(binding.path);
    assert.equal(run.feedGeneratedAt, binding.feedGeneratedAt);
    assert.ok(oddsEntries.some(entry => entry.generatedAt === binding.feedGeneratedAt && entry.snapshotBlobSha === binding.snapshotBlobSha), 'Exact issued snapshot binding missing');
    const snapshot = readSnapshot(binding.snapshotBlobSha);
    assert.equal(snapshot.generatedAt, binding.feedGeneratedAt);
    const events = [...(snapshot.events || []), ...(snapshot.deepMarkets || [])].filter(event => String(event.eventId || event.identity?.eventId || event.id) === group.id);
    assert.ok(events.length, 'Pinned event absent from snapshot');
    for (const event of events) {
      assert.equal(event.away, identity.away); assert.equal(event.home, identity.home);
      assert.equal(Date.parse(event.date || event.identity?.startTime), Date.parse(identity.start));
      assert.equal(event.identity?.sportKey || event.sport?.slug, 'american-football');
    }
    const issued = run.recs.map((rec, index) => ({rec, index, sourceRun:binding.path})).filter(row => String(row.rec.feed?.eventId) === group.id);
    assert.deepEqual(issued.map(row => row.index), binding.indices, 'Issued ordinal population changed');
    for (const row of issued) {
      const feed = row.rec.feed;
      assert.equal(feed.eventDate, identity.start);
      assert.equal(row.rec.coreAssessment?.context?.sport, identity.sport);
      assert.equal(feed.selectionKey.split('|')[0], group.id);
      assert.ok(events.some(event => (event.bookmakers?.[feed.book] || []).some(market =>
        (market.marketKey || market.identity?.marketKey) === feed.marketKey && (market.odds || []).some(quote => {
          const keys = quote.selectionKeys || quote.identity?.selectionKeys || {};
          return keys[feed.side] === feed.selectionKey && Number(quote[feed.side]) === Number(feed.priceDecimal)
            && (feed.marketKey === 'ml' || Number(quote.hdp) === Number(feed.hdp ?? feed.line));
        }))), 'Issued book/selection/line/price does not match the pinned event');
      expectedRows.push(row);
    }
  }
  assert.equal(expectedRows.length, correction.expectedCards);
  const identityRows = group.identityRows || group.rows;
  assert.deepEqual(identityRows.map(key).sort(), expectedRows.map(key).sort(), 'Unreviewed issued row in conflicted event');
  const expected = new Map(expectedRows.map(row => [key(row), row.rec]));
  for (const row of [...identityRows, ...group.rows]) {
    const rec = expected.get(key(row));
    assert.ok(rec, 'Pending row is outside the pinned correction');
    assert.deepEqual(row.rec.feed, rec.feed);
    assert.equal(row.rec.title, rec.title); assert.equal(row.rec.meta, rec.meta);
  }
  return {identity, audit: {correctionId:correction.correctionId, eventId:group.id,
    sourceBlobs:Object.fromEntries(correction.issuedRuns.map(run => [run.path, run.blobSha])),
    snapshotBlobs:correction.issuedRuns.map(run => run.snapshotBlobSha),
    method:'Exact source-pinned feed identity takes precedence over the reviewed contaminated display labels; final score is independently verified by the standard historical provider.'}};
}

export function historicalIdentityCorrection(group) {
  const file = CORRECTIONS[group.id];
  if (!file || !fs.existsSync(file)) return null;
  const result = resolvePinnedIdentity(group, read(file), {readSource:read,
    sourceHash:file => git('hash-object', file), readSnapshot:sha => JSON.parse(git('cat-file', 'blob', sha)),
    oddsEntries:read('data/history/odds-index.json').entries || []});
  result.audit.path = file; result.audit.blobSha = git('hash-object', file);
  return result;
}
