# Bedienung und fehlende Grundlagen — 9. Oktober 2026

Fortschritt vom 11. Oktober: Zusätzliche Landspiele, besser erreichbare Mengen-/Commander-Zähler, kompaktes Kontextmenü und stärkere Holo-Tischoptik sind lokal umgesetzt. [Aktueller Bericht](LANDS-COUNTERS-TAVERN-2026-10-11.md).

Fortschritt vom 10. Oktober: Karteneditor, Anlegen und doppelseitige Karten sind lokal umgesetzt und geprüft. Details und verbleibende Grenzen: [Karten bearbeiten und anlegen](CARD-EDITOR-2026-10-10.md). Die folgende Bestandsaufnahme dokumentiert den ursprünglichen Prüfstand.

## Ergebnis

BatusMTG besitzt viele Einzelwerkzeuge, aber noch keinen durchgehend vollständigen Casual-Tisch. Das größte Problem ist die Mischung aus manueller Ausführung und eingeschränkter Regelprüfung: Die Oberfläche verlangt Entscheidungen oder blockiert Aktionen, während die Engine den zugehörigen Kartentext nicht umfassend versteht. Mehr visuelle Effekte allein lösen das nicht.

Die gewünschte Richtung bleibt: gemeinsamer Tisch mit vier Playmatten, nur Zugwechsel, mündliche Absprachen, geführter Stack und frei korrigierbare Casual-Aktionen. Kein erneuter Phasenzwang und kein verpflichtender Mana-Pool.

## Grundlage des Vergleichs

- MoxGate: Start, Commander-Deckauswahl, Solitär-Casual-Tisch, Starthand, Ziehen, Ausspielen von Viridian Corrupter und Karteneditor im Browser angesehen. Der Karteneintritt bot eine kleine Ziel-Aktion; der Editor bot getrennte P/T-Werte, Counter, verdeckte Zustände und Schlüsselwörter. Die Hand war stark überlappend; außerdem lief ein Zugtimer. Diese beiden Details sollten wir nicht ungeprüft übernehmen.
- [MoxGate FAQ](https://www.moxgate.com/faq/): trennt Casual-Tisch und regelgeführtes Spiel mit Forge. Dokumentiert außerdem Reaktionseinstellungen und Hilfen für lange Triggerfolgen. Kein vollständiger Mehrspieler-Vergleichstest auf MoxGate durchgeführt.
- [Untap.in Updates](https://www.untap.in/updates): Werkzeuge nahe Hand/Deck, ausblendbare Aktionsleiste, optionale kartengebundene Skriptaktionen. Grundlage ist die offizielle Dokumentation, kein eigener Untap-Matchtest.
- [Cockatrice Kurzguide](https://github.com/Cockatrice/Cockatrice/wiki/One-minute-game-guide): direkte Kontextaktionen, P/T-Eingabe, Mehrfachaktionen, Zielpfeile und begrenzte Rücknahme einer Ziehaktion. Grundlage ist die offizielle Dokumentation.
- Abgleich mit den lokalen Dateien shared/game.ts, shared/engine.ts, shared/rules-types.ts, shared/placement.ts, src/interaction.ts, src/direct-play.ts, src/CardMenu.tsx, src/MechanicsPanel.tsx, src/StackPanel.tsx, src/Tabletop.tsx, src/network.ts und src/DeckWorkshop.tsx.

## Bestätigte Lücken nach Auswirkung

| Priorität | Lücke | Aktuelles Verhalten | Nötige Verbesserung |
|---|---|---|---|
| P0 | Rückseiten und Transformation | Engine und Spielaktion verwenden die Vorderseite; die Oberfläche weist ausdrücklich auf fehlende Seitenauswahl hin. | Spielbare Seite wählen; transformieren/umdrehen; sichtbare Seite, Werte und Bild bei allen synchronisieren. MDFC und transformierende Karten unterscheiden. |
| P0 | Casual-Ausnahmen beim Spielen | Ein Land pro Zug ist fest begrenzt. Reguläres Wirken ist auf Hand/Kommandozone beschränkt, mit einer Sonderaktion für Hideaway. | Einfacher, protokollierter Weg für zusätzliche Länder, Wirken aus Friedhof/Exil und besondere Spielberechtigungen. Stack beibehalten. |
| P0 | Unerwartet endgültige Niederlage | 0 Leben, Gift oder Commander-Schaden können automatisch zum Ausscheiden führen; dabei werden eigene Karten entfernt. | Im Casual-Modus versehentliche Eingaben korrigierbar halten und Ausscheiden bewusst bestätigen. Aufgeben bleibt ausdrücklich möglich. |
| P1 | Auren und Ausrüstung | Kein gespeicherter Bezug zwischen angelegter Karte und Ziel. | Anlegen durch Zielauswahl/ziehen, sichtbare Verbindung, gemeinsames Verschieben, korrektes Lösen bei Zonenwechsel. |
| P1 | Temporäre Kartenwerte | P/T werden aus gedruckten Werten und +1/+1-/−1/−1-Marken berechnet. | Stärke/Widerstandskraft unabhängig von Marken ändern; temporäre Änderungen und Notizen markieren. |
| P1 | Verdeckte Zustände und Zeigen | Hideaway ist ein Sonderfall; keine allgemeinen Aktionen für Morph/Manifest, einzelne Handkarte zeigen oder Hand vorzeigen. | Eigener öffentlicher Zustand plus private Identität; bewusste Aktionen zum Zeigen/Aufdecken. |
| P1 | Fähigkeiten und Trigger an der Quelle | Fähigkeiten werden vorwiegend über ein allgemeines Menü mit Texteingabe angesagt. | Häufige Aktionen direkt an der Karte; Quelle vorausfüllen; bekannte Skripte anbieten und manuelle Aktion behalten. |
| P1 | Stack-Bedienung | Geordneter Stack und Priorität sind vorhanden, aber beliebige Zieländerungen, Spruchkopien und wiederholte Trigger sind nicht als allgemeine Werkzeuge umgesetzt. | Ziele sichtbar zuordnen, Stack-Objekte kopieren/umlenken, gleiche Trigger als Menge ansagen; Reaktionsfenster erhalten. |
| P1 | Viele gleiche Permanents | Gruppierung existiert in der optionalen Kartenübersicht, nicht auf dem freien Tisch. Die Platzsuche besitzt 21 Kandidatenplätze und kann sie danach erneut verwenden. | Im gemeinsamen Tisch gleiche Token zusammenfassen, einzelne abspalten und verschiedene Tap-Zustände/Counter erhalten. Mit 30–100 Token testen. |
| P1 | Gemeinsames Zeigen und Kampf | Kein allgemeiner Ping oder Zielpfeil zwischen Spielern/Karten; ein spezieller Botkampf ersetzt keine gemeinsame Markierung. | Karte anpingen, Angriffsziel/Blocker optisch markieren. Kampf bleibt nach Wunsch mündlich regelbar. |
| P2 | Commander-Nebenmechaniken | Eigene Counter erlauben Behelfe, aber keine eigenen Zustände für Monarch, Initiative, Ringträger, Dungeon, Storm oder Phasing. | Kleine bedarfsabhängige Marker und passende Hilfen; nicht alle ständig anzeigen. |
| P2 | X, Modi und Sonderkosten | Stack speichert keinen allgemeinen X-Wert/Modus. Kosten und viele Ziele bleiben mündlich; nur ausgewählte Karten besitzen gezielte Auflösung. | Optionale kompakte Angaben am Spruch, ohne leere Bestätigungsdialoge. Keine vollständige Regeldurchsetzung versprechen. |

## Konkrete Ursachen für den Klickaufwand

1. src/direct-play.ts öffnet bei jedem Vorkommen von `target` im Kartentext einen Wirkdialog. Das betrifft auch Kreaturen mit Eintrittsfähigkeiten. Der Dialog bietet für die meisten dieser Karten keine konkrete Zielentscheidung; die Zielauswahl ist auf einzelne implementierte Karten begrenzt.
2. Fähigkeiten und unbekannte Spontanzauber/Hexereien öffnen eine manuelle Verrechnung. Das ist für korrekte Absprachen sinnvoll, fühlt sich mit allgemeinen Formularen aber wie eine zweite Bedienaufgabe an. Eine kompakte, nicht blockierende Anzeige mit den gerade benötigten Aktionen wäre besser.
3. Standardmäßig steht Reagieren auf „Immer“. Auto existiert, erkennt jedoch nur mögliche Antworten anhand von Kartentyp/Text, nicht sämtliche legalen Antworten samt Kosten und kontinuierlichen Effekten. Es darf nicht als vollständige Regelprüfung bezeichnet werden.
4. Karte, globales Aktionsmenü, Stack, Counterfenster und Korrekturformular bieten unterschiedliche Bedienwege. Häufige Aktionen brauchen einheitliche Ziele und Gesten; seltene Aktionen gehören in ein aufklappbares Menü.
5. Die Hand und das Aktionsdock können denselben Bereich belegen. Für volle Hände muss die Erreichbarkeit jeder Karte gezielt geprüft werden, statt nur das Gesamtbild zu bewerten.
6. Der aktuelle Produktionsbuild bündelt knapp 28 MB JavaScript vor Kompression. Das ist ein konkreter Kandidat für langsameren Einstieg. Für Aussagen über Spiel-FPS fehlen noch Messungen; hierfür sollten Katalog und Kartenlisten getrennt geladen und die echte Laufzeit gemessen werden.

## Bereits vorhanden — nicht erneut bauen

Kostenlose Mulligans nach Hausregel, Hand umsortieren, Hover-Vorschau, Tappen per Taste unter der Maus, Leben in größeren Schritten, Standard- und eigene Counter, Würfel/Münzen, Token-Katalog samt Kartenbezug, private Bibliothekssuche, Scry/Surveil/Discover/Cascade/Hideaway als Hilfsaktionen, Commander-Tax/-Schaden, manuelle Korrekturen, Aufgeben/Verlassen, Online-Wiederverbinden und serverseitig gespeicherte Räume. Nicht jede Hilfe führt beliebigen Kartentext automatisch aus.

Auch Deckspeicherung im Konto existiert; Speichern und Laden erfordern derzeit eigene Knöpfe. Das ist ein Komfortthema, keine fehlende Kontofunktion.

## Empfohlene Umsetzung in drei Blöcken

1. **Grundaktionen zuverlässig machen:** P0-Lücken, Anlegen, P/T, verdeckte Karten, einfache Zielmarkierung. Einen kleinen Karteneditor schaffen statt vieler neuer Fenster. Bestehende Casual-Korrekturen direkt erreichbar machen.
2. **Abläufe verkürzen:** leere Wirkdialoge entfernen, häufige Quellenaktionen, wiederholte Trigger und Token-Mengen, räumlich getrennte Hand und Bedienelemente. Stack und private Entscheidungen behalten. Keine automatischen Entscheidungen bei unbekannter Legalität.
3. **Einladender Einstieg und Prüfung:** Deck wählen → Tisch erstellen/beitreten → bereit. Einladungslink, kurze überspringbare Einführung, klare aktive Spieleranzeige, optionale leise Rückmeldung und sichtbare Wiederverbindung. Startlast messen und verringern.

Abnahmeszenarien: Voltron mit Ausrüstung/Auren; MDFC/Transform-Deck; Reanimator mit Friedhof/Exil; Token-Deck mit 30–100 Permanents; lange Triggerfolge; versehentliche Leben-/Countereingabe; Verbindungsabbruch mit anschließender Wiederaufnahme. Jeweils zwei und vier Spieler, kleine und große Fenster. Das sind geplante Prüfungen, keine bereits vollständig getesteten Partien.

## Stand des parallel fertiggestellten Updates

Die neue räumliche Viereransicht sowie Übernehmen, Zurückgeben und gegnerische Token-Kopien sind lokal umgesetzt und geprüft. 154 automatisierte Tests sowie die Browserprüfung mit vier Sitzungen bestehen; Duellansicht ebenfalls geprüft. Diese Prüfungen belegen die getesteten Funktionen, nicht die Vollständigkeit sämtlicher MTG-Regeln. Noch nicht auf dem öffentlichen Server installiert.
