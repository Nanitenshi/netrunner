# Menschliche Effektzahlungen am Forge-Tisch

Aufbauend auf dem gemergten PR #23. Fokus bleibt der Forge-Tisch; diese Änderung aktualisiert keinen laufenden Server.

## Problem und Verhalten

Der menschliche Controller erbte bei `payCostToPreventEffect` bisher eine strategische KI-Entscheidung. Dadurch konnte Forge etwa die Zahlung für Rhystic Study, Smothering Tithe oder Ward ohne Rückfrage annehmen oder ablehnen. Jetzt bestimmt der native Effekt den tatsächlichen Zahler und die Kosten; dieser Spieler entscheidet ausdrücklich über die Zahlung.

Mana-Kosten öffnen eine private Vorschau mit einem bereits gewählten Vorschlag. Ein Klick bezahlt; „Nicht bezahlen“ lässt Forge die Alternative verrechnen. Die Quellen lassen sich wie bei einer normalen Zahlung ändern. Ein unzureichender Vorschlag bezahlt nichts und kann korrigiert werden. Vorhandenes Mana wird berücksichtigt. Komplexe Quellen außerhalb des begrenzten Planers verwenden nach ausdrücklicher Bestätigung weiterhin die native automatische Quellenwahl; der Dialog weist darauf hin.

Bei festen Lebens-, Abwurf- oder Opferkosten entscheidet der Spieler zuerst, ob er zahlen möchte. Eine nötige Karte wählt er anschließend selbst. Ablehnen in dieser Auswahl lässt den Effekt ohne Zahlung weiterlaufen. Nach erfolgreicher Zahlung gibt es kein Abbruchrecht für bereits bezahlte Kosten.

Diese Zahlung ist Teil der Verrechnung und kein erneutes Wirken. Der ursprüngliche Spruch bleibt bezahlt und kann durch Ward oder Mana Leak neutralisiert werden. Die Oberfläche zeigt daher „Nicht bezahlen“ und „Effektkosten bezahlen“ statt „Wirken abbrechen“. Sie zeigt den nativen Effekttext und die Kosten. Private Quellen, mögliche Abwurfkarten und Zahlungsdetails gehen ausschließlich an den entscheidenden Sitz. Auswahl-ID, Sitz, erlaubte Optionen und Bezahlbarkeit werden nativ geprüft.

Die menschliche Kostenvorprüfung verwendet jetzt die native Bezahlbarkeit des eigentlichen Spruchs statt einer KI-Bewertung zusätzlicher Ward-Kosten. Einen Spruch auf ein Ziel mit Ward zu wirken bleibt damit möglich, wenn man die spätere Ward-Zahlung nicht bezahlen kann oder nicht bezahlen möchte.

## Automatik und Entscheidungsgrenze

Die Automatik erstellt und bezahlt den bestätigten Mana-Vorschlag. Ob ein Gegner eine Karte ziehen oder einen Schatz bekommen soll, ob ein Spruch neutralisiert werden darf oder ob man Leben beziehungsweise eine Karte dafür ausgibt, bleibt eine Spielerentscheidung. Es gibt keine voreingestellte automatische Zustimmung zu solchen Zahlungen.

Forge berechnet Kosten und Folgen. Der Browser setzt keine Lebenspunkte, Karten oder Tapzustände voraus; er zeigt den bestätigten Zustand. Unerwartetes Scheitern nach Bestätigung wird als Regelfehler angehalten. Eine vollständige Rücknahme teilweise ausgeführter Effekte wird nicht behauptet.

## Gezielte Prüfung

`forge-bridge/tests/ForgeEffectPaymentTest.java` verwendet echte Sprüche, Kosten, Trigger und Stack-Verrechnung:

| Karte/Fall | Prüfung |
|---|---|
| Mana Leak | Drei Mana bezahlen oder ablehnen; ursprünglicher Lightning Bolt verrechnet oder neutralisiert; unzureichendes Mana sowie fremde, alte und gefälschte Antworten abweisen |
| Rhystic Study | Tatsächlicher gegnerischer Zahler; ein Mana verhindert das Ziehen, Ablehnen ermöglicht es; der ursprüngliche Spruch wird weiter verrechnet |
| Smothering Tithe | Zwei Mana verhindern den Schatz; Ablehnen erzeugt einen echten Schatz-Spielstein |
| Tolarian Terror | Ward-Mana getrennt von den bereits bezahlten Spruchkosten bezahlen oder ablehnen |
| Sedgemoor Witch | Drei Leben für Ward bezahlen, ablehnen oder mangels Leben nicht bezahlen können; ursprüngliche Spruchkosten bleiben bezahlt |
| Graveyard Trespasser | Konkrete Handkarte für Ward abwerfen oder während der Kartenwahl ablehnen; keine Rücknahme des ursprünglichen Spruchs |
| Sauron, the Dark Lord | Zulässiges legendäres Artefakt für Ward selbst wählen und tatsächlich opfern |
| Esper Sentinel | Effektkosten aus der aktuellen Stärke einschließlich Marken statt aus gedruckten Werten |
| Mana-Pool und mehrere Zahlungen | Bereits erzeugtes Mana zuerst verwenden; aufeinanderfolgende Zahlungen anhand der jeweils verbleibenden Quellen prüfen |
| Grenzen | Zufälliges Abwerfen und noch ungeprüfte gemischte Sonderzahlungen nicht als freie Kartenwahl oder KI-Entscheidung behandeln |

`scripts/test-forge-effect-payments-browser.mjs` prüft zwei Desktop-Gäste, Ward mit Leben/Abwerfen, private Mana-Vorschau, Neuladen, ungültige und korrigierte Quellenwahl sowie tatsächliches Bezahlen/Ablehnen mit Kartenziehen und Schatz-Spielstein. Das isolierte Szenario „Effektzahlungen und Ward“ ist zusätzlich manuell auswählbar.

## Grenzen und Wiederholung

Prüfstand: 268 Anwendungstests und Produktionsbuild bestanden; alle acht Produktions-Java-Dateien gemeinsam kompiliert. Die 19 nativen Effektzahlungsfälle, beide Browserdurchläufe (Effektzahlungen und vollständiger Commander-Ablauf), die P0-/Kosten-/Entscheidungsprüfungen, Mana-Policy und Aktivierungszahlungen, KI-Interaktion sowie die bisherige native Effektprüfung sind bestanden. Auch die 13 bisherigen Aufdeck-/Suchfälle sind geprüft: beide Entscheidungen für fünf Aufdeckländer, keine passende Handkarte, Cultivate und Impulse. Der Cultivate-Test enthält jetzt drei Gebirge, damit nach den zwei echten Ziehsegmenten garantiert eines in der Bibliothek bleibt; zuvor konnte die einzige Suchkarte zufällig vorher gezogen werden. Die normale Commander-Partie wurde einschließlich Kampf, tatsächlichem Schaden und Zugübergaben weitergespielt. Kein Live-Deployment.

Neu geprüft sind Mana ohne unbestimmtes X sowie feste Lebens-, gewöhnliche Abwurf- und Opferkosten. Zusätzlich ist der native Effekt-Ausdruck `Count$CardPower` geprüft: Esper Sentinels X wird aus der aktuellen Stärke berechnet und als konkreter Betrag angezeigt. Dies erlaubt keine frei gewählte X-Zahlung beim Wirken. Gemischte Mana-/Nichtmana-Effektkosten, zufälliges Abwerfen, Spezialanforderungen an mehrere Abwurfkarten und weitere Kostenfamilien werden nicht neu freigegeben. Ein solcher nicht unterstützter Verrechnungsfall hält die Partie sichtbar an, statt eine geerbte KI-Zahlungsentscheidung zu verwenden; dieser Schutz gilt auch außerhalb einer Stack-Verrechnung. X beim Wirken, Kicker und weitere optionale Wirk-Kosten bleiben separate Arbeit. Nicht alle geerbten Controller-Callbacks sind damit überprüft.

Referenz für den nativen Ablauf sind die [offiziellen Ward-Regeln](https://magic.wizards.com/en/news/feature/strixhaven-school-mages-mechanics-2021-03-25) und die [Release Notes zu Rhystic Study und Smothering Tithe](https://magic.wizards.com/en/news/feature/wilds-of-eldraine-release-notes). Die geprüfte Forge-Runtime und ihr bestehender Prüfsummen-Lock bleiben unverändert.

Alle acht Produktions-Java-Dateien gemeinsam gegen die gesperrte Forge-2.0.15-Runtime mit Java 17 kompilieren. Die Anwendung verlangt für Commander und die betroffenen Testszenarien zusätzlich das Merkmal `human-effect-payments`; ältere Adapter werden abgewiesen. Server, Client und Adapter müssen gemeinsam aktualisiert werden.

Die neue Java-Prüfklasse separat gegen Runtime-JAR und Produktionsklassen kompilieren. Mit absoluten `FORGE_JAVA`, `FORGE_RUNTIME`, `FORGE_CLASSES` und `FORGE_TEST_CLASSES`:

```sh
pnpm test
pnpm build
node scripts/test-forge-effect-payments.mjs
node scripts/test-forge-effect-payments-browser.mjs
```

Browserprüfungen benötigen zusätzlich `PLAYWRIGHT_MODULE` und gegebenenfalls `CHROME_PATH`. Normale CI prüft Anwendungstests und Build; die native Prüfung benötigt zusätzlich die externe Runtime. Die Java-Testklasse gehört nicht in die ausgelieferten Produktionsklassen.
