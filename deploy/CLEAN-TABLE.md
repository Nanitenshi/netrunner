# Spielfläche und Kartenfenster — 8. Oktober 2026

Die Gesamtansicht ist standardmäßig interaktiv. Eigene Karten lassen sich dort bedienen und per Hover vergrößern, gegnerische Karten ansehen. V wechselt zwischen Übersicht und eigenem Board; die Spielerleiste fokussiert einzelne Plätze. Die bevorzugte Ansicht wird gespeichert. In der Übersicht ist die Perspektive flach, damit alle vier Plätze vollständig in den verfügbaren Bereich passen. Im Duell liegen die Boards gegenüber.

Ruhigere Spielfeldflächen, dezente Commander-Motive und schmalere Rahmen ersetzen Holztexturen, Zierleisten und Partikel auf dem Tisch. Deck und Friedhof zeigen mehrere Kartenlagen, Kartenschatten, unterschiedliche Oberseiten und Mengen. Leere Stapel erscheinen ohne Karte.

Ein Klick auf das eigene Deck öffnet ein seitliches Kartenfenster ohne blockierenden Hintergrund oder zusätzliche Stack-Passrunde. Karten lassen sich nach Name, Typ und Kartentext suchen. Doppelklick übernimmt eine Karte, die nummerierte Mehrfachauswahl mehrere Karten. Hand, Spielfeld, Friedhof, Exil und Bibliotheksoberseite sind verfügbar; Rest mischen und getappt kommen bei Bedarf hinzu. Mischen schließt das Fenster auch ohne Entnahme. Bloßes Schließen verändert weder Reihenfolge noch Karten.

Das Durchsehen ist eine ausdrücklich manuelle Casual-Aktion; die Spielrunde spricht die Berechtigung zum Durchsehen und den Karteneffekt ab. Der Server liefert dabei ausschließlich die eigene Bibliothek an die eigene Sitzung. Gegenüber bleiben Bibliothek und entnommene Handkarten geheim. Andere Spieler können weiter agieren. Geskriptete Suchvorgaben über den Stack behalten ihre Filter und Auswahlregeln. Aktive geskriptete Entscheidungen lassen sich nicht durch manuelle Entnahmen umgehen. Spezialeffekte des übernommenen Kartentexts bleiben manuell.

Friedhof und Exil verwenden dasselbe seitliche Kartenfenster mit Suche; der Friedhof zeigt zuletzt abgelegte Karten zuerst. Gegnerische Karten sind nur lesbar. Verdeckte Exilkarten behalten ihre bisherigen Sichtbarkeits- und Spielbedingungen.

Prüfung: 147 Tests bestanden, TypeScript und Produktionsbuild erfolgreich. Browserprüfung mit vier Online-Spielern, je 16 Permanents, gefüllten Friedhöfen, Hover-Tappen aus der Gesamtansicht, privater Decksuche und direkter Übernahme eines getappten Landes. Zusätzlich Duellansicht und Bildschirmbreiten von 600 bis 1920 Pixeln geprüft. Kartenregeltext wird in der Viererübersicht per Hover bzw. Detailansicht gelesen; vier vollständige Boards können nicht zugleich Kartentext in Originalgröße zeigen.

Screenshots: milestones/playtest-usability/clean-vier-spieler.png, clean-board-stapel.png, clean-deck-durchsehen.png.

Das Serverpaket enthält auch das vorherige Token-Update. Lokal vorbereitet, noch nicht auf dem öffentlichen Hetzner-Server installiert.
