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
  var options=HumanDecisions.cardOptions(candidates);String error="";
  while(true){
   var a=HumanDecisions.ask(BatusForge.seat(player),"attackers","Angreifer wählen","",0,candidates.size(),false,options,null,Map.of("error",error));
   for(var old:new CardCollection(combat.getAttackers()))combat.removeFromCombat(old);
   for(var c:HumanDecisions.collect(candidates,HumanDecisions.ids(a,"first")))combat.addAttacker(c,defender);
   if(CombatUtil.validateAttackers(combat)){BatusForge.log.add("Angriff bestätigt · "+combat.getAttackers().size()+" Angreifer");return;}
   for(var old:new CardCollection(combat.getAttackers()))combat.removeFromCombat(old);
   error="Diese Auswahl erfüllt die Angriffsvorgaben nicht. Bitte korrigiere die Angreifer.";
  }
 }
 static void blockers(Player player,Combat combat){
  var options=new ArrayList<Map<String,Object>>();var pairs=new HashMap<String,Card[]>();
  for(var attacker:combat.getAttackers())if(combat.getDefenderPlayerByAttacker(attacker)==player)
   for(var blocker:player.getCreaturesInPlay())if(CombatUtil.canBlock(attacker,blocker,combat)){
    var key=BatusForge.id(blocker)+":"+BatusForge.id(attacker);pairs.put(key,new Card[]{attacker,blocker});
    options.add(Map.of("id",key,"name",blocker.getName()+" → "+attacker.getName(),"kind","block","cardId",BatusForge.id(blocker),"targetId",BatusForge.id(attacker),"maxBlocks",blocker.canBlockAny()?combat.getAttackers().size():1+blocker.canBlockAdditional()));
   }
  String error="";
  while(true){
   var a=HumanDecisions.ask(BatusForge.seat(player),"blockers","Blocker zuweisen","",0,options.size(),false,options,null,Map.of("error",error));
   String invalid=null;
   for(var key:HumanDecisions.ids(a,"first")){
    var pair=pairs.get(key);
    // Group validation alone does not enforce a blocker's capacity. Check each
    // pair again against the native assignments already made in this attempt.
    if(!CombatUtil.canBlock(pair[0],pair[1],combat)){invalid="Ein Blocker kann diese Zuordnungen nicht gleichzeitig übernehmen.";break;}
    combat.addBlocker(pair[0],pair[1]);
   }
   if(invalid==null)invalid=CombatUtil.validateBlocks(combat,player);
   if(invalid==null){BatusForge.log.add("Blocken bestätigt · "+HumanDecisions.ids(a,"first").size()+" Zuordnungen");return;}
   for(var c:player.getCreaturesInPlay())if(combat.isBlocking(c))combat.removeFromCombat(c);
   error="Blocken ist so nicht legal: "+invalid;
  }
 }
 static int lethal(Card source,Card recipient){int n=Math.max(0,recipient.getLethalDamage());return source.hasKeyword("Deathtouch")?Math.min(1,n):n;}
 static boolean validDamage(Map<Card,Integer> result,Card source,CardCollectionView recipients,boolean overrideOrder){
  boolean earlierLethal=true;int defenderDamage=result.getOrDefault(null,0);
  for(var c:recipients){int dealt=result.getOrDefault(c,0),needed=lethal(source,c);if(!overrideOrder&&dealt>0&&!earlierLethal)return false;if(dealt<needed){earlierLethal=false;if(defenderDamage>0)return false;}}
  return true;
 }
 static Map<Card,Integer> damage(int who,Card source,CardCollectionView recipients,int amount,GameEntity defender,boolean overrideOrder){
  boolean trample=defender!=null&&source.hasKeyword("Trample");
  var result=new LinkedHashMap<Card,Integer>();
  if(amount==0)return result;
  if(recipients.size()==1&&!trample){result.put(recipients.get(0),amount);return result;}
  BatusForge.require(amount<=128,"Schadenszuordnung über 128 liegt außerhalb des Testumfangs");
  var options=HumanDecisions.cardOptions(recipients);
  if(trample)options.add(Map.of("id","defender","name",defender.getName(),"kind","player"));
  var needed=new LinkedHashMap<String,Integer>();var suggested=new LinkedHashMap<String,Integer>();int remaining=amount;
  for(var c:recipients){int n=lethal(source,c);needed.put(BatusForge.id(c),n);int assigned=Math.min(remaining,n);suggested.put(BatusForge.id(c),assigned);remaining-=assigned;}
  if(remaining>0){String last=trample?"defender":BatusForge.id(recipients.get(recipients.size()-1));suggested.merge(last,remaining,Integer::sum);}
  String error="";
  while(true){
   var a=HumanDecisions.ask(who,"damage","Schaden verteilen",source.getName(),amount,amount,true,options,null,Map.of("error",error,"damage",Map.of("trample",trample,"ordered",!overrideOrder,"lethal",needed,"suggested",suggested)));
   result.clear();for(var key:HumanDecisions.ids(a,"first")){Card recipient=key.equals("defender")?null:BatusForge.card(key);result.merge(recipient,1,Integer::sum);}
   if(validDamage(result,source,recipients,overrideOrder)){BatusForge.log.add("Schaden zugewiesen · "+source.getName()+" · "+amount);return new LinkedHashMap<>(result);}
   error=trample?"Trampelschaden erst nach tödlicher Zuweisung an alle Blocker. Bitte korrigiere die Verteilung.":"Die Schadensreihenfolge erfordert zuerst tödlichen Schaden auf die vorherigen Kreaturen.";
  }
 }
}
