# Gameplay-Bedienung

## Neue Abkuerzungen

- Nach dem Wirken wird eigene Prioritaet automatisch abgegeben. Die anderen Spieler erhalten weiterhin ihre normalen Reaktionsfenster.
- Umschalt beim Doppelklick oder Ziehen haelt die Prioritaet. Dauerhaftes Halten ist in Einstellungen moeglich.
- Bei ausreichend Floating Mana werden feste gedruckte Kosten und Commander-Tax automatisch aus dem Pool bezahlt. Farbige und echte farblose Kosten werden vor generischen Kosten reserviert. Keine Quellen werden automatisch getappt.
- X, Hybrid, phyrexianisches Mana, Kostenreduzierungen und Zusatzkosten bleiben manuell; Poolzahlung laesst sich ausschalten. Bei nicht ausreichendem oder nicht unterstuetztem Pool wird wie bisher manuelle Bezahlung angenommen.
- Counterspell und Swords to Plowshares: legales Ziel per Button waehlen, dadurch direkt wirken. Andere Zielbeschreibungen bleiben manuelle Kartentexte.
- Reaktionskarten sind im Stack-Fenster sofort sichtbar, ohne extra Untermenue.
- + / - aendert passende Kartenmarken: Loyalitaet bei Planeswalkern, Sagenmarken bei Sagas, sonst +1/+1. Umschalt fuer Fuenferschritte. Die Schnellleiste und das Kontextmenue nutzen dieselbe Auswahl.
- Mehrere ausgewaehlte Standardlaender mit Q gemeinsam tappen und Mana erzeugen. Andere Quellen bleiben individuell waehlbar.

Es bleibt bei einem Zug statt einzelner Phasen. Kampf, Upkeep, Endstep und Trigger werden abgesprochen. Stack und gefuehrte Auswahlen bleiben erhalten.

## Pruefung

128 Tests bestanden. Produktionsbuild und TypeScript bestanden. Online geprueft: Poolzahlung, Commander-Tax, Prioritaetswechsel und doppelte Zustellung. Browser geprueft: Counter 1/5, direktes Zielwirken, Poolzahlung, Umschalt zum Halten, sofort sichtbare Reaktionskarten und Bildschirmbreiten 1440, 1366 und 800 ohne Seitenueberlauf.

## Vorbilder

Wizards beschreibt optionale Hilfe bei Mana und manuelle Kontrolle:
https://magic.wizards.com/en/news/mtg-arena/mtg-arena-state-game-the-brothers-war

XMages Client enthaelt Prioritaet-halten und weitere direkte Shortcuts:
https://github.com/magefree/mage/blob/master/Mage.Client/src/main/java/mage/client/game/GamePanel.java

Eigenstaendige Implementierung in der vorhandenen Engine. Keine Aussage ueber eine statistische Mehrheitswahl dieser Funktionen.
