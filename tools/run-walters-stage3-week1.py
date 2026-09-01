#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path('data/walters/nfl')
INPUT = ROOT / 'stage3/week-01-personnel-acceptance-input.json'
STAGE2 = ROOT / 'player-values/stage2-current.json'
REGISTRY = ROOT / 'player-values/player-values-2026-v1.json'
BOARD = ROOT / '2026/week-01-current-numbers.json'
OUT = ROOT / 'stage3/week-01-personnel-acceptance-result.json'
CURRENT = ROOT / 'stage3/stage3-current.json'


def read(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path: Path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def sha(obj) -> str:
    return hashlib.sha256(json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()


def half_point(v: float) -> float:
    return round(v * 2) / 2


def main():
    now = datetime.now(ZoneInfo('America/Vancouver')).isoformat(timespec='seconds')
    inp = read(INPUT)
    s2 = read(STAGE2)
    registry = read(REGISTRY)
    board = read(BOARD)

    if not s2.get('auditPass') or s2.get('productionAuthority') or s2.get('stage3Authority'):
        raise RuntimeError('STAGE2_NOT_VALIDATED_ISOLATED')
    if inp.get('mode') != 'SHADOW_ONLY' or inp.get('marketViewed') is not False:
        raise RuntimeError('STAGE3_INPUT_NOT_SHADOW_ISOLATED')
    if registry.get('operationalAuthority') is not False or registry.get('marketViewed') is not False:
        raise RuntimeError('REGISTRY_OPERATIONAL_OR_MARKET_CONTAMINATED')

    players = {}
    for p in registry['players']:
        players.setdefault(p['player'], []).append(p)
    games = {g['gameKey']: g for g in board['games']}

    def resolve_player(name: str, team: str | None = None):
        matches = players.get(name, [])
        if team:
            team_matches = [p for p in matches if p.get('teamAbbr') == team]
            if team_matches:
                matches = team_matches
        if len(matches) != 1:
            raise RuntimeError(f'PLAYER_LOOKUP_AMBIGUOUS:{name}:{len(matches)}')
        return matches[0]

    results = []
    numeric = 0
    fail_closed = 0
    for case in inp['cases']:
        game = games.get(case['gameKey'])
        if not game:
            raise RuntimeError(f'MISSING_GAME:{case["gameKey"]}')
        prior = float(game['grahamFairHome'])
        player = resolve_player(case['player'], case['team'])
        base = {
            'caseId': case['caseId'],
            'gameKey': case['gameKey'],
            'team': case['team'],
            'side': case['side'],
            'player': case['player'],
            'registryPosition': player.get('position'),
            'currentRole': case.get('currentRole'),
            'maddenOvr': player.get('maddenOvr'),
            'healthyWaltersPoints': player.get('waltersPoints'),
            'availabilityStatus': case.get('availabilityStatus'),
            'resolutionStatus': case['resolutionStatus'],
            'priorGrahamFairHome': prior,
            'sourceRefs': case.get('sourceRefs', []),
            'reason': case.get('reason')
        }
        if case['resolutionStatus'] == 'RESOLVED_ONE_FOR_ONE':
            replacement = resolve_player(case['replacementPlayer'])
            hv = float(player['waltersPoints'])
            rv = float(replacement['waltersPoints'])
            team_delta = round(rv - hv, 3)
            points_home = round(-team_delta if case['side'] == 'HOME' else team_delta, 3)
            exact = round(prior + points_home, 3)
            published = half_point(exact)
            base.update({
                'shadowStatus': 'NUMERIC_SHADOW_CALCULATED',
                'replacementPlayer': replacement['player'],
                'replacementRegistryTeam': replacement.get('teamAbbr'),
                'replacementRegistryPosition': replacement.get('position'),
                'replacementCurrentRole': case.get('replacementCurrentRole'),
                'replacementMaddenOvr': replacement.get('maddenOvr'),
                'replacementWaltersPoints': replacement.get('waltersPoints'),
                'teamContributionDelta': team_delta,
                'pointsToHomeSpread': points_home,
                'exactShadowGrahamFairHome': exact,
                'publishedShadowGrahamFairHome': published,
                'liveBoardChanged': False
            })
            numeric += 1
        else:
            candidate_values = []
            for name in case.get('replacementCandidates', []):
                try:
                    rp = resolve_player(name)
                    candidate_values.append({
                        'player': name,
                        'registryTeam': rp.get('teamAbbr'),
                        'registryPosition': rp.get('position'),
                        'maddenOvr': rp.get('maddenOvr'),
                        'waltersPoints': rp.get('waltersPoints')
                    })
                except Exception as exc:
                    candidate_values.append({'player': name, 'lookupStatus': 'NOT_UNIQUELY_RESOLVED', 'error': str(exc)})
            base.update({
                'shadowStatus': 'FAIL_CLOSED_NO_NUMERIC_MOVE',
                'failClosedCode': case.get('failClosedCode'),
                'replacementCandidates': candidate_values,
                'pointsToHomeSpread': None,
                'exactShadowGrahamFairHome': None,
                'publishedShadowGrahamFairHome': None,
                'liveBoardChanged': False
            })
            fail_closed += 1
        results.append(base)

    checks = [
        {'id': 'STAGE2_AUDIT_PASS', 'pass': s2.get('auditPass') is True},
        {'id': 'MARKET_ISOLATION', 'pass': inp.get('marketViewed') is False and registry.get('marketViewed') is False},
        {'id': 'AT_LEAST_ONE_NUMERIC_CASE', 'pass': numeric >= 1, 'actual': numeric},
        {'id': 'AT_LEAST_ONE_FAIL_CLOSED_CASE', 'pass': fail_closed >= 1, 'actual': fail_closed},
        {'id': 'UNRESOLVED_CASES_HAVE_NO_NUMERIC_MOVE', 'pass': all(r['pointsToHomeSpread'] is None for r in results if r['shadowStatus'].startswith('FAIL_CLOSED'))},
        {'id': 'LIVE_BOARD_UNCHANGED_BY_RUNNER', 'pass': all(r['liveBoardChanged'] is False for r in results)},
        {'id': 'PRODUCTION_AUTHORITY_REMAINS_FALSE', 'pass': s2.get('productionAuthority') is False}
    ]
    passed = all(x['pass'] for x in checks)
    result = {
        'schema': 1,
        'testId': inp['testId'],
        'state': 'PASS_SHADOW_ACCEPTANCE' if passed else 'FAIL_SHADOW_ACCEPTANCE',
        'generatedAt': now,
        'mode': 'SHADOW_ONLY',
        'season': 2026,
        'week': 1,
        'sourceStage2': str(STAGE2),
        'sourceRegistry': str(REGISTRY),
        'sourceBoard': str(BOARD),
        'marketViewed': False,
        'liveBoardMutation': False,
        'carriedRatingMutation': False,
        'numericShadowCaseCount': numeric,
        'failClosedCaseCount': fail_closed,
        'checks': checks,
        'cases': results,
        'stage4ActivationRecommended': passed,
        'stage4ActivationAutomatic': False,
        'productionAuthority': False,
        'note': 'Acceptance test only. Shadow fairs are diagnostic and must not be written into the live Graham Week 1 board until Stage 4 explicitly activates the personnel layer.'
    }
    result['contentSha256Canonical'] = sha(result)
    current = {
        'schema': 1,
        'stageId': 'walters-personnel-stage3-v1',
        'state': result['state'],
        'generatedAt': now,
        'resultPath': str(OUT),
        'resultCanonicalSha256': result['contentSha256Canonical'],
        'acceptancePass': passed,
        'stage4Authority': False,
        'productionAuthority': False,
        'marketViewed': False
    }
    write(OUT, result)
    write(CURRENT, current)
    print(f"WALTERS STAGE 3 // {result['state']} // NUMERIC {numeric} // FAIL-CLOSED {fail_closed} // PRODUCTION FALSE")
    for r in results:
        if r['shadowStatus'] == 'NUMERIC_SHADOW_CALCULATED':
            print(f"{r['caseId']}: {r['priorGrahamFairHome']} -> exact {r['exactShadowGrahamFairHome']} -> publish {r['publishedShadowGrahamFairHome']} // delta {r['pointsToHomeSpread']:+.3f}")
        else:
            print(f"{r['caseId']}: {r['shadowStatus']} // {r['failClosedCode']}")


if __name__ == '__main__':
    main()
