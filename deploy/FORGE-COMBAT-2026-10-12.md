# Forge-Kampf: Implementierung und Prüfung

Stand: 12. Oktober 2026. Separater optionaler Zweispieler-Testmodus; kein Server-Deployment.

## Bedienung

Im Forge-Testtisch das Szenario **Kampf** wählen. **Angreifen** eröffnet den Kampf mit einer Reaktionsmöglichkeit für beide Spieler. Eigene legal angreifende Kreaturen anklicken und den Angriff bestätigen; eine leere Auswahl verzichtet auf den Angriff.

Zum Blocken zuerst eine eigene Kreatur, dann den gegnerischen Angreifer anklicken. Zuordnungen erscheinen kompakt am Tisch und lassen sich einzeln entfernen. **Nicht blocken** ist ebenfalls möglich. Angriff und Blocken werden von Forge geprüft; illegale Kombinationen verlangen eine korrigierte Auswahl.

Bei mehreren Schadensempfängern beziehungsweise Trampelschaden erscheint eine kleine Verteilung mit direkt editierbaren Zahlen. Forge verrechnet den bestätigten Schaden. Ein einzelner Empfänger ohne alternative Verteilung benötigt keine zusätzliche Bestätigung. Vor Angreifern, Blockern und Schaden bleiben Reaktionsfenster; Erstschlag und Doppelschlag erhalten ihren echten Engine-Schritt. Nach dem Kampf geht es zur zweiten Hauptphase.

## Prüfung

- 212 Anwendungstests, TypeScript und Produktionsbuild bestanden.
- Echte Forge-Verrechnung für ungeblockte Angriffe, Flugfähigkeit, Doppelschlag, Mehrfachblock, Trampelschaden mit tödlicher Mindestzuweisung, Todesberührung und Lebensverknüpfung geprüft.
- Ein Spontanzauber kann einen Angreifer vor dem Schaden entfernen; er verursacht anschließend keinen Kampfschaden.
- Neu gewirkte Kreaturen mit Einsatzverzögerung sind nicht als Angreifer verfügbar; eine leere Angriffsauswahl beendet den Kampf ohne Schaden.
- Private Effektentscheidungen und echte Zugwechsel einschließlich Abwerfen bestehen weiterhin.
- Zwei Browser: Angreifer wählen, zwei Blocker zuweisen, während der Blockerauswahl neu laden, Schaden verteilen, Friedhof-Reihenfolge festlegen und Testtisch verlassen bestanden. Keine erfassten JavaScript-Fehler.
- Screenshots: `milestones/forge-combat/angriff.png`, `blocken.png` und `schaden.png`.
- Reproduzierbare Engine-Prüfung: `node scripts/test-forge-combat.mjs` mit den drei in `forge-bridge/README.md` beschriebenen Forge-Pfaden.

## Grenzen

Dieses Szenario verwendet vorgegebene Kreaturen und erlaubt Angriffe auf den gegnerischen Spieler. Planeswalker, Battles, besondere Angriffskosten, Banding und ungewöhnliche Schadensverteilungen sind nicht freigegeben. Die Auswahl verteilt maximal 128 Schadenspunkte. Eigene Commander-Decks und vier Spieler sind weiterhin nicht Teil der Forge-Automatik.

Die menschlichen Entscheidungen für komplexe Kosten und weitere Sonderfälle müssen vor einer Freigabe beliebiger Decks geprüft werden. Ein gleichzeitig eintretender Friedhof-Zonenwechsel kann eine Reihenfolgeentscheidung des Eigentümers verlangen. Der separate Casual-Tisch behält seine bisherigen Regeln und Korrekturmöglichkeiten.

Java, Forge-Ressourcen und drei kompilierte Bridge-Klassen sind erforderlich; das normale Server-Archiv allein aktiviert diesen Modus nicht.
