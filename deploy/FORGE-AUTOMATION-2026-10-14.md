# Schrittweise, freiwillige Entscheidungsautomatik

Ausgangspunkt ist der zusammengeführte PR #16. Dieses Inkrement automatisiert
eine geprüfte Entscheidungsfamilie und schafft eigene Einstellungen pro Mensch
am Forge-Tisch. Die Grundeinstellung bleibt **Selbst entscheiden**.

## Verhalten

- **Entscheidungen** öffnet die Einstellungen vor und während der Partie.
  Im Effektfenster führt **Automatik einstellen** direkt dorthin, auch am Handy.
- **Aufdeck-Länder → Automatisch, wenn eindeutig** erlaubt das automatische
  Aufdecken genau einer legalen Handkarte. Alle angebotenen Karten müssen
  denselben Namen haben. Die Automatik nimmt dann die erste erlaubte Kopie.
- Geprüft sind Port Town, Choked Estuary, Foreboding Ruins, Game Trail und
  Fortified Village. Bei verschiedenen Namen bleibt die Wahl manuell, auch bei
  eingeschalteter Automatik. Ohne passende Karte kommt das Land nativ getappt.
- Manuell kann der Spieler jede angebotene Karte auswählen oder ausdrücklich
  **Nicht aufdecken** wählen. Öffnen/Schließen der Einstellungen und das
  Umschalten erhalten eine noch laufende manuelle Auswahl.
- Jeder Mensch steuert nur seine eigenen Einstellungen. Neuladen stellt diese
  und die letzten acht automatischen Entscheidungen wieder her. Ein neuer Tisch
  beginnt manuell. Die Einstellungen sind nicht kontoweit gespeichert.
- Automatische Entscheidungen werden angezeigt. Zurückstellen wirkt auf noch
  nicht beantwortete und zukünftige Entscheidungen; ausgeführte Aufdeckungen
  werden nicht rückgängig gemacht.

## Grenzen und nächste Inkremente

Diese Einstellung aktiviert keine anderen Effekt-, Ziel-, Kosten-, Kampf- oder
Triggerentscheidungen. Vorhandene automatisierte Regelabwicklung und die Forge-KI
bleiben eigenständige Funktionen. Ungeprüfte geerbte Controller-Callbacks und die
übrigen Engine-Grenzen sind weiterhin im Bridge-README dokumentiert.

Neue Entscheidungsfamilien erhalten einzeln eine eigene freiwillige Einstellung,
eine manuelle Auswahl mit den nativen legalen Optionen und Tests an konkreten
Karten. Unterschiedliche strategische Möglichkeiten bleiben zunächst manuell.
Erst nach erfolgreichen Engine-, Mehrspieler-, Datenschutz-, Wiederverbindungs-
und Bedienprüfungen wird die nächste Familie aktiviert.

## Technische Absicherung

Nur der native Adapter markiert geprüfte Aufdeck-Kosten mit `reveal-land`.
Der Server verwendet die private Projektion des entscheidenden Spielers,
prüft Einstellung und laufende Entscheidungs-ID erneut in der gemeinsamen
Aktionswarteschlange und nutzt anschließend die normale native Antwortprüfung.
Ein Entscheidungs-ID wird höchstens einmal automatisch versucht. Ablehnung
schaltet den Spieler mit einem privaten Hinweis auf manuell zurück; es gibt
keine blinden Wiederholungen. Die abgelehnte laufende Entscheidung muss zuerst
manuell beantwortet werden, bevor die Automatik wieder eingeschaltet werden kann. Die eigentliche Aufdeckung erfolgt weiterhin über
die erlaubten Forge-Callbacks; fremde Hände/Bibliotheken und Einstellungen
werden nicht offengelegt. Historien und Versuchsspeicher sind begrenzt.

## Prüfungen

- 239 Anwendungstests erfolgreich; TypeScript und Produktionsbuild erfolgreich.
- Alle sieben Java-Dateien gemeinsam gegen Forge 2.0.15 / Java 17 kompiliert.
- `test-forge-automation.mjs`: echte Commander-Partien für alle fünf Länder,
  manuelles Ablehnen, verschiedene Handkarten, fehlende passende Karte,
  Aktivieren während einer Auswahl, sofortiges Zurückstellen vor Ausführung,
  private Einstellungen/Historie, native Aufdeckung und Schutz vor Doppelantwort.
- Ein zusätzlich erzwungener Worker-Antwortfehler prüft den manuellen Rückfall:
  dieselbe Entscheidung kann danach weiterhin manuell abgelehnt werden.
- `test-forge-automation-browser.mjs`: zwei angemeldete Browser; Handy-Touch
  390 × 844 und Querformat 844 × 390; Umschalten, Erhalten einer Auswahl,
  automatische Ausführung, Neuladen, neue Tische, private Historie und Ablehnung
  einer manipulierten Einstellung für einen fremden Sitz.
- Vorhandene native Entscheidungs- und Kostentests erfolgreich: Scry, Impulse,
  beidseitiges Opfern, Modi, optionale Trigger, Triggerreihenfolge/Ziele, Abbruch
  vor Manazahlung, Abwerfen, Counterspell und Fling.
- Bisheriger Aufdeck-Browsertest erfolgreich: manuelle Karte, Neuladen,
  gegnerische Sicht auf nur die gewählte Karte und private Impulse-Ansicht.

Die Browserprüfung verwendet Chrome mit Touch-/Handy-Emulation, kein physisches
Handy und kein Safari. Beliebige eigene Decks und alle Kartenkombinationen sind
damit nicht vollständig geprüft.

## Ausrollen

Noch kein Live-Deployment dieses Inkrements. Nach dem Merge müssen Anwendung
und **alle sieben Bridge-Dateien gemeinsam** aktualisiert/kompiliert werden.
Commander-Start verlangt jetzt zusätzlich `optional-reveal-automation` im
Handshake und lehnt ältere Klassen verständlich ab. Die Produktionskonfiguration
mit Java, Forge-Runtime und `FORGE_*`-Pfaden muss erhalten bleiben; bestehende
Nutzerdaten dürfen beim Imagewechsel nicht überschrieben werden. Laufende
Forge-Partien liegen im Speicher und enden bei einem Serverneustart.
