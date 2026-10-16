# Forge: Entscheidungen vor der Zahlung

Nach dem gemergten PR #20 sichert diese Erweiterung die noch offenen Übergänge zwischen Auswahl, Kosten und Stack ab. Der Forge-Tisch bleibt der einzige Fokus; es erfolgt kein Live-Deployment.

## Tatsächliche Ablaufänderungen

- **Ziele und Modi abbrechen:** Während der Ankündigung darf nur der entscheidende Spieler abbrechen. Die ursprünglichen Ziele, Modi, Unterfähigkeiten und Kosten werden wiederhergestellt. Die Karte bleibt in ihrer Zone, Mana und Priorität bleiben erhalten. Dieselbe Karte kann danach erneut gespielt werden. Pflichtentscheidungen während der Verrechnung erhalten dieses Abbruchrecht ausdrücklich nicht.
- **Zusatzkosten vor dem Stack:** Abwerf- und Opferauswahl werden vor dem Verschieben eines Spruchs gesammelt. Der anzukündigende Spruch kann nicht seine eigene Abwerfkostenkarte sein. Gewählte Karten werden für die weiteren Kosten reserviert; dieselbe Karte kann nicht zwei Opfer-/Abwerfkosten bezahlen. Vor der eigentlichen Zahlung werden die gewählten IDs erneut gegen die nativen Kandidaten geprüft. Bei Abbruch wurde noch nichts bezahlt. Die native Zahlung und Stack-Aufnahme folgen erst danach.
- **Privatsphäre:** Eine noch nicht bezahlte Handkarte erscheint weder als Stack-Karte beim Gegner noch über ihren Namen im öffentlichen Abbruchprotokoll. Abbruchrecht, private Vorschau und Zugende-Zusammenfassung werden nur an den entscheidenden Sitz projiziert.
- **Aktivierungen mit Mana und Tapkosten:** Für einfache Nichtmana-Fähigkeiten mit festen Mana-/Selbsttapkosten gilt jetzt derselbe automatische bzw. optionale manuelle Zahlungsweg wie beim Wirken. Der eigene Tapkosten-Träger wird aus den zur Zahlung verfügbaren Manaquellen ausgeschlossen. Die Vorschau nennt die zusätzlichen Tapkosten. Abbruch tappt weder die Fähigkeit noch eine Manaquelle.
- **Ungültiger Zahlungsplan:** Bei unzureichender Quellenwahl zeigt die Vorschau keine veraltete gültige Quellenliste und behauptet keine reine Poolzahlung. Bestätigen bleibt gesperrt, bis eine andere Auswahl erneut geprüft wurde. Die Korrektur erzeugt vor dem Bezahlen eine neue Vorschau.
- **Ein Klick für einfaches Mana:** Forge kennzeichnet ausschließlich einfache feste Ein-Mana-Selbsttapfähigkeiten ohne weitere Kosten oder Unterfähigkeiten als direkte Aktion. Ein Standardland auf dem Feld lässt sich damit direkt für Mana tappen. Fetches, Opfern, Cycling und mehrdeutige Fähigkeiten behalten ihre ausdrückliche Auswahl. Ein Handland wird weiterhin vorrangig als Land gespielt.
- **Zugende mit Überblick:** Vor der Bestätigung zeigt Forge verbleibende Landzüge, aktuell wirkbare Sprüche einschließlich Commander sowie den tatsächlichen Mana-Pool. Die Zahlen stammen aus dem nativen Zustand und bleiben privat. Auf möglichen Manaverfall beim Phasenwechsel wird hingewiesen. Es gibt weiterhin keinen stillen automatischen menschlichen Zugwechsel.
- **Automatik verständlich beschriften:** Mana-Automatik und Aufdeckland-Automatik werden separat benannt. Modus-, Ziel- und Zusatzkostenentscheidungen bieten keine unpassende Automatik-Schaltfläche. Die Prioritätserklärung unterscheidet Stack-Aktionen von Manafähigkeiten, die ihre Priorität behalten.

## Kostenpfad

Unterstützte menschliche Zahlungen verwenden einen gemeinsamen nativen Kostenpfad mit Rollback bei Ablehnung oder Ausnahme. Die Vorbereitung wird vor der tatsächlichen Zahlung versiegelt: Nachfolgende Kosten-/Cast-Trigger können dadurch nicht versehentlich ein Abbruchrecht von der ursprünglichen Ankündigung erben. Die eigentliche Zahlung, Tapzustände, Commander-Tax, Verrechnung und Karteneffekte bleiben in Forge.

Dies ist keine beliebige Rücknahme bereits bezahlter Aktionen. Nach erfolgreicher Zahlung bleiben Zusatzkosten auch dann bezahlt, wenn der Gegner den Spruch neutralisiert. X, weitere bisher gesperrte Kosten und komplexe Manaquellen sind damit nicht vollständig freigegeben. Optionale Schlüsselwortkosten werden durch diese Änderung nicht neu automatisiert.

## Prüfungen

- 255 Anwendungstests mit `pnpm test` und Produktionsbuild mit `pnpm build` bestanden.
- `scripts/test-forge-costs.mjs`: Zielabbruch samt fremder/alter Antworten, unveränderte Hand vor Zusatzkosten, Abbruch ohne öffentliche Namensweitergabe, Abwerfen, Opfern und echte Fling-Verrechnung.
- `scripts/test-forge-decisions.mjs`: Modusabbruch, erneuter Cast mit anderer Wahl und Abweisung eines Abbruchs bei einem verpflichtenden Triggerziel; vorhandene Scry-/Surveil-/Opfer-/Triggerabläufe.
- `forge-bridge/tests/ForgeActivationPaymentTest.java`: Jayemdae Tome mit nativen Mana-/Tapkosten, Vorschau, Abbruch, ungültigem und korrigiertem Plan, Zahlung, gehaltener Priorität und Kartenziehen. Desolate Lighthouse darf seine eigenen Tapkosten nicht durch Doppelnutzung als Manaquelle umgehen. Überlappende Opferkosten müssen vor dem Bezahlen scheitern; eine erneute Auswahl verschiedener Karten bezahlt beide Kosten und das Mana tatsächlich.
- `scripts/test-forge-commander-browser.mjs`: zwei Desktop-Gäste, unzureichende Zahlung, gesperrte Bestätigung, Neuladen, Korrektur, ein Klick für Mana, Poolzahlung, Commander und Zugende-Zusammenfassung.
- `scripts/test-forge-preparation-browser.mjs`: zwei Desktop-Gäste, private Modus-/Zusatzkostenwahl, sichtbare Hand vor der Zahlung, Neuladen, Abbruch und Wiederholung, tatsächliche Zahlung und gegnerisches Reaktionsfenster.
- Bestehende native Prüfungen für Commander, Filtermana, Deckmechaniken, P0, KI, Mana-Policy und Länder werden weiterverwendet.

Native Skripte benötigen absolute `FORGE_JAVA`, `FORGE_RUNTIME`, `FORGE_CLASSES`; Browser zusätzlich `PLAYWRIGHT_MODULE` und gegebenenfalls `CHROME_PATH`. Die Java-Prüfklasse wird separat gegen die Produktionsklassen kompiliert und aus dem Runtime-Verzeichnis gestartet. Sie gehört nicht in den Serverstart.

## Installation

Alle acht Produktions-Java-Dateien zusammen gegen Forge 2.0.15 mit Java 17 kompilieren. Frontend, Server und Adapter gemeinsam aktualisieren und bestehende Runtime sowie Daten erhalten. Der Commander-Start verlangt zusätzlich `action-preparation`; ältere Adapter werden abgewiesen. Ein Merge allein aktualisiert den laufenden Adapter nicht.
