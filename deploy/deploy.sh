#!/usr/bin/env bash
# Builds the latest code from GitHub into its own release folder, then switches the live site to it.
# If the new release doesn't answer, it switches back to the previous one. Run as root.
# Manual use: sudo /opt/anagramparty/deploy/deploy.sh
set -euo pipefail
REPO=/opt/anagramparty
RELEASES=/opt/anagramparty-releases
LIVE=/opt/anagramparty-live
ENVFILE=$REPO/.env.production.local
LOCK=/run/anagramparty-deploy.lock

exec 9>"$LOCK"
flock -n 9 || { echo "Another deploy is running."; exit 0; }

cd "$REPO"
sudo -u anagram git fetch -q origin main
sudo -u anagram git reset -q --hard origin/main
SHA=$(sudo -u anagram git rev-parse --short HEAD)
DIR=$RELEASES/$SHA
echo "$(date -u +%FT%TZ) Deploying $SHA: $(sudo -u anagram git log -1 --format=%s)"

mkdir -p "$RELEASES"
if [ ! -f "$DIR/.build-ok" ]; then
  rm -rf "$DIR"
  install -d -o anagram -g anagram "$DIR"
  sudo -u anagram git archive HEAD | sudo -u anagram tar -x -C "$DIR"
  sudo -u anagram ln -sf "$ENVFILE" "$DIR/.env.production.local"
  sudo -u anagram bash -c "cd '$DIR' && npm ci --no-audit --no-fund --loglevel=error && NEXT_TELEMETRY_DISABLED=1 npm run build"
  touch "$DIR/.build-ok"
fi

PREV=$(readlink -f "$LIVE" 2>/dev/null || true)
ln -sfn "$DIR" "$LIVE.new" && mv -Tf "$LIVE.new" "$LIVE"
systemctl restart anagramparty

for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3010/; then
    echo "Live on $SHA."
    # Keep the live release plus the two most recent others.
    ls -1dt "$RELEASES"/*/ 2>/dev/null | sed 's:/$::' | grep -vx "$DIR" | tail -n +3 | xargs -r rm -rf
    exit 0
  fi
  sleep 2
done

echo "New release did not answer. Rolling back."
if [ -n "$PREV" ] && [ -d "$PREV" ] && [ "$PREV" != "$DIR" ]; then
  ln -sfn "$PREV" "$LIVE.new" && mv -Tf "$LIVE.new" "$LIVE"
  systemctl restart anagramparty
  echo "Rolled back to $(basename "$PREV")."
fi
exit 1
