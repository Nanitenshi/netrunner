# Aufdecken als gemeinsame Kartenmechanik

## Ergebnis

Port Town, Choked Estuary, Foreboding Ruins, Game Trail und Fortified Village sind in den fünf vorbereiteten Commander-Decks enthalten. Beim optionalen Aufdecken ihrer Ersatzfähigkeit verwendete der menschliche Controller bisher geerbte KI-Zahlungsentscheidungen. Jetzt wählt der Mensch eine tatsächlich erlaubte Handkarte oder **Nicht aufdecken**. Die native Engine setzt anschließend die richtige Tap-Lage; die aufgedeckte Karte bleibt auf der Hand.

Der zusätzliche Zahlungsweg ist auf einen festen, einzelnen Aufdeck-Kostenbestandteil aus der Hand während eines Effekts begrenzt. Andere optionale Zahlungen sind kein neues Prüfergebnis. Insbesondere werden variable oder kombinierte Reveal-Kosten und Reveal-Kosten beim gewöhnlichen Wirken nicht dadurch freigeschaltet.

Aufdeck-Callbacks der nativen Engine erzeugen außerdem eine begrenzte Historie für den jeweiligen berechtigten Betrachter. Die Serverprojektion entfernt fremde Historieneinträge einschließlich ihrer Namen, IDs, Quellen und Meldungen. Eine aufgedeckte Hand- oder Bibliothekskarte wird dadurch nicht in die gegnerische Liste spielbarer Karten aufgenommen. Die übrige Hand/Bibliothek wird weiterhin nicht übertragen.

Bei verzögerten Look-/Such-Callbacks werden die für den auswählenden Spieler freigegebenen Karten sichtbar. Dadurch kann **Impulse** seine vier angesehenen Karten zeigen, während die gegnerische Ansicht leer bleibt. **Cultivate** behält seine privaten Suchoptionen, deckt die tatsächlich gefundenen Karten gemäß Forge auf und lässt den Menschen ihre Verteilung auf getapptes Battlefield und Hand wählen.

## Bedienung

Eine Aufdeck-Auswahl verlangt die passende Karte und **Aufdecken bestätigen**, oder **Nicht aufdecken**. Während einer Entscheidung bleiben fremde Spielaktionen gesperrt. Die Aktionsleiste bietet **Aufgedeckt**; bei einer Effektentscheidung ist **Aufgedeckte Karten ansehen** auch im Auswahlfenster erreichbar. Die Historie zeigt maximal acht Einträge pro Betrachter. Ihr Öffnen/Schließen bestätigt keine Auswahl und bezahlt keine Kosten. Auch auf einem Touch-Gerät bleibt der Schließen-Knopf im Querformat erreichbar.

## Reproduzierbare Prüfung

```sh
pnpm test
pnpm build
node scripts/test-forge-reveals.mjs
node scripts/test-forge-reveals-browser.mjs
node scripts/test-forge-decisions.mjs
node scripts/test-forge-costs.mjs
FORGE_AI_LEVEL=normal node scripts/test-forge-ai.mjs
```

Laufzeit-/Browserpfade wie in [forge-bridge/README.md](../forge-bridge/README.md). Optional beschränkt `FORGE_REVEAL_CASE` das neue Native-Script auf einen der fünf Landnamen, `No eligible reveal`, `Cultivate` oder `Impulse`.

Prüfpunkte: alle fünf Reveal-Länder mit Aufdecken/Ablehnen; keine unmögliche Auswahl bei fehlendem passenden Handkartentyp; private Optionen; fremde, doppelte, falsche und veraltete Antworten; tatsächliche Tap-Lage und unveränderte Handkarte. Cultivate mit echter Drei-Mana-Zahlung, privater Suche, öffentlichem ausgewähltem Ergebnis und menschlicher Landzuordnung. Impulse mit vier privaten angesehenen Karten. Zwei Browser mit privater Kandidatenliste, erlaubter gegnerischer Aufdeckung, Reload mitten in der Auswahl, privater Impulse-Ansicht und Touch-Querformat. Die bestehenden Effekt-/Zusatzkostenfälle und mehrzügige normale KI-Partien aller fünf vorbereiteten Decks dienen als Regressionen.

235 Anwendungstests und der Produktionsbuild sind erfolgreich. Visuelle Prüfung erfolgt mit Chrome-Touch-Emulation; physische Handys und Safari sind kein Prüfergebnis. Lokale Logs und Screenshots liegen in `.local/` und werden nicht eingecheckt.

## Bereitstellung und nächste Schritte

Nach Zusammenführen Server und alle sieben Java-Dateien gemeinsam aktualisieren. Commander-Starts verlangen jetzt `human-reveals` im Bridge-Handshake, damit ein alter Controller keine Entscheidungen weiterhin automatisch für Menschen trifft. Die bestehende produktive Forge-Installation und `Dockerfile.production-forge`/Compose-Erweiterung erhalten; der Basis-Dockerfile des Repositories allein enthält keine Forge-Laufzeit.

Dies ist ein weiterer abgegrenzter Schritt, keine vollständige Commander-Regelabdeckung. Ungeprüfte geerbte Controller-Callbacks, X-/Counter-/Exil-/Tap-other-Kosten, zusätzliche Wirkzonen und Neustart-Persistenz bleiben offen. Als Nächstes weitere häufige menschliche Effektentscheidungen vor zusätzlichen Kostenfamilien prüfen.
