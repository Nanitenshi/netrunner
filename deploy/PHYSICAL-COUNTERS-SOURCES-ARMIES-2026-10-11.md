# Counter, Effektquellen und große Boards — 11. Oktober 2026

Lokal umgesetzt und geprüft. Noch nicht auf den öffentlichen Server übertragen.

## Große Boards

Ab 16 bleibenden Karten wird die Playmatte automatisch geordnet. Über das Raster neben dem Spielernamen lässt sich zwischen freier und geordneter Darstellung wechseln. Kreaturen, andere Permanents und Länder erhalten eigene Reihen. Getappte Karten bekommen ausreichend Abstand. Die Ansicht verändert keine Spielwerte oder gespeicherten Kartenpositionen.

Gleiche Token und Länder erscheinen als Stapel mit Anzahl. Unterschiedliche Marken, Zustand, Besitzer oder Kontrolle verhindern eine falsche Zusammenfassung. Anklicken der Anzahl klappt den Stapel auf. Rechtsklick auf die eigene Gruppe bietet gemeinsames Tappen, Enttappen und Marken mit frei wählbarer Menge pro Karte. Marken werden gemeinsam vom Server verarbeitet. Manuell verschobene Karten bleiben in der geordneten Ansicht an ihrer gewählten Position.

## Physische Counter und Kartenbewegung

Counter öffnet eine Ablage mit Kartenmarken, Spielerzählern, Commander-Schaden und eigenen Namen. Menge eingeben und den Stein auf die eigene Playmatte oder eine eigene Spielfeldkarte ziehen. Ein Kartenstein wird beim Ablegen auf einer Karte in deren Marken übernommen. Freie Steine lassen sich verschieben, ändern und entfernen. Spielerzähler und Commander-Schaden verwenden dieselben Werte wie die bisherigen Menüs. Das Entfernen ihres Steins löscht den Wert nicht. Bei tödlichem Commander-Schaden erscheint eine Bestätigung; Leben wird nicht automatisch verändert.

Karten folgen beim Ziehen direkt der Tischfläche und behalten den angefassten Punkt. Escape bricht die Bewegung ab.

## Effektquellen

Exil- und Friedhofskarten können eine Quelle und einen kurzen Hinweis erhalten. Quellen bleiben als Name und ursprüngliche Karteninstanz gespeichert, wenn die Quelle das Spielfeld verlässt. Die Zuordnung zeigt den verantwortlichen Spieler. Im Kartenfenster lassen sich mehrere Karten gleichzeitig verknüpfen und nach Quelle gruppieren. Der Karteneditor der Quelle zeigt ihre verbundenen Karten.

Mill, Surveil, Discover, Cascade, Hideaway und unterstützte Exil-Effekte ergänzen ihre Quellen automatisch. Verdeckte Karten bleiben geschützt. Ein neuer Zonenwechsel entfernt die Zuordnung. Hinweise allein führen keine Rückkehr-, Ablauf- oder Wirkerlaubnisregeln für beliebige Kartentexte aus; diese bleiben gegebenenfalls manuell zu regeln.

## Prüfung

- TypeScript und Produktionsbuild erfolgreich.
- 187 Tests bestanden.
- Browserprüfung mit vier verbundenen Spielern: direkte Kartenbewegung, Abbruch, Counter auf Feld und Karten, Mengen, eigene Counter, Commander-Schaden, Quellenverknüpfung, Quellen nach Verlassen des Spielfelds und Reload.
- Alle vier Boards mit über 20 Kreaturen geprüft; unterschiedliche Marken bleiben einzeln sichtbar, identische Token lassen sich gruppieren und gemeinsam bearbeiten. Keine Scrollleisten innerhalb der geordneten Boards.
- Counter-Ablage bei 1600×1000, 1366×768 und 800×600 geprüft.

Extrem große Boards verkleinern weiterhin Karten. Hover und Einzelboardansicht bleiben deshalb wichtig. Absichtlich frei platzierte Karten und Counter können sich überlagern.

## Referenz

Die [Moxgate-FAQ](https://www.moxgate.com/faq/) beschreibt unter anderem gruppierte Token und schnelle Reaktionsoptionen. Für dieses Update wurde die Gruppierung als Bedienidee aufgenommen und passend zu unserer freien Casual-Oberfläche umgesetzt.

## Screenshots

Siehe milestones/playtest-usability: vier-boards-grosse-armeen.png, zwanzig-kreaturen-geordnet.png, counter-ablage-physisch.png, friedhof-quellen-gruppiert.png und quelle-verbundene-karten.png.
