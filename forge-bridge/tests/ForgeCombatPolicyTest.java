// GPL-3.0-or-later. Deterministic native fixture; never loaded by the server.
import com.google.gson.JsonObject;
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.game.card.*;
import forge.game.combat.Combat;
import forge.game.zone.ZoneType;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class ForgeCombatPolicyTest {
 static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 static Map<String,Object> waitChoice(String previous)throws Exception{long end=System.currentTimeMillis()+10000;while(BatusForge.choice==null||Objects.equals(BatusForge.choice.get("id"),previous)){if(System.currentTimeMillis()>end)throw new AssertionError("Choice timeout");Thread.sleep(5);}return BatusForge.choice;}
 static void answer(Map<String,Object> choice,List<String> ids){var a=new JsonObject();a.addProperty("choiceId",choice.get("id").toString());a.add("first",BatusForge.JSON.toJsonTree(ids));HumanDecisions.answer((int)choice.get("seat"),a);}
 @SuppressWarnings("unchecked") public static void main(String[] args)throws Exception{
  GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);BatusForge.init(false);
  BatusForge.protocol=new PrintStream(OutputStream.nullOutputStream());BatusForge.requestId="combat-fixture";
  var attacker=BatusForge.player(0);var defender=BatusForge.player(1);
  for(var p:BatusForge.seatedPlayers)for(var c:new CardCollection(p.getCreaturesInPlay()))c.getZone().remove(c);
  var a=BatusForge.add(attacker,"Grizzly Bears",ZoneType.Battlefield);var b=BatusForge.add(attacker,"Silvercoat Lion",ZoneType.Battlefield);
  var bear=BatusForge.add(defender,"Grizzly Bears",ZoneType.Battlefield);var wall=BatusForge.add(defender,"Wall of Glare",ZoneType.Battlefield);
  BatusForge.game.getAction().checkStaticAbilities(false);var combat=new Combat(attacker);combat.addAttacker(a,defender);combat.addAttacker(b,defender);
  String ba=BatusForge.id(bear)+":"+BatusForge.id(a),bb=BatusForge.id(bear)+":"+BatusForge.id(b),wa=BatusForge.id(wall)+":"+BatusForge.id(a),wb=BatusForge.id(wall)+":"+BatusForge.id(b);
  var executor=Executors.newSingleThreadExecutor();
  try{
   var blocks=executor.submit(()->HumanCombat.blockers(defender,combat));var choice=waitChoice(null);
   var options=(List<Map<String,Object>>)choice.get("options");check(options.stream().filter(o->o.get("cardId").equals(BatusForge.id(bear))).allMatch(o->o.get("maxBlocks").equals(1)),"Normal blocker has native capacity one");check(options.stream().filter(o->o.get("cardId").equals(BatusForge.id(wall))).allMatch(o->o.get("maxBlocks").equals(2)),"Wall can block both attackers");
   answer(choice,List.of(ba,bb));choice=waitChoice(choice.get("id").toString());check(!choice.get("error").toString().isBlank(),"Illegal capacity has visible native error");check(combat.getAllBlockers().isEmpty(),"Entire invalid assignment rolls back");
   answer(choice,List.of(ba,wa,wb));blocks.get(10,TimeUnit.SECONDS);check(combat.getBlockers(a).size()==2&&combat.getBlockers(b).size()==1,"Retry supports genuine multiple-block ability");
   System.out.println("PASS native block capacity: normal double-block rejected, no partial assignment, corrected retry allows Wall of Glare multi-block");

   var dread=BatusForge.add(attacker,"Colossal Dreadmaw",ZoneType.Battlefield);var recipients=new CardCollection(List.of(a,b));
   var damage=executor.submit(()->HumanCombat.damage(0,dread,recipients,6,defender,true));choice=waitChoice(null);var metadata=(Map<String,Object>)choice.get("damage");var suggested=(Map<String,Integer>)metadata.get("suggested");
   check(suggested.get(BatusForge.id(a))==2&&suggested.get(BatusForge.id(b))==2&&suggested.get("defender")==2,"Native trample proposal is 2/2/2");
   answer(choice,Collections.nCopies(6,"defender"));choice=waitChoice(choice.get("id").toString());check(!choice.get("error").toString().isBlank(),"Forged illegal trample is rejected natively");check(defender.getLife()==40,"Rejected assignment deals no damage");
   var ids=new ArrayList<String>();for(var e:suggested.entrySet())ids.addAll(Collections.nCopies(e.getValue(),e.getKey()));answer(choice,ids);var result=damage.get(10,TimeUnit.SECONDS);check(result.get(a)==2&&result.get(b)==2&&result.get(null)==2,"Confirmed proposal returns exact native allocation");
   dread.addIntrinsicKeyword("Deathtouch");a.setDamage(1);check(HumanCombat.lethal(dread,a)==1,"Deathtouch uses one remaining lethal damage");a.setDamage(2);check(HumanCombat.lethal(dread,a)==0,"Already lethal marked damage does not demand another point");
   damage=executor.submit(()->HumanCombat.damage(0,dread,recipients,6,defender,true));choice=waitChoice(null);metadata=(Map<String,Object>)choice.get("damage");suggested=(Map<String,Integer>)metadata.get("suggested");check(suggested.get(BatusForge.id(a))==0&&suggested.get(BatusForge.id(b))==1&&suggested.get("defender")==5,"Proposal respects marked damage and deathtouch");ids=new ArrayList<>();for(var e:suggested.entrySet())ids.addAll(Collections.nCopies(e.getValue(),e.getKey()));answer(choice,ids);damage.get(10,TimeUnit.SECONDS);
   System.out.println("PASS native damage: legal trample proposal, invalid forged answer rejected, exact confirmation, marked damage and deathtouch");
  }finally{executor.shutdownNow();}
 }
}
