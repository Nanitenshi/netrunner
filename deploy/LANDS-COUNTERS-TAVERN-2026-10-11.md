# Landspiele, Schaden und Holo-Tisch — 11. Oktober 2026

Lokal umgesetzt. Dieses Update wird erst nach Upload und Serverneustart online verfügbar.

## Landspiele

Oben am Tisch steht **Länder gespielt / erlaubt**. Anklicken zeigt verbleibende Landspiele und erkannte Quellen. **Plus** gibt ein zusätzliches Landspiel frei; eine beliebige Anzahl bis 998 kann direkt gesetzt werden. Manuelle Freigaben gelten für den aktuellen Zug und werden bei dessen Ende zurückgesetzt.

Eindeutige, unbedingte dauerhafte Formulierungen wie bei Exploration, Azusa, Oracle of Mul Daya und Dryad of the Ilysian Grove werden anhand der offenen Spielfeldkarten automatisch addiert. Mehrere Quellen zählen zusammen. Aktuelle Kartenseite, Kontrollwechsel und Verlassen des Spielfelds werden berücksichtigt. Bereits gespielte Länder werden dadurch nicht zurückerstattet.

Bedingte, aktivierte und einmalige Effekte wie Explore werden nicht pauschal aus dem Kartentext geraten: Nach ihrer Ausführung die zusätzlichen Landspiele freigeben. Länder durch Suchen oder Ramp direkt auf das Spielfeld zu legen verbraucht weiterhin kein normales Landspiel. Server, Client-Hinweise und Hideaway verwenden dieselbe erlaubte Anzahl.

## Commander-Schaden und Counter

- **Counter / Schaden** bleibt auf der eigenen Playmatte sichtbar.
- **Rechtsklick auf einen Commander → Schaden erfassen** öffnet direkt die passende Quelle.
- Im Tab **Commander-Schaden** sind die Commander mit Bild und eigenem Stand auswählbar. Partner zählen getrennt. Ein übernommener Commander bleibt dieselbe Quelle; Token-Kopien zählen nicht als Commander.
- Menge eingeben oder 1, 5, 10 wählen; Plus/Minus erfassen oder korrigieren den erhaltenen Kampfschaden. Leben kann optional gleichzeitig angepasst werden. Das ist manuelles Tracking, keine automatische Kampferkennung.
- Eine Eingabe, die 21 erreicht, verlangt eine Bestätigung, bevor die Engine den Spieler ausscheiden lässt.
- Standardcounter und vorhandene eigene Counter verwenden dieselbe gewählte Menge. Eigene Counter lassen sich weiterhin frei benennen und mit einer Anfangsmenge erstellen.
- Im Rechtsklickmenü ist die Schnellcounter-Menge direkt einstellbar. Die P/T-Anzeige berücksichtigt +1/+1- und −1/−1-Marken.

## Menü und Tisch

Kartenaktionen stehen in einem kompakten Menü mit zwei Spalten. Es verschiebt sich an Bildschirmrändern ins Fenster, statt eine lange Liste mit Scrollleiste anzuzeigen. Kartenbild, kurze Bezeichnungen und Mengenfeld ersetzen die vorherige Textliste.

Der Tisch nutzt die vorhandene Holo-Taverne als sichtbaren Raum. Wärmere Metall-/Holztöne, kräftigere Playmatten und dezente projizierte Lichtkreise beleben freie Flächen. Die vier Playmatten, Tiefeneffekte und klare Trennlinien bleiben bestehen. Dekoration fängt keine Eingaben ab. Mit deaktivierten Effekten bleibt der Tisch ruhiger.

Automatische Fensteranpassungen setzen die Kamera direkt auf die passende Größe; sie interpolieren nicht mehr vorübergehend über den Rand eines schmalen Fensters. Bewusste Boardwechsel behalten ihren kurzen Kameraschwenk.

## Prüfung

170 automatisierte Tests bestanden; TypeScript und Produktionsbuild erfolgreich. Vier verbundene Spieler im Browser: drei Länder im selben Zug, Mengenänderungen für Standard-/eigene Counter, getrennte Partner-Schadensquellen, optionale Lebensänderung, Bestätigung vor 21, Zustand nach Reload und Rücksetzen beim Zugwechsel. Rechtsklickmenü bei 1366×768, 800×600 und 600×600 ohne innere Scrollleiste geprüft.

Screenshots in `milestones/playtest-usability/`:

- `holo-tavernen-tisch.png`
- `landspiele-holo.png`
- `kreaturenmenue-kompakt.png`
- `counter-mengen.png`
- `commander-schaden-partner.png`

Das Serverpaket enthält auch den vorherigen Karteneditor, Seitenwahl und Anlegen. Die bestehende vollständige Automatisierung beliebigen MTG-Kartentexts bleibt außerhalb dieses Updates.
