#!/usr/bin/env python3
"""Exercise a real non-fast-forward push without losing snapshots or remote metadata."""
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
REAL_GIT = shutil.which('git')


def run(*args, cwd, env=None):
    return subprocess.run(args, cwd=cwd, env=env, text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)


def git(cwd, *args):
    return run(REAL_GIT, *args, cwd=cwd).stdout.strip()


def identity(cwd):
    git(cwd, 'config', 'user.name', 'odds-history-test')
    git(cwd, 'config', 'user.email', 'test@example.invalid')


def feed(cwd, hour):
    (cwd / 'data/live-odds.json').write_text(json.dumps({
        'schema': 5, 'generatedAt': f'2026-10-19T{hour:02d}:00:00Z',
        'events': [{'id': f'event-{hour}'}], 'requestUsage': {'used': 77},
        'scheduleMeta': {'canonicalSlot': hour - 12},
    }) + '\n')


def rebuild(cwd):
    run(sys.executable, 'tools/odds-history-index.py', cwd=cwd)


def inject_remote(racer, indexed):
    feed(racer, 15)
    index = racer / 'data/history/odds-index.json'
    value = json.loads(index.read_text())
    value['concurrentWriter'] = 'must-survive'
    index.write_text(json.dumps(value) + '\n')
    git(racer, 'add', 'data')
    git(racer, 'commit', '-m', 'Concurrent odds snapshot and index metadata')
    if indexed:
        rebuild(racer)
        git(racer, 'add', 'data/history/odds-index.json')
        git(racer, 'commit', '-m', 'Concurrent index publication')
    git(racer, 'push', 'origin', 'HEAD:main')


class OddsHistoryCollision(unittest.TestCase):
    def test_remote_changes_survive_retry(self):
        for indexed in (False, True):
            with self.subTest(remote_already_indexed=indexed), tempfile.TemporaryDirectory() as temp:
                base = pathlib.Path(temp)
                seed, remote = base / 'seed', base / 'remote.git'
                seed.mkdir()
                git(seed, 'init', '--initial-branch=main')
                identity(seed)
                for directory in ('tools', 'data/history'):
                    (seed / directory).mkdir(parents=True, exist_ok=True)
                for name in ('odds-history-index.py', 'publish-odds-history-index.sh'):
                    shutil.copyfile(ROOT / 'tools' / name, seed / 'tools' / name)
                index_path = seed / 'data/history/odds-index.json'
                index_path.write_text(json.dumps({'schema': 1, 'entries': []}) + '\n')
                feed(seed, 13)
                git(seed, 'add', '.')
                git(seed, 'commit', '-m', 'Initial odds snapshot')
                rebuild(seed)
                original = json.loads(index_path.read_text())['entries'][0]
                git(seed, 'add', 'data/history/odds-index.json')
                git(seed, 'commit', '-m', 'Initial history index')
                git(seed, 'init', '--bare', '--initial-branch=main', str(remote))
                git(seed, 'remote', 'add', 'origin', str(remote))
                git(seed, 'push', '-u', 'origin', 'main')
                feed(seed, 14)
                git(seed, 'add', 'data/live-odds.json')
                git(seed, 'commit', '-m', 'First new odds snapshot')
                git(seed, 'push', 'origin', 'main')

                publisher, racer = base / 'publisher', base / 'racer'
                git(base, 'clone', str(remote), str(publisher))
                git(base, 'clone', str(remote), str(racer))
                identity(racer)
                wrapper_dir = base / 'bin'
                wrapper_dir.mkdir()
                marker = base / 'injected'
                wrapper = wrapper_dir / 'git'
                wrapper.write_text(
                    '#!' + sys.executable + '\n'
                    'import os, pathlib, subprocess, sys\n'
                    'marker = pathlib.Path(os.environ["ODDS_TEST_MARKER"])\n'
                    'if len(sys.argv)>1 and sys.argv[1]=="push" and not marker.exists():\n'
                    '    marker.touch()\n'
                    '    subprocess.run([sys.executable, os.environ["ODDS_TEST_DRIVER"], "--inject",\n'
                    '                    os.environ["ODDS_TEST_RACER"], os.environ["ODDS_TEST_INDEXED"]], check=True)\n'
                    'os.execv(os.environ["ODDS_TEST_REAL_GIT"], [os.environ["ODDS_TEST_REAL_GIT"], *sys.argv[1:]])\n'
                )
                wrapper.chmod(0o755)
                env = {**os.environ, 'PATH': str(wrapper_dir) + os.pathsep + os.environ['PATH'],
                       'ODDS_TEST_MARKER': str(marker), 'ODDS_TEST_DRIVER': str(pathlib.Path(__file__).resolve()),
                       'ODDS_TEST_RACER': str(racer), 'ODDS_TEST_INDEXED': str(int(indexed)),
                       'ODDS_TEST_REAL_GIT': REAL_GIT}
                result = run('bash', 'tools/publish-odds-history-index.sh', cwd=publisher, env=env)
                self.assertTrue(marker.exists(), 'collision was injected at the actual first push')
                self.assertIn('push collision on attempt 1', result.stdout)
                git(racer, 'pull', '--ff-only', 'origin', 'main')
                final = json.loads((racer / 'data/history/odds-index.json').read_text())
                self.assertEqual(final['concurrentWriter'], 'must-survive')
                self.assertEqual(final['entries'][0], original, 'prior exact snapshot entry remains unchanged')
                self.assertEqual([e['generatedAt'] for e in final['entries']],
                                 [f'2026-10-19T{hour}:00:00Z' for hour in (13, 14, 15)])
                self.assertEqual(len({e['snapshotBlobSha'] for e in final['entries']}), 3)
                for entry in final['entries']:
                    self.assertEqual(git(racer, 'rev-parse', entry['snapshotCommitSha'] + ':data/live-odds.json'),
                                     entry['snapshotBlobSha'])
                before = git(publisher, 'rev-parse', 'HEAD')
                repeat = run('bash', 'tools/publish-odds-history-index.sh', cwd=publisher)
                self.assertIn('No odds history index changes', repeat.stdout)
                self.assertEqual(git(publisher, 'rev-parse', 'HEAD'), before, 'repeat is idempotent')


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--inject':
        inject_remote(pathlib.Path(sys.argv[2]), bool(int(sys.argv[3])))
    else:
        unittest.main()
