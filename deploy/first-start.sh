#!/usr/bin/env bash
set -euo pipefail
cd /opt/batusmtg
docker --version
docker compose version
if [[ ! -f .env.production ]]; then
  read -r -p 'Spiel-Domain ohne https:// [batusmtg.de]: ' game_domain
  game_domain=${game_domain:-batusmtg.de}
  [[ "$game_domain" =~ ^[a-zA-Z0-9.-]+$ ]] || { echo 'Ungültige Domain'; exit 1; }
  if ! getent ahostsv4 "$game_domain" | awk '{print $1}' | grep -Fxq '2.29.40.106'; then
    echo 'Die Domain zeigt noch nicht auf 2.29.40.106. Erst Registrierung und DNS abschließen, dann erneut starten.'
    exit 1
  fi
  read -r -s -p 'Discord Client Secret einfügen (unsichtbar): ' discord_secret
  printf '\n'
  [[ "$discord_secret" =~ ^[a-zA-Z0-9._-]{20,}$ ]] || { echo 'Secret fehlt oder hat ein unerwartetes Format'; exit 1; }
  umask 077
  printf 'DOMAIN=%s\nDISCORD_CLIENT_ID=1556377736157855896\nDISCORD_CLIENT_SECRET=%s\n' "$game_domain" "$discord_secret" > .env.production
  unset discord_secret
  chmod 600 .env.production
fi
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build
docker compose --env-file .env.production run --rm --no-deps app node scripts/check-production.ts
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
echo 'Container gestartet. HTTPS und die echte Discord-Anmeldung jetzt im Browser prüfen.'
game_domain=$(sed -n 's/^DOMAIN=//p' .env.production)
printf 'Prüfung: curl --fail https://%s/healthz\n' "$game_domain"
