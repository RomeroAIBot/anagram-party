#!/usr/bin/env bash
# Saves the Supabase secret key into the app's settings file without showing it, then restarts the app.
# Run as root: bash /opt/anagramparty/deploy/set-secret.sh
set -uo pipefail
ENV=/opt/anagramparty/.env.production.local
read -rs -p 'Paste the Supabase secret key, then press Enter: ' SK
echo
SK="$(printf '%s' "$SK" | tr -d '[:space:]')"
if [[ $SK == sb_secret_* || $SK == eyJ* ]] && (( ${#SK} >= 30 )); then
  sed -i '/^SUPABASE_SERVICE_ROLE_KEY=/d' "$ENV"
  echo "SUPABASE_SERVICE_ROLE_KEY=$SK" >> "$ENV"
  chown anagram:anagram "$ENV"; chmod 600 "$ENV"
  echo "Key saved. It is ${#SK} characters long."
  systemctl restart anagramparty && echo "Anagram Party restarted."
else
  echo "That doesn't look like the secret key (got ${#SK} characters). Nothing was saved. Copy the key that starts with sb_secret_ and run this again."
fi
unset SK
