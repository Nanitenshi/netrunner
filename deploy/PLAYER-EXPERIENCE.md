# Spielansicht und Bedienung – 7. Oktober 2026

## Änderungen

- Große fokussierte Playmatte für eigene und gegnerische Boards. Die Gegneransicht verwendet standardmäßig das frei gelegte Spielfeld; eine scrollende Kartenübersicht ist optional.
- Im Duell stehen die Playmatten in der Tischübersicht gegenüber. Einzelne Boards bleiben per Spielerleiste oder Tasten 1/2 fokussierbar.
- Große, mittig gehaltene Hand mit leichtem Kartenfächer, freier Reihenfolge und Mausvorschau. Sehr große Hände lassen sich seitlich scrollen. Die Hand liegt über dem unteren Rand, statt eine große feste Ablage zu reservieren.
- Desktop-Aktionsdock oben; Handaktionen separat rechts. Größere Scry-, Such- und Hideaway-Karten mit Mausvorschau.
- Menüs schließen sich gegenseitig. Escape oder ein Klick außerhalb klappt sie ein. Laufende Kartenauswahlen gehen dabei nicht verloren.
- Ereignishinweise und automatisch aufklappender Stack sind optional. Das Protokoll bleibt verfügbar. Bewusstes Kamera-Zoom mit Alt + Mausrad; normale Hand- und Listennavigation bewegt die Kamera nicht.
- Neue Permanents, Kopien und Tokens erhalten freie Startpositionen. Bei dichtem Spielfeld wird die Position mit den wenigsten Überschneidungen verwendet. Manuelle Platzierung und Aufräumen bleiben verfügbar; begrenzte Spielfläche bedeutet bei extrem vielen Karten weiterhin Überlappung.
- Token-Menü mit zwölf üblichen Token-Arten und Mengenwahl. Erzeugung wird vom Server validiert und an alle Spieler übertragen. Eigene Illustrationen und Kartentext-Automatisierung sind nicht Bestandteil der Token-Vorlagen.
- Bibliothek und Friedhof zeigen geschichtete Karten; der Friedhof zeigt die zuletzt eingegangene Karte.
- Hideaway: privates Ansehen, eine verdeckte Exilkarte, übrige Karten zufällig unter die Bibliothek. Gegner erhalten die Kartenidentität nicht. Hideaway-ETB wird bei unterstützten Permanents automatisch auf den Stack gelegt.
- Spielen einer Hideaway-Karte erfordert die Bestätigung, dass ihre Kartenbedingung erfüllt und Aktivierungs-/Zusatzkosten bezahlt sind. Diese individuellen Bedingungen bleiben manuell, passend zum Casual-Tisch.
- Nicht erlaubte Zieh- und Zugaktionen werden deaktiviert und kurz erklärt. Die Steuerungshilfe enthält die neuen Aktionen.

Hideaway-Regelgrundlage: [Offizielle Streets of New Capenna Release Notes](https://magic.wizards.com/en/news/feature/streets-new-capenna-release-notes-2022-04-20).

## Prüfung

- 134 automatisierte Tests bestanden, einschließlich Online-Aktionsschema, Platzierung, Tokens, Hideaway-Geheimhaltung und Friedhof-Reihenfolge.
- TypeScript-Prüfung und Produktionsbuild erfolgreich. Der bestehende große Kartenkatalog erzeugt weiterhin eine Bundle-Größenwarnung; dessen Ladeoptimierung steht noch aus.
- Browserprüfung: zwei Online-Spieler, zwölf gegnerische Tokens, Duell-Anordnung, größere Hand/Auswahlkarten, Menüwechsel, Hideaway, drei kleinere Fenstergrößen, direkte Zielwahl, Mana-Zahlung, Priorität und Tastatur-Counter.
- Screenshots unter milestones/playtest-usability.

## Veröffentlichung

Das aktualisierte Serverarchiv liegt unter releases/server/batusmtg-server.tar.gz. Noch nicht auf dem öffentlichen Server installiert. Bestehende .env.production und Spielerdaten bleiben außerhalb des Archivs. Nach Backup und Neuaufbau der Container im Browser Strg + F5 drücken.
