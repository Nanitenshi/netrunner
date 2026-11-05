# Forge-Prozessverbindung: Stabilisierung

Ausgangscommit: `17bc92d7904cb15c39683f396c67ecb05d3cb852`.
Dieses Paket bearbeitet einen konkreten Fehlerpfad aus der
[BATUSMTG-Roadmap](BATUSMTG-ROADMAP.md). Es ersetzt deren Freigabekriterien nicht.

## Fehler und Änderung

Der bisherige Worker fängt Fehler von stdin, stdout, stderr und dem Zeilenleser
nicht ab. Ein Schreibfehler nach einem Engine-Abbruch kann dadurch den Node-Server
treffen. Außerdem können mehrere fehlerhafte Nachrichten die Raumverwaltung
mehrfach benachrichtigen.

`server/forge-transport.ts` übernimmt jetzt Prozess-I/O, Antwortzuordnung,
Timeouts und Beenden. `ForgeWorker` behält Runtime-Prüfung, Java-Startargumente
und Deck-/Versionsprüfung. Beim ersten Verbindungsfehler werden alle wartenden
Anfragen abgewiesen und die Raumverwaltung genau einmal benachrichtigt. Spätere
Ereignisse sowie neue Anfragen führen keine weitere Aktion aus. Bewusstes
Beenden und abgewiesene Deck-/Versionsprüfungen melden keinen zusätzlichen
Prozessabsturz. Parserdiagnosen mit möglichen privaten Kartendaten werden nicht
als Verbindungsfehler ausgegeben.

## Tatsächlich ausgeführte Prüfung

- Umgebung: Node.js `v24.19.0`, isolierter lokaler Quellenausschnitt.
- Befehl: `node --experimental-strip-types --test --test-isolation=none tests/forge-transport.test.ts tests/forge-runtime-lock.test.ts`.
- Ergebnis: **23 bestanden, 0 fehlgeschlagen**; davon 22 neue Transporttests und
  ein bestehender Runtime-Lock-Test.
- Geprüft: parallele Anfragen und Antwortzuordnung, Updates, doppelte/fremde
  Antwort-IDs, Prozess-/Stream-/EOF-Fehler, Start-/Aktionstimeout, manuelles
  Beenden, ungültige Nachrichten, synchrone und asynchrone Schreibfehler,
  spezifische Startablehnung, fehlendes Executable und Nachrichtenaustausch
  mit einem echten Node-Unterprozess.

Die lokale Umgebung liest Ausgaben asynchroner Node-Unterprozesse nicht
zuverlässig. Deshalb verwendet dieser lokale Lauf `--test-isolation=none` und
der echte Testunterprozess synchrone Datei-I/O. Die normale Projektprüfung in
GitHub verwendet unverändert Node 22.18.0, `pnpm install --frozen-lockfile`,
`pnpm test` und `pnpm build`; ihr Ergebnis ist im zugehörigen Pull Request unter
Checks nachzulesen. Die vollständigen Projektbefehle wurden in diesem lokalen
Quellenausschnitt nicht ausgeführt.

## Grenzen und nächste Schritte

Die native Java-/Forge-Runtime ist hier nicht eingerichtet. Native Kartentests,
Browsertests und vollständige Commander-Partien sind **NICHT AUSGEFÜHRT**.
Dieser Unterprozesstest bestätigt den Transport, keine Magic-Regeln.
Weder Runtime-Hashes noch Java-Bridge, Spielregeln, Produktionsdaten oder
Live-Infrastruktur werden geändert.

Als nächstes die Raumverwaltung mit kontrollierten Worker-Antworten testen:
Verlassen während des Starts, ausstehende Aktionen beim Abbruch,
Antwort-/Update-Reihenfolge, doppelte Aktionen und private Projektionen. Danach
die native Baseline und vollständigen Partien aus der bestehenden Roadmap
einrichten und prüfen. Automatischer Vier-Spieler-Commander bleibt offen.
