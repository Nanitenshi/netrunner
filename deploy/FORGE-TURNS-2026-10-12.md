# Forge – Zugwechsel und erste menschliche Entscheidungen

Im separaten Forge-Testmodus umgesetzt:

- „Zug beenden“ öffnet zunächst ein Reaktionsfenster im End Step.
- Nach dem Passen beider Spieler führt Forge Cleanup, Enttappen, Upkeep,
  Ziehen und den Wechsel zur nächsten Hauptphase aus. Leere Zwischenphasen
  brauchen keine zusätzlichen Klicks; der Stack bleibt nutzbar.
- Länder aus der Hand werden direkt gespielt. Forge prüft Timing und die
  erlaubte Anzahl; seine Zugbereinigung setzt die Landzählung zurück.
- Bei zu vielen Handkarten wählt der Spieler selbst die abzuwerfenden Karten.
  Gegner sehen die Anzahl, aber keine Kartennamen oder IDs der Auswahl.
- Falscher Spieler, falsche Anzahl, doppelte Karten und veraltete Entscheidungen
  werden vor Änderungen zurückgewiesen. Während einer Entscheidung sind
  Wirken, Länder und Passen gesperrt.
- Der bisherige KI-Controller darf im Testlauf keine Angreifer bestimmen und
  keine Karten für das Abwerfen auswählen.

Prüfung: Java kompiliert; tatsächliche Forge-Testläufe für Zugwechsel,
Enttappen, Ziehen, Landlimit und menschliches Abwerfen bestanden. Zwei
authentifizierte Socket-Sitzungen sowie zwei getrennte Chromium-Sitzungen
prüfen Stack/Antworten, sechs aufeinanderfolgende Zugwechsel, Abwerfen,
Neuladen und Verlassen. TypeScript, Build und alle 210 Tests bestanden.

Die echte Engine-Prüfung ist wiederholbar: Mit den drei FORGE-Variablen aus
`forge-bridge/README.md` führt `node scripts/test-forge.mjs` den Test aus.

Grenzen: Weiterhin vordefinierte Testkarten. Kampf wird ohne Angreifer
durchlaufen; interaktive Angreifer/Blocker, allgemeine Entscheidungen während
einer Spruchverrechnung, optionale Trigger und eigene Commander-Decks sind
noch nicht freigegeben. Der Adapter verwendet drei private Phasen-Hooks der
festgelegten Forge-Version 2.0.15, weil diese keine öffentliche Einzelschritt-API
anbietet. Er setzt für Zugwechsel keine fiktiven Phasen/Zugnummern.

Keine Veröffentlichung auf dem Live-Server, kein neuer Server-Download.
Casual-Engine bleibt unabhängig. Nächster Schritt: menschliche Kampf- und
Verrechnungsentscheidungen, anschließend Commander-Decks.

Screenshots: `milestones/forge-turns/zugwechsel.png` und
`milestones/forge-turns/abwerfen-entscheidung.png`.
