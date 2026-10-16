// GPL-3.0-or-later. Deterministic native land fixtures, never server-loaded.
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.game.zone.ZoneType;

public class ForgeLandRulesTest {
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 public static void main(String[] args){
  GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);BatusForge.init(false);
  var payer=BatusForge.player(0);var steppe=BatusForge.add(payer,"Secluded Steppe",ZoneType.Hand);
  // This land also has cycling. The explicit land action must not activate it.
  BatusForge.land(0,BatusForge.id(steppe));
  var played=payer.getCardsIn(ZoneType.Battlefield).stream().filter(c->c.getName().equals("Secluded Steppe")).findFirst().orElseThrow();
  check(played.isTapped(),"Native enters-tapped rule must be preserved");
  check(payer.getLandsPlayedThisTurn()==1,"Exactly one land play is consumed");
  check(payer.getCardsIn(ZoneType.Hand).stream().noneMatch(c->c.getName().equals("Secluded Steppe")),"Played land leaves the hand");
  check(BatusForge.game.getStack().isEmpty(),"Land action must not cast or cycle a spell");
  var guildgate=BatusForge.add(payer,"Azorius Guildgate",ZoneType.Hand);boolean rejected=false;
  try{BatusForge.land(0,BatusForge.id(guildgate));}catch(IllegalArgumentException expected){rejected=true;}
  check(rejected&&guildgate.isInZone(ZoneType.Hand)&&payer.getLandsPlayedThisTurn()==1,"Second drop cannot consume the card or bypass the limit");
  payer.addMaxLandPlays(1L,1);BatusForge.land(0,BatusForge.id(guildgate));
  check(payer.getLandsPlayedThisTurn()==2&&payer.getMaxLandPlays()==2,"Additional native land allowances must work");
  check(payer.getCardsIn(ZoneType.Battlefield).stream().anyMatch(c->c.getName().equals("Azorius Guildgate")&&c.isTapped()),"Dual land retains its native enters-tapped behavior");
  System.out.println("PASS native lands: cycling land plays once without cycling; tapped dual, rejected extra drop and engine-granted second land play");
 }
}
