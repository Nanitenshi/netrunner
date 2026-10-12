# Architektur · lokaler Multiplayer

`src/Root.tsx` hält Navigation und persönliche Einstellungen. `src/network.ts` verbindet HTTP-Session und Socket.IO. `src/Lobby.tsx` verwaltet Raumbeitritt, Deckwahl und Bereitschaft. `src/App.tsx` rendert entweder einen projizierten Serverzustand oder den getrennten lokalen Testtisch. Keine optimistischen Spieländerungen ohne Serverbestätigung; nach Reconnect wird die aktuelle Vollansicht übertragen. Kameraposition und kosmetische Einstellungen bleiben lokal.

## Autoritativer Einzelserver

`server/server.ts` stellt HTTP, OAuth, statische Dateien und Socket.IO unter derselben Adresse bereit. `shared/protocol.ts` prüft Daten zur Laufzeit mit Zod. Der Spieler stammt aus der HttpOnly-Sitzung, niemals aus einem Client-Actor-Feld. Karteninstanzen und Kopie-IDs erzeugt der Server. Der synchrone Reducer verarbeitet Aktionen ohne asynchrone Unterbrechung und speichert den Raumzustand in SQLite.

Action-IDs verhindern doppelte Ausführung innerhalb der letzten 4000 Raumaktionen. Revisionen kennzeichnen Snapshots, sind aber keine vom Client geforderten Versions-Locks. Der Client sendet bei fehlender Bestätigung eine Aktion nicht automatisch erneut. Die sichtbare Aktualisierung kommt aus dem projizierten Spielstand.

`projectGame` entfernt alle Bibliothekskarten und fremden Handkarten; die Anzahl bleibt sichtbar. Öffentlich sind Spielerwerte, Commander-Tax und Karten auf öffentlichen Zonen. Lobbyansichten enthalten keine Decklisten. Protokolle verraten keine privaten Kartennamen. `choiceCards` enthält nur die für diesen Empfänger erlaubten Karten einer laufenden Auswahl. `projectRules` entfernt private Auswahl-IDs bei anderen Spielern. Reveal, Discover und Cascade sind öffentlich; Scry, Surveil, Look und Search privat. Eine explizite Such-Reveal-Option darf gefundene Kartennamen ins öffentliche Log schreiben.

## Authentifizierung und Speicherung

Origin-Prüfung für HTTP-Mutationen und Socket.IO-Handshakes, begrenzte Payloads und Aktionsraten. Zufällige Sitzungstokens werden nur gehasht gespeichert. Cookies sind HttpOnly, SameSite=Lax und bei einer HTTPS-PUBLIC_URL Secure. Logout widerruft die Sitzung und trennt zugehörige Sockets.

Discord verwendet Authorization Code mit `identify`, zehn Minuten gültigem browsergebundenem Einmal-State, fest konfigurierter Redirect-URL und serverseitigem Secret-/Tokenaustausch. Access-Tokens werden weder an den Browser übertragen noch dauerhaft gespeichert. Ohne Client-ID, Secret und PUBLIC_URL bleibt Discord deaktiviert. Testkonten sind standardmäßig nur außerhalb von NODE_ENV=production aktiv oder müssen explizit freigeschaltet werden.

SQLite (`node:sqlite`, WAL) enthält Session-Datensätze, Kontodecks und vollständige Räume als JSON. Die Datenbank liegt außerhalb des statischen Build-Verzeichnisses. Dieser Stand verwendet einen Prozess; kein PostgreSQL und kein Clusterbetrieb. Reservierte Plätze und Spielstände bleiben beim Neustart erhalten. Der Gastgeber kann eine Partie beenden und zur Deckwahl zurückkehren. Inaktive Räume und Sessions laufen nach sieben Tagen aus.

## Karten, Commander und Counter

Gedruckte Kartendefinitionen sind von Spielinstanzen getrennt. Der Katalog enthält 20 normalisierte Scryfall-Datensätze. Die Deckwahl bestimmt den Commander; Kopien verlieren diese Markierung. `castCommander` funktioniert nur für den eigenen Commander in der Kommandozone und erhöht den Zähler um eins. Nächste Tax = zwei mal bisherige Casts. Gedruckter Manawert bleibt unverändert. Das UI nutzt `cast` mit manueller Kostenbestätigung. Der Spruch geht auf den Stack. Nicht gescriptete Effekte werden in einer angehaltenen Verrechnung manuell ausgeführt.

`shared/counters.ts` definiert zehn Karten- und vier Spieler-Counter. Karten-Marker sind nach Typ getrennt; das historische Feld `counters` bleibt als +1/+1-Kompatibilitätswert erhalten. Die Standardaktionen akzeptieren nur bekannte Typen, ganzzahlige Änderungen und eigene Ziele. Kopien beginnen ohne Marker. +1/+1 und −1/−1 verändern die Darstellung numerischer Stärke/Widerstandskraft, nicht die ursprünglichen Metadaten. Variable Werte werden nicht erfunden. Zonenwechsel leeren Marker; Betäubung wird beim regulären Enttappen berücksichtigt. Andere Counter-Effekte und Ausnahmen bleiben manuell.

## Nächste Ausbaustufen

Vollständiger Kartenkatalog und Import, komplette Decklegalität, mehrere Commander, vollständige Karten-/Mana-/Trigger-/Kampfregelengine, öffentliche HTTPS-Bereitstellung und PostgreSQL-Migration.

## Assistierte Regel-Engine

`shared/engine.ts` verarbeitet Regeln getrennt von den manuellen Tischaktionen in `shared/game.ts`. Neue Partien beginnen in `mulligan`; jeder Spieler kann beliebig oft kostenfrei sieben Karten nehmen. `keep` schließt seinen Mulligan ab. Erst nach allen Keeps beginnt die Versorgung.

`RulesState` speichert Stack (unten nach oben), Prioritätsinhaber, aufeinanderfolgende Pässe, laufende Verrechnung, Auswahl, Landspielzähler und ausgeschiedene Spieler. Alle Entscheidungen laufen in einer geklonten, synchronen Transaktion. Nur validierte erfolgreiche Aktionen werden gespeichert. Karten behalten ihre UI-ID; `incarnation` ändert sich bei Zonenwechseln, damit ein früheres Spruchziel nach einem Blink nicht erneut legal wird.

Vier aufeinanderfolgende Pässe verrechnen ein Objekt, nach Ausscheiden entsprechend weniger. Ohne Stack wechseln sie das Segment. Casting behält Priorität; neue Objekte löschen den Passlauf; nach Verrechnung erhält der aktive Spieler Priorität. Auswahlbesitzer können ihre private Entscheidung ohne Priorität treffen, alle übrigen Reaktionen sind währenddessen gesperrt. Manuelle Spruchauflösung verwendet eine Continuation: Bibliotheks-Teileffekte kehren vor der endgültigen Verrechnung zur selben manuellen Entscheidung zurück.

Bibliotheksreihenfolge entspricht der Reihenfolge der eigenen Library-Instanzen im Kartenarray. Fisher-Yates mit `crypto.getRandomValues` und Rejection Sampling erzeugt serverseitige Zufallsreihenfolgen. Choices werden durch monotone, raumlokale IDs gebunden. Partitionen werden auf Vollständigkeit und Eindeutigkeit geprüft. Auswahlzustand bleibt vollständig in SQLite; nach Reconnect wird erneut nur die jeweilige erlaubte Projektion übertragen.

`src/MechanicsPanel.tsx` bietet numerische Bibliotheksaktionen, Cast-/Zielbestätigung, Priorität, Stack, Starthand und private/öffentliche Kartenauswahlen. Der Stack ist einklappbar; Auswahlen können ohne Verrechnung geschlossen und wieder geöffnet werden. Öffentliches Aufdecken wird für andere Spieler zunächst eingeklappt angezeigt. Der lokale Testtisch nutzt ebenfalls die Engine; die Perspektivenauswahl erlaubt dort die einzelnen Prioritätsschritte zu testen.

Die Regeln sind bewusst begrenzt: keine automatische Manabuchhaltung, kein allgemeiner Oracle-Interpreter, kein automatisches APNAP-Trigger-Sammeln, keine vollständigen Ersatz-/Dauereffekte oder Kampfentscheidungen. Manuelle Tischwerkzeuge erlauben die Ausführung fehlender Kartenregeln. Neue Kartenscripts müssen diese Grenzen beachten, statt nur Text-Keywords in beliebige Aktionen umzusetzen.

## Tisch und lokale Kamera

`src/Tabletop.tsx` ersetzt die bisherige dreigeteilte Gegnerzeile. Ein gemeinsamer transformierter DOM-Tisch enthält vier gleichwertige Matten. Die lokale Sitzreihenfolge ist relativ zur angemeldeten Person; ihr eigener Platz bleibt unten links. `ResizeObserver` bestimmt den verfügbaren Platz. Fokussierte Matten passen sich an das Fensterverhältnis an; auf Mobilgeräten verwendet der fixierte Fokus eine untransformierte, kompakte Einzelmatte. Übersicht und freie Kamera behalten die gemeinsame Tischgeometrie.

Kamera, Zoom, Pan, Drehung, Fokus und Leserfilter werden nicht über Socket.IO gesendet. Kartenpositionen und Spielaktionen nutzen weiterhin dieselbe autoritative Engine. Die vier Ecken der eigenen freien Kartenfläche liefern die Bildschirmprojektion für Drag-and-drop; damit bleibt die Platzierung auch nach Kameratransformationen korrekt. Der große Gegnerleser ordnet nur die Darstellung; er ändert keine serverseitigen Kartenpositionen.

`src/tabletop.css` begrenzt die Arena auf die Fensterhöhe und hält die Hand sichtbar. Matten-Illustrationen liegen lokal unter `public/mats/`. Die Seitenvorschau ist standardmäßig aus; Karten-Pop-ups funktionieren unabhängig davon. `tableViewVersion: 2` migriert ältere Profile einmalig auf ausgeblendete Seitenvorschau und 14° Tischneigung. Danach bleiben persönliche Änderungen an diesen Einstellungen erhalten. Der private Auswahlzustand verbleibt unverändert auf dem Server, wenn sein Fenster geschlossen wird.


## Holo-Oberfläche und erweiterte Counter

`LibrarySearch.tsx` rendert die private `search`-Auswahl als filterbares Raster mit separater Auswahlleiste und Bestätigungsprüfung. Der eigene Deckstapel sendet lediglich einen lokalen Öffnungsimpuls an `MechanicsPanel`; Kartendaten werden weiterhin erst über die vorhandene autoritative Suchverrechnung sichtbar. Eine eingeklappte Suche wird dadurch fortgesetzt. Anzahl, Kartenmerkmal, Zielzone und Offenlegen bleiben Gegenstand der bestehenden serverseitigen Validierung. Keine zusätzlichen Bibliotheks-Endpunkte oder Änderungen an der Gegnerprojektion.

`HomeGate.tsx` kapselt das neue Hauptmenü mit vorhandenen Navigationszielen. `holo.css` wird nach den bisherigen Styles eingebunden; Atmosphäre und reduzierte Bewegung werden berücksichtigt. Illustrationen/Karten kommen aus den vorhandenen lokalen Assets. `SelectionActions.tsx` verwendet bestehende autoritative Aktionen, `StackPanel.tsx` ausschließlich die projizierte eigene Sicht. Auswahl eines Antwortspruchs öffnet den regulären Cast-Dialog und schließt den Stack, um überlagerte Dialoge zu vermeiden. Priorität und Verrechnung bleiben in der Engine.

Optionale `customCounters: {name,value}[]` auf Karten und Spielern sind rückwärtskompatibel mit bestehenden Spielständen. `customCounter` bestimmt den Spieler ausschließlich über die Sitzung; ein optionales `cardId` erfordert Kontrolle über die Karte. NFKC-Normalisierung, Whitespace-Bereinigung, 28-Zeichen-Limit, Ablehnung von Steuerzeichen und höchstens 16 Arten begrenzen die Eingaben. Werte sind ganzzahlig und auf 0–999 begrenzt. Array-Einträge vermeiden dynamische Objekt-Property-Namen. Projektion, private Hände und Netzwerk-Deduplizierung bleiben unverändert. Kopieren und alle implementierten Zonenwechsel entfernen eigene Kartenmarken. `customCounterKey` verhindert falsches Gruppieren unterschiedlicher Marker.

`commanderDamage` ist eine manuelle Buchung für den authentifizierten Empfänger. Einträge speichern die stabile Commander-Instanz-ID und öffentliche Namens-/Besitzmetadaten. Dadurch bleiben Werte bei Zonen- und Kontrollwechseln getrennt und nach Entfernen eines Commanders lesbar. Optional wird genau die effektive Änderung vom Leben abgezogen (bei Korrektur entsprechend addiert). `settle` prüft mindestens 21 pro tatsächlichem Commander bei den unterstützten Zustandsprüfungen. Keine automatische Kampfschadenszuweisung oder Erkennung weiterer Schadensmodifikatoren.
