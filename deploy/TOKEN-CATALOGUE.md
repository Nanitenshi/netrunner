# Token-Update — 8. Oktober 2026

## Bedienung
Die bisherigen zwölf Favoriten bleiben unter Häufig verfügbar. Alle bietet 852 spielbare Token-Varianten bzw. Kartenseiten aus dem aktuellen Scryfall-Katalog, ohne Werbekarten, Challenge-Deck-Karten, Sticker oder Embleme. Cyberman ist berücksichtigt, obwohl der Anbieter Token in seiner Typzeile auslässt.

Rechtsklick auf eine Karte → Passende Token öffnet Von Karte. Die Auswahl verwendet die tatsächlichen all_parts-Verknüpfungen des Anbieters; abweichende Druckversionen werden über ihre Oracle-ID zugeordnet. Namen allein reichen nicht als Zuordnung. Nicht vorhandene Varianten werden angezeigt, ohne eine andere Variante zu ersetzen. Die Verknüpfung benötigt Internet; bei Ausfällen bleibt Alle nutzbar.

Name, Stärke/Widerstandskraft, Farbe und Fähigkeiten filtern die Auswahl. Deutsche Begriffe wie Schatz, Soldat, Flugfähigkeit und Wachsamkeit werden erkannt. Pro Aktion sind 1–30 Token möglich. Die Auswahl wird vom Server geprüft und für alle Mitspieler synchronisiert. Land-Token erhalten die Land-Eigenschaft.

Token haben passende Bilder und die Werte ihrer gewählten Variante. Bilder des erweiterten Katalogs werden vom Bildanbieter geladen. Effekte, X-Werte, Verdoppler und Token-Kopien werden weiterhin manuell ausgeführt. Das Update ist keine automatische Ausführung sämtlicher Kartentexte. Neue Karten ohne Anbieter-Verknüpfung und zukünftige Token benötigen eine Aktualisierung. Doppelseitige Token werden als auswählbare einzelne Seiten geführt.

## Aktualisierung
Im Projektverzeichnis: node scripts/update-token-catalogue.mjs. Anschließend Client und Server gemeinsam neu bauen und das Serverarchiv erstellen. Die Aktualisierung verwendet stabile Oracle-IDs, erhält bisherige spielbare Einträge und überschreibt den Katalog nicht bei unvollständigen oder doppelten Daten.

## Prüfung
143 automatisierte Tests erfolgreich; TypeScript und Produktionsbuild erfolgreich. Browserprüfung mit zwei Online-Spielern: Katalogsuche und Seitenwechsel, erzeugte 4/4-Engel beim Gegner sichtbar, echte Najeela-Verknüpfung erzeugt weiße 1/1-Warrior, Rechtsklick und schmale Bildschirmgrößen. Live-Abruf zusätzlich für Avenger of Zendikar und Wurmcoil Engine geprüft.

## Veröffentlichung
Das aktualisierte Archiv liegt unter releases/server/batusmtg-server.tar.gz. Es wurde lokal vorbereitet; der bestehende öffentliche Server wird erst durch das Hochladen und Neubauen aktualisiert. Das Archiv enthält keine Zugangsdaten oder Produktionsdatenbank.
