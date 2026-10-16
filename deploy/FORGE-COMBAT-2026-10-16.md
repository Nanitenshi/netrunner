# Forge: verständlicher Kampf und native Blockprüfung

Aufbauend auf dem gemergten PR #21. Ausschließlich Forge-Tisch; kein Live-Deployment.

## Verhalten

- Angreifer werden in einer beschrifteten Auswahl mit Stärke/Widerstandskraft vorgemerkt. Einzelwahl auf dem Tisch bleibt möglich, dazu kommen „Alle angreifen lassen“ und „Auswahl leeren“. Nur Bestätigen erklärt tatsächlich den Angriff. Während einer laufenden Auswahl nennt die Phasenanzeige die erforderliche Entscheidung.
- Blocker werden nach eigener Kreatur gruppiert. Jeder legale gegnerische Angreifer ist direkt als Ziel wählbar. Bei normalen Blockern ersetzt ein Klick auf ein anderes Ziel die vorherige Zuordnung. Zusätzliche Blockkapazität stammt aus Forge, nicht aus Kartentext-Heuristiken. Angriffspflichten, Menace und andere Gruppenvorgaben werden weiterhin nativ geprüft.
- **Regelfix:** `CombatUtil.validateBlocks` prüft Gruppenvorgaben, aber nicht die Höchstzahl der Angreifer pro Blocker. Deshalb prüft der Adapter jede gewählte Paarung zusätzlich mit `CombatUtil.canBlock` gegen die bereits vorgemerkten nativen Zuordnungen. Eine unzulässige Mehrfachzuordnung wird vollständig entfernt, bevor eine neue Entscheidung erscheint. Wall of Glare darf weiterhin mehrere Angreifer blocken.
- Komplexere Schadensverteilungen bekommen einen nativen Vorschlag: in der vorgegebenen Reihenfolge bis zur tödlichen Zuweisung auf Kreaturen, Rest bei Trampelschaden zum Verteidiger. Markierter und bereits zugewiesener Schaden sowie Todesberührung gehen in die erforderliche Zuweisung ein. Ein einfacher Empfänger ohne Trampelschaden wird weiterhin ohne Auswahldialog behandelt.
- Der Vorschlag ist vorausgefüllt, mit einem Klick bestätigbar und manuell änderbar. Legales Überzuweisen bleibt möglich. Fehlende Punkte, verletzte Reihenfolge und zu früher Trampelschaden sperren die Bestätigung in der UI. Manipulierte Antworten prüft der Adapter unabhängig davon erneut. Schadensverhinderung und Ersatzeffekte werden erst bei der tatsächlichen Verrechnung berücksichtigt; die Vorschau behauptet keinen garantierten Kreaturentod.
- Entscheidungsfehler werden im jeweiligen Panel angezeigt. Doppelklicks können die Bestätigung nicht doppelt auslösen. Neuladen rekonstruiert die native Entscheidung; unbestätigte lokale Angreifer-/Blockentwürfe werden dabei verworfen, bestätigte Engine-Zuordnungen bleiben bestehen.
- Die Kampfübersicht zeigt bestätigte Angreifer und Blocker. Ein geblockter Angriff bleibt auch nach dem Entfernen seiner Blocker als geblockt gekennzeichnet. Ohne Trampelschaden wird dadurch kein Spielerschaden suggeriert.
- Ein Hinweis erklärt, was nach beidseitigem Passen geschieht: oberstes Stack-Objekt, Angreiferwahl, Blockerwahl, Reaktionsfenster vor Schaden, Fenster nach Erstschlag oder zweite Hauptphase. Menschliche Züge enden weiterhin ausdrücklich mit Bestätigung.

## Grenzen

Dies ist ein nachvollziehbarer Vorschlag für eine einzelne Schadensverteilung, keine strategische Bewertung des gesamten Zuges. Angriffsziele außerhalb des gegnerischen Spielers, zusätzliche Kampfphasen, Sonderformen der Schadenszuweisung und die bisher nicht freigegebenen Kosten werden durch diesen PR nicht allgemein unterstützt. Zwei Plätze bleiben die unterstützte Tischgröße. Eine beliebige Rücknahme bereits bezahlter oder verrechneter Aktionen wird nicht eingeführt.

## Prüfungen

- 260 Anwendungstests bestanden, inklusive Block-Neuzuordnung, nativer Sonderkapazität, Schadensregeln, Datenschutz und Prioritätshinweisen.
- Produktionsbuild und frische Kompilierung aller acht Produktions-Java-Dateien gegen Forge 2.0.15 / Java 17.
- `forge-bridge/tests/ForgeCombatPolicyTest.java`: normale Mehrfachblocks abweisen und vollständig zurücksetzen; erneute legale Auswahl mit Wall of Glare; 2/2/2-Trampelvorschlag; manipulierte illegale Verteilung; Todesberührung und bereits markierter Schaden. Die Prüfklasse wird separat kompiliert und gehört nicht in den Serverstart.
- `scripts/test-forge-combat.mjs`: ungeblockter Schaden, Flugfähigkeit, Erst-/Doppelschlag, Mehrfachblock, Trampeln, Todesberührung/Lebensverknüpfung, Reaktion vor Schaden, Einsatzverzögerung, leerer Angriff und entfernter Blocker ohne nachträglichen Nichttrampel-Spielerschaden.
- `scripts/test-forge-combat-browser.mjs`: zwei echte Desktop-Gäste, Angriffsvormerkung, Blockerwechsel, Neuladen während Block- und Schadenswahl, vorausgefüllter nativer Vorschlag, gesperrte illegale Verteilung, Bestätigung per Doppelklick, tatsächlicher Schaden/Tod, zweite Hauptphase und Zugübergabe.
- `scripts/test-forge-commander-browser.mjs`: zusammenhängende Commander-Partie vom Gast-Login und eigenen Decks über Mulligan, Land, manuelle Zahlung samt Abbruch/Korrektur, direkte Manaaktivierung, Commander, Priorität, mehrere Züge bis zum Angriff mit echtem Lebens-/Commander-Schaden, zweiter Hauptphase und nächstem Spieler.
- Bestehende native Commander-, P0- und KI-Interaktionsprüfungen.

Native Skripte benötigen absolute `FORGE_JAVA`, `FORGE_RUNTIME` und `FORGE_CLASSES`, Browser zusätzlich `PLAYWRIGHT_MODULE` und gegebenenfalls `CHROME_PATH`.

## Installation

Frontend, Server und alle acht Produktions-Java-Dateien gemeinsam aktualisieren. Der Commander-Start verlangt zusätzlich das Adaptermerkmal `combat-decisions` und weist alte Klassen ab. Bestehende Runtime, Daten und Serverkonfiguration erhalten. Ein Merge führt kein Deployment aus.

Alle oben genannten Prüfungen bestanden. Die Desktop-Aufnahmen von Block- und Schadenswahl wurden zusätzlich visuell geprüft.
