#!/usr/bin/env python3
"""Read-only retrospective study. Never writes production ratings or forecasts.

Run from the repository root. Requires numpy. Protocol and source manifest are
frozen under research/graham-replacement-20261026/ before candidate evaluation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import numpy as np

STUDY = Path('research/graham-replacement-20261026')
FACTS = [
    'data/walters/nfl/2026/weeks-01-03-final-facts-20260930.json',
    'data/walters/nfl/2026/week-04-final-facts-20261006.json',
    'data/walters/nfl/2026/week-05-final-facts-20261013.json',
    'data/walters/nfl/2026/week-06-final-facts-20261020.json',
]
ALIASES = {
    'LA Rams': 'LAR', 'Seattle': 'SEA', 'Baltimore': 'BAL', 'Buffalo': 'BUF',
    'San Francisco': 'SF', 'Denver': 'DEN', 'New England': 'NE',
    'Philadelphia': 'PHI', 'Green Bay': 'GB', 'Chicago': 'CHI', 'Detroit': 'DET',
    'Kansas City': 'KC', 'Houston': 'HOU', 'LA Chargers': 'LAC',
    'Cincinnati': 'CIN', 'Dallas': 'DAL', 'Jacksonville': 'JAX',
    'Indianapolis': 'IND', 'Minnesota': 'MIN', 'Pittsburgh': 'PIT',
    'Tampa Bay': 'TB', 'Washington': 'WAS', 'New Orleans': 'NO',
    'Carolina': 'CAR', 'NY Giants': 'NYG', 'Atlanta': 'ATL', 'Cleveland': 'CLE',
    'Tennessee': 'TEN', 'Las Vegas': 'LV', 'Miami': 'MIA', 'NY Jets': 'NYJ',
    'Arizona': 'ARI',
}


def read(root: Path, name: str | Path):
    return json.loads((root / name).read_text())


def clock(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00'))


def half(value: float) -> float:
    return float((Decimal(str(value)) * 2).quantize(Decimal('1'), rounding=ROUND_HALF_UP) / 2)


def fit_ratings(train, teams, seeds, lam=4.0, delta=None):
    """Solve paired-comparison ridge; optional Huber with quadratic-scale loss.

    Targets and seeds have rating-point units. Markets and archived Graham
    ratings are deliberately absent from this function and its training input.
    """
    if lam <= 0:
        raise ValueError('Positive preseason regularization required')
    index = {team: i for i, team in enumerate(teams)}
    prior = np.array([seeds[t] for t in teams], dtype=float)
    prior -= prior.mean()
    x = np.zeros((len(train), len(teams)))
    y = np.zeros(len(train))
    for i, game in enumerate(train):
        x[i, index[game['home']]] = 1
        x[i, index[game['away']]] = -1
        y[i] = game['homeScore'] - game['awayScore'] - game['hfa']
    weights = np.ones(len(train))
    ratings = prior.copy()
    for iteration in range(1000):
        new = np.linalg.solve(x.T @ (weights[:, None] * x) + lam * np.eye(len(teams)),
                              x.T @ (weights * y) + lam * prior)
        if delta is None or np.max(np.abs(new - ratings)) < 1e-10:
            ratings = new
            break
        ratings = new
        residual = np.abs(y - x @ ratings)
        weights = np.minimum(1.0, delta / np.maximum(residual, 1e-15))
    else:
        raise ValueError('Huber solver failed to converge')
    grad_residual = x @ ratings - y
    if delta is not None:
        grad_residual = np.clip(grad_residual, -delta, delta)
    gradient = x.T @ grad_residual + lam * (ratings - prior)
    if np.max(np.abs(gradient)) > 1e-7:
        raise ValueError('Rating solution failed gradient check')
    return {team: float(ratings[i]) for i, team in enumerate(teams)}


def predict(game, ratings):
    return ratings[game['away']] - ratings[game['home']] - game['hfa']


def grade(fair, market, home_margin):
    if abs(fair - market) < 1e-9:
        return 'NO_EDGE'
    cover = (home_margin + market) * (1 if fair < market else -1)
    return 'PUSH' if abs(cover) < 1e-9 else 'WIN' if cover > 0 else 'LOSS'


def summarize(rows):
    errors = np.array([r['homeScore'] - r['awayScore'] + r['fair'] for r in rows])
    raw_errors = np.array([r['homeScore'] - r['awayScore'] + r['rawFair'] for r in rows])
    counts = {g: sum(r['grade'] == g for r in rows) for g in ['WIN', 'LOSS', 'PUSH', 'NO_EDGE']}
    return {
        'games': len(rows), 'mae': float(np.abs(errors).mean()),
        'rmse': float(np.sqrt(np.square(errors).mean())),
        'bias': float(errors.mean()), 'rawMae': float(np.abs(raw_errors).mean()),
        'ats': counts,
    }


def load_inputs(root):
    manifest = read(root, STUDY / 'source-manifest.json')
    for source in manifest['sources']:
        data = (root / source['path']).read_bytes()
        sha = hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest()
        if sha != source['blobSha']:
            raise ValueError('Pinned source bytes changed: ' + source['path'])
    seed_file = read(root, 'core/staging/walters-nfl-seed-dataset-2026.json')
    seeds = {ALIASES[r['team']]: float(r['rating']) for r in seed_file['powerRatings']}
    if len(seeds) != 32:
        raise ValueError('32 unique preseason seeds required')
    venue_policy = read(root, 'data/walters/nfl/home-field/home-field-production-current.json')
    location_values = (
        venue_policy['productionScope']['neutralZeroBase']['homeLocationAdvantagePoints'],
        venue_policy['productionScope']['domesticLeagueBaseline']['homeLocationAdvantagePoints'],
    )
    diagnostics = read(root, 'data/walters/nfl/2026/rating-reviews/2026-10-22-score-diagnostics.json')
    hfa = {g['gameKey']: g for g in diagnostics['gamesUsed']}
    if len(hfa) != len(diagnostics['gamesUsed']):
        raise ValueError('Duplicate HFA source game')
    games = {}
    for name in FACTS:
        facts = read(root, name)
        for week in facts['weeks']:
            for original in week['games']:
                key = original['gameKey']
                if key in games or original['state'] != 'FINAL':
                    raise ValueError('Duplicate or nonfinal score game: ' + key)
                historical = hfa[key]
                if any(original[k] != historical[k] for k in ['away', 'home', 'awayScore', 'homeScore']):
                    raise ValueError('HFA/final identity mismatch: ' + key)
                if historical['hfa'] not in location_values:
                    raise ValueError('Unexpected venue effect needs separate provenance review')
                if clock(venue_policy['activatedAt']) >= clock(original['startTimePacific']):
                    raise ValueError('Location policy not active before game')
                games[key] = {**original, 'week': week['week'], 'hfa': historical['hfa'],
                              'factsPath': name, 'factsVerifiedAt': facts['verifiedAt']}
    if len(games) != 93 or set(games) != set(hfa):
        raise ValueError('Expected exact 93-game score/HFA inventory')
    for g in games.values():
        if g['home'] not in seeds or g['away'] not in seeds:
            raise ValueError('Unknown team')
    return manifest, seeds, list(games.values())


def forecasts(games, seeds, protocol):
    output, fits = [], []
    teams = sorted(seeds)
    for week in protocol['developmentWeeks']:
        tests = [g for g in games if g['week'] == week]
        train = [g for g in games if g['week'] < week]
        origin = min(clock(g['startTimePacific']) for g in tests)
        if any(clock(g['factsVerifiedAt']) >= origin or clock(g['startTimePacific']) >= origin for g in train):
            raise ValueError('Training fact unavailable at weekly origin')
        train_keys = sorted(g['gameKey'] for g in train)
        for spec in protocol['candidates']:
            if spec['kind'] == 'frozen_preseason':
                ratings = dict(seeds)
            else:
                ratings = fit_ratings(train, teams, seeds, spec['lambda'], spec.get('delta'))
            fits.append({'week': week, 'candidate': spec['id'], 'origin': origin.isoformat(),
                         'trainingGames': len(train), 'trainingGameKeys': train_keys,
                         'ratings': ratings})
            for g in tests:
                raw = predict(g, ratings)
                output.append({'candidate': spec['id'], 'gameKey': g['gameKey'], 'week': week,
                               'away': g['away'], 'home': g['home'], 'homeScore': g['homeScore'],
                               'awayScore': g['awayScore'], 'hfa': g['hfa'], 'rawFair': raw,
                               'fair': half(raw), 'trainingGames': len(train)})
    return output, fits


def study(root):
    protocol = read(root, STUDY / 'protocol.json')
    manifest, seeds, games = load_inputs(root)
    predictions, fits = forecasts(games, seeds, protocol)
    # Prices are loaded only after all candidate fits and forecasts are complete.
    market_file = read(root, 'data/history/graham-pinnacle-value.json')
    markets = {r['gameKey']: r for r in market_file['rows']}
    for row in predictions:
        market = markets[row['gameKey']]
        for field in ['away', 'home', 'homeScore', 'awayScore', 'week']:
            if row[field] != market[field]:
                raise ValueError('Market comparator identity mismatch')
        if market['resultState'] != 'FINAL' or any(clock(market[k]) > clock(market['startTime']) for k in ['grahamAsOf', 'pinnacleObservedAt']):
            raise ValueError('Nonfinal or after-kickoff comparator')
        row['marketHomeLine'] = market['pinnacleHomeLine']
        row['grade'] = grade(row['fair'], row['marketHomeLine'], row['homeScore'] - row['awayScore'])
    test_keys = set(p['gameKey'] for p in predictions)
    for name, field in [('graham_archived', 'grahamHomeFair'), ('pinnacle_saved_benchmark', 'pinnacleHomeLine')]:
        for key in sorted(test_keys):
            m = markets[key]
            fair = float(m[field])
            predictions.append({'candidate': name, 'gameKey': key, 'week': m['week'],
                                'away': m['away'], 'home': m['home'], 'homeScore': m['homeScore'],
                                'awayScore': m['awayScore'], 'rawFair': fair, 'fair': fair,
                                'marketHomeLine': m['pinnacleHomeLine'],
                                'grade': grade(fair, m['pinnacleHomeLine'], m['homeScore'] - m['awayScore'])})
    names = [s['id'] for s in protocol['candidates']] + ['graham_archived', 'pinnacle_saved_benchmark']
    summaries = {name: summarize([r for r in predictions if r['candidate'] == name]) for name in names}
    weekly = {str(w): {n: summarize([r for r in predictions if r['candidate'] == n and r['week'] == w]) for n in names}
              for w in protocol['developmentWeeks']}
    baseline = summaries['graham_archived']
    for name, stats in summaries.items():
        stats['maeImprovementVsGraham'] = baseline['mae'] - stats['mae']
    rank = sorted(protocol['candidates'], key=lambda s: (summaries[s['id']]['mae'], s['id']))
    primary = summaries['ridge_4']
    eligible = primary['mae'] < baseline['mae'] and primary['rmse'] <= baseline['rmse']
    result = {
        'schema': 1, 'state': 'RETROSPECTIVE_SHADOW_CANDIDATE_STUDY',
        'baseCommit': manifest['commit'], 'protocolPath': str(STUDY / 'protocol.json'),
        'trainingSeasons': [2026], 'finalGamesAvailable': len(games), 'evaluationGames': len(test_keys),
        'evaluationWeeks': protocol['developmentWeeks'], 'summaries': summaries, 'weekly': weekly,
        'candidateMaeRank': [s['id'] for s in rank],
        'primaryPassesShadowScreen': eligible, 'productionReady': False,
        'limitations': protocol['limitations'],
        'hfaProvenance': 'September1 H4 production policy fixes domestic2.082/neutral0 before all games. Venue assignments come from the October22 preserved archive and are treated as scheduled locations, not fitted outcomes. No fitted current rating from that file is used.',
        'scoreAvailability': 'Every training factsVerifiedAt precedes the first kickoff of the tested week.',
        'marketIsolation': 'Only unique prior score facts, venue effects and original seeds enter candidate fits.',
        'injuryBoundary': protocol['injuries'],
        'fitRecords': fits, 'predictions': predictions,
    }
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, default=Path.cwd())
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    result = study(args.root)
    if args.write:
        out = args.root / STUDY / 'results.json'
        out.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
    print(json.dumps({k: result[k] for k in ['evaluationGames', 'summaries', 'weekly', 'candidateMaeRank', 'primaryPassesShadowScreen']}, indent=2))


if __name__ == '__main__':
    main()
