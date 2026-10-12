# Tisch und Reaktionen – 7. Oktober 2026

- Gemeinsamer Tisch: Außenrand 28 statt 58, Abstand der Playmatten 18 statt 32. Kompaktere Kopfbereiche und Zonenleiste; 30 Pixel mehr Tischhöhe auf Desktop. Diese Änderungen gelten für alle Spielerzahlen und die Übersicht.
- Vier Boards gleichzeitig füllen den verfügbaren Bildschirm. Die Hand zieht sich in der Übersicht nach unten und kommt bei Mausberührung oder Tastaturfokus zurück. Einzelne Boards bleiben größer fokussierbar. Ein zusätzlicher speicherbarer Board-Zoom liegt in Tischwerkzeugen und Einstellungen.
- Bibliothek: Commander-Motiv, Spielerfarbe und Sitznummer auf dem Deckrücken. Friedhof: eigene Farbe, Schädel im leeren Stapel, zuletzt abgelegte Karte bei gefülltem Stapel. Jeder Spieler behält seine eigenen Zonen und Karten.
- T über einer eigenen Spielfeldkarte tappt/enttappt sie ohne vorherigen Klick. Ohne Mauskarte verwendet T die Auswahl; gegnerische Karten unter der Maus werden nicht verändert. Q tappt ausgewählte ungetappte eigene Spielfeldkarten.
- Mana-Pool und zugehörige Spielaktionen aus der Oberfläche entfernt. Gedruckte Kosten und Commander-Tax bleiben angezeigt; Zahlung wird am Tisch manuell geregelt. Vorhandene Backend-Daten bleiben kompatibel.
- Zwölf Token-Vorlagen mit echten Kartenbildern, lokal gespeichert. Farben, Werte und Text passen jeweils zur gewählten Druckversion. Künstler und Scryfall-Quelle stehen in public/tokens/credits.json. Beispiele: [Soldier](https://scryfall.com/card/tfrc/3/soldier?utm_source=api), [Treasure](https://scryfall.com/card/tfra/15/treasure?utm_source=api). Tokenfähigkeiten bleiben manuell.
- Reagieren: Aus passt automatisch auf ein offenes Stack-Objekt; Immer wartet; Auto wartet bei möglichen Antworten. F8 wechselt den Modus. Standard ist Immer, damit bestehende Spieler ihre Reaktionsfenster behalten. Aus beendet keinen Zug automatisch und überspringt keine offene Auswahl.
- Auto erkennt Spontanzauber, Flash und mögliche aktivierte Fähigkeiten sowie einige Handfähigkeiten. Unterstützte Zielprüfungen berücksichtigen Counterspell und Swords to Plowshares. Unklare Fähigkeiten halten Priorität vorsichtshalber offen. Kosten, Sonderbedingungen, gewährte Fähigkeiten und beliebiger Oracle-Text sind nicht vollständig automatisiert; für vollständige manuelle Kontrolle Immer nutzen.
- Online-Autopassen wird auf dem Server gegen die aktuelle Spielrevision geprüft. Veraltete Anfragen und fremde Priorität führen nicht zum Passen.
- Leben: Zahl anklicken oder L. ±5, ±10, ±20 und freie Menge 1–100. Plus/Minus-Klick mit Umschalt ändert 5, mit Strg 10. Bild hoch/runter: ±1, mit denselben Mengenmodifikatoren.
- Aufklappende Aktionsfenster liegen über der Hand; Reaktionsauswahl hebt den aktiven Modus klar hervor.

## Prüfung und Veröffentlichung

137 Tests bestanden. TypeScript-Prüfung und Produktionsbuild erfolgreich. Browserprüfung mit vier verbundenen Spielern, zwölf Token-Karten pro Board, Maus-Tappen, Lebensänderungen, Reaktionsmodi und Server-Autopassen. Kleinere Fenster ohne Seitenüberlauf geprüft. Der große Kartenkatalog benötigt weiterhin eine spätere Ladeoptimierung.

Das neue Archiv releases/server/batusmtg-server.tar.gz muss noch auf den öffentlichen Server hochgeladen und installiert werden. Es enthält keine Spielerdaten oder private Konfiguration. Vor dem Neuaufbau Backup ausführen; anschließend Strg + F5 im Browser.
