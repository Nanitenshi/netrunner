# Forge: menschliche Effektentscheidungen

Stand: 12. Oktober 2026. Lokal implementiert und geprüft, nicht auf den öffentlichen Server veröffentlicht.

## Umgesetzt

- Die echte Forge-Verrechnung wartet auf menschliche Entscheidungen. Die Netzwerkverbindung bleibt währenddessen bedienbar; es gibt keine automatische Antwort nach einem Zeitlimit.
- Scry und Surveil: Karten auf die jeweiligen Bereiche verteilen und ihre Reihenfolge bestimmen.
- Karten, Opfer durch Effekte, Ziele und Modi auswählen; optionale Trigger annehmen oder ablehnen.
- Unterschiedliche gleichzeitig ausgelöste Fähigkeiten in gewünschter Reihenfolge auf den Stack legen. Ziele werden vor dem Hinzufügen bestimmt.
- Kompakte Auswahl am Tisch mit Kartenbildern. Neuladen stellt eine offene Entscheidung wieder her.
- Der Server prüft Spieler, Entscheidungs-ID, erlaubte Karten, Anzahl, doppelte Auswahlen und vollständige Scry-Zuordnung. Private Auswahlinhalte werden nicht an Gegner übertragen.
- Verlassen funktioniert auch direkt nach einer Aktion; der separate Forge-Prozess wird beendet.

## Nachweise

- 212 automatisierte Anwendungstests bestanden; TypeScript und Produktionsbuild bestanden.
- Echte Forge-Tests: Preordain, Impulse, Innocent Blood, You Meet in a Tavern, Raise the Alarm und Man-o'-War. Geprüft wurden tatsächliche Kartenbewegungen, Moduseffekte, Opfer, Trigger-Ziele und Lebensänderungen sowie ungültige Antworten.
- Regressionen für Zugwechsel und zwei authentifizierte Online-Clients bestanden.
- Zwei Browser: Scry, Impulse einschließlich Reihenfolge, vier optionale Trigger, Moduswahl, Neuladen während einer Auswahl und Verlassen bestanden. Keine erfassten JavaScript-Fehler.
- Screenshots: `milestones/forge-decisions/scry.png` und `milestones/forge-decisions/modi.png`.

## Grenzen

Die Automatik ist weiterhin ein optionaler Zweispieler-Testtisch mit vorgegebenen Karten. Eigene Commander-Decks, vier Spieler und interaktiver Kampf sind noch nicht freigegeben. Die Casual-Engine bleibt unabhängig.

Surveil und allgemeine Auswahlformen sind angebunden, aber nicht jede mögliche Karte ist getestet. Zahlen-/Farbauswahl, aufgeteilte Ziele, komplexe Kosten und besondere Sichtbarkeitsregeln benötigen weitere Prüfung. Ein vollständiger menschlicher Forge-Controller ist noch nicht erreicht. Die Zahlung einfachen Manas verwendet weiterhin den Forge-Kostenlöser.

Der normale Docker-Container enthält weder Java noch Forge-Ressourcen oder kompilierte Bridge-Klassen. Dieses Ergebnis ist deshalb kein fertiges Server-Update. Einrichtung und GPL-Quellen stehen in `forge-bridge/README.md` und `forge-bridge/LICENSE`.

## Nächster Schritt

Menschliche Kampfentscheidungen: Angreifer, Blocker und Schadenszuordnung. Anschließend verbleibende Entscheidungswege und Kosten prüfen, bevor echte Commander-Decks zugelassen werden.
