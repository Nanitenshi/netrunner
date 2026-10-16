// GPL-3.0-or-later. Native regression fixture, never loaded by the server.
import com.google.gson.JsonObject;
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.game.card.*;
import forge.game.zone.ZoneType;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Consumer;

public class ForgeEffectPaymentTest {
 static final ExecutorService executor=Executors.newSingleThreadExecutor();
 static Consumer<Map<String,Object>> respond;
 static int payments,confirms,costs;
 static boolean pay=true,cancelCost=false,checkInvalid=false;
 static Card discard;
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static void setup(){
  BatusForge.init(false);BatusForge.commanderMode=true;CommanderDecks.kept[0]=CommanderDecks.kept[1]=true;BatusForge.active=0;BatusForge.priority=0;BatusForge.passes=0;BatusForge.ending=false;BatusForge.endWindow=false;BatusForge.combatRunning=false;BatusForge.choice=null;BatusForge.ruleError=null;
  BatusForge.protocol=new PrintStream(OutputStream.nullOutputStream());BatusForge.requestId="effect-payments";payments=confirms=costs=0;pay=true;cancelCost=false;checkInvalid=false;discard=null;respond=ForgeEffectPaymentTest::answer;
  for(var p:BatusForge.seatedPlayers){for(var c:new CardCollection(p.getCreaturesInPlay()))c.getZone().remove(c);for(var n:List.of("Plains","Island","Mountain"))for(int i=0;i<3;i++)BatusForge.add(p,n,ZoneType.Battlefield);}
  BatusForge.game.getAction().checkStaticAbilities(false);BatusForge.game.copyLastState();
 }
 static JsonObject reply(Map<String,Object> choice){var a=new JsonObject();a.addProperty("choiceId",choice.get("id").toString());return a;}
 @SuppressWarnings("unchecked") static void answer(Map<String,Object> choice){
  String kind=choice.get("kind").toString();var a=reply(choice);
  boolean effect=Objects.equals(choice.get("purpose"),"effect-payment");
  if(effect){
   var meta=(Map<String,Object>)choice.get("effectPayment");check(meta!=null&&meta.containsKey("cost"),"Missing native effect cost");check(!Boolean.TRUE.equals(choice.get("canCancel")),"Resolution must not inherit cast cancellation");
   if(checkInvalid){checkInvalid=false;var foreign=reply(choice);foreign.addProperty("answer",false);boolean rejected=false;try{HumanDecisions.answer(1-(int)choice.get("seat"),foreign);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Foreign payment accepted");foreign.addProperty("choiceId","stale");rejected=false;try{HumanDecisions.answer((int)choice.get("seat"),foreign);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Stale payment accepted");var bad=reply(choice);bad.add("first",BatusForge.JSON.toJsonTree(List.of("forged-source")));rejected=false;try{HumanDecisions.answer((int)choice.get("seat"),bad);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Forged source accepted");}
   if(kind.equals("payment")){payments++;var payment=(Map<String,Object>)choice.get("payment");check(Objects.equals(payment.get("action"),"effect")&&Objects.equals(payment.get("commanderTax"),0),"Effect must not be labelled as a new cast or taxed");if(!Boolean.TRUE.equals(meta.get("canPay"))){var bad=reply(choice);bad.add("first",BatusForge.JSON.toJsonTree(List.of()));boolean rejected=false;try{HumanDecisions.answer((int)choice.get("seat"),bad);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Unaffordable effect payment accepted");a.addProperty("answer",false);}else if(!pay)a.addProperty("answer",false);else a.add("first",BatusForge.JSON.toJsonTree(payment.get("selectedIds")));}
   else if(kind.equals("confirm")){confirms++;a.addProperty("answer",pay&&Boolean.TRUE.equals(meta.get("canPay")));}
   else if(kind.equals("cost")){costs++;if(cancelCost)a.addProperty("answer",false);else {var options=(List<Map<String,Object>>)choice.get("options");var id=discard==null?options.get(0).get("id").toString():BatusForge.id(discard);a.add("first",BatusForge.JSON.toJsonTree(List.of(id)));}}
   else throw new AssertionError("Unexpected effect choice "+choice);
  }else if(kind.equals("confirm"))a.addProperty("answer",true);
  else {var options=(List<Map<String,Object>>)choice.get("options");int count=(int)choice.get("min");a.add("first",BatusForge.JSON.toJsonTree(options.stream().limit(count).map(o->o.get("id").toString()).toList()));}
  HumanDecisions.answer((int)choice.get("seat"),a);
 }
 static void run(Runnable work)throws Exception{var task=executor.submit(work);String answered="";long limit=System.currentTimeMillis()+12000;while(!task.isDone()){var choice=BatusForge.choice;if(choice!=null&&!Objects.equals(answered,choice.get("id"))){answered=choice.get("id").toString();respond.accept(choice);}if(System.currentTimeMillis()>limit)throw new AssertionError("Effect payment timeout: "+BatusForge.choice);Thread.sleep(5);}try{task.get();}catch(ExecutionException e){throw new AssertionError("Native action failed",e.getCause());}}
 static Card cast(int seat,String name,String target)throws Exception{var card=BatusForge.add(BatusForge.player(seat),name,ZoneType.Hand);run(()->BatusForge.cast(seat,BatusForge.id(card),target,null,false,true));check(card.isInZone(ZoneType.Stack),name+" was not actually cast");return card;}
 static void resolve()throws Exception{run(()->{BatusForge.pass(BatusForge.priority);BatusForge.pass(BatusForge.priority);});}
 static void all()throws Exception{for(int i=0;!BatusForge.game.getStack().isEmpty()&&i<20;i++)resolve();check(BatusForge.game.getStack().isEmpty()&&BatusForge.ruleError==null,"Unfinished or failed native stack");}
 static long tapped(int seat){return BatusForge.player(seat).getCardsIn(ZoneType.Battlefield).stream().filter(Card::isTapped).count();}
 static void leak(boolean paid,boolean insufficient)throws Exception{
  setup();pay=paid;checkInvalid=true;var opponent=BatusForge.player(1);if(insufficient){for(var c:new CardCollection(opponent.getCardsIn(ZoneType.Battlefield)))c.getZone().remove(c);BatusForge.add(opponent,"Mountain",ZoneType.Battlefield);}
  BatusForge.priority=1;var bolt=cast(1,"Lightning Bolt","player:0");BatusForge.priority=0;var target=BatusForge.game.getStack().peekAbility();String targetId="stack:"+BatusForge.game.getStack().iterator().next().getId();cast(0,"Mana Leak",targetId);long before=tapped(1);resolve();check(payments==1,"Mana Leak must ask the actual payer once");check(tapped(1)==before+(paid&&!insufficient?3:0),"Only confirmed tax taps three sources");check(BatusForge.card(BatusForge.id(bolt)).isInZone(paid&&!insufficient?ZoneType.Stack:ZoneType.Graveyard),"Native counter result disagrees with payment");all();check(BatusForge.player(0).getLife()==(paid&&!insufficient?37:40),"Bolt only resolves after the tax is paid");check(target!=null,"Real target ability");
  System.out.println("PASS native Mana Leak: "+(insufficient?"unaffordable tax rejected":paid?"pay three, original spell resolves":"decline, original spell countered")+", foreign/stale/forged choices rejected");
 }
 static void study(boolean paid)throws Exception{
  setup();pay=paid;BatusForge.add(BatusForge.player(0),"Rhystic Study",ZoneType.Battlefield);BatusForge.settle();int hand=BatusForge.player(0).getCardsIn(ZoneType.Hand).size();BatusForge.priority=1;cast(1,"Lightning Bolt","player:0");long before=tapped(1);all();check(payments==1,"Rhystic Study must ask opponent to pay");check(tapped(1)==before+(paid?1:0),"Study actual mana payment");check(BatusForge.player(0).getCardsIn(ZoneType.Hand).size()==hand+(paid?0:1),"Study actual draw follows payer decision");check(BatusForge.player(0).getLife()==37,"Study never counters the original spell");System.out.println("PASS native Rhystic Study: "+(paid?"payer spends one, no draw":"payer declines, controller draws")+", original spell resolves");
 }
 static void tithe(boolean paid)throws Exception{
  setup();pay=paid;BatusForge.add(BatusForge.player(0),"Smothering Tithe",ZoneType.Battlefield);BatusForge.settle();BatusForge.priority=1;cast(1,"Think Twice",null);long before=tapped(1);all();check(payments==1,"Tithe must ask the drawing opponent");check(tapped(1)==before+(paid?2:0),"Tithe actual two-mana payment");long treasures=BatusForge.player(0).getCardsIn(ZoneType.Battlefield).stream().filter(c->c.isToken()&&c.getType().hasSubtype("Treasure")).count();check(treasures==(paid?0:1),"Native Treasure result: "+BatusForge.player(0).getCardsIn(ZoneType.Battlefield).stream().map(c->c.getName()+" token="+c.isToken()).toList());System.out.println("PASS native Smothering Tithe: "+(paid?"pay two prevents Treasure":"decline creates actual Treasure"));
 }
 static void ward(String name,boolean paid,boolean cancelled,boolean insufficient)throws Exception{
  setup();pay=paid;cancelCost=cancelled;discard=BatusForge.add(BatusForge.player(0),"Forest",ZoneType.Hand);var warded=BatusForge.add(BatusForge.player(1),name,ZoneType.Battlefield);BatusForge.settle();if(insufficient)BatusForge.player(0).setLife(2,null);var swords=cast(0,"Swords to Plowshares",BatusForge.id(warded));long before=tapped(0);all();boolean success=paid&&!cancelled&&!insufficient;check(BatusForge.card(BatusForge.id(swords)).isInZone(ZoneType.Graveyard),"Original Swords cost is never undone");check(BatusForge.card(BatusForge.id(warded)).isInZone(success?ZoneType.Exile:ZoneType.Battlefield),"Native ward counter/resolve result");check(tapped(0)==before,"Non-mana ward cannot charge the original spell again");if(name.equals("Sedgemoor Witch")){check(confirms==1,"Life ward must be human");check(BatusForge.player(0).getLife()==(insufficient?2:success?37:40),"Exact ward life payment");}else{check(confirms==1&&costs==(paid?1:0),"Discard ward needs confirmation then a card");check(BatusForge.card(BatusForge.id(discard)).isInZone(success?ZoneType.Graveyard:ZoneType.Hand),"Chosen discard is only spent on confirmation");}
  System.out.println("PASS native "+name+": "+(insufficient?"cannot pay life but casting is legal":cancelled?"decline during card choice counters without discarding":paid?"chosen cost paid, original spell resolves":"decline counters original spell")+", cast mana remains spent");
 }
 static void manaWard(boolean paid)throws Exception{
  setup();pay=paid;var warded=BatusForge.add(BatusForge.player(1),"Tolarian Terror",ZoneType.Battlefield);BatusForge.settle();cast(0,"Swords to Plowshares",BatusForge.id(warded));long before=tapped(0);all();check(payments==1&&tapped(0)==before+(paid?2:0),"Ward two is paid separately from the original spell");check(BatusForge.card(BatusForge.id(warded)).isInZone(paid?ZoneType.Exile:ZoneType.Battlefield),"Native mana ward result");System.out.println("PASS native mana Ward: "+(paid?"two extra sources paid":"decline keeps original cast paid and counters it"));
 }
 static void effectSources(boolean floating)throws Exception{
  setup();var payer=BatusForge.player(1);for(var c:new CardCollection(payer.getCardsIn(ZoneType.Battlefield)))c.getZone().remove(c);
  for(var name:floating?List.of("Mountain","Sol Ring","Forest"):List.of("Mountain","Island","Ferrous Lake","Forest"))BatusForge.add(payer,name,ZoneType.Battlefield);
  BatusForge.add(BatusForge.player(0),floating?"Smothering Tithe":"Rhystic Study",ZoneType.Battlefield);BatusForge.settle();BatusForge.priority=1;
  if(floating){var ring=payer.getCardsIn(ZoneType.Battlefield).stream().filter(c->c.getName().equals("Sol Ring")).findFirst().orElseThrow();var mana=ring.getManaAbilities().get(0);mana.setActivatingPlayer(payer);check(HumanCosts.play(mana,payer),"Generate real floating mana");}
  if(floating){long initial=tapped(1);run(()->{payer.drawCard();BatusForge.settle();});all();check(payments==1&&tapped(1)==initial&&HumanMana.pool(payer).isEmpty(),"Effect payment consumes floating mana before any new tap");}
  else {var bolt=cast(1,"Lightning Bolt","player:0");resolve();BatusForge.priority=0;cast(0,"Mana Leak","stack:"+BatusForge.game.getStack().iterator().next().getId());all();check(payments==2&&tapped(1)==2&&HumanMana.pool(payer).isEmpty()&&BatusForge.card(BatusForge.id(bolt)).isInZone(ZoneType.Graveyard)&&BatusForge.player(0).getLife()==40,"Study and Leak consume successive sources, decline second unaffordable payment");}
  System.out.println("PASS native effect mana: "+(floating?"existing floating pool used without tapping another source":"successive Study/Leak payments re-evaluate remaining sources"));
 }
 static void sentinel()throws Exception{
  setup();var sentinel=BatusForge.add(BatusForge.player(0),"Esper Sentinel",ZoneType.Battlefield);sentinel.setCounters(CounterEnumType.P1P1,2);BatusForge.settle();int hand=BatusForge.player(0).getCardsIn(ZoneType.Hand).size();BatusForge.priority=1;cast(1,"Lightning Bolt","player:0");long before=tapped(1);all();check(payments==1&&tapped(1)==before+3&&BatusForge.player(0).getCardsIn(ZoneType.Hand).size()==hand,"Dynamic Sentinel tax uses native current power, not printed one");System.out.println("PASS native Esper Sentinel: dynamic payment uses current power three");
 }
 static void sacrificeWard()throws Exception{
  setup();discard=BatusForge.add(BatusForge.player(0),"The One Ring",ZoneType.Battlefield);var sauron=BatusForge.add(BatusForge.player(1),"Sauron, the Dark Lord",ZoneType.Battlefield);BatusForge.settle();cast(0,"Swords to Plowshares",BatusForge.id(sauron));all();check(confirms==1&&costs==1&&BatusForge.card(BatusForge.id(discard)).isInZone(ZoneType.Graveyard)&&BatusForge.card(BatusForge.id(sauron)).isInZone(ZoneType.Exile),"Ward sacrifices the chosen valid artifact then allows the original spell");System.out.println("PASS native Sauron Ward: human chooses an actual artifact to sacrifice");
 }
 static void unsupported(){check(!HumanCosts.effectSupported(new forge.game.cost.Cost("Discard<1/Random>",true)),"Random discard must not become a human choice");check(!HumanCosts.effectSupported(new forge.game.cost.Cost("1 Discard<1/Card>",true)),"Mixed effect payment remains outside this reviewed path");var sa=BatusForge.spell(BatusForge.add(BatusForge.player(0),"Lightning Bolt",ZoneType.Hand),BatusForge.player(0));boolean rejected=false;try{BatusForge.player(0).getController().payCostToPreventEffect(new forge.game.cost.Cost("1 Discard<1/Card>",true),sa,false,BatusForge.game.getPlayers());}catch(IllegalStateException expected){rejected=true;}check(rejected&&BatusForge.ruleError!=null,"Unsupported effect must freeze even outside stack resolution");System.out.println("PASS native effect cost boundaries: random discard and mixed special payments never use an AI decision fallback");}
 public static void main(String[] args)throws Exception{GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);try{leak(true,false);leak(false,false);leak(true,true);study(true);study(false);tithe(true);tithe(false);manaWard(true);manaWard(false);effectSources(true);effectSources(false);sentinel();sacrificeWard();unsupported();ward("Sedgemoor Witch",true,false,false);ward("Sedgemoor Witch",false,false,false);ward("Sedgemoor Witch",true,false,true);ward("Graveyard Trespasser",true,false,false);ward("Graveyard Trespasser",true,true,false);}finally{executor.shutdownNow();}}
}
