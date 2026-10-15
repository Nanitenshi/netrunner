// GPL-3.0-or-later. Deterministic native fixtures; never loaded by the game server.
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.game.card.*;
import forge.game.player.Player;
import forge.game.spellability.SpellAbility;
import forge.game.zone.ZoneType;
import java.util.*;

public class ForgePaymentPolicyTest {
 static Player payer;
 static void check(boolean condition,String message){if(!condition)throw new AssertionError(message);}
 static void reset(){BatusForge.commanderMode=false;BatusForge.costMode=false;BatusForge.combatMode=false;BatusForge.init(false);payer=BatusForge.player(0);for(var c:new CardCollection(BatusForge.game.getCardsIn(ZoneType.Battlefield)))c.getZone().remove(c);}
 static Card source(String name){return BatusForge.add(payer,name,ZoneType.Battlefield);}
 static SpellAbility spell(String name){return BatusForge.spell(BatusForge.add(payer,name,ZoneType.Hand),payer);}
 static List<FilterMana.Option> plan(SpellAbility spell){return FilterMana.selectedPlan(spell,payer,null,null);}
 static List<String> names(List<FilterMana.Option> plan){return plan.stream().map(o->o.ability().getHostCard().getName()).toList();}
 static void cast(SpellAbility spell){check(HumanMana.play(spell,payer,HumanMana.automatic(spell,payer)),"Native payment failed");check(BatusForge.game.getStack().size()==1,"Exactly one spell must be on the real stack");}
 public static void main(String[] args){
  GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);
  reset();var rock=source("Sol Ring");var forest=source("Forest");var plains=source("Plains");var sa=spell("Mind Stone");
  check(names(plan(sa)).equals(List.of("Sol Ring")),"Two generic mana should use one rock instead of two lands");check(!rock.isTapped()&&!forest.isTapped()&&!plains.isTapped(),"Planning must not tap anything");cast(sa);check(rock.isTapped()&&!forest.isTapped()&&!plains.isTapped(),"Only the native selected rock is tapped");
  System.out.println("PASS native auto: one rock replaces two basic-land activations");
  reset();rock=source("Sol Ring");forest=source("Forest");sa=spell("Sol Ring");check(names(plan(sa)).equals(List.of("Forest")),"Equal tap count should avoid excess mana");cast(sa);check(!rock.isTapped()&&forest.isTapped(),"Do not tap a two-mana rock for one mana unnecessarily");
  System.out.println("PASS native auto: exact payment wins over unnecessary surplus");
  reset();var dual=source("Breeding Pool");forest=source("Forest");sa=spell("Sol Ring");check(names(plan(sa)).equals(List.of("Forest")),"Preserve a flexible dual land for the next spell");cast(sa);check(forest.isTapped()&&!dual.isTapped(),"Actual payment must match the flexibility policy");
  System.out.println("PASS native auto: preserve flexible color sources");
  reset();var utility=source("Strip Mine");var wastes=source("Wastes");sa=spell("Sol Ring");check(names(plan(sa)).equals(List.of("Wastes")),"Preserve a land with another useful activation");cast(sa);check(!utility.isTapped()&&wastes.isTapped(),"Utility land stays available");
  System.out.println("PASS native auto: preserve another useful activated ability");
  reset();rock=source("Sol Ring");forest=source("Forest");var mana=rock.getManaAbilities().get(0);mana.setActivatingPlayer(payer);check(HumanCosts.play(mana,payer),"Create native floating mana");sa=spell("Mind Stone");check(plan(sa).isEmpty(),"Use floating mana without another tap");cast(sa);check(!forest.isTapped()&&HumanMana.pool(payer).isEmpty(),"The pool is paid and the land stays untapped");
  System.out.println("PASS native auto: floating mana is used first");
  reset();var filter=source("Ferrous Lake");sa=spell("Expressive Iteration");check(plan(sa)==null,"A filter cannot create its own activation mana");forest=source("Forest");check(names(plan(sa)).equals(List.of("Forest","Ferrous Lake")),"Seed mana must precede the filter");cast(sa);check(filter.isTapped()&&forest.isTapped()&&HumanMana.pool(payer).isEmpty(),"Native filter activation and payment both happen");
  System.out.println("PASS native auto: filter activation is paid before its output");
  reset();rock=source("Sol Ring");sa=spell("Mind Stone");var approval=HumanMana.automatic(sa,payer);rock.setTapped(true);var beforePool=HumanMana.pool(payer);boolean failed=false;try{HumanMana.play(sa,payer,approval);}catch(IllegalArgumentException expected){failed=true;}check(failed,"Stale payment must fail");check(BatusForge.game.getStack().isEmpty(),"Failed payment cannot leave a stack object");check(BatusForge.game.getCardsIn(ZoneType.Hand).stream().anyMatch(c->c.getName().equals("Mind Stone")),"Failed payment restores the hand card");check(HumanMana.pool(payer).equals(beforePool),"Failed payment keeps mana unchanged");
  rock.setTapped(false);var restored=BatusForge.game.getCardsIn(ZoneType.Hand).stream().filter(c->c.getName().equals("Mind Stone")).findFirst().orElseThrow();cast(BatusForge.spell(restored,payer));
  System.out.println("PASS native auto: stale selected source rejects before paying and restores the card");
  reset();for(int n=0;n<40;n++)source("Forest");sa=spell("Darksteel Colossus");long start=System.nanoTime();check(plan(sa).size()==11,"Identical sources must pay eleven generic mana");long elapsed=(System.nanoTime()-start)/1_000_000;check(elapsed<3000,"Bounded grouped planning took "+elapsed+"ms");
  System.out.println("PASS native auto: forty identical lands are grouped ("+elapsed+"ms)");
 }
}
