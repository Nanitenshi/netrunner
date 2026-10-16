# Forge-Regelvertrag und Effektprüfung

Aufbauend auf dem gemergten PR #22. Entwicklungsfokus bleibt der Forge-Tisch. Diese Änderung führt kein Live-Deployment aus.

## Verbindlicher Ablauf

Forge berechnet Spielregeln, Karteneffekte, Layer, Ersatzeffekte, Trigger, Zonenwechsel und zustandsbasierte Aktionen. Der Server authentifiziert Spieler und serialisiert Anfragen; der Client zeigt den bestätigten Zustand und sendet Absichten. Änderungen an Marken, Lebenspunkten, Typen, Fähigkeiten, Kosten oder Zonen werden im Forge-Modus ausschließlich durch native Spielaktionen ausgelöst. Die strikten Aktionsschemas akzeptieren solche Zustände nicht als Client-Eingabe.

Offizielle Regeln dienen der Überprüfung des Engine-Verhaltens: insbesondere [Layer und Ersatzeffekte sowie Objektwechsel und Regeneration](https://magic.wizards.com/en/rules) und die [Earthbending-Erklärung](https://magic.wizards.com/en/news/feature/avatar-the-last-airbender-mechanics). Die Ausführung übernimmt die geprüfte Forge-Version mit ihren Kartenskripten. Regeltext wird weder im Browser noch durch eine generative KI in neue Spielaktionen übersetzt.

## Native Zustände sichtbar machen

Öffentliche Spielfeldkarten erhalten `rules` mit nativer Objektinstanz, Marken, markiertem Schaden, Regenerationsschutz, effektiver Einsatzverzögerung, sichtbaren Schlüsselwörtern, aktuellem Fähigkeitstext sowie Attachment-Verweisen. Typ, Stärke/Widerstandskraft und aktivierbare Fähigkeiten stammen weiterhin aus dem aktuellen Forge-Zustand. Ein Blink erzeugt trotz gleicher physischer Karten-ID eine neue Instanz; alte Marken, Attachments und temporäre Zustände werden nicht aus dem vorherigen UI-Objekt übernommen.

Karten tragen kleine Statusanzeigen. Auf dem Desktop öffnet Umschalt-Klick oder „Kartenstatus ansehen“ die aktuellen Werte und Beziehungen. Das Kartenbild bleibt als gedruckte Referenz erhalten. Der zusätzlich aufklappbare Kartentext stammt aus der tatsächlich verwendeten Forge-Spielversion; der Katalog ist nur ein Fallback. Für verdeckte Hand-/Bibliothekskarten werden keine neuen Metadaten veröffentlicht. Der Server entfernt zusätzlich Attachment-Verweise auf für den jeweiligen Sitz nicht sichtbare Karten.

## Entscheidungen bei Effekten

Bei mehreren konkurrierenden Ersatzeffekten entscheidet jetzt der von Forge bestimmte Mensch über einen validierten Auswahlweg. Gleiches gilt für mehrere statische Alternativen, Markentypen und zur Auswahl angebotene Fähigkeiten. Nur eine vorhandene Alternative wird direkt übernommen. Optionale Anwendungen bleiben über die bestehenden Bestätigungen ablehnbar; eine verpflichtende Verrechnung erhält kein Ankündigungs-Abbruchrecht. Auswahl-IDs, Sitz, Anzahl und erlaubte Werte werden nativ erneut geprüft.

Diese Änderung überprüft vier zusätzliche Controller-Callbacks. Der menschliche Controller erbt weiterhin weitere, noch nicht vollständig überprüfte Forge-AI-Callbacks. Vollständige manuelle Kontrolle aller Magic-Entscheidungen ist damit noch nicht nachgewiesen.

## Fehler während der Verrechnung

Ausnahmen bei Stack-Verrechnung, Zustandsprüfungen oder Phasenübergängen markieren die Partie als angehalten. Der Zustand bleibt zur Diagnose erhalten; weitere menschliche Spielaktionen und KI-Fortsetzung werden gesperrt. Der Tisch kann verlassen werden. Es wird keine vollständige Rücknahme bereits teilweise ausgeführter Effekte behauptet. Fehler vor einer zulässigen Aktion bleiben gewöhnliche Ablehnungen mit den bisherigen Kosten-/Zahlungs-Rollbacks.

Dies schützt vor stiller Fortsetzung nach einer bekannten Ausnahme. Semantische Fehler ohne Ausnahme müssen weiterhin durch Regressionen gefunden werden.

## Geprüfte Kombinationen

`forge-bridge/tests/ForgeRuleEffectsTest.java` wirkt und bezahlt echte Karten und verrechnet sie über den nativen Stack:

| Gruppe | Konkrete Prüfung |
|---|---|
| Auren und Layer | Rancor, Battlegrowth, Darksteel Mutation, Naturalize: Basiswerte, Stärkeänderung, Marken, Fähigkeiten entfernen/wiederherstellen, Attachment-Verknüpfung |
| Blink | Cloudshift entfernt alte Marken/Auren; Rancor kehrt über seinen Trigger zurück; ein bereits auf dem Stack liegendes Doom Blade verfolgt das neue Objekt nicht |
| Verzögerter Blink | Flickerwisp kehrt erst im tatsächlichen Endsegment zurück |
| Reanimation | Reanimate auf eine fremde Air Elemental: Eigentum/Kontrolle, fünf Lebenspunkte, Einsatzverzögerung; Mulldrifter zieht nach Reanimation wirklich zwei Karten |
| Verknüpfte Effekte | Animate Dead reanimiert, bleibt angelegt und ändert Stärke; sein Entfernen opfert die zurückgeholte Kreatur |
| Regeneration | Regenerate gegen Doom Blade: Schutz verbraucht, Schaden entfernt, getappt und aus echtem Kampf entfernt; schützt nicht gegen Diabolic Edict, Swords to Plowshares oder Widerstandskraft 0 durch Disfigure |
| Earthbending | Badgermole animiert ein neu gespieltes Land mit Marken und Eile; Tod und Exil lösen echte Rückkehr als neues getapptes Land aus, ohne weiteren Landzug |
| Ersatzeffekte | Rest in Peace und gegnerische Leyline of the Void: menschliche Auswahl, ungültige/fremde Antworten abgewiesen, Exil tatsächlich angewendet |
| Fehlerschutz | Eine gezielt fehlerhafte Testfähigkeit verändert zuerst den Zustand und wirft dann eine Ausnahme: Partie wird gesperrt, teilweise Änderungen werden nicht fälschlich rückgängig dargestellt |

Die neue Auswahl „Auren, Blink und Rückkehr“ ist ein isoliertes Testszenario. Die bisherigen Szenarien und echten Commander-Decks bleiben getrennt davon. `scripts/test-forge-rule-status-browser.mjs` prüft zwei Desktop-Gäste, öffentliche Statusanzeige, Neuladen, Blink, Regeneration, Earthbending und Reanimation.

## Versions- und Freigabeprozess

`shared/forge-runtime-lock.ts` hält die SHA-256-Prüfsummen des getesteten Forge-JARs und des Kartenskriptarchivs fest. Jeder Worker prüft beide Dateien vor seinem Start. Abweichende Dateien werden abgewiesen; die Lobby bleibt nach einem Fehler benutzbar. Zusätzlich verlangen Commander und das Effektszenario das Adaptermerkmal `rule-effects`.

Vor einem Forge-/Oracle-Update:

1. Offizielle Änderungen und betroffene Kartenskripte prüfen; getestete Runtime isoliert aktualisieren.
2. Alle acht Produktions-Java-Dateien gemeinsam gegen diese Version kompilieren. Private Phasen-Hooks und Controller-Signaturen überprüfen.
3. Prüfsummen im Entwicklungsstand aktualisieren; Anwendungstests, Build, die native Effektsuite sowie Commander/P0/Kampf/KI/Zahlungsprüfungen ausführen.
4. Die Desktop-Durchläufe für Status, Commander und Kampf prüfen. Fehlerfälle und vorherige Fähigkeiten müssen weiter funktionieren.
5. Änderungen einschließlich Lock, Adapter, Server und Client zusammen reviewen und ausrollen. Persistente Daten und Runtime-Ressourcen erhalten. Während einer laufenden Partie die Runtime unverändert lassen; Updates werden zwischen Partien durchgeführt.

Der Lock umfasst Engine-JAR und Kartenskriptarchiv, nicht jede einzelne Ressourcen-Datei. Ressourcen wie Tokenskripte und Effekttemplates müssen ebenfalls gemeinsam aus der geprüften Distribution stammen und im Freigabeprozess berücksichtigt werden. Eine globale Bestätigung aller Kartenkombinationen ist dieser Testumfang nicht.

## Wiederholen

Mit absoluten `FORGE_JAVA`, `FORGE_RUNTIME` und `FORGE_CLASSES`:

```sh
node scripts/check-forge-runtime.mjs
pnpm test
pnpm build
```

`ForgeRuleEffectsTest.java` separat gegen den Runtime-JAR und die Produktionsklassen kompilieren. `FORGE_TEST_CLASSES` auf dieses Prüfklassenverzeichnis setzen; dann:

```sh
node scripts/test-forge-rule-effects.mjs
node scripts/test-forge-rule-status-browser.mjs
```

Browserprüfungen benötigen zusätzlich `PLAYWRIGHT_MODULE` und gegebenenfalls `CHROME_PATH`. Die Testklassen gehören nicht in die ausgelieferten Produktionsklassen. Die normale GitHub-Prüfung führt Anwendungstests und Build aus; die Forge-Prüfungen benötigen die externe Runtime und sind zusätzlich vor Freigabe auszuführen.

## Prüfergebnis dieses Standes

265 Anwendungstests und der Produktionsbuild sind bestanden. Die native Effektsuite einschließlich Fehlerschutz, die bisherigen P0- und KI-Interaktionsprüfungen sowie beide Desktop-Browserdurchläufe (Effektstatus und vollständiger Commander-Ablauf) sind bestanden. Alle acht Produktions-Java-Dateien wurden gemeinsam gegen die gesperrte Runtime kompiliert. Dies ist eine Entwicklungsprüfung, keine Bestätigung eines Live-Deployments.

## Noch offen

Vier Spieler, beliebige Rücknahmen, alle Controllerentscheidungen, Spezialkosten, alle alternativen Wirkzonen, Morph/Manifest-Sonderfälle und ungewöhnliche Kampfregeln sind weiterhin nicht vollständig abgedeckt. Eine vorhandene Karte im Katalog oder Forge-Skript beweist allein keine vollständige Unterstützung durch die Anbindung. Neue Mechaniken erhalten repräsentative positive und negative Tests, ehe sie als geprüft gelten.
