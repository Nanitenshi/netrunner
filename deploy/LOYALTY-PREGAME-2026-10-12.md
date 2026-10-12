# Planeswalker und Deckauswahl

- Sichtbare Loyalität einschließlich null auf offenen Planeswalkern.
- Gedruckte +/−/0- und X-Kosten in Auswahlleiste und Rechtsklickmenü. Nur Marken werden verändert: keine Fähigkeitenaktivierung, kein neuer Stack-Eintrag, keine automatische Effektverrechnung oder Beschränkung auf eine Verwendung pro Zug. Unzureichende Loyalität wird abgewiesen. Manuelle Counter-Korrekturen bleiben verfügbar. Null Loyalität entfernt die Karte nicht automatisch.
- Autoritative Scryfall-Loyalität für 320 Katalogkarten einschließlich doppelseitiger Karten; auf dem Spielfeld eintretende Planeswalker und neue Kopien starten mit ihrem gedruckten numerischen Wert. Bei variabler Startloyalität legt die Runde den Wert manuell fest. Bestehende Karten werden nicht rückwirkend zurückgesetzt.
- Fünf vollständige Starter-Commander-Decks: First Flight, Grave Danger, Chaos Incarnate, Draconic Destruction, Token Triumph. Alle enthalten 100 Karten und bestehen die vorhandene Deckprüfung.
- Bildbasierte Deckauswahl am Tisch mit Suche, eigenen Decks, Partnerdarstellung und Farbidentität. Auswahl wird vom Server bestätigt und über Reloads anhand der Raumdaten angezeigt. Deckwechsel setzt wie bisher die Bereitschaft zurück.
- Vorbereitete Decks im Deckersteller als unabhängige eigene Kopien öffnen und bearbeiten.
- Neuer Tisch startet mit First Flight als Standarddeck. Trainingsbots behalten ihr eigenes Trainingsdeck.

Quellen: https://magic.wizards.com/en/news/announcements/starter-commander-decks-decklists-2022-10-20 und https://scryfall.com/docs/api/cards (loyalty / card_faces). Moxgate als gewünschte Referenz für bildbasierte Deckauswahl; keine fremden Programmdateien übernommen.

Prüfung: 207 Tests bestanden, TypeScript und Produktionsbuild bestanden. Echter Browser mit vier Socket-Spielern: alle fünf Decks auswählen, Deckkopie im Editor speichern und am Tisch auswählen, Loyalität +2/−2/0, Synchronisierung für alle Spieler, sichtbare null, zu teure Kosten deaktiviert und kein Stack-Eintrag. Darstellung bei 1600×1000 und 1366×768 geprüft.

Serverarchiv neu erstellen und vom Nutzer zwischen Partien hochladen. Nicht automatisch veröffentlicht. Bestehende große Katalogdatei verursacht weiterhin eine Build-Warnung zur Bundlegröße.
