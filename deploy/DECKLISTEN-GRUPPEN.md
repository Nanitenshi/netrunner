# Deckliste und Analyse

In **Deckersteller → Deine Deckliste** werden Karten standardmäßig nach ihrer vermuteten Aufgabe gruppiert: Länder, Mana/Ramp, Kartenziehen, Tutoren, Interaktion, Schutz, Friedhof, Kreaturen und weitere Karten. Gruppen zählen Exemplare, nicht nur unterschiedliche Namen.

Die automatische Zuordnung arbeitet mit Kartentyp und Kartentext. Sie ist ein Vorschlag, keine vollständige Interpretation von Synergien oder Spielregeln. Über das Feld **Gruppe** lässt sich jede Karte anders zuordnen. Ein eigener Name erstellt eine eigene Gruppe; Enter oder Verlassen des Felds speichert. Ein leeres Feld setzt die Karte auf die automatische Zuordnung zurück. Jede Karte steht in genau einer Gruppe.

Weitere Ansichten: Kartentyp, Manawert oder ungegliederte Liste. Innerhalb der Gruppen kann nach Name oder Manawert sortiert werden. Die Suche berücksichtigt Name, Typ und Kartentext. Links-/Rechtsklick sowie Minus/Plus ändern weiterhin die Anzahl.

**Analyse & Testhand** enthält:

- gewichtete Manakurve und durchschnittlichen Manawert ohne Länder und Commander;
- Kartentypen der Bibliothek und Farbidentitäten, wobei mehrfarbige Karten in jeder ihrer Farben mitgezählt werden;
- zufällige Test-Starthände aus der tatsächlichen Bibliothek ohne Commander. Änderungen an der Deckmenge verwerfen eine alte Testhand. Es wird keine laufende Partie verändert.

Kartentypen verwenden bei doppelseitigen Karten die Vorderseite. X zählt bei der Manakurve entsprechend dem gespeicherten Manawert als 0. Die Farbverteilung beschreibt Farbidentität, keine Manaquellenanalyse.

Eigene Zuordnungen und Decknotizen werden lokal gespeichert, beim Duplizieren übernommen und über **Im Konto speichern** mit dem Konto synchronisiert. Der reine Textlistenexport bleibt eine importierbare Kartenliste ohne diese Zusatzdaten.

Vorbild für die ausgewählten Funktionen: [Deckstats](https://deckstats.net/index.php?lng=en) und [Deckbuilder](https://deckstats.net/deckbuilder/en/). Umsetzung und Gestaltung bleiben Teil von BatusMTG.

Prüfung: 109 Tests erfolgreich; TypeScript und Produktionsbuild erfolgreich. Browserprüfung für eigene/automatische Gruppen, Zurücksetzen, Neuladen, Notizen, Mengenänderung, Typ-/Manawertansicht, Testhand und vier Bildschirmbreiten. Kein horizontaler Überlauf oder JavaScript-Fehler in diesen Prüfungen.

Das Paket `releases/server/batusmtg-server.tar.gz` enthält auch die vorherigen Änderungen zum Aufgeben und Verlassen. Es muss auf den öffentlichen Server hochgeladen und installiert werden. Vorhandene Decks benötigen keine manuelle Umstellung.
