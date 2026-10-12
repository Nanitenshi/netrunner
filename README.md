# Nexus · Commander

Lokal vorbereiteter Vier-Spieler-Multiplayer mit einem autoritativen Node-/Socket.IO-Server und React/TypeScript-Oberfläche. **Spielen** öffnet die Multiplayer-Lobby. **Testtisch öffnen** bleibt eine separate lokale Beispielpartie.

## Starten

Node.js 22.18 oder neuer und pnpm werden benötigt. Auf diesem Rechner kann `Start-Nexus.ps1` den vorhandenen gebündelten Node-Runtime verwenden.

```sh
pnpm install
pnpm start
```

`pnpm start` baut die Oberfläche und startet den Spielserver. Danach [Nexus öffnen](http://127.0.0.1:5173). Der Server lauscht standardmäßig auf Port 5173 an allen Netzwerkschnittstellen.

## Zu viert testen

1. Unter **Spielen** einen Anzeigenamen wählen und ein Testkonto starten.
2. **Tisch erstellen** anklicken und den sechsstelligen Raumcode teilen.
3. Drei weitere Spieler öffnen dieselbe Serveradresse in getrennten Browserprofilen oder auf anderen Rechnern, starten jeweils ein Testkonto und treten mit dem Raumcode bei.
4. Jeder wählt ein Deck und klickt **Ich bin bereit**. Der Gastgeber startet die Partie, sobald alle vier verbunden und bereit sind.
5. Unter **Spielen** lässt sich die laufende Partie fortsetzen; der Gastgeber kann sie dort beenden. Anschließend sind Deckwechsel und eine neue Partie möglich.

Fenster desselben Browserprofils teilen ein Konto. Auf weiteren Rechnern im LAN die Adresse `http://IP-DES-HOSTS:5173` öffnen. Eine gegebenenfalls vorhandene Firewall muss Verbindungen zum Node-Server im privaten Netzwerk zulassen. Eine öffentliche Internetadresse ist noch nicht eingerichtet.

Das **Atraxa-Netzwerk-Testdeck** enthält 100 Karten und sehr viele Standardländer. Es dient dem Verbindungstest und ist kein abgestimmtes Commander-Precon. Die lokale Beispielpartie verwendet einen verkürzten Kartenbestand.

## Multiplayer und Spieloberfläche

- Vier echte Teilnehmer, Raumcode, Deckauswahl, Bereitschaft und Start durch den Gastgeber.
- Der Server bestimmt Spieler und Kartenrechte anhand der Sitzung. Fremde Karten lassen sich nicht manipulieren; neue Kopie-IDs erzeugt der Server.
- Jeder erhält nur öffentliche Karten und seine eigene Hand. Bibliotheken und fremde Hände werden als Anzahl übertragen. Das Protokoll verrät keine verdeckten Kartennamen.
- Lebenspunkte, Ziehen, Ausspielen, Bewegen, Tappen, Kopieren, Counter, Phasen und Zonenwechsel werden synchronisiert. Kamera und persönliche Darstellung bleiben lokal.
- Automatisches Wiederverbinden. Sessions, Kontodecks, reservierte Plätze und Spielstände liegen in `data/nexus.sqlite` und werden nach einem Serverneustart geladen. Inaktive Räume und Sitzungen verfallen nach sieben Tagen.
- Größere umrandete Playmatte mit Spielfeld, Ländern, Commander-Tax, Kommandozone, Leben, Bibliothek, Friedhof und Exil. Karten sind frei beweglich; Aufräumen ordnet Länder separat an.
- Kartenvergrößerung nach 350 ms Hover, optionale Seitenvorschau und Karten-Pop-ups. Gegnerkarten per Klick öffnen; eigene Karten per Leertaste oder Rechtsklick → Groß ansehen. Touch: lange drücken. Kartenlisten scrollen innerhalb der Matte.
- Commander werden über die Deckauswahl bestimmt. **Wirken** erhöht ihren Zähler für das Wirken aus der Kommandozone; die nächsten zusätzlichen Kosten steigen um zwei generische Mana. Bloßes Verschieben erhöht die Tax nicht. Kopien sind keine Commander. Der gedruckte Manawert bleibt unverändert.
- Farbidentität, Manawert und Grund-Stärke/Widerstandskraft stammen aus gespeicherten Scryfall-Kartendaten. Variable Werte wie `*` bleiben erhalten.

## Mulligan, Bibliotheksaktionen und Stack

**Eure Hausregel ist aktiv:** beliebig oft sieben neue Karten, ohne Abzug und ohne anschließendes Zurücklegen. Vor dem ersten Zug müssen alle **Diese Hand behalten** wählen. Der beginnende Spieler zieht in dieser Vier-Spieler-Partie ebenfalls in seinem ersten Ziehsegment.

Im Spiel **Aktionen → Discover / Cascade / Scry / Surveil / Ziehen / Mill / Ansehen / Aufdecken / Suchen** wählen und den Wert eintippen. „Spieler führt aus“ bestimmt, für wen die Aktion ausgeführt wird. Die angesagte Fähigkeit geht auf den gemeinsamen Stack. Ist bereits ein ungescripteter Spruch in Verrechnung, können dieselben Aktionen als Teileffekte ohne zusätzlichen Stack ausgeführt werden.

- **Scry / Surveil:** nur der ausführende Spieler sieht die Karten. Anklicken ordnet sie oben/unten beziehungsweise oben/Friedhof zu; Pfeile ändern die Reihenfolge. Bestätigung ist verbindlich und gegen veraltete Auswahl-IDs geschützt.
- **Ansehen** bleibt privat, **Aufdecken** ist öffentlich. Beides lässt die Bibliotheksreihenfolge unverändert. **Mill** legt Karten in den Friedhof; **Ziehen** zieht einzeln.
- **Suchen:** private Bibliotheksansicht mit Namenssuche, Anzahl, Filter (beliebig/Land/Standardland/Kreatur), Zielzone, optionalem Offenlegen/Mischen und getapptem Eintritt. Bei einer Suche ohne Merkmal muss die erforderliche Anzahl gefunden werden; bei einem Merkmal darf man weniger finden.
- **Discover N:** Nichtland mit Manawert ≤ N; kostenlos wirken oder auf die Hand. **Cascade N:** Nichtland mit Manawert < N; kostenlos wirken oder mit nach unten. Die übrigen ins Exil geschickten Karten gehen in zufälliger Reihenfolge unter die Bibliothek. Der Treffer wird zuerst dargestellt, damit er bei vielen aufgedeckten Ländern sichtbar bleibt.
- Bei Cascade lässt sich der auslösende eigene Spruch auswählen. Sein Manawert wird übernommen und bleibt erhalten, wenn er neutralisiert wird. Mehrere Cascade-Fähigkeiten werden einzeln angesagt und verrechnet. Die Karte muss Cascade tatsächlich haben; das Ansagen wird noch nicht automatisch aus Kartentext abgeleitet.
- Kostenlos gewirkte Treffer gehen auf den Stack. Normale zeitliche Einschränkungen werden dabei übergangen; X wäre 0. Zusätzliche Kosten und weitere Einschränkungen sind manuell zu prüfen. Counterspell und Swords to Plowshares verlangen ein passendes Ziel. Weitere Kartendefinitionen benötigen vor Aufnahme eigene Script-/Zielunterstützung.

**Priorität:** Wer einen Spruch wirkt oder eine Fähigkeit aktiviert, behält zunächst Priorität. **Passen** gibt sie in Sitzreihenfolge weiter. Erst wenn alle nacheinander passen, wird genau das oberste Objekt verrechnet. Bei leerem Stack folgt das nächste Segment. Nach Verrechnung erhält der aktive Spieler Priorität. Eine neue Stack-Aktion setzt die bisherigen Pässe zurück; während einer Verrechnung/Auswahl kann niemand reagieren.

Doppelklick oder Ziehen einer Handkarte öffnet das **Wirken**-Fenster; Ziele und manuelle Bezahlung bestätigen. Länder gehen ohne Stack aufs Spielfeld, regulär einmal pro eigenem Zug in einer Hauptphase. Commander-Tax wird bereits beim Wirken erhöht, auch wenn der Spruch neutralisiert wird. Ein neutrales Zonenverschieben erhöht sie nicht.

**Counterspell** neutralisiert einen gewählten Spruch, keine Fähigkeit. **Swords to Plowshares** prüft das Kreaturenziel bei Verrechnung erneut, schickt es ins Exil und gibt dessen Controller Leben entsprechend der numerischen Stärke inklusive +/- Marken. Ein Zonenwechsel macht das alte Ziel ungültig, selbst wenn dieselbe Karte zurückkehrt. Andere Spontanzauber/Hexereien öffnen einen geführten manuellen Verrechnungsschritt. Aktivierte Fähigkeiten lassen sich über **Andere aktivierte Fähigkeit** mit Name und Quelle ansagen; sie bleiben unabhängig von ihrer Quelle bestehen. Manafähigkeiten werden direkt manuell ausgeführt.

Reguläres Enttappen und Ziehen erfolgen beim Segmentwechsel. Am Zugende fordert die Engine privat das Abwerfen auf sieben Karten. Leere Bibliothek allein ist kein Verlust; ein fehlgeschlagener Ziehversuch, 0 Leben oder 10 Gift führen bei der nächsten unterstützten Zustandsprüfung zum Ausscheiden. Nicht unterstützte Zustandsprüfungen und Kampfregeln werden nicht automatisch abgewickelt.

**D / Manuell ziehen**, Lebenspunkte, Marker und Zonenmenü bleiben bewusst manuelle Tischwerkzeuge. Sie sind kein Ersatz für Kartenscripts. Private Bibliotheksauswahlen, Stack und Verrechnung werden mit dem Raum gespeichert und nach Reconnect/Serverneustart fortgesetzt.

Referenzen: [Magic-Regelwerk](https://magic.wizards.com/en/rules), [Discover-Regelhinweise](https://magic.wizards.com/en/news/feature/the-lost-caverns-of-ixalan-release-notes), [Cascade-Regelhinweise](https://magic.wizards.com/en/news/feature/commander-masters-release-notes). Der kostenlose Mulligan auf sieben ist ausdrücklich eure Hausregel.

Screenshots und Browser-Prüfbericht: `milestones/mechanics/`. Die Tests prüfen auch private Auswahlen nach einem echten Serverneustart, fremde/veraltete Auswahlversuche und genau einmal ausgeführte Netzwerkaktionen.

## Karten im Deck suchen

Auf den eigenen **Deckstapel → DECK SUCHEN** klicken. Anzahl und Suchvorgabe (beliebig, Land, Standardland oder Kreatur), Zielzone sowie Mischen/Offenlegen einstellen. Außerhalb einer laufenden manuellen Verrechnung wird die Suche als Fähigkeit auf den Stack gelegt; nachdem alle Priorität abgegeben haben, öffnet sich die private Kartenauswahl. Während einer manuellen Verrechnung wird sie als Teileffekt ausgeführt. Ohne Priorität zeigt das Menü an, weshalb der Start noch nicht möglich ist.

Die Auswahl bietet ein Kartenraster, Namens-/Typsuche, zusätzliche Ansichtsfilter und Sortierung nach Name oder Manawert. Ausgewählte Karten bleiben unter den Ergebnissen sichtbar, auch wenn der Suchbegriff geändert wird. **Auswahl bestätigen** legt sie auf die Hand, aufs Spielfeld (optional getappt) oder oben auf die Bibliothek. Bei mehreren Karten oben bestimmt die Reihenfolge der Auswahl ihre Reihenfolge; Pfeile ändern sie. Eine Suche ohne Merkmal verlangt die geforderte Anzahl, bei Merkmalsuchen darf man weniger finden. Ein erneuter Klick auf den Deckstapel setzt eine eingeklappte eigene Suche fort. Die Suche und ihre erlaubten Karten sind nach einem Reconnect wieder verfügbar; noch nicht bestätigte lokale Auswahlen müssen nach Neuladen erneut gewählt werden.

Andere Spieler erhalten keine privaten Bibliothekskarten. Ein Klick auf ihren Deckstapel zeigt nur die Anzahl. Vier-Spieler-Prüfung und Screenshots: `milestones/deck-search/`.

## Counter schnell bedienen

Karte auswählen und **M** drücken, den **Counter**-Button bei den Handaktionen verwenden oder **Rechtsklick → Counter verwalten** wählen. Auf Touch-Geräten über die große Kartenansicht öffnen.

Karten-Counter: **+1/+1, −1/−1, Loyalität, Ladung, Schild, Betäubung, Sage/Lore, Öl, Zeit, Quest**. Jede Zeile bietet Minus, Anzahl und Plus. Aktive Marken erscheinen direkt auf der Karte. Die angezeigte Stärke/Widerstandskraft berücksichtigt +1/+1 und −1/−1 bei numerischen Grundwerten; weitere Effekte werden nicht berechnet.

Über **Counter / Schaden** am Rand der eigenen Playmatte lassen sich **Gift, Energie, Erfahrung und Strahlung** verwalten. Andere Spieler sehen diese Werte ebenfalls. Nur der jeweilige Spieler kann seine Counter verändern.

Counter werden manuell gesetzt. Bei Zonenwechseln werden sie entfernt; beim regulären Enttappen ersetzt eine Betäubungsmarke das Enttappen und wird entfernt. Weitere Effekte wie Schild, proliferate und das Aufheben gegensätzlicher Marken sind noch manuell. **Alle entfernen** setzt die Marken des geöffneten Ziels zurück. Kopien übernehmen keine Counter.

## Deckersteller und Konten

Der vorhandene Katalog enthält **20 Karten**. Decks lassen sich benennen, bauen, filtern, duplizieren, exportieren und lokal speichern. Ein 100-Karten-Testdeck kann als Ausgangspunkt hinzugefügt werden. Der Commander wird separat gewählt. Spieldecks werden auf 100 Karten einschließlich Commander, Singleton und passende Farbidentität geprüft; unvollständige Entwürfe können gespeichert werden.

Nach der Anmeldung: **Im Konto speichern** überträgt lokale Decks zum Server, **Aus Konto laden** lädt gespeicherte Decks. Andere vorhandene Decks werden erhalten; bei derselben Deck-ID gilt die bewusst gewählte Richtung. Keine automatische Synchronisierung und kein vollständiger MTG-Katalog.

## Discord später aktivieren

Die Anbindung ist implementiert, aber mangels Discord-Anwendung noch deaktiviert. Die lokale Testanmeldung funktioniert bereits.

1. Anwendung im [Discord Developer Portal](https://discord.com/developers/applications) erstellen.
2. `.env.example` nach `.env` kopieren.
3. `PUBLIC_URL`, `DISCORD_CLIENT_ID` und `DISCORD_CLIENT_SECRET` eintragen. Das Secret bleibt auf dem Server.
4. Exakte Redirect-Adresse im Discord-Portal hinterlegen: `PUBLIC_URL/auth/discord/callback`.
5. Server neu starten. Im Bereich **Konto** wird **Mit Discord anmelden** verfügbar.

Der OAuth-Codeaustausch läuft serverseitig, mit browsergebundenem Einmal-State und HttpOnly-Sitzungscookie. Discord-Access-Tokens gelangen nicht an den Browser. Der Sprachkanal-Button bleibt ein separat konfigurierbarer Link. Ein Testkonto wird nicht automatisch mit einem Discord-Konto zusammengeführt; lokale Decks können im neuen Konto gespeichert werden.

Für öffentliche Bereitstellung: HTTPS-`PUBLIC_URL`, `NODE_ENV=production`, `ENABLE_GUEST=false` und einen Reverse Proxy mit WebSocket-Unterstützung verwenden. Der aktuelle Stand nutzt **einen Server mit SQLite**, keinen PostgreSQL-Cluster. Öffentliche Bereitstellung und Produktionshärtung sind noch offen.

Referenzen: [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2), [Commander-Regelhinweise](https://magic.wizards.com/en/news/feature/commander-masters-release-notes), [Magic-Begriffe und Counter](https://magic.wizards.com/en/keyword-glossary).

## Grenzen dieses Standes

Die Engine ist ein Regelassistent mit echtem gemeinsamem Stack, noch keine vollständige Magic-Simulation. Manabezahlung, allgemeine Kostenmodifikatoren, nicht gescriptete Kartentexte, automatisch erkannte Trigger und deren APNAP-Reihenfolge, Ersatz-/Verhinderungseffekte, vollständige Ziellegalität (etwa Schutz/Shroud durch andere Karten), Kampfzuweisung und -schaden bleiben manuell. Nur ein Commander pro Deck; Partner/Background, verdeckte Permanents und Rückgängig fehlen. Mehrseitige Karten werden beim Wirken abgelehnt, bis ihre Seitenwahl implementiert ist. Die Entscheidung, einen Commander aus Friedhof/Exil in die Kommandozone zu legen, erfolgt noch über das Zonenmenü. **Die vorhandenen 20 Karten sind nicht alle vollständig gescriptet.**

Vollständige Kartensuche, Deckimport, aktuelle Bannlisten und Sonderregeln der Decklegalität sind noch nicht angebunden. Der Server wurde lokal mit getrennten Clients geprüft, nicht auf einem öffentlichen Hosting eingerichtet.

## Entwickeln und prüfen

```sh
pnpm build       # TypeScript-Prüfung und Produktionsbuild
pnpm test        # Modell-, Server- und OAuth-Vertragstests
pnpm server      # Vorhandenen Build mit dem Spielserver starten
pnpm dev         # Oberfläche auf 5174, Proxy zum Spielserver auf 5173
pnpm preview     # Statische Oberfläche ohne Multiplayer-Backend
```

**54 Tests bestehen**, einschließlich vier Socket-Sitzungen, Privatheit, Raumrechten, fünftem Teilnehmer, doppelt gelieferter Action-ID, Reconnect, Sitzungswiderruf, Kontodeck-Isolation, Origin-Prüfung, reservierten Plätzen nach Serverneustart, Commander-Tax, typisierten Countern und simuliertem Discord-Codeaustausch. Eine echte Discord-Anmeldung wurde noch nicht durchgeführt.

Zusätzlich im Chrome mit vier getrennten Browserkontexten geprüft: Raumbeitritt, Bereitschaft, Ausspielen, replizierte Lebenspunkte, Tax +0/+2/+4, Hover, Offline/Online-Wiederverbindung, Neuladen, Kontodeck-Speicherung und responsive Ansichten. Screenshots liegen unter `milestones/multiplayer/`.

## Neuer gemeinsamer Tisch

Die Arena zeigt jetzt einen physischen Tisch mit **vier gleich großen Playmatten in einer 2×2-Anordnung**, statt drei schmaler Gegnerfelder über einem eigenen Board. Jede Matte hat eine lokal gespeicherte Commander-Illustration und feste Umrisse für Battlefield, Länder/Mana, Kommandozone, Bibliothek, Friedhof und Exil. Die eigenen Karten bleiben frei platzierbar.

**Normalansicht:** Die Kamera fokussiert deine eigene Matte und nutzt die verfügbare Fensterfläche. Ein Klick auf einen Spieler oben fokussiert dessen Matte in derselben Größe. Lebenspunkte, Kartenanzahl und aktiver Spieler bleiben in der Spielerleiste sichtbar. „Tischübersicht“ zeigt alle vier Matten; eine Matte anklicken, um sie zu fokussieren. Auf jedem Client liegt der eigene Platz in der Übersicht unten links. Kameraänderungen bleiben lokal und verändern weder Kartenrechte noch die Perspektive der Mitspieler.

Die Seitenvorschau ist standardmäßig ausgeblendet, damit die Playmatte die volle Breite erhält. Über das Vorschau-Symbol oben oder **Einstellungen → Seitenvorschau anzeigen** lässt sie sich zuschalten; die Auswahl bleibt gespeichert. Karten lassen sich unabhängig davon als Hover-Vorschau oder Detail-Pop-up ansehen. Die Desktop-Perspektive startet mit einer leichten Neigung von 14° und behält diese beim Spielerwechsel bei. Auf kleinen Touch-Bildschirmen bleibt der fixierte Fokus gerade und gut bedienbar.

- **1–4:** Eigenes Board / die drei Gegner. **V:** Tischübersicht. **Pos1:** Eigener Board-Fokus.
- **F / Kamera lösen:** Freie Kamera. Auf freiem Tisch ziehen verschiebt sie, Rechtsziehen dreht sie. Mausrad und +/- zoomen. Der Neigungsregler reicht von 0° bis 28°.
- **Gegnerfokus:** große geordnete Karten oder Liste, Namens-/Typsuche und eigener Scrollbereich. Scrollen auf den Karten bewegt nicht die Kamera. Gleiche Länder/Tokens lassen sich optional bündeln und einzeln aufklappen; unterschiedliche Tap-Zustände, Controller und Counter werden nicht vermischt.
- **Eigenes Board:** „Frei legen“ zeigt die physischen Positionen. „Kartenübersicht“ bietet für volle eigene Boards dieselbe geordnete Ansicht. Auf schmalen Bildschirmen startet sie automatisch; „Frei legen“ bleibt wählbar.
- Hand, Spielerleiste und Aktionen bleiben im Fenster sichtbar. Desktop, Laptop, Ultrawide und Mobilansicht benötigen kein Scrollen der ganzen Arena. Kartenlisten und Hände scrollen bei Bedarf separat.
- Der Stack ist standardmäßig zugeklappt und über seinen Zähler erreichbar. Offene Auswahlen lassen sich einklappen und fortsetzen. Öffentliches Aufdecken öffnet bei Zuschauenden nicht automatisch ein Fenster über ihrem Board.
- Akzentfarbe, Kartengröße, Neigung und Playmatten-Illustrationen sind persönlich einstellbar. Die Illustrationen stammen aus den vorhandenen Scryfall-Commander-Datensätzen; Artist-/Kartenverweise bleiben in der Vorschau zugänglich.

Die lokale Beispielpartie bietet im unteren Werkzeugstreifen weiterhin den Testspieler-Wechsel, damit sich Prioritätsschritte ohne weitere Browser durchspielen lassen. Online wird nur die Kamera auf andere Spieler umgeschaltet; die eigene Identität bleibt unverändert.

Mit vier getrennten Clients und **90 gegnerischen Permanents** geprüft: individuelle Startperspektiven, 30 Karten je Gegner, Suche, Gruppierung, Scrollen, Übersicht/Fokus, freie Kamera, Drag/Tap/Counter/Leben über das Netzwerk sowie einklappbare private Auswahl. Zusätzlich sichtbare Hand und keine Seitenüberläufe bei 1366×768, 2560×1080 und 390×844. Screenshots und Prüfbericht: `milestones/tabletop/`.


## Holo-Menü, Stack und neue Tischwerkzeuge

Das neue Hauptmenü inszeniert einen zentralen Commander mit Holo-Ringen, einem projizierten Tisch und getrennten Menüschaltflächen links und rechts. Vier Menümotive sind wählbar. Multiplayer, Deckersteller, Konto, Einstellungen, Discord und Testtisch führen in ihre vorhandenen Bereiche. In einer laufenden Online-Partie ersetzt „Partie fortsetzen“ den Einstieg; „Deine Runde“ führt zur Lobby. Der Discord-Knopf öffnet den hinterlegten Kanal oder die Einstellungen. Anmeldung und öffentlicher Betrieb benötigen weiterhin die noch nicht eingerichteten Discord-/Hosting-Daten.

Der **Stack** zeigt zuerst das oberste Objekt, mit Kartenbild, Controller, Manawert, Ziel und Prioritätsfolge. Karten und vorhandene Ziele lassen sich vergrößern. **Mit Karte reagieren** öffnet die Auswahl eigener Spontanzauber und danach den bestehenden Wirken-/Zieldialog. **Fähigkeit ansagen** führt zu den manuellen Fähigkeiten. Weiterhin erforderlich: Kosten bestätigen und Priorität ausdrücklich abgeben. Ein leerer Stack zeigt eine Erklärung; die Ansicht ist jederzeit schließbar und verdeckt nicht die Spielerleiste.

**Karte anklicken:** Über der Hand erscheint eine Aktionsleiste für Großansicht, Tappen, Kopieren, Counter, Wirken/Land spielen und Friedhof. Passende Aktionen hängen von der Zone ab; Tappen, Kopieren und Friedhof funktionieren auch für mehrere ausgewählte eigene Karten. Bestehende Hotkeys, Doppelklick, Rechtsklick und freie Platzierung bleiben nutzbar.

**Eigene Counter:** Im Counter-Menü Name und Startanzahl eingeben, dann **Hinzufügen**. Danach mit +/− ändern oder löschen. Unterstützt Karten und Spieler, bis zu 16 eigene Arten je Ziel und Werte von 0 bis 999. Namen werden vereinheitlicht; derselbe Name erhöht die bestehende Marke. Eigene Counter werden synchronisiert und mit der Partie gespeichert. Sie lösen keine Karteneffekte aus und verändern keine Stärke/Widerstandskraft. Kartenkopien starten ohne Marken, Zonenwechsel entfernen sie. Unterschiedliche eigene Marken verhindern das Bündeln identischer Permanents.

**Commander-Schaden:** Unter **Counter / Schaden** den tatsächlichen Commander wählen und erhaltenen Kampfschaden eintragen. Die optionale Einstellung **Leben entsprechend mitändern** zieht zugleich Leben ab; standardmäßig wird nur der Schadenszähler geführt. Negative Änderungen korrigieren den Zähler. Lebensgewinn und Zonenwechsel setzen ihn nicht zurück. Bei mindestens 21 durch denselben Commander greift die unterstützte Zustandsprüfung und der betroffene Spieler scheidet aus. Verschiedene Commander werden getrennt erfasst. Auch der eigene Commander ist auswählbar, falls er unter fremder Kontrolle Schaden verursacht. Es gibt weiterhin nur einen Commander pro Deck. Regelgrundlage: [Wizards – Commander Masters Release Notes](https://magic.wizards.com/en/news/feature/commander-masters-release-notes).

**Geprüft:** vier getrennte Browser-Sitzungen, neue Counter über die Oberfläche, Sichtbarkeit bei Mitspielern, Zurückweisung fremder Ziele, doppelte Netzwerkaktionen, Commander-Schaden mit/ohne Lebensänderung, Erhalt der Werte nach echtem Serverneustart, Counterspell-Reaktion aus dem neuen Stack, bisherige Kernmechaniken und 90 gegnerische Permanents. Menü und Spielfeld wurden bei Laptop-, Desktop-, Ultrawide- und Mobilgrößen geprüft. Screenshots: `milestones/holo/`; Multiplayer-Prüfbericht: `milestones/holo/network/verification.json`.
