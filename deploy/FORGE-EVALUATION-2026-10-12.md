# Entscheidung: Forge als optionaler Automatikmodus

Die Forge-Engine funktioniert in einem isolierten lokalen Test mit unseren echten Commander-Decks. Für umfassende Regelautomatisierung ist eine Anbindung sinnvoll. Die bestehende Casual-Engine wird dabei beibehalten. Pro Partie muss genau eine Engine den verbindlichen Spielzustand führen; parallele automatische Verrechnung durch beide Engines ist ausgeschlossen.

## Tatsächlich ausgeführte Tests

Getestet: offizielles Release forge-2.0.15, internes Build 2.0.15-SNAPSHOT-09.28, portable Temurin-JRE 17.0.20.1, Windows, Java-Heap auf 768 MiB begrenzt. Alle Dateien und Benutzerprofile liegen isoliert unter work/forge-evaluation. Kein Austausch des Spielservers, keine Änderung an der aktuellen Engine.

1. Zwei KI-Spieler mit First Flight und Grave Danger: vollständige Commander-Partie, regulärer Sieg nach 17 Zügen; gemeldete Simulationszeit 11.979 Sekunden.
2. Vier KI-Spieler mit First Flight, Grave Danger, Draconic Destruction und Token Triumph: vollständige Partie, regulärer Sieg nach 36 Zügen; gemeldete Simulationszeit 79.120 Sekunden. Seed 42. Der erste Lauf mit einem 60-Sekunden-Limit wurde abgebrochen und zählt nicht als bestandene Partie; der Wiederholungslauf mit 180-Sekunden-Limit wurde regulär beendet.
3. Eigener Java-Test gegen die echte Engine: Ausgangswert ein Land, Exploration erhöht auf zwei, Entfernen von Exploration reduziert wieder auf eins. Alle drei Prüfungen bestanden.
4. Eigener Java-Test: Gideon mit sechs Loyalitätsmarken, anschließend null. Forge verschiebt ihn bei der nächsten Prüfung automatisch in den Friedhof. Beide Prüfungen bestanden. Das widerspricht unserem bewusst manuellen Planeswalker-Verhalten und belegt, dass ein Casual-Modus gezielte Ausnahmen braucht.
5. Alle Karten der fünf vorbereiteten Decks sind im mitgelieferten Skriptbestand vorhanden. Auch Massimo, the Magician ist enthalten. Dies ist ein Namens-/Bestandsabgleich und kein Nachweis fehlerfreier Skripte. 126 von 32.289 Katalogeinträgen hatten beim einfachen Namensvergleich keinen vollständigen Treffer; Aliase und Spezialkarten müssen separat geprüft werden.
6. Dedizierten Servermodus tatsächlich aufgerufen: Ausgabe „Not implemented“. Die mitgelieferte Anwendung bietet somit keinen fertig nutzbaren dedizierten Server über diesen Einstiegspunkt. Das ist keine Aussage darüber, dass Forge generell keine Netzwerkspiele unterstützt.
7. Controller-Schnittstelle: 109 abstrakte Methoden im getesteten Build. Diese Zahl beschreibt Integrationsoberfläche, nicht die Zahl der Dialoge pro Aktion.

Die Simulationszeiten gelten für vollständige KI-Partien auf diesem Rechner. Daraus folgt weder eine Interaktionslatenz für menschliche Spieler noch eine belastbare Serverkapazität. 768 MiB ist ein Heap-Limit und keine Messung des gesamten Speicherverbrauchs. Es wurde noch keine interaktive Verbindung zwischen Forge und unserer React-Oberfläche getestet.

## Nächste Umsetzung

1. Separaten Forge-Prozess mit strukturierten Spielerentscheidungen und Ereignissen anbinden. Browser dürfen keine internen Engine-Objekte oder vollständigen versteckten Zonen erhalten.
2. Erst eine interaktive Zwei-Spieler-Partie mit Wirken, Zielwahl, Priorität, Trigger und Verrechnung durch unsere Oberfläche prüfen. Alle Entscheidungen in kompakten Menüs direkt am Tisch darstellen.
3. Danach vier Spieler, Partner-Commander, Wiederverbindung, persistente Entscheidungen und private Hände testen.
4. Für einen assistierten Casual-Modus manuelle Ausnahmen explizit modellieren: Hausregel-Mulligan, verspätete Trigger und korrigierte Zustände. Bereits verrechnete Informationen lassen sich nicht einfach durch ein UI-Undo zurückholen.
5. Bestehenden freien Tisch als eigenen Modus erhalten. Ein Moduswechsel während einer laufenden Partie wird zunächst nicht angeboten.

Eine vollständige Forge-Anbindung ist ein eigenes Integrationsprojekt. Einzelne Karten-Skriptzeilen direkt in unsere Engine zu kopieren reicht nicht: Kosten, Trigger, Ziele, kontinuierliche Effekte und Zustandsprüfungen hängen zusammen.

## Nachweise und Quellen

Lokale Logs und Testcode: work/forge-evaluation/two-player.log, four-player.log (abgebrochen), four-player-extended.log, probe.log, server-mode.log, coverage.json, results.json, ForgeProbe.java, verify-results.mjs. In der Projektwurzel den vorhandenen Node-Runtime mit work/forge-evaluation/verify-results.mjs starten, um die Ergebnisse erneut auszuwerten.

- Moxgate erklärt seine Verwendung von Forge und den geschlossenen eigenen Quellcode: https://www.moxgate.com/faq/
- Getestetes offizielles Release: https://github.com/Card-Forge/forge/releases/tag/forge-2.0.15
- Simulationseinstieg: https://github.com/Card-Forge/forge/blob/forge-2.0.15/forge-gui-desktop/src/main/java/forge/view/SimulateMatch.java
- Server-Einstieg: https://github.com/Card-Forge/forge/blob/forge-2.0.15/forge-gui-desktop/src/main/java/forge/view/Main.java
- Controller: https://github.com/Card-Forge/forge/blob/forge-2.0.15/forge-game/src/main/java/forge/game/player/PlayerController.java
- Lizenz GPL-3.0: https://github.com/Card-Forge/forge/blob/forge-2.0.15/LICENSE

Die Evaluation übernimmt keine fremden Dateien in unser Produktionsarchiv. Vor einer tatsächlichen Forge-Veröffentlichung müssen Lizenzhinweise und die Bereitstellung der erforderlichen Quellen Teil des Releases sein.
