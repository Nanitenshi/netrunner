# Playtest: Bedienung und Ressourcen

Stand: 5. Oktober 2026. Lokal fertiggestellt und geprüft; dieses Paket ist noch nicht auf dem öffentlichen Server installiert.

## Änderungen

- Gemeinsame Holo-Tavernenoptik für Startmenü, Navigation, Konto, Einstellungen und Deckersteller. Werbesprüche durch eindeutige Bezeichnungen ersetzt. Kompakte Deckbearbeitung lässt mehr Platz für Karten.
- Startmenü-Navigation zu Online-Spiel, Konto und Einstellungen sowie Commander-Motivsuche im Browser geprüft; ohne horizontalen Seitenoverflow bei 1920, 1440, 1366, 800 und 600 Pixeln.

- Kartenmenü nach Aktion gruppiert. Tappen/Enttappen, Kopieren, Counter und Zonenwechsel stehen an der passenden Karte. Die irreführende Aktion „Aufs Spielfeld“ für bereits liegende Karten entfällt.
- Karten mit passendem Wirkzeitpunkt werden hervorgehoben. Die Anzeige prüft Priorität, Hauptphase, leeren Stack, Spontanzauber/Flash und das normale Landlimit. Sie garantiert keine vollständige Kartenlegalität und bezahlt kein Mana.
- Auswahlleiste: schnelle +1/+1-Marken, Tappen, Kopieren und Manaquelle. Q öffnet den Mana-Pool mit der ausgewählten ungetappten Karte als Quelle. Die tatsächlich erzeugte Farbe/Menge bestimmt der Spieler.
- Counter: häufige und aktive Marken zuerst; Suche nach weiteren Standardmarken; Mengen 1, 5, 10 oder eigener Wert. Bereits aktive seltene Counter bleiben sichtbar. Eigene benannte Counter bleiben verfügbar. „Alle entfernen“ braucht eine zweite Bestätigung.
- Würfel/Münze: R oder der Tischbutton öffnet ein gemeinsames Werkzeug. W4, W6, W8, W10, W12, W20, W100 und frei 2–1000 Seiten; 1–20 Würfe. Münzen ebenfalls mehrfach. Ergebnis und Verlauf sind für alle sichtbar; online bestimmt der Server die Zufallswerte.
- Deckersteller: „Karten finden“ und „Deine Deckliste“ als getrennte Ansichten. Suche im eigenen Deck, Mengen ändern, Rechtsklick zum Hinzufügen, Linksklick zum Entfernen; Mengenzähler und Plus/Minus unter jeder Katalogkarte. Ein Import öffnet sofort die erstellte Deckliste. Katalogseiten auf 24 Karten reduziert; sichtbare Namen auch bei langsam ladenden Bildern.
- Bestehender gemeinsamer Stack, nachträgliche Casual-Aktionen, Mana-Pool und Befehlsliste bleiben integriert.

## Referenzen und Entscheidungen

MTGO erklärt kontextbezogene Kartenaktionen, hervorgehobene Handlungsmöglichkeiten und ein klares Prioritätsfenster: https://www.mtgo.com/getting-started/getting-started-gameplay

MTG Arena beschreibt manuelle Kontrolle und Manaauswahl: https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-january-2021-01-21

Übernommen wurden diese Bedienungsprinzipien, angepasst an unseren freien Casual-Tisch. Es gibt keine automatische Prioritätsabgabe: beliebige manuelle Trigger lassen sich derzeit nicht sicher vorhersagen. Die Referenzen sind keine belegte Rangliste der beliebtesten Spiele.

## Prüfung

- 99 automatisierte Tests bestanden, einschließlich Mehrspieler-Sitzungen, Privatsphäre, Wiederverbindung, Stack, Korrekturen, Counter, Zufall und Mana.
- TypeScript-Prüfung und Produktionsbuild bestanden.
- Browserprüfung: Counter-Menge, Suche, eigene Marken, Reset-Bestätigung, Kartenmenü, Q/Manaquelle, R/Würfel/Münze, Decklistenbearbeitung und Textimport bestanden. Die Kartenbedienung wurde zusätzlich mit mehreren Exemplaren, Plus/Minus und Entfernen bei Menge null im Browser geprüft. Keine unbehandelten Browserfehler.
- Bestehende Browserprüfung: Manaerzeugung/Verbrauch, Stack und Priorität, vergessene Trigger, Zurücknehmen, Kartenkorrektur, privates Nachziehen, Befehlsuche und reduzierte Bewegung bestanden.
- Deckansicht ohne horizontales Seitenoverflow bei 1920, 1366, 800 und 600 Pixeln geprüft. Das ersetzt keinen vollständigen Ergonomie-Test auf jeder Bildschirmgröße.
- Screenshots sind aus der laufenden Anwendung, mit einem isolierten Demonstrationsdeck; keine Änderung an deinen gespeicherten Decks.

## Ehrliche Grenzen vor dem Playtest

Dies ist ein Casual-Tisch mit Regelhilfe, keine vollständige automatische MTG-Regelengine. Beliebiger Kartentext, Kampf, Sonderkosten und eingeschränkte Manaarten brauchen weiterhin manuelle Ausführung. Commander-Steuer und unterstützte Bibliothekseffekte werden geführt. Externe Kartenbilder können verzögert laden. Echtes Discord-Login und eine gemeinsame Partie über eure realen Geräte müssen nach dem Serverupdate geprüft werden.

## Nächste Schritte innerhalb der 24 Stunden

1. Neues Serverpaket mit vorherigem Datenbankbackup installieren; vorhandene Produktionskonfiguration und Daten behalten.
2. Mit zwei echten Geräten anmelden, Raum erstellen/beitreten, unterschiedliche Decks wählen und starten. Anschließend dieselben Abläufe mit drei oder vier Personen prüfen.
3. Eine 30-Minuten-Proberunde: Mulligan, Ziehen, Wirken/Reagieren/Passen, Commander-Tax, Counter, Mana, Würfel und vergessenen Trigger nachholen. Ein Spieler lädt währenddessen neu und verbindet sich wieder.
4. Nur dabei auftretende Blocker beheben. Große Kamera- oder Designumbauten vor dem Playtest vermeiden.
5. Während des Playtests konkrete Aktionen und Screenshots bei Fehlern notieren. Danach entscheiden, welche manuell häufig ausgeführte Mechanik als Nächstes automatisiert wird.

## Planeswalker-Commander geprüft

Alle 22 Planeswalker mit ausdrücklicher Commander-Erlaubnis im aktuellen Katalog sowie Grist, the Hunger Tide bestehen Erkennung und Deckprüfung. Will/Rowan und Jeska/Tevesh bestehen die Partnerprüfung. Zwei echte lokale Serversitzungen akzeptieren Daretti beziehungsweise Will/Rowan und sehen die Commander in der Kommandozone. Im Browser wurden sechs Planeswalker und beide Partnerpaare ausgewählt; normale Planeswalker wie Oko und Teferi, Hero of Dominaria erscheinen nicht in der Commander-Auswahl. Kein Erkennungsfehler gefunden; vier Regressionstests ergänzt. Dies prüft Commander-Zulassung, nicht die automatische Ausführung aller Loyalitätsfähigkeiten.

## Soloplay mit Trainingsbots

Im Spielraum als Gastgeber „Bot hinzufügen“ (bis zu drei Bots), eigenes Deck wählen, bereit melden und starten. Ein Mensch plus ein Bot reicht. Die Bots behalten nach bis zu drei kostenlosen Mulligans ihre Starthand, legen Länder, erzeugen/bezahlen weißes Mana und wirken einfache Kreaturen über den regulären Stack. Menschliche Priorität bleibt erhalten. Bot-Hände bleiben privat.

Die Bots verwenden ein geprüftes 100-Karten-Singleton-Deck mit Isamaru, einfachen weißen/farblosen Kreaturen und Ebenen. Keine frei auswählbaren Bot-Decks mit unbekannten Effekten. Bei Angriffen zeigt ein Fenster Angreifer und Stärke/Widerstandskraft. Ein Blocker pro Angreifer sowie ungeblockter Schaden, Kreaturentausch und Commander-Schaden werden berechnet. Einsatzverzögerung wird berücksichtigt. Sonderfähigkeiten, mehrere Blocker, Schadensverhinderung und eigene Angriffe werden manuell ausgeführt. Es handelt sich um eine begrenzte Trainings-KI mit vereinfachtem Kampfschritt, keine vollständige automatische MTG-KI.

Über „Bot-Training“ lassen sich Bots pausieren und ihr Leben für manuelle Kämpfe ändern. Manuelle Verrechnungen eines Bot-Effekts kann der Gastgeber nach Ausführung bestätigen. Ohne verbundenen menschlichen Spieler laufen Bots nicht weiter. Bots werden vor dem Start entfernt; laufende Plätze bleiben reserviert.

Zusätzliche Prüfung: Trainingsdeck-Legalität, Manareservierung vor dem Wirken, mehrere komplette Züge, Angriff/Einsatzverzögerung/Blocker/Commander-Schaden, private Hände, Gastgeberrechte, Raumlimit, Solostart, Pause und Wiederverbindung. Browserprüfung für Bot hinzufügen, Start, Pause/Fortsetzen, Lebensänderung und Angriff-Fenster.


## Partie verlassen und Skalierung

Das neue Partiemenü bietet Hauptmenü (Platz reserviert), Aufgeben (weiter zuschauen) sowie Aufgeben und verlassen (Platz freigeben). Gastgeber können die Partie für alle beenden. Beim Verlassen wechselt der Gastgeber automatisch zum verbleibenden menschlichen Spieler. Aufgeben funktioniert auch im Mulligan oder bei einer laufenden Auswahl.

In den Einstellungen: Kompakt (85 %), Standard (100 %) und Groß (120 %) sowie der Regler für Zwischenschritte. Die Bedienelemente werden skaliert, ohne Kartenkoordinaten zu verändern. Bei niedrigen Fenstern wird die Hand kompakter.

Prüfung: 104 Tests erfolgreich, einschließlich Online-Verlassen, Gastgeberwechsel und erneuter Partievorbereitung. TypeScript und Produktionsbuild erfolgreich. Die neue Version muss noch auf den Server hochgeladen werden.
