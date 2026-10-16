// GPL-3.0-or-later. Native fixture only; never loaded by the game server.
import com.google.gson.JsonObject;
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.game.zone.ZoneType;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class ForgeActivationPaymentTest {
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static Map<String,Object> waitChoice(String previous)throws Exception{long end=System.currentTimeMillis()+10000;while(BatusForge.choice==null||Objects.equals(BatusForge.choice.get("id"),previous)){if(System.currentTimeMillis()>end)throw new AssertionError("Choice timeout");Thread.sleep(5);}return BatusForge.choice;}
 static void answer(Map<String,Object> choice,boolean cancel,List<String> ids){var a=new JsonObject();a.addProperty("choiceId",choice.get("id").toString());a.add("first",BatusForge.JSON.toJsonTree(ids));if(cancel)a.addProperty("answer",false);HumanDecisions.answer(0,a);}
 @SuppressWarnings("unchecked") public static void main(String[] args)throws Exception{
  GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);BatusForge.init(false);BatusForge.commanderMode=true;CommanderDecks.kept[0]=CommanderDecks.kept[1]=true;
  BatusForge.protocol=new PrintStream(OutputStream.nullOutputStream());BatusForge.requestId="fixture";
  var payer=BatusForge.player(0);var tome=BatusForge.add(payer,"Jayemdae Tome",ZoneType.Battlefield);var ability=tome.getSpellAbilities().stream().filter(sa->!sa.isSpell()).findFirst().orElseThrow();int index=BatusForge.abilities(tome,payer).indexOf(ability);
  var executor=Executors.newSingleThreadExecutor();
  try{
   var cancelled=executor.submit(()->BatusForge.activate(0,BatusForge.id(tome),index,true,true));var choice=waitChoice(null);var payment=(Map<String,Object>)choice.get("payment");check(payment.get("action").equals("activate"),"Activation payment is labelled");check(Boolean.TRUE.equals(payment.get("tapSource")),"Native source tap is visible");
   check(payer.getCardsIn(ZoneType.Battlefield).stream().noneMatch(c->c.isTapped()),"Preview cannot tap any source");answer(choice,true,List.of());cancelled.get(10,TimeUnit.SECONDS);check(!tome.isTapped()&&BatusForge.game.getStack().isEmpty(),"Cancel leaves no tap or stack object");
   var paid=executor.submit(()->BatusForge.activate(0,BatusForge.id(tome),index,true,true));choice=waitChoice(null);payment=(Map<String,Object>)choice.get("payment");var selected=(List<String>)payment.get("selectedIds");check(selected.size()==4,"Native four-mana plan");
   answer(choice,false,List.of());choice=waitChoice(choice.get("id").toString());payment=(Map<String,Object>)choice.get("payment");check(Boolean.FALSE.equals(payment.get("valid")),"Insufficient selection is explicitly invalid");check(((List<?>)payment.get("steps")).isEmpty(),"Invalid selection never shows an old valid plan");check(!tome.isTapped(),"Invalid plan does not tap the activated permanent");
   answer(choice,false,selected);choice=waitChoice(choice.get("id").toString());check(Boolean.TRUE.equals(((Map<?,?>)choice.get("payment")).get("valid")),"Corrected plan has a new valid preview");answer(choice,false,selected);paid.get(10,TimeUnit.SECONDS);
   check(tome.isTapped(),"Native tap cost paid");check(payer.getCardsIn(ZoneType.Battlefield).stream().filter(c->c.isLand()&&c.isTapped()).count()==4,"Exactly four mana sources paid");check(BatusForge.game.getStack().size()==1&&BatusForge.priority==0,"Ability on native stack with held priority");
   int hand=payer.getCardsIn(ZoneType.Hand).size();BatusForge.pass(0);BatusForge.pass(1);check(payer.getCardsIn(ZoneType.Hand).size()==hand+1,"Native ability draws a card");
   System.out.println("PASS native activation: private review/cancel, invalid selection clears old plan, corrected preview, real mana/tap/draw and held priority");
   BatusForge.init(false);var nextPayer=BatusForge.player(0);for(var card:new forge.game.card.CardCollection(nextPayer.getCardsIn(ZoneType.Battlefield)))card.getZone().remove(card);
   var lighthouse=BatusForge.add(nextPayer,"Desolate Lighthouse",ZoneType.Battlefield);BatusForge.add(nextPayer,"Island",ZoneType.Battlefield);BatusForge.add(nextPayer,"Mountain",ZoneType.Battlefield);
   var loot=BatusForge.abilities(lighthouse,nextPayer).stream().filter(sa->!sa.isSpell()&&!sa.isManaAbility()&&!sa.isLandAbility()).findFirst().orElseThrow();int lootIndex=BatusForge.abilities(lighthouse,nextPayer).indexOf(loot);
   check(FilterMana.selectedPlan(loot,nextPayer,null,null)==null,"A tapped cost carrier cannot fund its own activation");boolean rejected=false;try{BatusForge.activate(0,BatusForge.id(lighthouse),lootIndex,true,false);}catch(IllegalArgumentException expected){rejected=true;}
   check(rejected&&nextPayer.getCardsIn(ZoneType.Battlefield).stream().noneMatch(c->c.isTapped())&&BatusForge.game.getStack().isEmpty(),"Insufficient activation leaves every source untouched");
   BatusForge.add(nextPayer,"Wastes",ZoneType.Battlefield);var plan=FilterMana.selectedPlan(loot,nextPayer,null,null);check(plan!=null&&plan.stream().noneMatch(step->step.ability().getHostCard()==lighthouse),"Mana plan excludes the tap-cost carrier");BatusForge.activate(0,BatusForge.id(lighthouse),lootIndex,true,false);
   check(lighthouse.isTapped()&&nextPayer.getCardsIn(ZoneType.Battlefield).stream().filter(c->c.isTapped()).count()==4&&BatusForge.game.getStack().size()==1,"Native activation pays three external mana and its own tap exactly once");
   System.out.println("PASS native activation: Desolate Lighthouse cannot pay its own tap cost twice; insufficient mana unchanged, three external sources succeed");
   BatusForge.init(false);var costPayer=BatusForge.player(0);BatusForge.add(costPayer,"Mountain",ZoneType.Battlefield);var artifact=BatusForge.add(costPayer,"Ornithopter",ZoneType.Battlefield);var fling=BatusForge.add(costPayer,"Fling",ZoneType.Hand);BatusForge.spell(fling,costPayer).getPayCosts().add(new forge.game.cost.Cost("Sac<1/Artifact>",false));
   var failed=executor.submit(()->BatusForge.cast(0,BatusForge.id(fling),"player:1",null,false,true));choice=waitChoice(null);answer(choice,false,List.of(BatusForge.id(artifact)));boolean overlapRejected=false;try{failed.get(10,TimeUnit.SECONDS);}catch(ExecutionException expected){overlapRejected=expected.getCause() instanceof IllegalArgumentException;}
   check(overlapRejected&&fling.isInZone(ZoneType.Hand)&&artifact.isInZone(ZoneType.Battlefield)&&costPayer.getCardsIn(ZoneType.Battlefield).stream().noneMatch(c->c.isTapped())&&BatusForge.game.getStack().isEmpty(),"One permanent cannot pay two sacrifice costs; failure occurs before any payment");
   var success=executor.submit(()->BatusForge.cast(0,BatusForge.id(fling),"player:1",null,false,true));choice=waitChoice(null);var bear=costPayer.getCardsIn(ZoneType.Battlefield).stream().filter(c->c.getName().equals("Grizzly Bears")).findFirst().orElseThrow();answer(choice,false,List.of(BatusForge.id(bear)));choice=waitChoice(choice.get("id").toString());check(((List<?>)choice.get("options")).size()==1,"Reserved creature is unavailable for another cost");answer(choice,false,List.of(BatusForge.id(artifact)));success.get(10,TimeUnit.SECONDS);
   check(bear.isInZone(ZoneType.Graveyard)&&artifact.isInZone(ZoneType.Graveyard)&&BatusForge.game.getStack().size()==1&&costPayer.getCardsIn(ZoneType.Battlefield).stream().filter(c->c.isTapped()).count()==2,"Distinct reserved costs commit together with the native mana payment");
   System.out.println("PASS native costs: overlapping sacrifices reject before payment; retry with distinct reserved cards pays mana and commits both costs");
  }finally{executor.shutdownNow();}
 }
}
