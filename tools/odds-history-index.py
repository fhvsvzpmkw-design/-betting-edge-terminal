#!/usr/bin/env python3
"""Append exact committed odds snapshots to the current branch's compact index."""
import datetime as dt
import hashlib
import json
import pathlib
import subprocess

INDEX = pathlib.Path('data/history/odds-index.json')
SOURCE = 'data/live-odds.json'

def git(*args):
    return subprocess.check_output(['git', *args]).decode().strip()

index = json.loads(INDEX.read_text())
entries = index.setdefault('entries', [])
indexed_commits = {e.get('snapshotCommitSha') for e in entries if e.get('snapshotCommitSha')}
indexed_blobs = {e.get('snapshotBlobSha') for e in entries if e.get('snapshotBlobSha')}

latest_source_commit = git('log', '-1', '--format=%H', '--', SOURCE)
if not latest_source_commit:
    raise SystemExit('No data/live-odds.json commit found.')

if entries and entries[-1].get('snapshotCommitSha'):
    last = entries[-1]['snapshotCommitSha']
    raw = git('log', '--reverse', '--format=%H', f'{last}..HEAD', '--', SOURCE)
    candidates = [x for x in raw.splitlines() if x]
else:
    candidates = [latest_source_commit]

added = 0
for commit in candidates:
    if commit in indexed_commits:
        continue
    blob = git('rev-parse', f'{commit}:{SOURCE}')
    if blob in indexed_blobs:
        continue

    raw_bytes = subprocess.check_output(['git', 'show', f'{commit}:{SOURCE}'])
    feed = json.loads(raw_bytes)
    generated = feed.get('generatedAt')
    if not generated:
        raise SystemExit(f'{commit}: generatedAt missing; refusing to index malformed snapshot.')

    entry = {
        'generatedAt': generated,
        'generatedAtVancouver': feed.get('generatedAtVancouver'),
        'snapshotCommitSha': commit,
        'snapshotBlobSha': blob,
        'sha256': hashlib.sha256(raw_bytes).hexdigest(),
        'schema': feed.get('schema'),
        'identitySchema': feed.get('identitySchema'),
        'source': feed.get('source'),
        'eventCount': len(feed.get('events') or []),
        'indexedAtUtc': dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')
    }

    if feed.get('scheduleMeta'):
        entry['scheduleMeta'] = feed['scheduleMeta']

    for key in ('selectedSports', 'requestUsage', 'requestCounts', 'requestCount', 'requestsUsed'):
        if key in feed:
            entry[key] = feed[key]

    entries.append(entry)
    indexed_commits.add(commit)
    indexed_blobs.add(blob)
    added += 1

if added:
    INDEX.write_text(json.dumps(index, indent=2) + '\n')
    print(f'Indexed {added} odds snapshot(s).')
else:
    print('No new odds snapshots to index.')

