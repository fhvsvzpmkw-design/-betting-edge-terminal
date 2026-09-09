#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path('data/walters/nfl')
MADDEN_ROOT = ROOT / 'madden27'
BASELINE_MANIFEST = MADDEN_ROOT / 'madden27-current.json'
PLAYER_ACCESS = ROOT / 'player-values' / 'player-values-access-v1.json'
OUTPUT = MADDEN_ROOT / 'week1-roster-audit-2026-09-08.json'
FREEZER = Path('tools/freeze-madden27-ea.py')


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8'))


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def load_freezer():
    spec = importlib.util.spec_from_file_location('madden27_freezer_shadow_source', FREEZER)
    if spec is None or spec.loader is None:
        raise RuntimeError('MADDEN_FREEZER_IMPORT_FAILED')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def slim(p: dict) -> dict:
    return {
        'eaPlayerId': str(p.get('eaPlayerId')),
        'player': p.get('fullName'),
        'teamName': p.get('teamName'),
        'teamAbbr': p.get('teamAbbr'),
        'teamStatus': p.get('teamStatus'),
        'position': p.get('position'),
        'rawPosition': p.get('rawPosition'),
        'overall': p.get('overall'),
    }


def change_record(old: dict, new: dict, fields: list[str]) -> dict:
    return {
        'eaPlayerId': str(new.get('eaPlayerId')),
        'player': new.get('fullName') or old.get('fullName'),
        'changes': {
            field: {'baseline': old.get(field), 'current': new.get(field)}
            for field in fields
            if old.get(field) != new.get(field)
        },
    }


def main() -> None:
    now = datetime.now(ZoneInfo('America/Vancouver')).isoformat(timespec='seconds')
    baseline_manifest = read_json(BASELINE_MANIFEST)
    if baseline_manifest.get('schema') != 1 or baseline_manifest.get('state') != 'FROZEN_STAGE_1':
        raise RuntimeError('BASELINE_MADDEN_MANIFEST_NOT_FROZEN')
    if baseline_manifest.get('sourceAuthority') != 'EA_OFFICIAL_MADDEN_NFL_27':
        raise RuntimeError('BASELINE_MADDEN_SOURCE_AUTHORITY_INVALID')
    if baseline_manifest.get('normalizationAuditStatus') != 'PASS':
        raise RuntimeError('BASELINE_MADDEN_NORMALIZATION_NOT_PASS')

    access = read_json(PLAYER_ACCESS)
    if access.get('state') != 'ACTIVE' or int(access.get('recordCount', -1)) != int(baseline_manifest['officialPlayerCount']):
        raise RuntimeError('PLAYER_VALUE_ACCESS_BASELINE_COUNT_MISMATCH')

    baseline_path = MADDEN_ROOT / baseline_manifest['normalizedPath']
    baseline_doc = read_json(baseline_path)
    baseline_players = baseline_doc.get('players') or []
    if len(baseline_players) != int(baseline_manifest['officialPlayerCount']):
        raise RuntimeError('BASELINE_NORMALIZED_PLAYER_COUNT_MISMATCH')

    freezer = load_freezer()
    build_id, current_total, raw_players = freezer.fetch_ea_players()
    current_players = [freezer.normalize_player(p) for p in raw_players]
    audit = freezer.normalization_audit(current_players)

    baseline = {str(p['eaPlayerId']): p for p in baseline_players}
    current = {str(p['eaPlayerId']): p for p in current_players}
    baseline_ids = set(baseline)
    current_ids = set(current)
    new_ids = current_ids - baseline_ids
    removed_ids = baseline_ids - current_ids
    shared_ids = baseline_ids & current_ids

    new_players = [slim(current[pid]) for pid in new_ids]
    removed_players = [slim(baseline[pid]) for pid in removed_ids]
    new_active = [p for p in new_players if p.get('teamStatus') == 'NFL_TEAM']
    new_calibratable_active = [
        p for p in new_active
        if p.get('position') not in {'K', 'P', 'LS', 'UNKNOWN', None}
    ]

    team_changes = []
    position_changes = []
    overall_changes = []
    identity_fields = ['teamName', 'teamAbbr', 'teamStatus']
    for pid in shared_ids:
        old = baseline[pid]
        new = current[pid]
        if any(old.get(f) != new.get(f) for f in identity_fields):
            team_changes.append(change_record(old, new, identity_fields))
        if old.get('position') != new.get('position') or old.get('rawPosition') != new.get('rawPosition'):
            position_changes.append(change_record(old, new, ['position', 'rawPosition']))
        if old.get('overall') != new.get('overall'):
            overall_changes.append(change_record(old, new, ['overall']))

    new_players.sort(key=lambda p: (p.get('teamAbbr') or 'ZZZ', -(int(p.get('overall') or 0)), p.get('player') or ''))
    removed_players.sort(key=lambda p: (p.get('teamAbbr') or 'ZZZ', -(int(p.get('overall') or 0)), p.get('player') or ''))
    new_active.sort(key=lambda p: (-(int(p.get('overall') or 0)), p.get('teamAbbr') or '', p.get('player') or ''))
    new_calibratable_active.sort(key=lambda p: (-(int(p.get('overall') or 0)), p.get('teamAbbr') or '', p.get('player') or ''))
    team_changes.sort(key=lambda p: p.get('player') or '')
    position_changes.sort(key=lambda p: p.get('player') or '')
    overall_changes.sort(key=lambda p: p.get('player') or '')

    donald = [p for p in new_players if (p.get('player') or '').strip().lower() == 'aaron donald']
    priority = [p for p in new_calibratable_active if int(p.get('overall') or 0) >= 80]
    for p in donald:
        if not any(x.get('eaPlayerId') == p.get('eaPlayerId') for x in priority):
            priority.append(p)
    priority.sort(key=lambda p: (-(int(p.get('overall') or 0)), p.get('player') or ''))

    state = 'SHADOW_COMPLETE' if audit.get('status') == 'PASS' else 'SHADOW_REVIEW_REQUIRED'
    report = {
        'schema': 1,
        'auditId': 'madden27-week1-roster-audit-2026-09-08',
        'state': state,
        'capturedAt': now,
        'purpose': 'Post-preseason Week 1 population reconciliation only. Detect roster/population churn without rebasing or mutating any frozen Walters player value or Graham number.',
        'sourceAuthority': 'EA_OFFICIAL_MADDEN_NFL_27',
        'sourceUrl': baseline_manifest['sourceUrl'],
        'marketViewed': False,
        'safety': {
            'shadowOnly': True,
            'madden27CurrentMutated': False,
            'playerValueRegistryMutated': False,
            'playerValueShardsMutated': False,
            'grahamNumbersMutated': False,
            'existingFrozenOvrChangesApplied': False,
            'existingWaltersValuesRebased': False,
            'removalsDeleteFrozenValues': False,
            'teamChangesMoveFrozenValuesAutomatically': False,
        },
        'baseline': {
            'manifestPath': str(BASELINE_MANIFEST),
            'capturedAt': baseline_manifest['capturedAt'],
            'eaBuildId': baseline_manifest['eaBuildId'],
            'officialPlayerCount': int(baseline_manifest['officialPlayerCount']),
            'normalizedPath': baseline_manifest['normalizedPath'],
            'normalizedCanonicalSha256': baseline_manifest['normalizedCanonicalSha256'],
            'playerValueAccessPath': str(PLAYER_ACCESS),
            'playerValueRecordCount': int(access['recordCount']),
            'playerValueRegistryCanonicalSha256': access['sourceRegistryCanonicalSha256'],
        },
        'currentShadow': {
            'eaBuildId': build_id,
            'officialPlayerCount': int(current_total),
            'normalizationAudit': audit,
        },
        'counts': {
            'baselinePlayers': len(baseline_ids),
            'currentPlayers': len(current_ids),
            'netPopulationChange': len(current_ids) - len(baseline_ids),
            'newPlayers': len(new_players),
            'newActiveTeamPlayers': len(new_active),
            'newCalibratableActiveTeamPlayers': len(new_calibratable_active),
            'removedPlayers': len(removed_players),
            'sharedPlayers': len(shared_ids),
            'teamAssignmentChanges': len(team_changes),
            'positionChanges': len(position_changes),
            'overallChangesIgnoredForFrozenValues': len(overall_changes),
            'priorityOnboardingCandidates': len(priority),
        },
        'aaronDonald': {
            'presentInCurrentEa': bool(donald),
            'records': donald,
            'action': 'GOVERNED_SUPPLEMENTAL_ONBOARDING_CANDIDATE' if donald else 'REMAINS_MISSING_FROM_EA_CURRENT',
        },
        'priorityOnboardingCandidates': priority,
        'newActiveTeamPlayers': new_active,
        'newPlayersAllStatuses': new_players,
        'removedPlayersPreserveFrozenHistory': removed_players,
        'teamAssignmentChangesInformationalOnly': team_changes,
        'positionChangesReviewRequiredBeforeAnyNewCase': position_changes,
        'overallChangesFrozenAndIgnored': overall_changes,
        'governance': {
            'existingPlayerRule': 'Preserve the first verified 2026 OVR and Walters value. Current EA OVR/team churn does not silently alter the frozen registry.',
            'newPlayerRule': 'Only a player absent from the frozen registry may be considered for first-time governed supplemental onboarding, with current NFL roster/role evidence verified separately.',
            'rosterAuthorityRule': 'EA is a ranking input, not roster/depth authority. NFL/team sources must establish actual active status and role before personnel use.',
            'removalRule': 'Do not delete a frozen player because the current EA population no longer contains that player; preserve historical provenance.',
            'numericMutationRule': 'This audit has no authority to calculate personnel deltas, update the live registry, or change a Graham fair.',
        },
        'recommendedNextStep': 'Review new calibratable active-team players. Create a separate governed supplemental-onboarding transaction only for verified active players missing from the frozen registry; prioritize Aaron Donald and other high-value Week 1 contributors. Do not rebuild Stage 2 wholesale.',
    }
    write_json(OUTPUT, report)
    print(f"MADDEN WEEK1 SHADOW AUDIT: {state} // BASE {len(baseline_ids)} // CURRENT {len(current_ids)} // NEW ACTIVE {len(new_active)} // REMOVED {len(removed_players)} // TEAM CHANGES {len(team_changes)} // OVR CHANGES FROZEN {len(overall_changes)}")
    if donald:
        d = donald[0]
        print(f"AARON DONALD: PRESENT CURRENT EA // {d.get('teamAbbr')} // {d.get('position')} // OVR {d.get('overall')}")
    else:
        print('AARON DONALD: NOT PRESENT CURRENT EA')


if __name__ == '__main__':
    main()
