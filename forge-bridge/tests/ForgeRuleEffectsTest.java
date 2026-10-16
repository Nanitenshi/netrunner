// GPL-3.0-or-later. Native rule regression fixture; never loaded by the server.
import com.google.gson.JsonObject;
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.game.card.*;
import forge.game.zone.ZoneType;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class ForgeRuleEffectsTest {
 static final ExecutorService executor=Executors.newSingleThreadExecutor();
 static String preferred="";static int replacementPrompts=0;
 static void check(boolean ok,String text){if(!ok)throw new AssertionError(text);}
 static void setup(){
  BatusForge.init(false);BatusForge.commanderMode=true;CommanderDecks.kept[0]=CommanderDecks.kept[1]=true;BatusForge.active=0;BatusForge.priority=0;BatusForge.passes=0;BatusForge.ending=false;BatusForge.endWindow=false;BatusForge.combatRunning=false;BatusForge.choice=null;BatusForge.ruleError=null;preferred="";
  BatusForge.protocol=new PrintStream(OutputStream.nullOutputStream());BatusForge.requestId="rules-fixture";
  for(var p:BatusForge.seatedPlayers)for(var c:new CardCollection(p.getCreaturesInPlay()))c.getZone().remove(c);
  for(var n:List.of("Forest","Plains","Swamp","Island","Mountain"))for(int i=0;i<5;i++)BatusForge.add(BatusForge.player(0),n,ZoneType.Battlefield);
  BatusForge.game.getAction().checkStaticAbilities(false);BatusForge.game.copyLastState();
 }
 static Card card(String id){return BatusForge.card(id);}
 static Card add(String name,ZoneType zone){return BatusForge.add(BatusForge.player(0),name,zone);}
 @SuppressWarnings("unchecked") static void run(Runnable work)throws Exception{
  var task=executor.submit(work);String answered="";long until=System.currentTimeMillis()+15000;
  while(!task.isDone()){
   var choice=BatusForge.choice;
   if(choice!=null&&!Objects.equals(answered,choice.get("id"))){
    answered=choice.get("id").toString();var a=new JsonObject();a.addProperty("choiceId",answered);var options=(List<Map<String,Object>>)choice.get("options");String kind=choice.get("kind").toString();
    if(kind.equals("confirm"))a.addProperty("answer",true);
    else {int count=(int)choice.get("min");if(kind.equals("attackers"))count=1;var selected=new ArrayList<String>();if(count>0&&options.stream().anyMatch(o->Objects.equals(o.get("id"),preferred)))selected.add(preferred);for(var option:options)if(selected.size()<count&&!selected.contains(option.get("id").toString()))selected.add(option.get("id").toString());a.add("first",BatusForge.JSON.toJsonTree(selected));}
    if(options.stream().anyMatch(o->Objects.equals(o.get("kind"),"replacement"))){replacementPrompts++;check(!Boolean.TRUE.equals(choice.get("canCancel")),"Mandatory replacement cannot cancel resolution");var invalid=a.deepCopy();invalid.add("first",BatusForge.JSON.toJsonTree(List.of("replacement:999")));boolean rejected=false;try{HumanDecisions.answer((int)choice.get("seat"),invalid);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Forged replacement choice accepted");rejected=false;try{HumanDecisions.answer(1-(int)choice.get("seat"),a);}catch(IllegalArgumentException expected){rejected=true;}check(rejected,"Foreign replacement answer accepted");}
    HumanDecisions.answer((int)choice.get("seat"),a);
   }
   if(System.currentTimeMillis()>until)throw new AssertionError("Native effect timeout: "+BatusForge.choice);Thread.sleep(5);
  }
  try{task.get();}catch(ExecutionException failure){throw new AssertionError("Native operation failed",failure.getCause());}
 }
 static void cast(String name,String target)throws Exception{var c=add(name,ZoneType.Hand);run(()->BatusForge.cast(0,BatusForge.id(c),target,null,false,true));check(!BatusForge.game.getStack().isEmpty(),name+" did not enter stack");}
 static void resolve()throws Exception{run(()->{BatusForge.pass(BatusForge.priority);BatusForge.pass(BatusForge.priority);});}
 static void all()throws Exception{for(int i=0;!BatusForge.game.getStack().isEmpty()&&i<16;i++)resolve();check(BatusForge.game.getStack().isEmpty(),"Unfinished stack");}
 static void spell(String name,String target)throws Exception{cast(name,target);all();}
 static void basicEffects()throws Exception{
  setup();var bear=add("Grizzly Bears",ZoneType.Battlefield);String id=BatusForge.id(bear);bear.setSickness(false);BatusForge.settle();
  spell("Rancor",id);check(card(id).getNetPower()==4&&card(id).hasKeyword("Trample"),"Rancor continuous boost/keyword");
  spell("Battlegrowth",id);check(card(id).getCounters(CounterEnumType.P1P1)==1&&card(id).getNetPower()==5,"Native counter plus aura");check(BatusForge.publicRules(card(id)).get("counters").toString().contains("+1/+1=1")&&!card(id).getAttachedCards().isEmpty(),"Native public counter/attachment state");
  spell("Darksteel Mutation",id);check(card(id).getNetPower()==3&&card(id).getNetToughness()==2&&card(id).hasKeyword("Indestructible")&&!card(id).hasKeyword("Trample"),"Native layers: base, counters, boost and ability removal");
  var mutation=BatusForge.player(0).getCardsIn(ZoneType.Battlefield).stream().filter(c->c.getName().equals("Darksteel Mutation")).findFirst().orElseThrow();spell("Naturalize",BatusForge.id(mutation));check(card(id).getNetPower()==5&&card(id).getNetToughness()==3&&card(id).hasKeyword("Trample"),"Aura leaving restores computed abilities");
  long instance=card(id).getGameTimestamp();String before=BatusForge.publicRules(card(id)).get("instance").toString();spell("Cloudshift",id);check(card(id).isInZone(ZoneType.Battlefield)&&card(id).getGameTimestamp()!=instance&&card(id).getCounters(CounterEnumType.P1P1)==0&&card(id).getNetPower()==2&&card(id).getAttachedCards().isEmpty(),"Blink returns a new object without old counters/auras");check(!BatusForge.publicRules(card(id)).get("instance").equals(before)&&BatusForge.publicRules(card(id)).get("attachments").equals(List.of()),"Projected new instance has no stale attachments");
  check(BatusForge.player(0).getCardsIn(ZoneType.Hand).stream().anyMatch(c->c.getName().equals("Rancor")),"Rancor graveyard trigger after blink");
  System.out.println("PASS native enchantment layers, current abilities, actual counter spell, aura removal, blink new instance/counter reset, attachment cleanup and Rancor return trigger");
 }
 static void reanimate()throws Exception{
  setup();var dead=BatusForge.add(BatusForge.player(1),"Air Elemental",ZoneType.Graveyard);String id=BatusForge.id(dead);spell("Reanimate",id);check(card(id).isInZone(ZoneType.Battlefield)&&card(id).getController()==BatusForge.player(0)&&card(id).getOwner()==BatusForge.player(1)&&BatusForge.player(0).getLife()==35&&card(id).isSick(),"Reanimate returns enemy-owned creature under caster with life loss and sickness");
  spell("Cloudshift",id);check(card(id).getController()==BatusForge.player(0),"Cloudshift explicitly returns under your control");System.out.println("PASS native reanimation: legal graveyard target, ownership/control separation, actual life loss, sickness and card-specific blink controller");
  setup();dead=add("Mulldrifter",ZoneType.Graveyard);id=BatusForge.id(dead);int hand=BatusForge.player(0).getCardsIn(ZoneType.Hand).size();spell("Reanimate",id);check(BatusForge.player(0).getCardsIn(ZoneType.Hand).size()==hand+2&&BatusForge.player(0).getLife()==35,"Reanimated creature's real entry trigger draws two");System.out.println("PASS native reanimation triggers: Mulldrifter enters from graveyard, loses five life and actually draws two");
 }
 static void blinkResponse()throws Exception{
  setup();var bear=add("Grizzly Bears",ZoneType.Battlefield);String id=BatusForge.id(bear);BatusForge.settle();long before=card(id).getGameTimestamp();cast("Doom Blade",id);cast("Cloudshift",id);check(BatusForge.game.getStack().size()==2,"Actual response stack");all();check(card(id).isInZone(ZoneType.Battlefield)&&card(id).getGameTimestamp()!=before,"Old removal target must not track the new blink instance");System.out.println("PASS native blink response: old removal target becomes illegal even though physical card ID is unchanged");
 }
 static void delayedAndLinked()throws Exception{
  setup();var bear=add("Grizzly Bears",ZoneType.Battlefield);String id=BatusForge.id(bear);BatusForge.settle();preferred=id;long instance=card(id).getGameTimestamp();spell("Flickerwisp",null);check(card(id).isInZone(ZoneType.Exile),"Delayed blink must not return immediately");run(()->BatusForge.endTurn(0));all();check(card(id).isInZone(ZoneType.Battlefield)&&card(id).getGameTimestamp()!=instance&&BatusForge.active==0,"Delayed return occurs in actual end-step response window");
  setup();var dead=BatusForge.add(BatusForge.player(1),"Grizzly Bears",ZoneType.Graveyard);id=BatusForge.id(dead);spell("Animate Dead",id);var aura=BatusForge.player(0).getCardsIn(ZoneType.Battlefield).stream().filter(c->c.getName().equals("Animate Dead")).findFirst().orElseThrow();check(card(id).isInZone(ZoneType.Battlefield)&&card(id).getController()==BatusForge.player(0)&&card(id).getNetPower()==1&&aura.getAttachedTo()==card(id),"Linked reanimation attaches aura and applies its penalty");spell("Naturalize",BatusForge.id(aura));check(card(id).isInZone(ZoneType.Graveyard)&&card(id).getOwner()==BatusForge.player(1),"Losing Animate Dead actually sacrifices returned creature to owner's graveyard");
  System.out.println("PASS native delayed/linked effects: Flickerwisp returns in end step; Animate Dead attaches, modifies power and sacrifices its creature when removed");
 }
 static void regeneration()throws Exception{
  setup();var bear=add("Grizzly Bears",ZoneType.Battlefield);String id=BatusForge.id(bear);bear.setSickness(false);BatusForge.settle();preferred=id;BatusForge.combatMode=true;BatusForge.beginCombat(0);resolve();check(BatusForge.game.getCombat().isAttacking(card(id)),"Actual attacker declared");spell("Regenerate",id);check(card(id).getShieldCount()==1,"Native regeneration shield");card(id).setDamage(1);spell("Doom Blade",id);check(card(id).isInZone(ZoneType.Battlefield)&&card(id).isTapped()&&card(id).getDamage()==0&&card(id).getShieldCount()==0&&!BatusForge.game.getCombat().isAttacking(card(id)),"Regeneration consumes shield, heals, taps and removes attacker");
  spell("Regenerate",id);spell("Diabolic Edict","player:0");check(card(id).isInZone(ZoneType.Graveyard),"Regeneration cannot stop sacrifice");
  setup();bear=add("Grizzly Bears",ZoneType.Battlefield);id=BatusForge.id(bear);BatusForge.settle();spell("Regenerate",id);spell("Swords to Plowshares",id);check(card(id).isInZone(ZoneType.Exile),"Regeneration cannot stop exile");
  setup();bear=add("Grizzly Bears",ZoneType.Battlefield);id=BatusForge.id(bear);BatusForge.settle();spell("Regenerate",id);spell("Disfigure",id);check(card(id).isInZone(ZoneType.Graveyard),"Regeneration cannot stop zero toughness");System.out.println("PASS native regeneration: shield consumed on destruction, heal/tap/remove combat; sacrifice, exile and zero toughness bypass shield");
 }
 static void earthbend(boolean exile)throws Exception{
  setup();var land=add("Forest",ZoneType.Hand);String id=BatusForge.id(land);BatusForge.land(0,id);preferred=id;spell("Badgermole",null);var animated=card(id);check(animated.isLand()&&animated.isCreature()&&animated.getCounters(CounterEnumType.P1P1)==2&&animated.hasKeyword("Haste")&&animated.getNetPower()==2,"Earthbend applies land/creature/counters/haste");long instance=animated.getGameTimestamp();spell(exile?"Swords to Plowshares":"Doom Blade",id);var returned=card(id);check(returned.isInZone(ZoneType.Battlefield)&&returned.isTapped()&&returned.isLand()&&!returned.isCreature()&&returned.getCounters().isEmpty()&&returned.getGameTimestamp()!=instance,"Earthbend delayed return as fresh tapped land");check(BatusForge.player(0).getLandsPlayedThisTurn()==1,"Effect return never consumes another land play");System.out.println("PASS native earthbend: newly played land gets haste, counters and creature type; "+(exile?"exile":"death")+" return trigger creates fresh tapped land without another land play");
 }
 static void replacements()throws Exception{
  setup();spell("Rest in Peace",null);BatusForge.add(BatusForge.player(1),"Leyline of the Void",ZoneType.Battlefield);var bear=add("Grizzly Bears",ZoneType.Battlefield);BatusForge.settle();int before=replacementPrompts;spell("Doom Blade",BatusForge.id(bear));check(replacementPrompts>before&&card(BatusForge.id(bear)).isInZone(ZoneType.Exile),"Affected human chooses competing replacement effects");System.out.println("PASS native competing replacements: affected human selects, forged/foreign answers rejected, mandatory resolution cannot cancel, actual exile");
 }
 static void fault()throws Exception{
  setup();var host=add("Grizzly Bears",ZoneType.Battlefield);var failing=new forge.game.spellability.SpellAbility.EmptySa(host){@Override public void resolve(){BatusForge.player(0).setLife(37,this);throw new IllegalStateException("Injected fixture fault");}};BatusForge.game.getStack().add(failing);BatusForge.pass(0);boolean failed=false;try{BatusForge.pass(1);}catch(IllegalStateException expected){failed=true;}check(failed&&BatusForge.ruleError!=null&&BatusForge.state().containsKey("ruleError"),"Failed irreversible resolution must publish frozen rule state");var request=new JsonObject();request.addProperty("seat",0);var action=new JsonObject();action.addProperty("type","pass");request.add("action",action);boolean rejected=false;try{BatusForge.action(request);}catch(IllegalArgumentException expected){rejected=true;}check(rejected&&BatusForge.player(0).getLife()==37,"No fake rollback or continuation after partial resolution");System.out.println("PASS native fault containment: partial effect stops play, state exposes fault, later action rejected without pretending to undo resolved changes");
 }
 public static void main(String[] args)throws Exception{GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);try{basicEffects();reanimate();blinkResponse();delayedAndLinked();regeneration();earthbend(false);earthbend(true);replacements();fault();}finally{executor.shutdownNow();}}
}
