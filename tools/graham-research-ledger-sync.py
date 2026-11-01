#!/usr/bin/env python3
"""Append research-event sweeps to ledgers; never mutate a Graham board."""
import argparse
import copy
import json
from datetime import datetime
from pathlib import Path


SWEEP_FIELDS = (
    'sequence', 'type', 'runEventId', 'sourceTaskKey', 'completionResult',
    'startedAt', 'completedAt', 'scope', 'sourcesChecked', 'teamFindings',
    'ratingChanges', 'matchupChanges', 'espnFpiCapture', 'summary',
    'methodologySource', 'activeWeekAuthority', 'h4Guard', 'vsin2Source',
    'personnelProduction', 'matchupProduction',
)


def instant(value):
    if not isinstance(value, str):
        raise ValueError('RESEARCH_SYNC_TIMESTAMP_REQUIRED')
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError as error:
        raise ValueError('RESEARCH_SYNC_TIMESTAMP_INVALID:' + value) from error
    if result.tzinfo is None:
        raise ValueError('RESEARCH_SYNC_TIMESTAMP_OFFSET_REQUIRED:' + value)
    return result


def legacy_key(sweep):
    return sweep.get('sequence'), sweep.get('type'), sweep.get('startedAt')


def append_sweeps(ledger, events):
    result = copy.deepcopy(ledger)
    sweeps = result.setdefault('sweeps', [])
    run_ids = {s.get('runEventId') for s in sweeps if s.get('runEventId')}
    legacy = {legacy_key(s) for s in sweeps}
    appended = 0
    ignored = 0
    for event in events:
        # Readbacks and eventId/sweepSequence receipts reference a sweep. They
        # are not additional research, even when stored beside that sweep.
        if not event.get('type'):
            ignored += 1
            continue
        run_id = event.get('runEventId')
        key = legacy_key(event)
        if (run_id and run_id in run_ids) or (not run_id and key in legacy):
            continue
        if event.get('season', ledger['season']) != ledger['season'] or event.get('week', ledger['week']) != ledger['week']:
            raise ValueError('RESEARCH_SYNC_EVENT_WEEK_MISMATCH')
        if event.get('marketViewed', event.get('summary', {}).get('marketViewed')) is not False:
            raise ValueError('RESEARCH_SYNC_MARKET_ISOLATION_REQUIRED')
        if instant(event.get('completedAt')) < instant(event.get('startedAt')):
            raise ValueError('RESEARCH_SYNC_EVENT_CHRONOLOGY')
        sweeps.append({key: copy.deepcopy(event[key]) for key in SWEEP_FIELDS if key in event})
        if run_id:
            run_ids.add(run_id)
        legacy.add(key)
        appended += 1
    if appended:
        # ISO strings with differing offsets cannot be sorted lexically. Keep
        # the newer existing ledger clock when adding an older event.
        dates = [ledger['updatedAt']] if ledger.get('updatedAt') else []
        dates.extend(s['completedAt'] for s in sweeps if s.get('completedAt'))
        result['updatedAt'] = max(dates, key=instant)
    return result, appended, ignored


def synchronize(root, write=False):
    root = Path(root)
    plans = []
    ignored = 0
    for directory in sorted((root / 'data/walters/nfl').glob('20*/week-*-research-events')):
        ledger_path = directory.parent / directory.name.replace('-research-events', '-research-ledger.json')
        if not ledger_path.exists():
            continue
        original = ledger_path.read_bytes()
        ledger = json.loads(original)
        expected_week = int(directory.name.split('-')[1])
        if ledger.get('season') != int(directory.parent.name) or ledger.get('week') != expected_week:
            raise ValueError('RESEARCH_SYNC_LEDGER_WEEK_MISMATCH:' + str(ledger_path))
        event_paths = sorted(directory.glob('*.json'))
        event_bytes = {path: path.read_bytes() for path in event_paths}
        result, appended, skipped = append_sweeps(ledger, [json.loads(event_bytes[path]) for path in event_paths])
        ignored += skipped
        if appended:
            plans.append((ledger_path, original, result, appended, event_bytes))
    if write:
        # Validate every plan before any write and retain the exact source
        # bytes used. The workflow retries against freshly fetched main.
        for ledger_path, original, _, _, event_bytes in plans:
            if ledger_path.read_bytes() != original or any(path.read_bytes() != data for path, data in event_bytes.items()):
                raise ValueError('RESEARCH_SYNC_INPUT_CHANGED:' + str(ledger_path))
        for ledger_path, _, result, _, _ in plans:
            ledger_path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
    return {
        'state': 'APPLIED' if write and plans else 'PREVIEW' if plans else 'UNCHANGED',
        'changedPaths': [str(item[0].relative_to(root)) for item in plans],
        'appendedSweeps': sum(item[3] for item in plans),
        'ignoredNonSweepEvents': ignored,
        'boardMutationAllowed': False,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default='.')
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    print(json.dumps(synchronize(args.root, args.write)))
