# Online spielen ohne Discord

In der Online-Lobby, im Konto-Bereich und direkt am Forge-Tisch lässt sich
**Als Gast spielen** wählen. Ein Spielname genügt. Discord bleibt zusätzlich
verfügbar, wenn es eingerichtet ist, und ermöglicht die bewusst ausgelöste
Kontospeicherung. Gastzugang ist in der Anwendung und Compose standardmäßig aktiv.

## Speicherung und Sitzungen

- Die Decksammlung bleibt im Browser unter `nexus.decks`. Der lokale Anzeigename
  liegt unter `nexus.profileName`. Neuladen und Abmelden löschen beides nicht.
- Gäste sehen keine Kontospeicher-Buttons, laden in der Forge-Deckauswahl nur
  lokale/vorbereitete Decks und dürfen `/api/decks` weder lesen noch beschreiben.
  Bestehende gespeicherte Decks werden nicht gelöscht oder migriert.
- **Exportieren** und der Textimport übertragen die Kartenliste auf ein anderes
  Gerät. Browserdaten sind je Browser und Spieladresse getrennt; Löschen der
  Browserdaten entfernt auch die lokale Decksammlung.
- Online-Spiel benötigt weiterhin den gemeinsamen Server: Gastsitzung,
  Spielname und übermittelte Decks/Spielzustände einer Partie liegen dort, wie
  bisher. „Lokal speichern“ bezeichnet die Decksammlung außerhalb der Partie,
  keine serverlose Online-Partie. Normale Online-Tische werden in SQLite
  gespeichert; Forge-Tische bleiben im Speicher und enden bei einem Neustart.
- Die vorhandene geschützte Sitzung bleibt erhalten: zufällige Spieler-ID,
  HttpOnly-/SameSite-Cookie, HTTPS-Secure-Cookie im öffentlichen Betrieb und
  Ablauf nach sieben Tagen. Gleiche Spielnamen sind getrennte Spieler und
  berechtigen nicht zum Zugriff auf fremde Hände oder Kontodecks.

## Konfiguration und Ausrollen

Für neuen öffentlichen Gastbetrieb genügen eine HTTPS-Adresse und
`ENABLE_GUEST=true`; Discord-ID und Secret dürfen beide leer bleiben. Falls
Discord verwendet wird, müssen beide Werte gemeinsam eingetragen werden.
`ENABLE_GUEST=false` verhindert neue Gastanmeldungen und verlangt im
Produktivbetrieb die Discord-Konfiguration. Bestehende Sitzungen werden durch
diesen Schalter nicht nachträglich widerrufen.

Nach Merge Anwendung/Compose aktualisieren und in der vorhandenen
`.env.production` ausdrücklich `ENABLE_GUEST=true` setzen, wenn dort bislang
`false` eingetragen ist. Domain, Discord-Secrets, Datenvolume und vorhandene
Java-/Forge-Produktionskonfiguration erhalten. Das normale Repo-Dockerfile
allein enthält keine Forge-Runtime; die bestehende Produktionsvariante mit
Java/Forge verwenden. Vor Containerwechsel ein geprüftes Backup anlegen.

`pnpm check:production` zeigt den Gastzugang und optionalen Discord-Status,
ohne Secrets auszugeben. Die echte Discord-Anmeldung wurde für diese Änderung
nicht erneut durchgeführt; der bestehende Anbieterablauf wird simuliert geprüft.

Dieses Inkrement wurde noch nicht live ausgerollt. Der PR basiert auf dem
zusammengeführten PR #16 und ist unabhängig von der optionalen
Entscheidungsautomatik in PR #17.

## Prüfungen

- 236 Anwendungstests erfolgreich, einschließlich öffentlichen Gastbetriebs
  ohne Discord, HTTPS-/Cookie-/Origin-Prüfungen, getrennter Spieler-IDs,
  Raumrechten, privater Hände, verweigerter Gast-Kontospeicherung, erhaltener
  Discord-Kontospeicherung und Sitzungswiderruf.
- TypeScript und Produktionsbuild erfolgreich.
- `node scripts/test-guest-browser.mjs`: drei getrennte Browser-Kontexte,
  Handy-Touch 390 × 844 und Desktop 1366 × 900. Gastanmeldung in Lobby und Forge,
  lokaler Import/Speichern/Neuladen, Text-Export und Import in einem anderen
  Browser, zwei Gastspieler in einer normalen Online-Partie und einer echten
  nativen Commander-Partie, Wiederverbinden, private Hände, keine automatischen
  Kontodeck-Anfragen, abgewiesener Upload und erhaltene lokale Daten nach Logout.
- Browserprüfung mit Chrome-Emulation, kein physisches Handy/Safari. Native
  Partie mit Forge 2.0.15, zwei eigenen Isamaru-/99-Plains-Decks und dem
  vorhandenen PR-#16-Adapter. Keine neuen Engine-Mechaniken aktiviert.

Browser-Test benötigt einen vorherigen Build, `FORGE_JAVA`, `FORGE_RUNTIME`,
`FORGE_CLASSES`, Playwright (`PLAYWRIGHT_MODULE` optional) und Chromium
(`CHROME_PATH` optional). Bilder liegen unter dem ignorierten `.local/browser`.
