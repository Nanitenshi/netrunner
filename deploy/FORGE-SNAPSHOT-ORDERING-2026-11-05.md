# Forge-Snapshots und Raumlebenszyklus

## Ergebnis

Aufbauend auf dem zusammengeführten [PR #27](https://github.com/Nanitenshi/netrunner/pull/27)
werden alle Forge-Snapshots unmittelbar in ihrer Empfangsreihenfolge angewendet.
Eine spätere Promise-Fortsetzung bestätigt nur die Aktion; sie schreibt keinen
älteren Zustand mehr über ein neueres Update. Dies gilt für normale Aktionen,
automatische Aufdeckentscheidungen und den Start einer Partie.

Ein Verbindungsausfall zwischen Ready-Nachricht und Startfortsetzung verhindert
den Spielstart. Ebenso darf eine bereits eingegangene Aktionsantwort nach einem
Ausfall den Tisch nicht wieder aktivieren. Löschen/Verlassen und der Schutz vor
doppelten Aktionen bleiben bestehen. Die Raumverwaltung erhält eine typisierte
Worker-Factory für isolierte Integrationstests; im Server wird weiterhin der
normale `ForgeWorker` verwendet.

## Reproduzierbare Prüfung

1. Auf Basis `b12e36952ec1a89b459080df9097a693b70e2703` wurden zunächst zehn
   Raumtests und die Worker-Factory ohne Verhaltenskorrektur hinzugefügt.
   Commit `d49b5e9be1e4df9458685cef843ae54d8c5fc3d0` reproduzierte **fünf Fehler
   bei 301 Tests**. [Fehlschlag auf GitHub](https://github.com/Nanitenshi/netrunner/actions/runs/41989746775).
   Betroffen waren ältere Aktions-/Automatikantworten nach neuen Updates,
   ein älterer Ready-Snapshot und Wiederaktivierung nach Ausfall bei Start/Aktion.
2. Nach der Korrektur prüfen zwölf Raum-/Transportintegrationstests zusätzlich
   die umgekehrte Reihenfolge (Update vor neuerer Aktionsantwort) und einen
   abgelehnten Befehl mit anschließendem Update. Sie verwenden den echten
   `ForgeTransport` mit kontrollierten Prozessstreams, keine Java-Regelengine.
3. Commit `71289e80cf51371a0d86b7a35519d875de49ebf1`: **303 Tests bestanden,
   0 fehlgeschlagen, 0 übersprungen**, TypeScript und Produktionsbuild bestanden.
   [Erfolgreicher GitHub-Lauf](https://github.com/Nanitenshi/netrunner/actions/runs/41990276840).
   Ausgeführt wurden `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`
   unter Node 22.18.0 und pnpm 10.11.0.

Lokal unter Node 24.19.0 bestanden außerdem die 22 Transporttests und der
bestehende Runtime-Lock-Test mit `--test-isolation=none`. Die neuen Raumtests
wurden vollständig auf GitHub ausgeführt. Ein lokaler vollständiger Checkout
mit allen Abhängigkeiten lag nicht vor.

## Grenzen und nächste Arbeit

Die neue Prüfung umfasst Reihenfolge, Lifecycle, Revisionen, doppelte Aktionen,
Verlassen, automatische Entscheidungen und die private Projektion einer Hand.
Sie ist keine Prüfung von Kosten, Kampf, KI-Spielstärke oder Kartenregeln.
Die Java-Runtime, native Szenarien, Browserdurchläufe und zehn vollständige
Commander-Partien aus der Roadmap wurden **NICHT AUSGEFÜHRT**. Die native
Baseline bleibt das nächste P0-Arbeitspaket.

Der erfolgreiche Build meldet weiterhin einen sehr großen JavaScript-Chunk
(rund 28 MB vor Kompression), Zod-Kommentarwarnungen und veraltete Node-20-
Action-Runtimes. Diese Hinweise wurden nicht durch Abschalten von Prüfungen
unterdrückt. Katalogladen/Code-Splitting und Action-Updates sind separate
Wartungsarbeiten nach der Spielstabilität.

Keine Änderung an Runtime-Hashes, Java-Bridge oder produktiven Daten;
kein Live-Deployment. Automatischer Vier-Spieler-Commander bleibt offen.
