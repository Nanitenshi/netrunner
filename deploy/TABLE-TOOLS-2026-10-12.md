# Tischaktionen, Kampf und zeitliche Effekte — 12. Oktober 2026

Lokal umgesetzt und geprüft. Dieses Paket ist noch nicht auf dem öffentlichen Server installiert.

## Reihenfolge und Ergebnis

1. Massenaktionen: Mehrere eigene Permanents mit Umschalt + Klick wählen und gemeinsam tappen, enttappen, opfern, ins Exil oder auf die Hand bewegen. Gleiche Token-/Ländergruppen bieten gemeinsame Zonenwechsel ebenfalls an. Die Auswahl wird vollständig geprüft und als eine Serveraktion ausgeführt. Markenänderungen der Auswahl laufen ebenfalls gemeinsam.
2. Sichtbarer Kampf: Rechtsklick auf eine Kreatur → Kampf, oder das Kampfsymbol der Auswahl. Angriffsziel beziehungsweise Angreifer zum Blocken wählen. Die Markierungen sind für alle Spieler sichtbar. Angreifer werden getappt; erkannte Wachsamkeit wird berücksichtigt. Kampf beenden und Zugwechsel entfernen die Markierungen. Es gibt weiterhin keine verpflichtenden Phasenfenster.
3. Zeitliche Effekte: Rechtsklick → Effekt oder Effekt-Symbol der Auswahl. Stärke- und Widerstandsbonus eingeben, mit Dauer bis Zugende, an eine offene Quelle gebunden oder manuell. Die Boni addieren sich zu Grundwerten und Marken und verschwinden bei Ablauf. Eine neue Karteninstanz nach Zonenwechsel erbt den Bonus nicht. 0/0 kann als bloße Erinnerung dienen.
4. Verknüpfte Karten: Der Quelleneditor bietet gemeinsames Zurückbringen auf die Hand oder aufs Feld, Permanent-Kopien und das kostenlose Wirken einer verknüpften Spontanzauber-/Hexerei-Kopie. Unterstützte Ziele werden vor dem Wirken gewählt. Die Spruchkopie geht auf den Stack, die Originalkarte bleibt liegen. Berechtigung und Sonderbedingungen prüft die Runde.
5. Korrekturen: Kampf / Effekte → Korrektur zeigt die letzten Massenaktionen. Die letzte eigene Massenaktion lässt sich im selben Zug mit Begründung zurücknehmen, solange betroffene Karten und zeitliche Effekte unverändert sind und der Stack leer ist. Auch mitbetroffene Auren, entfernte Token und an die Quelle gebundene Boni werden berücksichtigt. Geheime Snapshotdaten werden nicht an andere Spieler gesendet. Ziehen, Aufdecken und beliebige Folgen des Spiels werden nicht zurückgesetzt.
6. Ausscheiden: Eigene Karten werden entfernt, erteilte Deckansichten und Exil-Spielberechtigungen aufgeräumt und verwaiste Spruchobjekte aus dem Stack entfernt. Kontrollwechsel besitzen nun eine Vorgeschichte. Übernommene Karten können an einen verbleibenden vorherigen Controller zurückfallen; fremde Karten, die ursprünglich unter Kontrolle des ausgeschiedenen Spielers ins Spiel kamen, werden gegebenenfalls exiliert.

## Bedienhinweise und Grenzen

Kampf / Effekte ist ein optionales Tischwerkzeug. Kampf wird nicht automatisch ausgewertet. Schaden, Einsatzverzögerung, Flugfähigkeit und andere Blockbedingungen prüft die Runde. Kampfschaden und Commander-Schaden werden weiterhin über die vorhandenen Zähler erfasst.

Zeitliche Werte unterstützen numerische Stärke und Widerstandskraft. Variable Werte wie * werden weiterhin am Tisch bestimmt. Beliebige zusätzliche Fähigkeiten und andere Folgen sind bei 0/0-Erinnerungen nicht automatisch implementiert. Komplexe kontinuierliche Kontroll-, Ersatz- und Dauereffekte bleiben außerhalb der vollständigen Regelautomatisierung.

Die Quellenaktionen sind bewusste manuelle Werkzeuge. Insbesondere kostenloses Kopiewirken ersetzt keine automatische Erkennung jeder einzelnen Karte oder ihrer Auslösebedingungen. Spezielle Wiederbelebungs-Kontrolle kann weiterhin über Kontrolle übernehmen angepasst werden.

Die neue Bedienung ist in der Erklärungsliste unter Einstellungen → Steuerung enthalten.

## Prüfung

- TypeScript und Produktionsbuild erfolgreich.
- 201 Tests bestanden, einschließlich atomarer Massenaktionen, sicheren Rücknahmen, zeitlicher Boni und Quellenablauf, Kampfmarkierungen, verknüpfter Rückkehr und Spruchkopie sowie Spieler-Ausscheiden mit gestohlenen Karten und offenen Spruchobjekten.
- Browserprüfung mit vier verbundenen Spielern: sichtbare Angreifer und Blocker, zeitlicher Bonus, gemeinsames Opfern, Wiederherstellen der Token per Korrektur, verknüpfte Rückkehr, Swords-Spruchkopie mit Zielauswahl und anschließender Verrechnung, Ablauf beim Zugwechsel und Panelgröße bei 1366×768.

## Referenz für Ausscheiden

Die [offiziellen Wizards-Mehrspielerhinweise](https://magic.wizards.com/en/news/feature/archenemy-nicol-bolas-release-notes-2017-06-16) unterscheiden das Ende von Kontrollwirkungen vom Exilieren noch kontrollierter fremder Objekte. Diese Unterscheidung wurde für die vom Spiel unterstützten Kontrollaktionen umgesetzt.

## Screenshots

milestones/playtest-usability/kampf-angreifer-blocker.png
milestones/playtest-usability/zeitliche-effekte.png
milestones/playtest-usability/verknuepfte-spruchkopie.png
