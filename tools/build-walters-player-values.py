#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import mean
from zoneinfo import ZoneInfo

ROOT = Path('data/walters/nfl')
MADDEN_ROOT = ROOT / 'madden27'
CAL_PATH = ROOT / 'personnel-calibration-v1.json'
OUT_ROOT = ROOT / 'player-values'


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def canonical_sha(obj) -> str:
    raw = json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def in_range(value: float, bounds: list[float]) -> bool:
    return float(bounds[0]) <= float(value) <= float(bounds[1])


def band_value(bands: list[dict], ovr: int) -> float:
    for band in bands:
        if int(band['ovrMin']) <= int(ovr) <= int(band['ovrMax']):
            return float(band['points'])
    raise RuntimeError(f'OVR_OUTSIDE_CALIBRATION_BANDS:{ovr}')


def percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return 0.0
    idx = (len(sorted_values) - 1) * p
    lo = int(idx)
    hi = min(lo + 1, len(sorted_values) - 1)
    frac = idx - lo
    return sorted_values[lo] * (1 - frac) + sorted_values[hi] * frac


def summarize_values(records: list[dict]) -> dict:
    vals = [float(r['waltersPoints']) for r in records if r.get('waltersPoints') is not None]
    nonzero = [v for v in vals if v >= 0.10]
    meaningful = [v for v in vals if v > 0.25]
    ordered = sorted(vals)
    ovr_counts = Counter(int(r['maddenOvr']) for r in records if r.get('maddenOvr') is not None)
    return {
        'count': len(vals),
        'zeroOrBelow010Count': sum(1 for v in vals if v < 0.10),
        'nonZeroAtLeast010Count': len(nonzero),
        'nonZeroAtLeast010Share': round(len(nonzero) / len(vals), 6) if vals else 0,
        'meaningfulOver025Count': len(meaningful),
        'meaningfulOver025Share': round(len(meaningful) / len(vals), 6) if vals else 0,
        'meanAll': round(mean(vals), 6) if vals else 0,
        'meanNonZeroAtLeast010': round(mean(nonzero), 6) if nonzero else 0,
        'minimum': min(vals) if vals else None,
        'maximum': max(vals) if vals else None,
        'p50': round(percentile(ordered, 0.50), 3) if vals else None,
        'p75': round(percentile(ordered, 0.75), 3) if vals else None,
        'p90': round(percentile(ordered, 0.90), 3) if vals else None,
        'p95': round(percentile(ordered, 0.95), 3) if vals else None,
        'valueCounts': {str(k): v for k, v in sorted(Counter(vals).items(), key=lambda kv: float(kv[0]))},
        'maddenOvrCounts': {str(k): v for k, v in sorted(ovr_counts.items())},
    }


def top_n_per_team(records: list[dict], n: int) -> list[dict]:
    by_team: dict[str, list[dict]] = defaultdict(list)
    for r in records:
        if r.get('teamStatus') == 'NFL_TEAM' and r.get('teamAbbr'):
            by_team[r['teamAbbr']].append(r)
    selected = []
    for team, rows in sorted(by_team.items()):
        rows = sorted(rows, key=lambda r: (-int(r.get('maddenOvr') or 0), int(r['eaPlayerId']) if str(r['eaPlayerId']).isdigit() else str(r['eaPlayerId'])))
        selected.extend(rows[:n])
    return selected


def top_n_overall(records: list[dict], n: int) -> list[dict]:
    return sorted(records, key=lambda r: (-int(r.get('maddenOvr') or 0), int(r['eaPlayerId']) if str(r['eaPlayerId']).isdigit() else str(r['eaPlayerId'])))[:n]


def main() -> None:
    now = datetime.now(ZoneInfo('America/Vancouver')).isoformat(timespec='seconds')
    calibration = read_json(CAL_PATH)
    current = read_json(MADDEN_ROOT / 'madden27-current.json')
    if current.get('state') != 'FROZEN_STAGE_1':
        raise RuntimeError('MADDEN_STAGE_1_NOT_FROZEN')
    if current.get('sourceAuthority') != 'EA_OFFICIAL_MADDEN_NFL_27':
        raise RuntimeError('MADDEN_SOURCE_AUTHORITY_INVALID')
    if current.get('normalizationAuditStatus') != 'PASS':
        raise RuntimeError('MADDEN_NORMALIZATION_NOT_PASSED')
    normalized = read_json(MADDEN_ROOT / current['normalizedPath'])
    if len(normalized.get('players', [])) != int(current['officialPlayerCount']):
        raise RuntimeError('MADDEN_NORMALIZED_COUNT_MISMATCH')

    qb_positions = set(calibration['qbConversion']['eligiblePositions'])
    non_qb_positions = set(calibration['nonQbConversion']['eligiblePositions'])
    records = []
    unknown = []
    for p in normalized['players']:
        position = str(p.get('position') or '')
        ovr = p.get('overall')
        status = 'CALIBRATED'
        curve = None
        points = None
        if position in qb_positions:
            curve = 'QB'
            points = band_value(calibration['qbConversion']['bands'], int(ovr))
        elif position in non_qb_positions:
            curve = 'NON_QB'
            points = band_value(calibration['nonQbConversion']['bands'], int(ovr))
        elif position in {'K', 'P', 'LS'}:
            status = 'INELIGIBLE_SPECIALIST_REVIEW_REQUIRED'
        else:
            status = 'UNMAPPED_CALIBRATION_POSITION'
            unknown.append({'eaPlayerId': p['eaPlayerId'], 'player': p['fullName'], 'position': position})
        records.append({
            'eaPlayerId': p['eaPlayerId'],
            'player': p['fullName'],
            'teamName': p.get('teamName'),
            'teamAbbr': p.get('teamAbbr'),
            'teamStatus': p.get('teamStatus'),
            'position': position,
            'rawPosition': p.get('rawPosition'),
            'maddenOvr': int(ovr) if ovr is not None else None,
            'waltersPoints': points,
            'curve': curve,
            'valueStatus': status,
            'rankingCapturedAt': current['capturedAt'],
            'rankingSource': current['sourceUrl'],
            'calibrationId': calibration['calibrationId'],
        })
    if unknown:
        raise RuntimeError(f'UNMAPPED_CALIBRATION_POSITIONS:{unknown[:10]}')

    calibrated_nfl = [r for r in records if r['teamStatus'] == 'NFL_TEAM' and r['valueStatus'] == 'CALIBRATED']
    non_qb_nfl = [r for r in calibrated_nfl if r['curve'] == 'NON_QB']
    qb_nfl = [r for r in calibrated_nfl if r['curve'] == 'QB']

    # Source-locked audit population:
    # p.250 says approximately 1,700 active-roster players; 32 x 53 = 1,696.
    # We therefore use an OVR-ranked top-53-per-team statistical cohort ONLY to calibrate
    # the distribution. It is not a roster/depth authority and never selects replacements.
    # p.254 explicitly says Walters had 67 ranked QBs, so QB distribution is audited on the
    # top 67 Madden-ranked QBs. Stage 3 will replace these statistical cohorts with verified
    # current roster/depth roles for actual injury calculations.
    top53 = top_n_per_team(calibrated_nfl, 53)
    top53_non_qb = [r for r in top53 if r['curve'] == 'NON_QB']
    top67_qb = top_n_overall(qb_nfl, 67)
    non_qb_summary = summarize_values(top53_non_qb)
    qb_summary = summarize_values(top67_qb)

    top46 = top_n_per_team(calibrated_nfl, 46)
    top46_non_qb = [r for r in top46 if r['curve'] == 'NON_QB']
    all_non_qb_summary = summarize_values(non_qb_nfl)
    all_qb_summary = summarize_values(qb_nfl)

    nq_guard = calibration['nonQbConversion']['distributionAudit']
    qb_guard = calibration['qbConversion']['distributionAudit']
    targets = calibration['sourceAuthority']['waltersReferenceTargets']
    checks = [
        {
            'id': 'ACTIVE_ROSTER_SCALE_COUNT',
            'actual': len(top53),
            'expected': 1696,
            'pass': len(top53) == 1696,
        },
        {
            'id': 'NON_QB_NONZERO_AT_LEAST_010_SHARE',
            'actual': non_qb_summary['nonZeroAtLeast010Share'],
            'expected': nq_guard['expectedNonZeroShareRange'],
            'pass': in_range(non_qb_summary['nonZeroAtLeast010Share'], nq_guard['expectedNonZeroShareRange']),
        },
        {
            'id': 'NON_QB_MEANINGFUL_SHARE',
            'actual': non_qb_summary['meaningfulOver025Share'],
            'expected': nq_guard['expectedMeaningfulOver025ShareRange'],
            'pass': in_range(non_qb_summary['meaningfulOver025Share'], nq_guard['expectedMeaningfulOver025ShareRange']),
        },
        {
            'id': 'NON_QB_NONZERO_AVERAGE',
            'actual': non_qb_summary['meanNonZeroAtLeast010'],
            'expected': nq_guard['expectedNonZeroAverageRange'],
            'pass': in_range(non_qb_summary['meanNonZeroAtLeast010'], nq_guard['expectedNonZeroAverageRange']),
        },
        {
            'id': 'NON_QB_ELITE_CEILING',
            'actual': non_qb_summary['maximum'],
            'expected': targets['nonQbBestTypicalRange'],
            'pass': in_range(non_qb_summary['maximum'], targets['nonQbBestTypicalRange']),
        },
        {
            'id': 'QB_RANKED_COUNT',
            'actual': len(top67_qb),
            'expected': 67,
            'pass': len(top67_qb) == 67,
        },
        {
            'id': 'QB_MINIMUM',
            'actual': qb_summary['minimum'],
            'expected': targets['qbMinimum'],
            'pass': qb_summary['minimum'] == float(targets['qbMinimum']),
        },
        {
            'id': 'QB_MAXIMUM',
            'actual': qb_summary['maximum'],
            'expected': targets['qbMaximum'],
            'pass': qb_summary['maximum'] == float(targets['qbMaximum']),
        },
        {
            'id': 'QB_MEAN',
            'actual': qb_summary['meanAll'],
            'expected': qb_guard['expectedMeanRange'],
            'pass': in_range(qb_summary['meanAll'], qb_guard['expectedMeanRange']),
        },
    ]
    audit_pass = all(c['pass'] for c in checks)

    registry = {
        'schema': 1,
        'registryId': 'graham-walters-player-values-2026-v1',
        'state': 'STAGE_2_VALIDATED' if audit_pass else 'STAGE_2_RECALIBRATION_REQUIRED',
        'generatedAt': now,
        'sourceDataset': current['normalizedPath'],
        'sourceDatasetCanonicalSha256': current['normalizedCanonicalSha256'],
        'sourceAuthority': current['sourceAuthority'],
        'rankingCapturedAt': current['capturedAt'],
        'calibrationId': calibration['calibrationId'],
        'calibrationPath': str(CAL_PATH),
        'marketViewed': False,
        'operationalAuthority': False,
        'note': 'Stage 2 player-value registry. Values remain non-operational until Stage 3 acceptance testing and explicit production activation.',
        'players': records,
    }
    registry_sha = canonical_sha(registry)
    registry['contentSha256Canonical'] = registry_sha

    audit = {
        'schema': 1,
        'auditId': 'graham-walters-player-value-distribution-audit-v1',
        'state': 'PASS' if audit_pass else 'FAIL_RECALIBRATION_REQUIRED',
        'generatedAt': now,
        'calibrationId': calibration['calibrationId'],
        'sourceDataset': current['normalizedPath'],
        'sourcePlayerCount': len(records),
        'calibratedNflTeamPlayerCount': len(calibrated_nfl),
        'specialistReviewCount': sum(1 for r in records if r['valueStatus'] == 'INELIGIBLE_SPECIALIST_REVIEW_REQUIRED'),
        'sourceLockedAuditCohorts': {
            'nonQb': {
                'definition': 'Non-QBs inside a 32 x 53 OVR-ranked statistical roster-scale cohort (1,696 total players), matching Walters p.250 approximately 1,700 active-roster scale. Calibration-only; not roster/depth authority.',
                **non_qb_summary,
            },
            'qb': {
                'definition': 'Top 67 current NFL-team QBs by locked Madden OVR, matching Walters p.254 explicit 67 ranked-quarterback database size. Calibration-only; not starter/depth authority.',
                **qb_summary,
            },
        },
        'diagnosticCohorts': {
            'allEaAssignedNonQb': all_non_qb_summary,
            'allEaAssignedQb': all_qb_summary,
            'top46PerTeamNonQbNotRosterAuthority': summarize_values(top46_non_qb),
        },
        'waltersReferenceTargets': {
            **targets,
            'sourceExactNonQbAtLeast010Count': 991,
            'sourceExactNonQbMeaningfulOver025Count': 612,
            'sourceExactRankedQbCount': 67,
            'sourceApproxActiveRosterPlayers': 1700,
        },
        'checks': checks,
        'pass': audit_pass,
        'failureAction': None if audit_pass else 'DO_NOT_ACTIVATE_PLAYER_VALUES; recalibrate conversion bands and rerun Stage 2.',
        'marketViewed': False,
    }
    audit_sha = canonical_sha(audit)
    audit['contentSha256Canonical'] = audit_sha

    current_stage2 = {
        'schema': 1,
        'stageId': 'walters-player-values-stage-2-v1',
        'state': 'VALIDATED_NON_OPERATIONAL' if audit_pass else 'RECALIBRATION_REQUIRED',
        'generatedAt': now,
        'sourceMaddenManifest': 'data/walters/nfl/madden27/madden27-current.json',
        'sourceMaddenNormalizedSha256': current['normalizedCanonicalSha256'],
        'calibrationPath': str(CAL_PATH),
        'calibrationId': calibration['calibrationId'],
        'registryPath': 'data/walters/nfl/player-values/player-values-2026-v1.json',
        'registryCanonicalSha256': registry_sha,
        'auditPath': 'data/walters/nfl/player-values/calibration-audit-v1.json',
        'auditCanonicalSha256': audit_sha,
        'auditPass': audit_pass,
        'stage3Authority': False,
        'productionAuthority': False,
        'marketViewed': False,
    }

    write_json(OUT_ROOT / 'player-values-2026-v1.json', registry)
    write_json(OUT_ROOT / 'calibration-audit-v1.json', audit)
    write_json(OUT_ROOT / 'stage2-current.json', current_stage2)

    print(f"WALTERS STAGE 2 BUILD // {len(records)} RECORDS // {len(calibrated_nfl)} NFL CALIBRATED // SOURCE COHORT {len(top53)} // QB COHORT {len(top67_qb)}")
    print(f"NON-QB SOURCE COHORT // N={non_qb_summary['count']} // >=.10 {non_qb_summary['nonZeroAtLeast010Share']:.4f} // >.25 {non_qb_summary['meaningfulOver025Share']:.4f} // >=.10 AVG {non_qb_summary['meanNonZeroAtLeast010']:.4f} // MAX {non_qb_summary['maximum']}")
    print(f"QB SOURCE COHORT // N={qb_summary['count']} // MEAN {qb_summary['meanAll']:.4f} // MIN {qb_summary['minimum']} // MAX {qb_summary['maximum']}")
    print('NON-QB OVR HISTOGRAM // ' + json.dumps(non_qb_summary['maddenOvrCounts'], sort_keys=True))
    print('QB OVR HISTOGRAM // ' + json.dumps(qb_summary['maddenOvrCounts'], sort_keys=True))
    for check in checks:
        print(f"CHECK {check['id']}: {'PASS' if check['pass'] else 'FAIL'} // actual={check['actual']} expected={check['expected']}")
    print(f"STAGE 2 AUDIT: {'PASS' if audit_pass else 'FAIL_RECALIBRATION_REQUIRED'}")


if __name__ == '__main__':
    main()
