# Forge: menschliche Zusatzkosten und Bedienung

Stand: 13. Oktober 2026. Baut auf dem Forge-Kampfstand aus PR #9 auf.

## Verhalten

Das neue Testszenario **Zusatzkosten · Abwerfen und Opfern** enthält Village Rites,
Tormenting Voice und Fling. Der Spieler wählt selbst, welche zulässige Karte er
abwirft oder welche eigene Kreatur er opfert. Das Wirken kann vor der Zahlung
abgebrochen werden; Hand, Spielfeld, Mana und Priorität bleiben dabei erhalten.
Der zu wirkende Spruch kann nicht für seine eigene Abwerfkosten gewählt werden.

Forge prüft zulässige Kandidaten und bezahlt erst nach der Auswahl. Der Gegner
kann danach reagieren; ein Gegenzauber erstattet bereits bezahlte Kosten nicht.
Fling darf auch einen Spieler als Ziel wählen und verursacht den Schaden anhand
der zuletzt bekannten Stärke der tatsächlich geopferten Kreatur.

Private Auswahloptionen werden dem Gegner nicht übertragen. Fremde, doppelte,
veraltete und unvollständige Antworten werden zurückgewiesen. Neuladen stellt
eine noch offene Auswahl wieder her. Noch nicht unterstützte zusätzliche
Spruchkosten werden abgewiesen, statt die KI entscheiden zu lassen.

## Verbesserte Bedienung

- Phase und Priorität sowie der Spieler mit einer offenen Entscheidung sichtbar.
- Spieler als Spruchziel direkt über den markierten Namen wählen.
- Gültige Zielwahl bleibt bei einer Spielstandsaktualisierung erhalten.
- Auswahlfenster werden nicht mehr von einer Kartenvorschau überdeckt.
- Letzte öffentliche Aktionen lassen sich am Stack aufklappen.
- Karten, Tisch und Auswahlfenster passen sich schmalen Bildschirmen an.
- Entscheidungen und Kartenaktionen sind während einer Verbindungsunterbrechung gesperrt.

## Prüfung

- 213 Anwendungstests bestanden; TypeScript und Produktionsbuild bestanden.
- Alle vier Java-Bridgedateien mit Java 17 und Forge 2.0.15 kompiliert.
- Echte Forge-Kostenprüfung: private Abwerfauswahl, ungültige Antworten,
  Abbruch ohne Zahlung, anschließendes erneutes Wirken und Kartenziehen.
- Echte Forge-Prüfung: selbst gewählte Opferkarte, Reaktionsfenster und
  Kosten bleiben nach Counterspell bezahlt.
- Fling mit Spielerziel: eine geopferte 6/6-Kreatur verursacht sechs Schaden;
  fremde Spieler-IDs werden abgelehnt.
- Bestehende Forge-Prüfungen für Zugwechsel/Abwerfen, Scry, Modi, Opfer,
  optionale Trigger, Trigger-Reihenfolge und Kampf bestanden.
- Zwei Browser: Kosten privat, Neuladen während der Auswahl, Abbruch,
  Zahlung, Gegenzauber, Spielerziel, Schaden und Verlassen bestanden.
- 390×844-Ansicht: keine horizontale Überschreitung, Auswahlfenster innerhalb
  des Bildschirms und bedienbar; keine erfassten JavaScript-Fehler.

Reproduktion: `scripts/test-forge-costs.mjs` und
`scripts/test-forge-costs-browser.mjs`; Voraussetzungen in `forge-bridge/README.md`.
Die Browserprüfung speichert Bilder unter `.local/browser`.

## Grenzen

Weiterhin ein optionaler Zweispieler-Testmodus mit vorgegebenen Karten. Getestet
sind gewöhnliche Abwerf- und Kreaturenopferkosten; alternative Kosten, Kicker,
X-Kosten, andere Nichtmanakosten und beliebige Commander-Decks sind nicht freigegeben.
Der Manazahlungsplaner stammt weiterhin aus Forge. Die normale CI führt die
Anwendungstests und den Build aus; externe Java-/Forge-Prüfungen laufen separat.

Für diesen Stand muss zusätzlich `HumanCosts.java` kompiliert werden. Das normale
Serverpaket allein enthält keinen Forge-Laufzeitmodus. Kein Live-Deployment.
