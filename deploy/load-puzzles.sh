#!/usr/bin/env bash
# Daily puzzle loader. Called by /etc/cron.d/anagramparty. Reads CRON_SECRET from the app's env file.
set -euo pipefail
SECRET=$(grep -E '^CRON_SECRET=' /opt/anagramparty/.env.production.local | cut -d= -f2-)
curl -fsS -H "Authorization: Bearer ${SECRET}" http://127.0.0.1:3010/api/cron/puzzles
echo
