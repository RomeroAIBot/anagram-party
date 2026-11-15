#!/usr/bin/env bash
# Pull the latest code, rebuild, and restart. Run as root: sudo /opt/anagramparty/deploy/deploy.sh
set -euo pipefail
cd /opt/anagramparty
sudo -u anagram git pull --ff-only
sudo -u anagram npm ci --no-audit --no-fund
sudo -u anagram npm run build
systemctl restart anagramparty
sleep 3
curl -fsS -o /dev/null -w "Site answered with HTTP %{http_code}\n" http://127.0.0.1:3010/
