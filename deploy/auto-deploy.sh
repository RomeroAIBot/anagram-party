#!/usr/bin/env bash
# Runs every 2 minutes from anagramparty-autodeploy.timer. Deploys only when GitHub has new commits.
set -uo pipefail
REPO=/opt/anagramparty
cd "$REPO" || exit 1
sudo -u anagram git fetch -q origin main || exit 0
LOCAL=$(sudo -u anagram git rev-parse HEAD)
REMOTE=$(sudo -u anagram git rev-parse origin/main)
LIVE_SHA=$(basename "$(readlink -f /opt/anagramparty-live 2>/dev/null)" 2>/dev/null)
if [ "$LOCAL" = "$REMOTE" ] && [ "$LIVE_SHA" = "$(sudo -u anagram git rev-parse --short "$REMOTE")" ]; then
  exit 0
fi
exec "$REPO/deploy/deploy.sh"
