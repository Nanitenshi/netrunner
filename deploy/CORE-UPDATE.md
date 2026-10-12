# BatusMTG – Stack, Mana und Casual-Korrekturen

Stand: 5. Oktober 2026. Dieses Paket ist lokal vorbereitet; seine Erstellung bestätigt keine Installation auf dem öffentlichen Server.

## Im Spiel

- **Mana:** gemeinsamer, serverseitiger Pool für W/U/B/R/G/C. Mengen von 1–100 erzeugen oder verbrauchen; eine eigene ungetappte Quelle optional gleichzeitig tappen. Farbwahl, Manafähigkeit, Zusatzkosten und Einschränkungen werden manuell geprüft. Normales Tappen erzeugt kein Mana.
- Mana bleibt beim Passen und bei Verrechnung erhalten. Am Ende jedes Engine-Schritts wird es geleert. Die manuelle Ausnahme „Mana behalten“ erhält den gesamten Pool; selektives Erhalten, Einschränkungen und Umwandlung sind manuell.
- **Stack:** klare oberste Position, Prioritätsfolge, Reaktionsfenster, direkte Passaktion. S öffnet den Stack, P gibt Priorität ab. Neue Stack-Objekte öffnen das Fenster automatisch; in Einstellungen abschaltbar.
- Aktivierte Fähigkeiten und Trigger lassen sich getrennt ansagen. Gleichzeitige Trigger und ihre Reihenfolge werden manuell bestimmt.
- Während einer eigenen manuellen Verrechnung kann ein durch den Kartentext erlaubtes Stack-Objekt neutralisiert werden. Der Server entfernt das Objekt und bewegt einen zugehörigen Spruch in den Friedhof. Einschränkungen werden nicht allgemein automatisch erkannt.
- Swords to Plowshares mit variabler Stärke bietet eine Eingabe der tatsächlichen Stärke. Anschließend führt der Server Exil und Lebenspunkte für den Zielcontroller aus.
- **Korrektur:** vergessene Sprüche oder Fähigkeiten nachholen, eigene Kartenzonen und Tap-Zustände ändern, Commander-Castzahl korrigieren, direkt nachziehen oder eigene noch offene Stack-Objekte zurücknehmen. Eine Begründung ist nötig und wird allen angezeigt.
- Nachgeholte Stack-Aktionen übergehen als Casual-Ausnahme Zeitpunkt und aktuelle Priorität; danach bekommt der nachholende Spieler Priorität und alle erhalten eine neue Reaktionsmöglichkeit. Kosten bleiben zu bestätigen.
- Korrekturen blockieren während laufender Verrechnungen und Kartenauswahlen. Sie berechnen vergangene Folgen nicht erneut und sind kein vollständiges Undo. Kosten und Commander-Tax bei Rücknahme separat korrigieren.
- Hand- und Bibliothekskarten bleiben gegenüber Gegnern verborgen. Gründe nicht zum Offenlegen privater Karten verwenden.
- **Bedienung:** Suchbare Befehlsübersicht in Einstellungen und Hilfe. Neue Holo-Fenster, Öffnungsanimationen und Ereignishinweise; Effekte und reduzierte Bewegung werden berücksichtigt.

## Server aktualisieren

In deiner bestehenden PowerShell-Sitzung zuerst hochladen:

```powershell
& "C:\Windows\System32\OpenSSH\scp.exe" -o IdentitiesOnly=yes -i "$gameKey" "C:\Users\Batuh\Documents\Codex\2026-10-04\ic\outputs\commander\releases\server\batusmtg-server.tar.gz" root@2.29.40.106:/root/batusmtg-server.tar.gz
```

Nach erfolgreichem Upload: Datenbank sichern, Paket entpacken, Container aktualisieren:

```powershell
ssh -o IdentitiesOnly=yes -i "$gameKey" root@2.29.40.106 "cd /opt/batusmtg && docker compose --env-file .env.production exec -T app node scripts/backup.mjs && tar -xzf /root/batusmtg-server.tar.gz -C /opt/batusmtg && docker compose --env-file .env.production up -d --build && docker compose --env-file .env.production ps"
```

Die vorhandene Serverkonfiguration und die Datenvolumes bleiben bestehen. Danach alle Clients neu laden. Möglichst zwischen Partien aktualisieren.

## Prüfung

88 automatisierte Tests erfolgreich, einschließlich unabhängiger Online-Sitzungen, Mana-Synchronisation, doppelter Nachrichten, Casual-Korrekturen und privater Handkarten. TypeScript und Produktionsbuild erfolgreich. Browserprüfung: Mana mit Quelle/Verbrauch, Stack-Reaktion, nachgeholter Trigger, Rücknahme, Tap-Korrektur, Nachziehen, Hilfesuche, vier Fensterbreiten und reduzierte Bewegung.

Noch manuell: allgemeiner Kartentext, Kampf, Sonderkosten, Mana-Einschränkungen, gleichzeitige Trigger und Auswahl alternativer Kartenfronten. Die Engine ist kein vollständiger automatischer MTG-Regelautomat.
