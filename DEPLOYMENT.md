# BatusMTG: Windows und Online-Server

Stand: 4. Oktober 2026. Ausschließlich Windows als installierbarer Client. Android ist nicht vorgesehen.

## Was bereits bereitliegt

- Windows-x64-Installer in `releases/windows/`, eigener Launcher, lokaler Testmodus und Verbindung zu einem gemeinsamen Server.
- HTTPS-Konfiguration über Caddy, persistente SQLite-Datenbank, Serverprüfung und geprüftes SQLite-Backup.
- Discord-Anmeldung mit dem Scope `identify`, serverseitigem Secret, browsergebundener Zustandsprüfung und geschützter Sitzung.
- Im öffentlichen Betrieb sind Testkonten in der Compose-Konfiguration abgeschaltet.

Der Hetzner-CX23 in Helsinki ist angelegt (2.29.40.106). Der Nutzer hat das Spiel gebaut und erfolgreich gestartet; der öffentliche HTTPS-Aufruf unter https://batusmtg.2-29-40-106.sslip.io wurde im Browser geprüft. Discord-Rückleitung und Server-Secret sind eingerichtet. Die vollständige echte Discord-Anmeldung und eine öffentliche Runde mit vier Konten bleiben zu prüfen. batusmtg.de ist noch nicht registriert; die Domainverwaltung ist noch nicht sichtbar freigeschaltet.

Der gebuchte Server einschließlich IPv4 und täglicher Backups kostet laut Bestellansicht 8,43 Euro monatlich inklusive 19 % MwSt. Die geplante Domain kostet 3,90 Euro jährlich plus 2,00 Euro Einrichtung; die einmaligen Startkosten wurden freigegeben. Die installierbare Windows-Datei enthält einen älteren Stand; den aktuellen Online-Server kann der Launcher über seine HTTPS-Adresse öffnen.

## Deckimport

Im Deckersteller unter „Deck importieren“ einen öffentlichen Deckstats-Link oder eine englische Textliste einfügen. Vorschau prüfen, Commander auswählen und ein neues Deck erstellen. Bestehende Decks bleiben erhalten. Commander/Partner, Mengen, Set-Suffixe und Vorderseiten-Namen werden erkannt. Fehlende Karten oder fehlerhafte Zeilen verhindern einen stillen Teilimport. Sideboard, Tokens und weitere Zusatzlisten werden mit Hinweis ignoriert. Unvollständige Decks können als Entwurf ergänzt werden; die Online-Partie prüft erneut 100 Karten und Farbidentität.

Der automatische Linkabruf ist auf HTTPS-Deckseiten von deckstats.net begrenzt, mit kontrollierten Weiterleitungen, Zeit- und Größenlimit. Deckstats kann automatisierte Abrufe blockieren (beim öffentlichen Test kam HTTP 403); dann den öffentlichen Text-Export kopieren und einfügen. Der Textimport wurde in der Oberfläche geprüft, URL-Verarbeitung und Formate mit kontrollierten Antworten getestet. Ein erfolgreicher Abruf einer aktuellen echten Deckstats-Seite ist noch nicht bestätigt.

Das Import-Update ist lokal gebaut und geprüft; der öffentliche Server muss mit dem neuen Paket aktualisiert werden. Vorher SQLite-Backup erzeugen. Keine Datenvolumes löschen und keine ausgefüllte .env-Datei ersetzen.

## Auf dem Linux-Server

Voraussetzung: Docker Engine mit Compose, DNS für die Domain auf die öffentliche Serveradresse, eingehende Ports 80/TCP, 443/TCP und optional 443/UDP. SSH nur für die Administration. Port 5173 nicht öffentlich freigeben; die Anwendung vertraut im Compose-Netz auf den vom Caddy-Proxy überschriebenen Client-IP-Header.

1. Projekt nach `/opt/batusmtg` übertragen, ohne lokale Datenbank, `.env`-Dateien, `node_modules`, Desktop-Laufzeit oder Windows-Installer.
2. `.env.production.example` als `.env.production` kopieren, Rechte auf `600` setzen und Domain sowie Discord-Werte direkt auf dem Server eintragen.
3. In der [Discord Developer Console](https://discord.com/developers/applications) die Anwendung anlegen. Unter OAuth2 exakt `https://batusmtg.de/auth/discord/callback` als Redirect eintragen, wenn diese Domain registriert wurde. Kein Bot ist erforderlich. Das Secret bleibt auf dem Server.
4. Im Projektverzeichnis starten:

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build
docker compose --env-file .env.production ps
curl --fail https://batusmtg.de/healthz
```

`config --quiet` prüft, ohne das Secret auszugeben. Caddy beschafft und erneuert bei korrektem DNS und erreichbaren Ports das Zertifikat. [Caddy HTTPS](https://caddyserver.com/docs/automatic-https/) und [WebSocket-Proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy/).

Es läuft genau **eine** App-Instanz. Räume und Sitzungen liegen im Arbeitsspeicher und in SQLite; mehrere unabhängige Instanzen hinter einem Verteiler werden noch nicht unterstützt. Die Docker-Volumes bewahren Daten und Zertifikate beim Containerwechsel. `docker compose down -v` löscht diese Daten und darf für normale Updates nicht verwendet werden.

## Vor Freigabe tatsächlich prüfen

Discord-Anmeldung mit vier echten Konten, Tisch erstellen/beitreten, Decks im Konto speichern, Partie starten, Mulligan, Ziehen, Stack, private Bibliothekssuche, Verbindungsunterbrechung und Serverneustart. Bei allen vier Konten prüfen, dass fremde Hände/Bibliotheken verborgen bleiben. Abgebrochene und abgelaufene Discord-Anmeldungen prüfen. Dieselbe Runde aus Windows-App und Browser verbinden.

Die automatisierten Discord-Tests simulieren den Anbieter. Eine Anmeldung beim echten Discord ist erst nach Konfiguration prüfbar. Nicht alle MTG-Kartentexte sind automatisiert; der Katalog enthält 32.116 Karten und 3.468 allein auswählbare Commander, dazu mögliche Hintergründe.

## Backups und Updates

Ein konsistentes Backup einschließlich bereits geschriebener WAL-Daten erzeugen:

```sh
docker compose --env-file .env.production exec -T app node scripts/backup.mjs
```

Das Ergebnis liegt unter `/app/data/backups/` im Datenvolume. Für Schutz vor einem Serverausfall regelmäßig außerhalb des Servers sichern; ein Backup im selben Volume allein reicht dafür nicht. Der Dateiname wird ausgegeben, der Inhalt nicht. Backups enthalten Konten, Sitzungen und private Spielinformationen.

Vor Updates Backup anlegen, dann `docker compose --env-file .env.production up -d --build`. Zum Wiederherstellen die App stoppen, den bisherigen Datenbestand gesondert sichern, das geprüfte Backup als `nexus.sqlite` einsetzen und veraltete `nexus.sqlite-wal`/`nexus.sqlite-shm` nicht mit dem wiederhergestellten Stand mischen. Anschließend als App-Benutzer starten und die Wiederverbindung prüfen.

## Windows-App mit direkter Anbindung bauen

Nach erfolgreicher Veröffentlichung auf Windows x64 mit Node 24:

```powershell
$env:NEXUS_SERVER_URL = 'https://batusmtg.de'
pnpm desktop:build
```

Der Build speichert ausschließlich die öffentliche Adresse in `desktop/server-config.json`. Beim Start verbindet sich die App automatisch; bei Nichterreichbarkeit bleibt der Launcher mit einer Fehlermeldung verfügbar. `Strg+Umschalt+S` öffnet die Serverauswahl. Ohne konfigurierte Adresse startet der Launcher.

Die App enthält ihre Laufzeit und benötigt bei Spielern keine Node-Installation. Lokale Daten liegen im Windows-Benutzerprofil im Ordner `Nexus Commander`; sie werden beim normalen Deinstallieren nicht gelöscht. Online-Spielstände liegen auf dem gemeinsamen Server. Konto-Sitzungen sind je Server getrennt. Spielseiten erhalten keinen Zugriff auf Node oder die Launcher-Schnittstelle.

Der Installer ist noch nicht mit einem Herausgeberzertifikat signiert. Windows kann deshalb eine Warnung zum unbekannten Herausgeber anzeigen. Automatische App-Updates sind noch nicht eingerichtet. Desktop-Oberfläche und Server sind getrennt versionierbar; zum Wechsel der fest eingebauten Adresse den Installer neu bauen.

Referenzen: [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2/), [Electron-Sicherheit](https://www.electronjs.org/docs/latest/tutorial/security).
