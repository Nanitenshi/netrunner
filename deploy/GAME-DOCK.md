# Spielbedienung – 6. Oktober 2026

- Schwebendes Aktionsdock über der Hand mit großen Symbolen für Spielaktionen, Mana, Korrekturen, Stack und Zugabgabe.
- Kartenaktionen erscheinen bei der ausgewählten Karte: Vergrößern, Tappen, Kopieren, Mana, Counter und Friedhof.
- Kamera und Kartenanordnung öffnen sich über das Kompass-Symbol. Würfel und Münze über das Würfel-Symbol.
- Vier große Handaktionen: Counter, Ziehen, Enttappen und Raster. Kompakte Spieleranzeigen geben dem Board mehr Platz.
- Auswahlfenster liegen über dem Board, innerhalb des Fensters und oberhalb der Hand. Lange Inhalte scrollen.
- Kartenauswahl lässt sich über X oder Escape einklappen, auch wenn das Suchfeld fokussiert ist. Über „Auswahl fortsetzen“ wieder öffnen. Einklappen bricht den laufenden Effekt nicht ab.
- Suchauswahl bestätigen beendet den Effekt und gibt die Zugsteuerung frei. Bei Landsuchen darf man weniger oder keine Karte finden. Stack und Priorität bleiben erhalten.
- Ereignishinweise liegen außerhalb der Hand und fangen keine Mausaktionen ab.

Prüfung: 128 Tests erfolgreich; TypeScript und Produktionsbuild erfolgreich. Browserprüfung mit 1440 × 1000, 1366 × 768, 800 × 768 und 600 × 768: Dock, Mana, Würfel und Suchauswahl innerhalb des Fensters. Landsuche vollständig vom Stack bis zur Bestätigung geprüft. Zusätzlich Kartenaktionen, Counter, Ziehen, Kamerawerkzeuge, direkte Zielauswahl, Pool-Bezahlung und Priorität geprüft.

Das Paket muss noch auf den Spielserver übertragen werden. Der Kartenkatalog erzeugt weiterhin eine große JavaScript-Datei; die vorhandene Buildwarnung bleibt bestehen.
