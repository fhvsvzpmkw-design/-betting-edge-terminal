import copy
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
SPEC = importlib.util.spec_from_file_location('graham_research_sync', Path(__file__).resolve().parents[1] / 'tools/graham-research-ledger-sync.py')
SYNC = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SYNC)


def event(run='new', **updates):
    result = dict(sequence=2, type='DAILY_REVIEW', runEventId=run, season=2026, week=8,
                  startedAt='2026-10-31T10:00:00-07:00', completedAt='2026-10-31T11:00:00-07:00',
                  summary={'marketViewed': False}, teamFindings=[], matchupChanges=[])
    result.update(updates)
    return result


class ResearchSyncTests(unittest.TestCase):
    def setUp(self):
        self.ledger = {'season': 2026, 'week': 8, 'updatedAt': '2026-10-31T23:00:00Z',
                       'sweeps': [event('existing', sequence=1)]}

    def test_late_additions_preserve_original_prefix_and_newer_clock(self):
        before = copy.deepcopy(self.ledger)
        result, added, ignored = SYNC.append_sweeps(self.ledger, [event('older', sequence=0, startedAt='2026-10-30T09:00:00-07:00', completedAt='2026-10-30T10:00:00-07:00')])
        self.assertEqual(added, 1)
        self.assertEqual(ignored, 0)
        self.assertEqual(result['sweeps'][:1], before['sweeps'])
        self.assertEqual(result['sweeps'][-1]['runEventId'], 'older')
        self.assertEqual(result['updatedAt'], before['updatedAt'])
        self.assertEqual(self.ledger, before)

    def test_clock_order_uses_actual_instants_not_offset_strings(self):
        result, _, _ = SYNC.append_sweeps(self.ledger, [event(completedAt='2026-10-31T17:00:00-07:00')])
        self.assertEqual(result['updatedAt'], '2026-10-31T17:00:00-07:00')

    def test_existing_ids_and_legacy_events_are_idempotent(self):
        legacy = event(run=None, sequence=3)
        result, added, _ = SYNC.append_sweeps(self.ledger, [event(), event(), legacy, legacy])
        self.assertEqual(added, 2)
        again, added, _ = SYNC.append_sweeps(result, [event(), legacy])
        self.assertEqual(added, 0)
        self.assertEqual(again, result)

    def test_receipt_and_readback_wrappers_are_not_replayed_as_sweeps(self):
        wrappers = [{'eventId': 'existing', 'eventType': 'GRAHAM_RESEARCH_SWEEP', 'sweepSequence': 1,
                     'completedAt': '2026-10-31T23:30:00Z'},
                    {'runEventId': 'existing', 'recordType': 'PUBLICATION_READBACK'}]
        result, added, ignored = SYNC.append_sweeps(self.ledger, wrappers)
        self.assertEqual(added, 0)
        self.assertEqual(ignored, 2)
        self.assertEqual(result, self.ledger)

    def test_wrong_week_market_exposure_and_invalid_chronology_fail(self):
        for changes in [dict(week=7), dict(summary={'marketViewed': True}), dict(completedAt='invalid'),
                        dict(completedAt='2026-10-30T00:00:00Z')]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                SYNC.append_sweeps(self.ledger, [event(**changes)])

    def test_transport_never_changes_boards_and_preserves_noop_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / 'data/walters/nfl/2026'
            events = folder / 'week-08-research-events'
            events.mkdir(parents=True)
            ledger_path = folder / 'week-08-research-ledger.json'
            ledger_path.write_text(json.dumps(self.ledger))
            board = folder / 'week-08-current-numbers.json'
            board.write_text('{"lastResearchAt":"newer", "games":[{"started":true}]}\n')
            original_board = board.read_bytes()
            (events / 'new.json').write_text(json.dumps(event()))
            result = SYNC.synchronize(root, write=True)
            self.assertEqual(result['changedPaths'], ['data/walters/nfl/2026/week-08-research-ledger.json'])
            self.assertEqual(board.read_bytes(), original_board)
            written = ledger_path.read_bytes()
            self.assertEqual(SYNC.synchronize(root, write=True)['state'], 'UNCHANGED')
            self.assertEqual(ledger_path.read_bytes(), written)
            self.assertEqual(board.read_bytes(), original_board)


if __name__ == '__main__':
    unittest.main()
