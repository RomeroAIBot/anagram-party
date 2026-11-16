#!/usr/bin/env bash
# One-time setup on the server (run as root): switches to release folders and turns on auto-deploy.
set -euo pipefail
cd /opt/anagramparty
cp deploy/anagramparty.service /etc/systemd/system/anagramparty.service
cp deploy/anagramparty-autodeploy.service deploy/anagramparty-autodeploy.timer /etc/systemd/system/
systemctl daemon-reload
/opt/anagramparty/deploy/deploy.sh
systemctl enable --now anagramparty-autodeploy.timer
rm -rf /opt/anagramparty/.next /opt/anagramparty/node_modules
echo "AUTODEPLOY_READY"
