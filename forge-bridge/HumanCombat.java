// GPL-3.0-or-later. See LICENSE. Combat decisions for the pinned Forge adapter.
import forge.game.*;
import forge.game.card.*;
import forge.game.player.*;
import forge.game.combat.*;
import java.util.*;

final class HumanCombat {
 static void attackers(Player player,Combat combat){
  if(!BatusForge.combatRunning)return;
  var defender=BatusForge.player(1-BatusForge.seat(player));
  var candidates=new CardCollection();for(var c:player.getCreaturesInPlay())if(CombatUtil.canAttack(c,defender))candidates.add(c);
  var options=HumanDecisions.cardOptions(candidates);
  while(true){
   var a=HumanDecisions.ask(BatusForge.seat(player),"attackers","Angreifer wählen","",0,candidates.size(),false,options);
   for(var old:new CardCollection(combat.getAttackers()))combat.removeFromCombat(old);
   for(var c:HumanDecisions.collect(candidates,HumanDecisions.ids(a,"first")))combat.addAttacker(c,defender);
   if(CombatUtil.validateAttackers(combat))return;
   for(var old:new CardCollection(combat.getAttackers()))combat.removeFromCombat(old);
   BatusForge.log.add("Angriff erfüllt die Angriffsvorgaben nicht · Auswahl korrigieren");
  }
 }
 static void blockers(Player player,Combat combat){
  var options=new ArrayList<Map<String,Object>>();var pairs=new HashMap<String,Card[]>();
  for(var attacker:combat.getAttackers())if(combat.getDefenderPlayerByAttacker(attacker)==player)
   for(var blocker:player.getCreaturesInPlay())if(CombatUtil.canBlock(attacker,blocker,combat)){
    var key=BatusForge.id(blocker)+":"+BatusForge.id(attacker);pairs.put(key,new Card[]{attacker,blocker});
    options.add(Map.of("id",key,"name",blocker.getName()+" → "+attacker.getName(),"kind","block","cardId",BatusForge.id(blocker),"targetId",BatusForge.id(attacker)));
   }
  while(true){
   var a=HumanDecisions.ask(BatusForge.seat(player),"blockers","Blocker zuweisen","",0,options.size(),false,options);
   for(var key:HumanDecisions.ids(a,"first")){var pair=pairs.get(key);combat.addBlocker(pair[0],pair[1]);}
   String invalid=CombatUtil.validateBlocks(combat,player);if(invalid==null)return;
   for(var c:player.getCreaturesInPlay())if(combat.isBlocking(c))combat.removeFromCombat(c);
   BatusForge.log.add("Blocken ist so nicht legal · Zuordnung korrigieren");
  }
 }
 static Map<Card,Integer> damage(int who,Card source,CardCollectionView recipients,int amount,GameEntity defender,boolean overrideOrder){
  boolean trample=defender!=null&&source.hasKeyword("Trample");
  var result=new LinkedHashMap<Card,Integer>();
  if(recipients.size()==1&&!trample){result.put(recipients.get(0),amount);return result;}
  BatusForge.require(amount<=128,"Schadenszuordnung über 128 liegt außerhalb des Testumfangs");
  var options=HumanDecisions.cardOptions(recipients);
  if(trample)options.add(Map.of("id","defender","name",defender.getName(),"kind","player"));
  while(true){
   var a=HumanDecisions.ask(who,"damage","Schaden verteilen",source.getName(),amount,amount,true,options);
   result.clear();for(var key:HumanDecisions.ids(a,"first")){Card recipient=key.equals("defender")?null:BatusForge.card(key);result.merge(recipient,1,Integer::sum);}
   boolean valid=true,earlierLethal=true;int defenderDamage=result.getOrDefault(null,0);
   for(var c:recipients){int dealt=result.getOrDefault(c,0),lethal=source.hasKeyword("Deathtouch")?Math.min(1,Math.max(0,c.getLethalDamage())):Math.max(0,c.getLethalDamage());if(!overrideOrder&&dealt>0&&!earlierLethal)valid=false;if(dealt<lethal){earlierLethal=false;if(defenderDamage>0)valid=false;}}
   if(valid)return new LinkedHashMap<>(result);
   BatusForge.log.add("Trampelschaden erst nach tödlicher Zuweisung an die Blocker · Verteilung korrigieren");
  }
 }
}
