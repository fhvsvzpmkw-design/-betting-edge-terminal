"""Meaningful checks for retrospective forecast construction and audit boundaries."""
import copy
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('study', ROOT / 'tools/study-graham-replacement.py')
study = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(study)


class GrahamReplacementStudyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        _, cls.seeds, cls.games = study.load_inputs(ROOT)
        cls.protocol = study.read(ROOT, study.STUDY / 'protocol.json')

    def test_solved_two_team_example_and_home_sign(self):
        game = {'home': 'H', 'away': 'A', 'homeScore': 20, 'awayScore': 10, 'hfa': 2}
        r = study.fit_ratings([game], ['H', 'A'], {'H': 0, 'A': 0}, lam=4)
        self.assertAlmostEqual(r['H'], 8 / 6)
        self.assertAlmostEqual(r['A'], -8 / 6)
        self.assertAlmostEqual(study.predict(game, r), -14 / 3)
        self.assertEqual(study.grade(-4.5, -3, 4), 'WIN')
        self.assertEqual(study.grade(-4.5, -3, 2), 'LOSS')
        self.assertEqual(study.grade(-3, -3, 20), 'NO_EDGE')

    def test_preseason_centre_is_not_a_change_in_strength(self):
        train = [g for g in self.games if g['week'] < 4]
        original = study.fit_ratings(train, sorted(self.seeds), self.seeds)
        translated = study.fit_ratings(train, sorted(self.seeds), {k: v + 100 for k, v in self.seeds.items()})
        for team in original:
            self.assertAlmostEqual(original[team], translated[team], places=10)

    def test_week6_scores_cannot_change_any_test_forecast(self):
        original, fits = study.forecasts(self.games, self.seeds, self.protocol)
        altered = copy.deepcopy(self.games)
        for g in altered:
            if g['week'] == 6:
                g['homeScore'] += 100
                g['awayScore'] = 0
        changed, _ = study.forecasts(altered, self.seeds, self.protocol)
        self.assertEqual([r['rawFair'] for r in original], [r['rawFair'] for r in changed])
        for f in fits:
            self.assertTrue(all(int(k.split('-W')[1][:2]) < f['week'] for k in f['trainingGameKeys']))

    def test_fact_observed_after_origin_is_rejected(self):
        altered = copy.deepcopy(self.games)
        altered[0]['factsVerifiedAt'] = '2099-01-01T00:00:00Z'
        with self.assertRaisesRegex(ValueError, 'unavailable'):
            study.forecasts(altered, self.seeds, self.protocol)

    def test_market_changes_cannot_change_candidate_forecasts(self):
        original = study.study(ROOT)
        reader = study.read

        def altered_read(root, name):
            data = reader(root, name)
            if str(name) == 'data/history/graham-pinnacle-value.json':
                for row in data['rows']:
                    row['pinnacleHomeLine'] += 7
                    row['grahamHomeFair'] -= 10
            return data

        with patch.object(study, 'read', side_effect=altered_read):
            modified = study.study(ROOT)
        candidate_ids = {c['id'] for c in self.protocol['candidates']}
        raw = lambda result: [p['rawFair'] for p in result['predictions'] if p['candidate'] in candidate_ids]
        self.assertEqual(raw(original), raw(modified))

    def test_original_benchmark_and_symmetric_rounding(self):
        result = study.study(ROOT)
        baseline = result['summaries']['graham_archived']
        self.assertEqual(result['evaluationGames'], 45)
        self.assertAlmostEqual(baseline['mae'], 8.466666666666667)
        self.assertEqual(baseline['ats'], {'WIN': 19, 'LOSS': 23, 'PUSH': 1, 'NO_EDGE': 2})
        self.assertEqual([study.half(x) for x in [2.25, -2.25, 0.25, -0.25]], [2.5, -2.5, 0.5, -0.5])


if __name__ == '__main__':
    unittest.main()
