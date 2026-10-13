# Handy- und Tablet-Bedienung

Der Browser erkennt Touch-Geräte über `pointer: coarse`, auch nach dem Wechsel ins Querformat. Der normale Commander-Tisch und der Forge-Testtisch verwenden dafür eine eigene Anordnung. Hand und Spielaktionen bleiben unten erreichbar; Spielfelder, Kartenlisten und längere Auswahlen scrollen getrennt. Die Bildschirmhöhe folgt dem sichtbaren Browserbereich, Aussparungen und der unteren Systemleiste wird Platz eingeräumt. Pinch-Zoom bleibt erlaubt.

## Bedienung

- **Normaler Tisch:** Durch die Hand wischen. Eine Karte antippen und in der Aktionsleiste Spielen, Großansicht, Tappen oder Counter wählen. Ein Touch-Doppeltipp spielt keine Karte aus; die Quick-Tap-Einstellung löst beim bloßen Auswählen eines Landes keine Aktion aus. Die gerade Kartenübersicht startet am eigenen Platz. Die Spielerbilder wechseln zum gegnerischen Board, die Tischübersicht zeigt die Matten untereinander. Im Querformat kann das Board vertikal gescrollt werden.
- **Forge / KI:** Eine Karte antippen, Bild und Kartentext ansehen und ausdrücklich **Als Land spielen**, **Wirken** oder **Fähigkeit wählen** drücken. Anschließend gelten die vorhandenen Kosten- und Zielauswahlen. **Passen** und **Zug beenden** stehen vorn in der wischbaren Aktionsleiste. **Stack** öffnet die Antworten und Stack-Ziele. Während einer Ziel-, Abwerf- oder Kampfauswahl wählt das Antippen die betreffende Karte; **Karten ansehen** erlaubt zwischendurch die Großansicht und kehrt nach deren Schließen zur Auswahl zurück.
- **Kampf:** Eigene Angreifer auswählen und bestätigen; beim Blocken zuerst den eigenen Blocker, danach den gegnerischen Angreifer antippen und die Zuordnung bestätigen. Die Engine entscheidet weiterhin über legale Aktionen und Schaden.

## Prüfung

`pnpm build` und alle **233 Tests** bestehen. Zusätzlich gegen den Produktionsbuild mit Chrome, echten Touch-Ereignissen (`hasTouch`, `isMobile`, grober Zeiger), laufendem Spielserver und der nativen Forge-Engine geprüft:

```sh
node scripts/test-mobile-play.mjs
node scripts/test-forge-costs-browser.mjs --touch
node scripts/test-forge-ai-browser.mjs
node scripts/test-forge-costs-browser.mjs
```

Die Browser-Scripts benötigen Playwright und die in der [Forge-Anleitung](../forge-bridge/README.md) beschriebenen Laufzeitpfade. Optional lassen sich `PLAYWRIGHT_MODULE` und `CHROME_PATH` setzen.

- 390×844 Hochformat, 844×390 Querformat, wichtige Aktionen zusätzlich bei 320×568.
- Native Wischgesten scrollen Handkarten, ohne sie auszuspielen oder umzusortieren. Details, explizites Tappen trotz aktiviertem Quick-Tap, Counter und erreichbare Aktionen.
- Zwei Online-Clients: Land spielen und tappen, öffentliche Zustandsreplikation, private Handkarten, Zugwechsel und Neuladen.
- KI-Partie: eigenes Deck und Schwierigkeit wählen, Mulligan, Land, echte Commander-Kosten und Auflösung, gegnerischer Spruch, Reaktion, Stack, Neuladen, Aufgeben und Verlassen.
- Zwei Touch-Spieler: Angriff, Karteninspektion während der Blockerauswahl, Zuordnung im Querformat und native Kampfschadenverrechnung.
- Zusatzkosten: private Auswahl, Neuladen, Abbrechen ohne Zahlung, Abwerfen, Opfern, Counterspell, Spielerziel und tatsächlicher Schaden.
- Bestehende Desktop-Browserabläufe für KI und Zusatzkosten bleiben erfolgreich. Screenshots der lokalen Prüfung liegen in `.local/browser/` und werden nicht eingecheckt.

Dies sind Browser-Emulationen; ein physisches Android-Gerät oder iPhone und Safari wurden noch nicht geprüft. Der bestehende große Kartenkatalog wird weiterhin beim Start geladen. Es gibt keinen Offline-Spielmodus und keine neue native App.

## Bereitstellung

Nach dem Zusammenführen den Web-Build auf dem Spielserver aktualisieren. Die bestehende Server-/Forge-Einrichtung und Anmeldung gelten weiterhin; für diese Änderung müssen keine Java-Bridge-Dateien neu kompiliert werden. Danach die vorhandene HTTPS-Adresse im Handy-Browser öffnen und neu laden. Ein als Homescreen-Verknüpfung gestarteter Browser kann die verfügbaren Systemleisten reduzieren, benötigt aber weiterhin eine Verbindung zum Server.
