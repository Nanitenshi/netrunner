# Gezielte Deckaktionen und Deckklau — 11. Oktober 2026

Lokal fertiggestellt; Veröffentlichung erfolgt mit dem Serverupdate.

## Bedienung

Ein Klick auf einen eigenen oder gegnerischen Deckstapel öffnet jetzt ausschließlich das Aktionsfenster. Die Bibliothek bleibt zunächst verdeckt. Anzahl eingeben und oben ansehen, öffentlich aufdecken, millen oder ins Exil legen. Nur Bibliothek durchsuchen gibt ausdrücklich die vollständige Bibliothek für den ausführenden Spieler frei. Bekannte Karten können nach Name, Typ oder Text gefiltert werden.

Aus sichtbaren Karten wählen: eigene Karten auf die Hand, Karten ins Exil oder in den Friedhof, oberste Karten nach unten, beziehungsweise unter eigener Kontrolle aufs Spielfeld. Die tatsächlichen physischen Karten werden bewegt; der ursprüngliche Besitzer bleibt erhalten. Beim späteren Zonenwechsel gehen sie wieder zu dessen Zone.

Bei einer gegnerischen Bibliothek bietet Zum Spielen ins Exil eine manuelle Casual-Spielberechtigung: Die gewählte Karte wird verdeckt ins Exil gelegt. Nur der ausführende Spieler kennt sie. Im Exilfenster des Besitzers kann dieser Spieler Bedingungen und Kosten bestätigen und die Karte über den Stack spielen. Normales Timing, bekannte Ziele und Landspielzahl werden berücksichtigt; der normale Preis wird nicht automatisch kostenlos. Die Karte behält ihren Besitzer, während Spruch und bleibende Karte vom wirkenden Spieler kontrolliert werden. Ein Zonenwechsel beendet die Berechtigung.

Clash öffnet beide obersten Karten öffentlich und protokolliert deren Manawerte und den Gewinner beziehungsweise Gleichstand. Im Fenster wird die eigene Karte separat angezeigt; sie kann dort nach unten gelegt werden. Der Gegner entscheidet im eigenen Deckfenster über seine Karte. Die weitere Wirkung des auslösenden Kartentextes bleibt manuell.

## Sichtbarkeit

Private Deckansichten werden serverseitig projiziert, nicht nur im Interface verborgen. Millen und Exilieren ohne Auswahl öffnen den Rest der Bibliothek nicht. Änderungen der Reihenfolge oder Kartenmenge machen die vorherige Ansicht ungültig. Schließen beendet die eigenen freigegebenen Ansichten, auch während einer inzwischen geöffneten Regelauswahl.

Diese Werkzeuge sind bewusst manuelle Casual-Aktionen und keine automatische Erkennung sämtlicher Diebstahlkarten. Zulässige Suchbereiche, Exil-Dauer und Sonderkosten stimmt die Runde ab. Geskriptete Bibliothekssuche, Scry und ähnliche Auswahlmechaniken bleiben gesondert erhalten.

## Prüfung

TypeScript, Produktionsbuild und 192 Tests bestanden. Browserprüfung mit vier verbundenen Spielern: kein Deck beim Öffnen sichtbar, private oberste zwei Karten, öffentliches Clash, Aufräumen beim Schließen, Übernahme mit erhaltenem Besitzer, blindes Exilieren sowie verdecktes Exil mit anschließendem Spielen unter fremder Kontrolle. Keine Browserfehler.

Screenshots: milestones/playtest-usability/deck-clash.png, deck-aktionen-verdeckt.png und deckklau-exil.png.
