# Commander client — abgestimmte Produktrichtung

Stand: 4. Oktober 2026. Dieses Dokument beschreibt die Produktrichtung. Den tatsächlich implementierten Multiplayer-Umfang und die noch offenen Funktionen beschreibt README.md.

## Darstellung

- Moderne digitale Arena mit magischer Atmosphäre, dunkler Grundgestaltung und individuellen Farben.
- Jeder sieht seinen eigenen Spieler unten groß, drei Gegner oben. Gegner einzeln vergrößerbar, alle bleiben sichtbar.
- Kamerasteuerung: um das Board kreisen, neigen und zoomen; jederzeit zur Spielansicht zurückkehren. Keine frei fliegende Kamera unter dem Board.
- Die Standard-Spielmatte bildet eine feste, am Board verankerte Zonenebene. Karten sind darauf frei platzierbar. Optionale Rasterhilfe und expliziter Aufräumen-Befehl; keine erzwungenen Kartenplätze.
- Links einklappbare Kartenvorschau, zusätzliche Detailansicht beim Öffnen einer Karte.
- Persönliche Einstellungen für Farben, Effekte, Hintergrund, UI-Skalierung, Kartengröße und Vorschau-Breite. Automatische Anpassung an Fenstergröße; manuelle Überschreibung und lokale Monitorprofile.
- Kamera und Design bleiben lokal. Kartenpositionen werden in normierten Koordinaten des jeweiligen Spielerbereichs gespeichert und später vom Server synchronisiert. HUD und Kartendetails bleiben unabhängig von der Kameraneigung lesbar.

## Vorgeschlagene Standardsteuerung

Alle Belegungen konfigurierbar; Kürzel nur bei fokussiertem Spielfeld, nie in Textfeldern. Browserkürzel möglichst vermeiden.

| Aktion | Standard |
| --- | --- |
| Auswählen | Linksklick |
| Mehrfachauswahl | Umschalt + Linksklick |
| Verschieben | Linke Maustaste ziehen |
| Tap/Untap | Doppelklick oder T auf ausgewählten Karten |
| Kopie erzeugen | C auf ausgewählten öffentlichen eigenen Karten; Kontextmenü |
| Vorschau | Hover; Leertaste für große Ansicht |
| Aktionen | Rechtsklick; auf Touch Aktionsknopf |
| Kamera drehen/neigen | Rechte Maustaste auf freiem Board ziehen |
| Zoom | Mausrad über Board |
| Kamera zurücksetzen | Pos1 und sichtbarer Reset-Knopf |
| Schließen/Abwählen | Escape |

Kopien sind eigenständige, als Kopie/Token markierte Spielobjekte; sie verändern nicht die Deckliste. Tap bedeutet 90-Grad-Drehung und bleibt vom Kamerawinkel getrennt. Alle Spielaktionen laufen später durch denselben serverseitigen Validierungspfad, unabhängig von Maus, Tastatur oder Touch.

## Konto und Discord

Benutzerkonten sind gewünscht. Deckbibliothek, Deckbuilder und persönliche Einstellungen werden Konten zugeordnet. Konten dürfen nicht auf beliebige clientseitige Spieler-IDs vertrauen.

Vom Benutzer bestätigt: eigenständige Browser-App mit optionaler Discord-Anmeldung/-Verknüpfung über OAuth2 und einem Button zum Discord-Sprachkanal. OAuth2 benötigt eine konfigurierte Discord-Anwendung; keine funktionierende Verbindung vortäuschen. Eingebetteter Sprachchat folgt nicht automatisch aus OAuth2. Eine Discord Activity ist nicht Bestandteil der ersten Version.

## Architektur und Phasen

React/TypeScript/Vite für Oberfläche, getrennte gemeinsame Karten- und Zustandsmodelle. Für echte räumliche Kamera ist eine Board-Szene mit Three.js/React Three Fiber vorgesehen; DOM-Oberfläche für HUD, Decks, Vorschau und Formulare. Renderer erst mit der Battlefield-Phase hinzufügen.

Node.js/TypeScript und Socket.IO für spätere autoritative Game Actions; PostgreSQL für Konten, Decks, Karten-Cache und gespeicherte Spiele. Server erzeugt pro Betrachter eine gefilterte Sicht; Hand- und Bibliotheksidentitäten niemals pauschal broadcasten. Reconnect bindet an authentifizierten Sitz und erhält eine neue vollständige erlaubte Sicht.

Aktueller Auftrag bleibt Phase 1: ausführbare Projektstruktur und UI-Shell, anschließend Battlefield und Interaktionen, dann echte Multiplayer-Verbindungen. Lokale Entwicklungsansichten werden ausdrücklich gekennzeichnet. Noch kein vollständiger Deckbuilder und keine vollständige Regelengine.

## Referenzen

- EDOPro: https://github.com/edo9300/edopro — kompakter digitaler Spielclient; konkrete visuelle Referenz ist der Screenshot des Nutzers.
- Cockatrice: https://github.com/Cockatrice/Cockatrice — manuell bedienbarer Multiplayer-Kartenclient.
- Cockatrice-Kürzel: https://cockatrice.github.io/docs/d0/dfd/shortcuts__settings_8h_source.html
- Tabletop Simulator: https://kb.tabletopsimulator.com/player-guides/basic-controls/ — direkte Objektbedienung und Kamera.
- Discord OAuth2: https://docs.discord.com/developers/topics/oauth2
- Discord Activities: https://docs.discord.com/developers/activities/overview

Bedienkonzepte dienen als Inspiration. Übernahme von Quellcode erfordert eine konkrete Lizenzprüfung; Projektlizenz und Rechte an Kartenbildern sind getrennte Fragen.

## Design-Überarbeitung nach Nutzerfeedback

Eigenes Hauptmenü, Deckersteller, Konto und Einstellungen sind jetzt getrennt erreichbar. Gegnerkarten werden größer und in zwei Reihen dargestellt; ein eigener Detaildialog vergrößert ein Gegnerfeld, ohne die anderen Felder dauerhaft zu verkleinern. Blaues Licht, perspektivische Zonen und Commander-Porträts orientieren sich stärker an der YGOPro-Referenz. Optionales direktes Tappen eigener Länder per Klick orientiert sich an MTG Online. Decks und Anzeigename werden aktuell nur lokal gespeichert.
