#!/usr/bin/env python3
import csv
import hashlib
import json
import math
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

ROOT = Path.cwd()
H1 = ROOT / 'data/walters/nfl/home-field/home-field-calibration-v1.json'
H2 = ROOT / 'data/walters/nfl/home-field/home-field-h2-contract-v1.json'
ACTIVE = ROOT / 'data/walters/nfl/active-week.json'
POWER = ROOT / 'data/walters/nfl-power-ratings-ledger.json'
REGISTRY = ROOT / 'data/walters/nfl/player-values/player-values-2026-v1.json'
SNAPSHOT = ROOT / 'data/walters/nfl/home-field/source/nflverse-schedules-hfa-snapshot-2026-09-01.csv'
RELEASE = ROOT / 'data/walters/nfl/home-field/home-field-release-2026-v1.json'
CURRENT = ROOT / 'data/walters/nfl/home-field/h2-current.json'
AUDIT = ROOT / 'data/walters/nfl/home-field/h2-validation-audit-v1.json'

TEAM_MAP = {'LA': 'LAR'}


def read_json(path):
    return json.loads(path.read_text())


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=False) + '\n')


def file_sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def fail(msg):
    raise RuntimeError(f'WALTERS HOME FIELD H2 FAILED // {msg}')


def norm_team(v):
    s = str(v or '').strip().upper()
    return TEAM_MAP.get(s, s)


def norm_stadium_text(v):
    s = re.sub(r'[^a-z0-9]+', '-', str(v or '').lower()).strip('-')
    return s or 'unknown-stadium'


def stadium_key(row):
    sid = str(row.get('stadium_id') or '').strip()
    if sid and sid.lower() not in {'nan', 'none', 'na'}:
        return f'id:{sid}'
    return f'name:{norm_stadium_text(row.get("stadium"))}'


def as_int(v):
    try:
        return int(float(str(v).strip()))
    except Exception:
        return None


def as_float(v):
    try:
        x = float(str(v).strip())
        return x if math.isfinite(x) else None
    except Exception:
        return None


def is_home_location(v):
    return str(v or '').strip().lower() == 'home'


def is_neutral_location(v):
    return str(v or '').strip().lower() == 'neutral'


def load_filtered_rows(path):
    rows = []
    with path.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for r in reader:
            season = as_int(r.get('season'))
            if season is None:
                continue
            rr = dict(r)
            rr['season'] = season
            rr['week'] = as_int(r.get('week'))
            rr['home_team'] = norm_team(r.get('home_team'))
            rr['away_team'] = norm_team(r.get('away_team'))
            rr['home_score'] = as_float(r.get('home_score'))
            rr['away_score'] = as_float(r.get('away_score'))
            rows.append(rr)
    return rows


def completed_reg_rows(rows, seasons):
    out = []
    excluded = Counter()
    for r in rows:
        if r['season'] not in seasons:
            continue
        if str(r.get('game_type') or '').strip().upper() != 'REG':
            continue
        if not r.get('home_team') or not r.get('away_team'):
            excluded['team_identity'] += 1
            continue
        if r.get('home_score') is None or r.get('away_score') is None:
            excluded['score_missing'] += 1
            continue
        if not (is_home_location(r.get('location')) or is_neutral_location(r.get('location'))):
            excluded['location_unresolved'] += 1
            continue
        out.append(r)
    return out, excluded


def build_ridge(rows, penalties):
    strength_names = sorted({f'S:{r["season"]}:{r["home_team"]}' for r in rows} | {f'S:{r["season"]}:{r["away_team"]}' for r in rows})
    season_names = sorted({f'H:SEASON:{r["season"]}' for r in rows if is_home_location(r.get('location'))})
    tv_names = sorted({f'H:TV:{r["home_team"]}:{stadium_key(r)}' for r in rows if is_home_location(r.get('location'))})
    names = strength_names + ['H:BASE'] + season_names + tv_names
    index = {name: i for i, name in enumerate(names)}
    X = np.zeros((len(rows), len(names)), dtype=float)
    y = np.zeros(len(rows), dtype=float)
    lam = np.zeros(len(names), dtype=float)
    for name, i in index.items():
        if name.startswith('S:'):
            lam[i] = float(penalties['teamSeasonStrength'])
        elif name == 'H:BASE':
            lam[i] = float(penalties['leagueHomeBaseline'])
        elif name.startswith('H:SEASON:'):
            lam[i] = float(penalties['seasonHomeDeviation'])
        elif name.startswith('H:TV:'):
            lam[i] = float(penalties['teamVenueHomeDeviation'])
    for n, r in enumerate(rows):
        X[n, index[f'S:{r["season"]}:{r["home_team"]}']] = 1.0
        X[n, index[f'S:{r["season"]}:{r["away_team"]}']] = -1.0
        if is_home_location(r.get('location')):
            X[n, index['H:BASE']] = 1.0
            X[n, index[f'H:SEASON:{r["season"]}']] = 1.0
            X[n, index[f'H:TV:{r["home_team"]}:{stadium_key(r)}']] = 1.0
        y[n] = float(r['home_score'] - r['away_score'])
    A = X.T @ X + np.diag(lam) + np.eye(len(names)) * 1e-10
    b = X.T @ y
    beta = np.linalg.solve(A, b)
    pred = X @ beta
    resid = y - pred
    return {
        'names': names,
        'index': index,
        'beta': beta,
        'resid': resid,
        'sigma': float(np.sqrt(np.mean(resid ** 2))),
        'rows': rows,
    }


def coef(fit, name):
    i = fit['index'].get(name)
    return float(fit['beta'][i]) if i is not None else 0.0


def next_season_baseline(fit, fit_seasons, weights):
    seasons = sorted(fit_seasons)[-len(weights):]
    if len(seasons) != len(weights):
        fail('not enough fitted seasons for baseline forecast')
    devs = [coef(fit, f'H:SEASON:{s}') for s in seasons]
    wsum = float(sum(weights))
    weighted = sum(float(w) * d for w, d in zip(weights, devs)) / wsum
    return float(coef(fit, 'H:BASE') + weighted), seasons, devs


def fit_holdout_strength(rows, league_hfa, penalty):
    names = sorted({r['home_team'] for r in rows} | {r['away_team'] for r in rows})
    idx = {t: i for i, t in enumerate(names)}
    X = np.zeros((len(rows), len(names)), dtype=float)
    y = np.zeros(len(rows), dtype=float)
    for n, r in enumerate(rows):
        X[n, idx[r['home_team']]] = 1.0
        X[n, idx[r['away_team']]] = -1.0
        margin = float(r['home_score'] - r['away_score'])
        if is_home_location(r.get('location')):
            margin -= league_hfa
        y[n] = margin
    A = X.T @ X + np.eye(len(names)) * float(penalty)
    beta = np.linalg.solve(A, X.T @ y)
    return {t: float(beta[i]) for t, i in idx.items()}


def evaluate_holdout(rows, strengths, league_hfa, train_fit, use_teamvenue):
    domestic_err = []
    neutral_err = []
    unseen = 0
    for r in rows:
        strength_diff = strengths.get(r['home_team'], 0.0) - strengths.get(r['away_team'], 0.0)
        hfa = 0.0
        if is_home_location(r.get('location')):
            hfa = league_hfa
            if use_teamvenue:
                tv_name = f'H:TV:{r["home_team"]}:{stadium_key(r)}'
                if tv_name not in train_fit['index']:
                    unseen += 1
                hfa += coef(train_fit, tv_name)
        pred = strength_diff + hfa
        err = float(r['home_score'] - r['away_score']) - pred
        if is_home_location(r.get('location')):
            domestic_err.append(err)
        else:
            neutral_err.append(err)
    def metrics(arr):
        if not arr:
            return {'n': 0, 'meanError': None, 'mae': None, 'rmse': None, 'absoluteMeanBias': None}
        a = np.array(arr, dtype=float)
        mean = float(np.mean(a))
        return {
            'n': int(len(arr)),
            'meanError': mean,
            'mae': float(np.mean(np.abs(a))),
            'rmse': float(np.sqrt(np.mean(a ** 2))),
            'absoluteMeanBias': abs(mean),
        }
    return {
        'domestic': metrics(domestic_err),
        'neutral': metrics(neutral_err),
        'unseenTeamVenueGames': unseen,
    }


def diagnostic_fixed_hfa(rows, strengths, hfa):
    errs = []
    for r in rows:
        if not is_home_location(r.get('location')):
            continue
        pred = strengths.get(r['home_team'], 0.0) - strengths.get(r['away_team'], 0.0) + hfa
        errs.append(float(r['home_score'] - r['away_score']) - pred)
    a = np.array(errs, dtype=float)
    mean = float(np.mean(a)) if len(a) else None
    return {
        'n': len(errs),
        'meanError': mean,
        'mae': float(np.mean(np.abs(a))) if len(a) else None,
        'rmse': float(np.sqrt(np.mean(a ** 2))) if len(a) else None,
        'absoluteMeanBias': abs(mean) if mean is not None else None,
    }


def r3(x):
    return None if x is None else round(float(x), 3)


def round_metrics(obj):
    out = {}
    for k, v in obj.items():
        if isinstance(v, dict):
            out[k] = round_metrics(v)
        elif isinstance(v, float):
            out[k] = r3(v)
        else:
            out[k] = v
    return out


def download_and_filter(contract):
    src = contract['sourceSnapshot']
    url = src['browserDownloadUrl']
    req = urllib.request.Request(url, headers={'User-Agent': 'Betting-Edge-Walters-H2/1.0'})
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != src['assetSha256']:
        fail(f'external source SHA mismatch expected {src["assetSha256"]} got {digest}')
    text = raw.decode('utf-8-sig')
    reader = csv.DictReader(text.splitlines())
    header = reader.fieldnames or []
    required = [x for x in src['fieldWhitelist'] if x not in {'stadium_id'}]
    missing_required = [x for x in required if x not in header]
    if missing_required:
        fail(f'upstream missing required fields: {missing_required}')
    whitelist = list(src['fieldWhitelist'])
    out_fields = whitelist
    rows = []
    for row in reader:
        season = as_int(row.get('season'))
        if season is None or season < src['rowWindow']['minSeason'] or season > src['rowWindow']['maxSeason']:
            continue
        if str(row.get('game_type') or '').strip().upper() != src['rowWindow']['gameType']:
            continue
        filtered = {field: row.get(field, '') for field in out_fields}
        rows.append(filtered)
    rows.sort(key=lambda r: (as_int(r.get('season')) or 0, as_int(r.get('week')) or 0, str(r.get('gameday') or ''), str(r.get('away_team') or ''), str(r.get('home_team') or '')))
    SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    with SNAPSHOT.open('w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=out_fields)
        writer.writeheader()
        writer.writerows(rows)
    # Positive whitelist enforcement on durable snapshot.
    with SNAPSHOT.open(newline='', encoding='utf-8') as f:
        durable_header = csv.DictReader(f).fieldnames or []
    if durable_header != out_fields:
        fail('durable snapshot field whitelist mismatch')
    return {
        'externalSha256': digest,
        'filteredSha256': file_sha(SNAPSHOT),
        'filteredRows': len(rows),
        'upstreamHeaderCount': len(header),
        'upstreamSourceFieldsIgnored': len([x for x in header if x not in whitelist]),
    }


def build_2026_registry(all_rows, final_fit, baseline_2026, final_rows, h2):
    schedule_2026 = [r for r in all_rows if r['season'] == 2026 and str(r.get('game_type') or '').strip().upper() == 'REG']
    teams = sorted({r['home_team'] for r in schedule_2026} | {r['away_team'] for r in schedule_2026})
    domestic_by_team = defaultdict(list)
    for r in schedule_2026:
        if is_home_location(r.get('location')):
            domestic_by_team[r['home_team']].append(r)
    final_tv_counts = Counter()
    for r in final_rows:
        if is_home_location(r.get('location')):
            final_tv_counts[(r['home_team'], stadium_key(r))] += 1
    sigma = float(final_fit['sigma'])
    estimates = []
    classifications = []
    visitors = []
    for team in teams:
        home_rows = domestic_by_team.get(team, [])
        counts = Counter(stadium_key(r) for r in home_rows)
        if not counts:
            estimates.append({
                'team': team,
                'venueStatus': 'UNRESOLVED',
                'stadiumKey': None,
                'stadium': None,
                'sampleGames': 0,
                'teamVenueDeviationPoints': None,
                'homeLocationAdvantagePoints': None,
                'uncertaintyPoints': None,
            })
            classifications.append({'team': team, 'classification': 'UNRESOLVED', 'reason': 'No 2026 location=Home venue row was resolvable.'})
            visitors.append({'team': team, 'roadDeviationPoints': 0, 'status': h2['model']['visitorRoadDeviation']['status']})
            continue
        most = counts.most_common()
        top_count = most[0][1]
        top_keys = [k for k, n in most if n == top_count]
        if len(top_keys) != 1:
            estimates.append({
                'team': team,
                'venueStatus': 'UNRESOLVED',
                'stadiumKey': None,
                'stadium': None,
                'sampleGames': 0,
                'teamVenueDeviationPoints': None,
                'homeLocationAdvantagePoints': None,
                'uncertaintyPoints': None,
            })
            classifications.append({'team': team, 'classification': 'UNRESOLVED', 'reason': '2026 modal domestic home venue is tied across multiple stadium identities.'})
            visitors.append({'team': team, 'roadDeviationPoints': 0, 'status': h2['model']['visitorRoadDeviation']['status']})
            continue
        skey = top_keys[0]
        sample_row = next(r for r in home_rows if stadium_key(r) == skey)
        tv_name = f'H:TV:{team}:{skey}'
        seen = tv_name in final_fit['index']
        dev = coef(final_fit, tv_name) if seen else 0.0
        n = final_tv_counts[(team, skey)]
        uncertainty = max(0.25, sigma / math.sqrt(n + 16))
        status = 'DOMESTIC_HOME' if seen else 'NEW_VENUE'
        if not seen:
            uncertainty = max(float(h2['finalReleaseConstruction']['uncertainty']['newVenueFloor']), uncertainty)
        estimates.append({
            'team': team,
            'venueStatus': status,
            'stadiumKey': skey,
            'stadium': sample_row.get('stadium') or None,
            'stadiumId': sample_row.get('stadium_id') or None,
            'sampleGames': int(n),
            'teamVenueDeviationPoints': r3(dev),
            'homeLocationAdvantagePoints': r3(baseline_2026 + dev),
            'uncertaintyPoints': r3(uncertainty),
        })
        classifications.append({
            'team': team,
            'classification': status,
            'stadiumKey': skey,
            'stadium': sample_row.get('stadium') or None,
            'reason': 'Known completed team/venue pair receives its locked ridge deviation.' if seen else '2026 team/venue pair was unseen in completed 2021-2025 rows; deviation shrinks fully to zero with NEW_VENUE uncertainty.'
        })
        visitors.append({'team': team, 'roadDeviationPoints': 0, 'status': h2['model']['visitorRoadDeviation']['status']})
    return teams, estimates, classifications, visitors


def main():
    for path in [H1, H2, ACTIVE, POWER, REGISTRY]:
        if not path.exists():
            fail(f'missing {path.relative_to(ROOT)}')
    h1 = read_json(H1)
    h2 = read_json(H2)
    active = read_json(ACTIVE)
    if h1.get('stage') != 'H1' or h1.get('state') != 'CONTRACT_LOCKED_SHADOW_ONLY' or h1.get('marketViewed') is not False:
        fail('H1 contract boundary invalid')
    if h2.get('stage') != 'H2' or h2.get('state') != 'MODEL_LOCKED_PRE_VALIDATION' or h2.get('marketViewed') is not False:
        fail('H2 contract boundary invalid')
    if active.get('state') != 'ACTIVE' or active.get('authority') != 'GRAHAM_WEEK_ROLLOVER':
        fail('active week authority invalid')
    week = int(active['week'])
    season = int(active['season'])
    numbers = ROOT / f'data/walters/nfl/{season}/week-{week:02d}-current-numbers.json'
    personnel = ROOT / f'data/walters/nfl/{season}/week-{week:02d}-personnel-ledger.json'
    for path in [numbers, personnel]:
        if not path.exists():
            fail(f'missing protected active artifact {path.relative_to(ROOT)}')
    protected_before = {
        'currentNumbers': file_sha(numbers),
        'personnelLedger': file_sha(personnel),
        'powerRatings': file_sha(POWER),
        'playerValueRegistry': file_sha(REGISTRY),
    }

    source_meta = download_and_filter(h2)
    all_rows = load_filtered_rows(SNAPSHOT)
    train_seasons = list(h2['training']['seasons'])
    valid_seasons = list(h2['validation']['seasons'])
    train_rows, train_excluded = completed_reg_rows(all_rows, set(train_seasons))
    valid_rows, valid_excluded = completed_reg_rows(all_rows, set(valid_seasons))
    penalties = h2['model']['penalties']
    train_fit = build_ridge(train_rows, penalties)
    baseline_2025, baseline_seasons, baseline_devs = next_season_baseline(
        train_fit, train_seasons, h2['model']['nextSeasonLeagueBaselineForecast']['weightsOldestToNewest']
    )
    holdout_strengths = fit_holdout_strength(valid_rows, baseline_2025, penalties['validationTeamStrength'])
    league_eval = evaluate_holdout(valid_rows, holdout_strengths, baseline_2025, train_fit, False)
    candidate_eval = evaluate_holdout(valid_rows, holdout_strengths, baseline_2025, train_fit, True)
    generic15 = diagnostic_fixed_hfa(valid_rows, holdout_strengths, 1.5)
    book20 = diagnostic_fixed_hfa(valid_rows, holdout_strengths, 2.0)

    acceptance = h2['acceptance']
    domestic_train = sum(1 for r in train_rows if is_home_location(r.get('location')))
    domestic_valid = candidate_eval['domestic']['n']
    checks = {
        'minimumTrainingDomesticGames': domestic_train >= int(acceptance['minimumTrainingDomesticGames']),
        'minimumValidationDomesticGames': domestic_valid >= int(acceptance['minimumValidationDomesticGames']),
        'maeVsLeagueOnly': candidate_eval['domestic']['mae'] <= league_eval['domestic']['mae'] + float(acceptance['candidateDomesticMaeMayExceedLeagueOnlyByAtMost']),
        'rmseVsLeagueOnly': candidate_eval['domestic']['rmse'] <= league_eval['domestic']['rmse'] + float(acceptance['candidateDomesticRmseMayExceedLeagueOnlyByAtMost']),
        'biasVsLeagueOnly': candidate_eval['domestic']['absoluteMeanBias'] <= league_eval['domestic']['absoluteMeanBias'] + float(acceptance['candidateAbsoluteDomesticBiasMayExceedLeagueOnlyByAtMost']),
    }
    pass_validation = all(checks.values())

    generated_at = now_iso()
    audit = {
        'schema': 1,
        'auditId': 'walters-nfl-home-field-h2-validation-audit-v1',
        'stage': 'H2',
        'season': season,
        'week': week,
        'generatedAt': generated_at,
        'marketViewed': False,
        'sourceSnapshot': {
            **h2['sourceSnapshot'],
            **source_meta,
        },
        'training': {
            'seasons': train_seasons,
            'games': len(train_rows),
            'domesticGames': domestic_train,
            'neutralGames': sum(1 for r in train_rows if is_neutral_location(r.get('location'))),
            'excluded': dict(train_excluded),
            'ridgeResidualSigma': r3(train_fit['sigma']),
            'lockedPenalties': penalties,
            'holdoutLeagueBaselineForecast': r3(baseline_2025),
            'baselineForecastSourceSeasons': baseline_seasons,
            'baselineForecastSeasonDeviations': [r3(x) for x in baseline_devs],
        },
        'validation': {
            'seasons': valid_seasons,
            'games': len(valid_rows),
            'excluded': dict(valid_excluded),
            'leagueOnly': round_metrics(league_eval),
            'candidateTeamVenue': round_metrics(candidate_eval),
            'diagnosticGeneric1_5': round_metrics(generic15),
            'diagnosticBookExample2_0': round_metrics(book20),
            'candidateMinusLeagueOnly': {
                'domesticMae': r3(candidate_eval['domestic']['mae'] - league_eval['domestic']['mae']),
                'domesticRmse': r3(candidate_eval['domestic']['rmse'] - league_eval['domestic']['rmse']),
                'absoluteDomesticBias': r3(candidate_eval['domestic']['absoluteMeanBias'] - league_eval['domestic']['absoluteMeanBias']),
            },
            'checks': checks,
            'pass': pass_validation,
        },
        'protectedArtifactSha256Before': protected_before,
    }
    write_json(AUDIT, audit)

    if not pass_validation:
        current = {
            'schema': 1,
            'stage': 'H2',
            'state': acceptance['failState'],
            'season': season,
            'week': week,
            'updatedAt': generated_at,
            'productionAuthority': False,
            'liveBoardMutationAllowed': False,
            'marketViewed': False,
            'auditPath': str(AUDIT.relative_to(ROOT)),
            'releasePath': None,
            'validationPass': False,
            'nextGate': ['H2 failed its predeclared held-out validation; preserve the live 1.5 home-field placeholder and do not enter H3.']
        }
        write_json(CURRENT, current)
        protected_after = {
            'currentNumbers': file_sha(numbers),
            'personnelLedger': file_sha(personnel),
            'powerRatings': file_sha(POWER),
            'playerValueRegistry': file_sha(REGISTRY),
        }
        audit['protectedArtifactSha256After'] = protected_after
        write_json(AUDIT, audit)
        if protected_after != protected_before:
            fail('protected live artifact changed during failed H2')
        print('WALTERS HOME FIELD H2: FAIL CLOSED // HOLDOUT DID NOT PASS // LIVE 1.5 PRESERVED')
        return 2

    final_seasons = list(h2['finalReleaseConstruction']['refitSeasons'])
    final_rows, final_excluded = completed_reg_rows(all_rows, set(final_seasons))
    final_fit = build_ridge(final_rows, penalties)
    baseline_2026, final_baseline_seasons, final_baseline_devs = next_season_baseline(
        final_fit, final_seasons, h2['model']['nextSeasonLeagueBaselineForecast']['weightsOldestToNewest']
    )
    teams, estimates, classifications, visitors = build_2026_registry(all_rows, final_fit, baseline_2026, final_rows, h2)
    registry_finite = len(teams) == 32 and len(estimates) == 32 and all(
        e['venueStatus'] == 'UNRESOLVED' or (e['homeLocationAdvantagePoints'] is not None and math.isfinite(float(e['homeLocationAdvantagePoints'])))
        for e in estimates
    )
    if acceptance['requireFinite32Team2026Registry'] and not registry_finite:
        fail(f'2026 registry failed: teams={len(teams)} estimates={len(estimates)}')

    protected_after = {
        'currentNumbers': file_sha(numbers),
        'personnelLedger': file_sha(personnel),
        'powerRatings': file_sha(POWER),
        'playerValueRegistry': file_sha(REGISTRY),
    }
    if protected_after != protected_before:
        fail('protected live artifact changed during H2')

    final_domestic = sum(1 for r in final_rows if is_home_location(r.get('location')))
    release = {
        'schema': 1,
        'releaseId': 'walters-nfl-home-field-2026-v1',
        'calibrationId': h2['calibrationId'],
        'h2Id': h2['h2Id'],
        'stage': 'H2',
        'state': acceptance['passState'],
        'season': season,
        'generatedAt': generated_at,
        'productionAuthority': False,
        'liveBoardMutationAllowed': False,
        'marketViewed': False,
        'trainingSeasons': train_seasons,
        'validationSeasons': valid_seasons,
        'refitSeasons': final_seasons,
        'sourceSnapshot': {
            **h2['sourceSnapshot'],
            **source_meta,
            'filteredSnapshotSha256': source_meta['filteredSha256'],
        },
        'fieldWhitelist': h2['sourceSnapshot']['fieldWhitelist'],
        'model': {
            'family': h2['model']['family'],
            'penalties': penalties,
            'finalGames': len(final_rows),
            'finalDomesticGames': final_domestic,
            'finalExcluded': dict(final_excluded),
            'finalResidualSigma': r3(final_fit['sigma']),
            '2026BaselineSourceSeasons': final_baseline_seasons,
            '2026BaselineSeasonDeviations': [r3(x) for x in final_baseline_devs],
        },
        'leagueBaselineHomeAdvantagePoints': r3(baseline_2026),
        'teamVenueEstimates': estimates,
        'visitorRoadEstimates': visitors,
        'venueClassifications': classifications,
        'uncertainty': {
            'method': h2['finalReleaseConstruction']['uncertainty']['method'],
            'formula': h2['finalReleaseConstruction']['uncertainty']['formula'],
            'newVenueFloor': h2['finalReleaseConstruction']['uncertainty']['newVenueFloor'],
            'residualSigma': r3(final_fit['sigma']),
        },
        'validationMetrics': round_metrics(audit['validation']),
        'protectedArtifactSha256': protected_after,
        'h3Authority': False,
        'h3Rule': 'H2 release is shadow-only. H3 must rebuild every active-week location term in shadow while preserving personnel/matchup overlays and carried ratings before any H4 production activation.',
    }
    write_json(RELEASE, release)
    current = {
        'schema': 1,
        'stage': 'H2',
        'state': acceptance['passState'],
        'season': season,
        'week': week,
        'updatedAt': generated_at,
        'productionAuthority': False,
        'liveBoardMutationAllowed': False,
        'marketViewed': False,
        'validationPass': True,
        'leagueBaselineHomeAdvantagePoints': r3(baseline_2026),
        'teamVenueEstimateCount': len(estimates),
        'unresolvedVenueCount': sum(1 for e in estimates if e['venueStatus'] == 'UNRESOLVED'),
        'newVenueCount': sum(1 for e in estimates if e['venueStatus'] == 'NEW_VENUE'),
        'releasePath': str(RELEASE.relative_to(ROOT)),
        'auditPath': str(AUDIT.relative_to(ROOT)),
        'snapshotPath': str(SNAPSHOT.relative_to(ROOT)),
        'nextGate': [
            'Run H3 active-week shadow acceptance across every current Week game.',
            'Classify neutral, international, relocated and shared-venue games explicitly before applying any shadow location term.',
            'Preserve personnelOverlayPointsToHomeSpread and every other governed non-HFA adjustment exactly.',
            'Do not mutate the live 1.5 domestic placeholder until an explicit H4 production activation passes.'
        ]
    }
    write_json(CURRENT, current)
    audit['protectedArtifactSha256After'] = protected_after
    audit['finalRelease'] = {
        'releasePath': str(RELEASE.relative_to(ROOT)),
        'leagueBaselineHomeAdvantagePoints': r3(baseline_2026),
        'teamVenueEstimateCount': len(estimates),
        'unresolvedVenueCount': current['unresolvedVenueCount'],
        'newVenueCount': current['newVenueCount'],
    }
    write_json(AUDIT, audit)
    print(
        f'WALTERS HOME FIELD H2: PASS // 2021-24 TRAIN + 2025 HOLDOUT // '
        f'LEAGUE 2026 HFA {baseline_2026:.3f} // 32-TEAM REGISTRY // '
        f'MAE DELTA {candidate_eval["domestic"]["mae"] - league_eval["domestic"]["mae"]:+.3f} // '
        f'MARKET ISOLATED // 0 LIVE MOVES'
    )
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
