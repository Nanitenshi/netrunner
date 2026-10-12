# Entwicklung

Benötigt werden Node.js ab 22.18 und pnpm 10.11.0.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

Änderungen auf einem eigenen Branch entwickeln und über einen Pull Request prüfen.
GitHub Actions prüft Tests und Build bei Pushes und Pull Requests. Eine erfolgreiche
Prüfung veröffentlicht das Spiel nicht automatisch auf Hetzner.

Zugangsdaten gehören ausschließlich in lokale Umgebungsdateien beziehungsweise
in die Serverkonfiguration. Keine SSH-Schlüssel, Discord-Secrets, Datenbanken oder
Kontodecks einchecken. Beispielkonfigurationen enthalten keine echten Secrets.

Die optionale Forge-Anbindung benötigt zusätzliche externe Ressourcen. Ihre
Einrichtung, Grenzen und GPL-Lizenz stehen in `forge-bridge/README.md`. Die normalen
Tests und Builds benötigen diese Ressourcen nicht.
