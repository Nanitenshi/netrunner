// GPL-3.0-or-later. Native Forge opponents on the same serialized game executor.
import com.google.gson.JsonObject;
import forge.ai.*;
import forge.game.card.*;
import forge.game.phase.PhaseType;
import forge.game.zone.ZoneType;
import java.util.*;

final class ForgeAi {
 static final boolean[] seats={false,false};static String difficulty="normal";
 static int countedTurn=-1,actions=0;
 static LobbyPlayerAi lobby(JsonObject spec,int seat){
  BatusForge.require(seat==1,"Der erste Platz muss ein Mensch sein");
  difficulty=spec.getAsJsonObject("ai").get("difficulty").getAsString();
  BatusForge.require(List.of("easy","normal","hard").contains(difficulty),"Unbekannte KI-Stufe");seats[seat]=true;
  var lobby=new LobbyPlayerAi("Forge-KI",null);lobby.setAiProfile("Default");return lobby;
 }
 static void opening(){if(!seats[1])return;var p=BatusForge.player(1);
  for(int n=0;n<3;n++){long lands=p.getCardsIn(ZoneType.Hand).stream().filter(Card::isLand).count();if(lands>=2&&lands<=5)break;CommanderDecks.mulligan(1);}
  CommanderDecks.kept[1]=true;BatusForge.log.add("Forge-KI hat ihre Starthand gewählt");
 }
 static boolean ai(int seat){return seat>=0&&seat<seats.length&&seats[seat];}
 static int limit(){return difficulty.equals("easy")?1:difficulty.equals("normal")?3:Integer.MAX_VALUE;}
 static void advance(){
  if(!seats[1]||CommanderDecks.opening())return;
  for(int step=0;step<64&&!BatusForge.game.isGameOver()&&BatusForge.choice==null&&ai(BatusForge.priority);step++){
   int who=BatusForge.priority;var p=BatusForge.player(who);var game=BatusForge.game;var phase=game.getPhaseHandler().getPhase();
   if(countedTurn!=BatusForge.turn){countedTurn=BatusForge.turn;actions=0;}
   boolean own=BatusForge.active==who;
   var controller=p.getController();
   // Easy deliberately gives the human more breathing room. Mandatory effects,
   // legal blocking, damage and costs still use the native controller.
   List<forge.game.spellability.SpellAbility> chosen=difficulty.equals("easy")&&!own?null:controller.chooseSpellAbilityToPlay();
   if(chosen!=null){chosen=new ArrayList<>(chosen);if(own&&actions>=limit())chosen.removeIf(sa->!sa.isLandAbility()&&!sa.isManaAbility());}
   if(chosen!=null&&!chosen.isEmpty()){
    boolean attempted=false;
    for(var sa:chosen){
     sa.setActivatingPlayer(p);if(!sa.canPlay())continue;
     var host=sa.getHostCard();var origin=host.getZone();var changes=new CardZoneTable(game.getLastStateBattlefield(),game.getLastStateGraveyard());
     attempted=true;controller.playChosenSpellAbility(sa);var current=game.getCardState(host).getZone();
     boolean moved=current!=null&&origin!=null&&!current.equals(origin);
     if(sa.isSpell()&&!moved){BatusForge.pass(who);break;} // Never publish the name of an uncast private hand card.
     if(moved&&(sa.isSpell()||sa.isLandAbility())){changes.put(origin.getZoneType(),current.getZoneType(),game.getCardState(host));changes.triggerChangesZoneAll(game,sa);}
     if(!sa.isLandAbility()&&!sa.isManaAbility()&&own)actions++;
     BatusForge.log.add("Forge-KI "+(sa.isLandAbility()?"spielt ":sa.isSpell()?"wirkt ":"aktiviert ")+host.getName());
     game.copyLastState();BatusForge.passes=0;BatusForge.settle();BatusForge.priority=who;
     game.getPhaseHandler().setPriority(p);
     // Every stack action exposes a human response window. Lands and mana
     // abilities retain priority, matching the adapter's human behavior.
     if(!sa.isLandAbility()&&!sa.isManaAbility()){BatusForge.priority=1-who;game.getPhaseHandler().setPriority(BatusForge.player(1-who));return;}
    }
    if(!attempted)BatusForge.pass(who);continue;
   }
   if(own&&game.getStack().isEmpty()&&!BatusForge.ending&&!BatusForge.combatRunning){
    if(phase==PhaseType.MAIN1){BatusForge.beginCombat(who);continue;}
    if(phase==PhaseType.MAIN2){BatusForge.endTurn(who);continue;}
   }
   BatusForge.pass(who);
  }
  if(!BatusForge.game.isGameOver()&&BatusForge.choice==null&&ai(BatusForge.priority))throw new IllegalStateException("KI-Aktionsgrenze erreicht. Partie verlassen und neu starten.");
 }
}
