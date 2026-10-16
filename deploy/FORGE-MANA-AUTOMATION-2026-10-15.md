# Forge: automatische Mana-Zahlung · 15. Oktober 2026

Ergänzung im selben PR: [P0-Prüfung und Interaktionen](FORGE-P0-2026-10-15.md), einschließlich nativer Zugendebestätigung, gehaltener Priorität und zusätzlicher Versionsprüfung `p0-actions`.

Der Forge-Tisch ist der einzige Entwicklungsfokus. Der gemergte Stand von PR #19 ist integriert; dessen Verbesserungen bleiben erhalten. Der normale Regelassistent, Mobile und der Deckersteller werden hier nicht weiterentwickelt.

## Standardablauf

Ein legaler Spruch wird mit einem Klick gewirkt. Forge berechnet einschließlich Commander-Tax einen Zahlungsplan, aktiviert die wirklichen Manafähigkeiten und bezahlt den Spruch in seiner eigenen Engine. Es gibt im Normalfall keinen zusätzlichen Bestätigungsdialog für die Mana-Zahlung.

Bei gewöhnlichen festen Kosten bewertet der begrenzte Planer mehrere legale Lösungen:

1. Vorhandenes, geeignetes Mana aus dem Pool zuerst verwenden.
2. Möglichst wenige Quellen tappen.
3. Bei gleicher Zahl möglichst wenig überschüssiges Mana erzeugen.
4. Bei weiterem Gleichstand Quellen mit mehreren Farben oder anderen Fähigkeiten möglichst offenhalten.

Beispiele: Sol Ring statt zweier Standardländer für zwei generische Mana; ein Standardland statt eines zweifarbigen Landes für eine gleichwertige Zahlung; Wastes statt Strip Mine; Seed-Mana vor der Aktivierung von Ferrous Lake. Quellen mit gleichen Fähigkeiten und gleichem Erhaltungswert werden gruppiert, um Suchaufwand zu begrenzen. Dies sind überprüfbare Heuristiken und keine Garantie global optimaler Spielentscheidungen.

Die tatsächlichen Farben und Kosten stammen aus den nativen Forge-Fähigkeiten. Manazahlen, Kosten oder Spielzustände werden nicht vom Client übernommen. Vor dem Bezahlen wird der gewählte Plan im nativen Kostenpfad erneut geprüft. Die Aktivierungen und die endgültige Zahlung erfolgen über Forge. Der Mana-Pool und die letzte erfolgreiche automatische Zahlung sind im Tisch sichtbar.

## Optionaler Eingriff

**Mana: Automatisch / Selbst wählen** schaltet die persönliche Browser-Voreinstellung um. Standard ist automatisch. Im manuellen Modus zeigt Forge vor jeder unterstützten Zahlung Kosten, Tax, vorhandenen Pool und die geplanten Aktivierungen. Eine andere Quellenwahl erzeugt zuerst eine neue Vorschau; bis zur abschließenden Bestätigung wird nichts bezahlt. Ungültige/insuffiziente Quellen bezahlen nichts. Abbrechen erhält Karte, Mana, Tax und Priorität. Neuladen stellt die native Auswahl wieder her und behält die Browser-Einstellung.

Die Auswahl ist privat. Der Gegner erhält keine Quellenpräferenzen, Kosten oder private Spruchnamen aus dieser noch nicht bezahlten Entscheidung. Antworten werden nach authentifiziertem Sitz, Choice-ID, erlaubten IDs und Anzahl geprüft. Bereits beantwortete Choices sind nicht wiederverwendbar.

## Umfang

Der neue Planer deckt gewöhnliche Nichtkreatur-Tapquellen, einfache Mana-Artefakte und Filter mit festen generischen Aktivierungskosten ab. Restricted Mana, komplexe Fähigkeiten und relevante Kosten-/Manaersetzungseffekte bleiben beim bisherigen nativen Forge-Solver. Der manuelle Dialog kennzeichnet ausdrücklich, wenn eigene Quellenwahl für einen solchen Sonderfall nicht verfügbar ist. Bestehende Abwerf-/Opferkosten behalten ihre separaten Kostenentscheidungen. Ziele, Kampfentscheidungen und Zugende werden durch diese Mana-Änderung nicht automatisiert.

Die Oberfläche verändert keine Tap-Zustände und bewegt keine Karten vorab. Eine abgelehnte Zahlung geht über den nativen Rollback-Pfad. Der automatische Standard verwendet denselben geprüften Zahlungsweg wie eine bestätigte eigene Quellenwahl.

## Verifikation und Installation

- `pnpm test`, `pnpm build`.
- `scripts/test-forge-payments.mjs`: native private Vorschau, ungültige und fremde Antworten, Abbruch, insuffiziente Quellen, erneute Vorschau und tatsächliche Commander-Zahlung.
- `scripts/test-forge-commander.mjs`: automatische Zahlung ohne Dialog, Commander-Rückkehr/Tax, echte Züge, Kampf und Partner.
- `scripts/test-forge-deck-mechanics.mjs`: Fetchland/Leben/Opfer/Suche, Friedhofsziel, Cycling, Floating Mana, Filterland und vorbereitete Decks.
- `scripts/test-forge-commander-browser.mjs`: zwei Browser, manueller Eingriff/Privatsphäre/Abbruch/Neuladen und anschließendes Wirken im automatischen Standard ohne Zahlungsdialog.
- `forge-bridge/tests/ForgePaymentPolicyTest.java`: acht deterministische Prüfungen der nativen Auswahl, tatsächlichen Zahlung, Ablehnung veralteter Quellen und gruppierter Suche mit 40 identischen Ländern.

Alle acht Produktions-Bridgedateien einschließlich **HumanMana.java** zusammen gegen das gepinnte Forge 2.0.15 mit Java 17 kompilieren. Die Commander-Startprüfung verlangt nun zusätzlich `payment-review`; ein alter Adapter wird abgewiesen. Das Standard-Dockerfile bündelt weiterhin keine Forge-Laufzeit. Beim Deployment müssen Server, Frontend und kompilierter Adapter zusammen aktualisiert und die bestehende Forge-Laufzeit erhalten werden. Kein Live-Deployment durch diesen PR.

Native Policy-Prüfung nach der normalen Kompilierung (Pfade entsprechend anpassen):

```sh
javac -encoding UTF-8 -cp '/path/to/forge.jar:/path/to/classes' -d /path/to/classes forge-bridge/tests/ForgePaymentPolicyTest.java
cd /path/to/forge-runtime
java -Djava.awt.headless=true -cp '/path/to/forge.jar:/path/to/classes' ForgePaymentPolicyTest
```

Unter Windows verwendet der Klassenpfad `;` als Trenner. Die normale GitHub-CI führt Anwendungstests und Build aus; echte Forge-/Java-Prüfungen benötigen die separat bereitgestellte Laufzeit.
