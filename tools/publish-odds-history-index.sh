#!/usr/bin/env bash
# Rebuild from the remote index on every attempt so concurrent entries survive.
set -euo pipefail
git config user.name "betting-edge-bot"
git config user.email "actions@users.noreply.github.com"

for attempt in 1 2 3 4; do
  git fetch origin main
  git reset --hard origin/main
  python tools/odds-history-index.py
  git add -- data/history/odds-index.json
  if git diff --cached --quiet; then
    echo "No odds history index changes to publish."
    exit 0
  fi
  git commit -m "Index Betting Edge odds snapshot"
  if git push origin HEAD:main; then
    echo "Odds history index published on attempt $attempt."
    exit 0
  fi
  echo "Odds history push collision on attempt $attempt; rebuilding from latest main."
done

echo "Odds history index could not be published after 4 attempts." >&2
exit 1

