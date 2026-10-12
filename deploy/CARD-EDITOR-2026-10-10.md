# Karten bearbeiten und anlegen — 10. Oktober 2026

Lokaler Entwicklungsstand; erst nach Serverupdate online.

## Bedienung

- Rechtsklick auf eine eigene Spielfeldkarte → **Karte bearbeiten** öffnet eine kompakte Seitenfläche ohne blockierenden Hintergrund.
- Stärke und Widerstandskraft als Basiswerte ändern. +1/+1- und −1/−1-Marken werden zusätzlich gerechnet. Zurücksetzen stellt die gedruckten Werte wieder her.
- Zwölf häufige zusätzliche Fähigkeiten markieren und eine öffentliche Notiz hinterlegen. Alle Spieler sehen dieselben Angaben.
- Aura, Ausrüstung oder Befestigung bearbeiten → **Anlegen** → Zielkarte auf dem Tisch anklicken. Beim Verschieben bleiben eigene angelegte Karten zusammen. Die Kontrolle wechselt dadurch nicht.
- Verlässt das Ziel das Spielfeld, wird Ausrüstung gelöst; angelegte Auren gehen in den Friedhof ihres Besitzers. Manuelles Lösen lässt die Karte für Casual-Korrekturen liegen.
- Physische Vorder-/Rückseiten lassen sich im Editor wechseln. Bei modalen doppelseitigen Karten wird vor dem Spielen die Seite gewählt; Name, Manawert, Landstatus und Stack verwenden diese Seite. Commander-Steuer bleibt berücksichtigt.
- 846 Karten mit mehreren Kartenteilen wurden um Seitenmetadaten ergänzt. Bestehende Karten- und Druck-IDs bleiben erhalten. Auch alternative Drucke können ihre Seitenbilder liefern.
- Karten wie Eternal Witness brauchen beim Wirken keine zusätzliche Zielbestätigung nur wegen eines Eintrittstriggers im Text. Der eigentliche Trigger bleibt separat zu behandeln.
- Commander-Schaltfläche ist unterhalb der Karte sichtbar. Die 3D-Hierarchie verschluckt ihre Klicks nicht mehr. Die Tischfläche darf beim Fokussieren nicht als versteckter Scrollcontainer verrutschen.

## Grenzen

Zusätzliche Fähigkeiten und Notizen sind manuelle Markierungen. Kosten, Einschränkungen, Schutz, ausgelöste Fähigkeiten und Dauer von Effekten werden nicht allgemein automatisch abgewickelt. Eine Notiz „bis Zugende“ entfernt sich nicht automatisch; Zonenwechsel löschen die manuellen Änderungen. Dies ist keine vollständige MTG-Regelengine.

Keine allgemeine Unterstützung für Morph/Manifest, Meld, alle Adventure-/Split-Wirkweisen, Spieler-Verzauberungen oder beliebige Stack-Kopien durch dieses Update.

## Prüfung

- 164 automatisierte Tests bestanden, einschließlich Werte/Counter, unzulässiger Änderungen, Seitenwechsel, MDFC-Commander, Landrückseite, Anlegeketten, Zonenwechsel, Kopien und Farb-/Kartendaten-Regressionsprüfungen der bestehenden Suite.
- Produktionsbuild erstellt.
- Browserprüfung mit vier unabhängigen Verbindungen: gemeinsame Werte, Notizen, Anlegen, Transformieren, Hover-Rückseite, MDFC-Wirken, Landrückseite, direkter ETB-Cast, Wiederherstellung nach Reload, Laptoplayout und Entfernen des Anlegeziels.
- Zusätzliche Tischprüfung: gegnerische Karte kopieren/übernehmen/zurückgeben, Ziehen auf perspektivischem Tisch, Hover-Tappen, private Decksuche, Landtransfer, gegnerischer Friedhof und verschiedene Fenstergrößen.

Screenshots: `milestones/playtest-usability/card-editor-laptop.png` und `card-side-choice.png`.

## Nächste Prioritäten

1. Niederlage und manuelle Korrekturen besser vereinbaren: versehentliches Leben-/Schaden-Ändern darf eine Casual-Partie nicht irreversibel beenden.
2. Zusätzliche Landspiele sowie erlaubtes Spielen aus Friedhof und Exil gezielt unterstützen.
3. Fähigkeiten direkt an ihrer Quellkarte starten, Stack-Kopien und Zieländerungen sinnvoll bündeln.
4. Große Tokenmengen und die Größe des ersten Downloads reduzieren.
