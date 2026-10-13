# Eigene Commander-Decks und gemeinsame Automatisierung

## Bedienung

Im Automatik-Testtisch wählt der Gastgeber **Eigene Commander-Decks**. Beide
Spieler wählen ein lokales, im Konto gespeichertes oder vorbereitetes Deck,
bestätigen ihre Bereitschaft und behalten ihre Starthand oder nehmen kostenlose
Mulligans auf sieben. Das Deck enthält nach der bestehenden Hausregel 100–250
Karten einschließlich eines oder zweier legal kombinierter Commander.

Fehlende Forge-Kartenscripts verhindern den Start. Der betroffene Spieler sieht
seine fehlenden Karten und kann das Deck ändern. Es gibt keine Ersatzkarten.
Die Liste, Hand, Bibliothek, Notizen und privaten Auswahloptionen bleiben privat.

Die Automatisierung wird nach Mechaniken erweitert. Dadurch profitieren eigene
und vorbereitete Decks gemeinsam von einer implementierten Fähigkeit. Dieser
Stand ergänzt allgemeine Aktivierungen, Fetchländer, Cycling, einfache
Filtermana-Bezahlung und öffentliche Kartenziele außerhalb des Battlefields.

## Prüfung mit Forge 2.0.15

- 228 Anwendungstests und TypeScript-/Produktionsbuild bestanden.
- Echte 100-Karten-Bibliotheken, sieben private Startkarten, Mulligans und
  Zugwechsel mit Ziehen; native Kommandozone und zwei Partner-Commander.
- Commander wirken und verrechnen; freiwillige Rückkehr in die Kommandozone;
  unzureichendes Mana bei Tax +2 abgewiesen, danach drei tatsächliche Mana bezahlt.
- Menschlicher Angriff und native Erfassung von Commander-Schaden; Aufgeben
  beendet die Partie ohne Verschiebung der Sitzzuordnung.
- Fetchland: Lebenszahlung, Tap und Quellenopfer, private menschliche
  Bibliothekssuche und tatsächliches Land auf dem Battlefield.
- Regrowth: legaler Friedhofsziel-Dialog und Rückkehr des geopferten Fetchlands.
- Cycling: Quellenabwurf, tatsächliche Manazahlung und Ziehen bei Verrechnung.
  Manuelle Manafähigkeit behält Priorität; Floating Mana bezahlt einen Commander.
- Ferrous Lake: unzureichende Quellen abgewiesen, danach Aktivierungsmana bezahlt
  und Blau/Rot für Adeliz verwendet. Begrenzte Planung berücksichtigt jede
  mögliche Farbe für generische Aktivierungskosten.
- Alle fünf vorbereiteten Decks laden ihre vollständigen Kartenscripts,
  Kommandozonen und echten Bibliotheken. Vollständige Partien dieser Decks sind
  noch kein Prüfergebnis.
- Frühere Stack-, Effekt-, Kampf- und Zusatzkosten-Szenarien bleiben als
  Regressionstests erhalten.
- Zwei getrennte Browser: eigene Konto-/Lokal-Deckauswahl, geteilte Moduswahl,
  private Decklisten, Bereitschaft, Mulligan, Reload, Land und Commander,
  Verrechnung, Aufgeben und Verlassen. Mobile und Desktopansicht visuell geprüft.

Die reproduzierbaren Befehle stehen in [forge-bridge/README.md](../forge-bridge/README.md).
Screenshots liegen lokal unter `.local/browser/commander-*.png`.

## Nächste Schritte

Zuerst weitere private Effektentscheidungen und Zonenübergänge mit echten Karten
prüfen, anschließend X-/Counter-/Reveal-/Exilkosten und alternative Bezahlung.
Danach komplexe Manaquellen und zusätzliche Wirkzonen, schließlich mehrzügige
Tests der Hauptmechaniken jedes vorbereiteten Decks.

Der Forge-Modus bleibt experimentell mit zwei Menschen und ohne Neustart-
Persistenz. Einige geerbte Controller-Entscheidungen, vor dem Spiel ausgeführte
Aktionen, Sonderkosten und besondere Kampfregeln sind noch nicht geprüft.
Server müssen alle sechs Java-Dateien neu kompilieren; der normale Docker-Build
enthält weiterhin keine Forge-Laufzeit.
