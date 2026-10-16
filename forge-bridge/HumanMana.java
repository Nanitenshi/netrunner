// GPL-3.0-or-later. Native automatic payment with optional human override.
import forge.ai.ComputerUtilMana;
import forge.card.mana.ManaCost;
import forge.game.cost.*;
import forge.game.player.Player;
import forge.game.spellability.SpellAbility;
import forge.game.zone.ZoneType;
import java.util.*;

final class HumanMana {
 record Approval(int cardId,List<FilterMana.Option> plan,Set<String> allowed,String cost){}
 private static Approval current;
 static boolean managed(SpellAbility sa){return !sa.isManaAbility()&&sa.getPayCosts().getCostParts().stream().allMatch(part->part instanceof CostPartMana||!sa.isSpell()&&part instanceof CostTap);}
 static boolean approved(SpellAbility sa){return current!=null&&current.plan()!=null&&current.cardId()==sa.getHostCard().getId();}
 static String cost(SpellAbility sa,Player payer){return ComputerUtilMana.calculateManaCost(sa.getPayCosts(),sa,payer,true,0,false).toString();}
 static Map<String,Integer> pool(Player payer){var result=new LinkedHashMap<String,Integer>();for(var mana:payer.getManaPool()){int mask=mana.getColor(),index=mask==0||mask==32?5:Integer.numberOfTrailingZeros(mask);if(index<6)result.merge(FilterMana.COLORS.substring(index,index+1),1,Integer::sum);}return result;}
 static Approval automatic(SpellAbility sa,Player payer){var plan=FilterMana.selectedPlan(sa,payer,null,null);return new Approval(sa.getHostCard().getId(),plan,plan==null?null:new LinkedHashSet<>(ids(plan)),cost(sa,payer));}
 static List<String> ids(List<FilterMana.Option> plan){return plan.stream().map(o->BatusForge.id(o.ability().getHostCard())).toList();}
 static String signature(List<FilterMana.Option> plan){return plan.stream().map(o->BatusForge.id(o.ability().getHostCard())+":"+o.cost()+":"+Arrays.toString(o.produces())+":"+o.choice()).reduce("",(a,b)->a+"|"+b);}
 static List<Map<String,Object>> steps(List<FilterMana.Option> plan){return plan.stream().map(o->{var d=new LinkedHashMap<String,Object>();d.put("sourceId",BatusForge.id(o.ability().getHostCard()));d.put("name",o.ability().getHostCard().getName());d.put("cost",o.cost());var produces=new LinkedHashMap<String,Integer>();for(int i=0;i<6;i++)if(o.produces()[i]>0)produces.put(FilterMana.COLORS.substring(i,i+1),o.produces()[i]);d.put("produces",produces);return (Map<String,Object>)d;}).toList();}
 static Approval review(SpellAbility sa,Player payer){
  var plan=FilterMana.selectedPlan(sa,payer,null,null);boolean selectable=plan!=null;
  var options=new ArrayList<Map<String,Object>>();
  if(selectable)for(var card:payer.getCardsIn(ZoneType.Battlefield))if(!(sa.getPayCosts().hasTapCost()&&card==sa.getHostCard())&&!card.isTapped()&&!card.isCreature()&&card.getManaAbilities().stream().anyMatch(a->a.getPayCosts()!=null&&a.getPayCosts().hasTapCost()))options.add(BatusForge.target(card));
  List<String> selected=selectable?ids(plan):List.of();String message="";boolean valid=true;
  while(true){
   var meta=new LinkedHashMap<String,Object>();meta.put("action",sa.isSpell()?"cast":"activate");meta.put("tapSource",sa.getPayCosts().hasTapCost());meta.put("cost",cost(sa,payer));meta.put("commanderTax",sa.isSpell()&&sa.getHostCard().isCommander()&&sa.getHostCard().isInZone(ZoneType.Command)?2*payer.getCommanderCast(sa.getHostCard()):0);meta.put("selectable",selectable);meta.put("selectedIds",selected);meta.put("valid",valid);meta.put("steps",selectable&&valid?steps(plan):List.of());meta.put("pool",pool(payer));meta.put("error",message);
   var answer=HumanDecisions.ask(BatusForge.seat(payer),"payment","Mana-Zahlung prüfen",sa.getHostCard().getName(),0,Math.min(64,options.size()),false,options,null,Map.of("payment",meta));
   if(answer.has("answer"))return null;
   var chosen=HumanDecisions.ids(answer,"first");
   if(!selectable)return new Approval(sa.getHostCard().getId(),null,null,meta.get("cost").toString());
   var next=FilterMana.selectedPlan(sa,payer,new LinkedHashSet<>(chosen),null);
   if(next==null){selected=chosen;valid=false;message="Diese Quellen reichen nicht aus. Wähle andere Quellen oder brich ab.";continue;}
   if(!valid||!chosen.equals(selected)||!signature(next).equals(signature(plan))){selected=chosen;plan=next;valid=true;message="Geänderten Vorschlag prüfen und anschließend bezahlen.";continue;}
   return new Approval(sa.getHostCard().getId(),next,new LinkedHashSet<>(chosen),meta.get("cost").toString());
  }
 }
 static boolean play(SpellAbility sa,Player payer,Approval approval){current=approval;try{return HumanCosts.play(sa,payer);}finally{current=null;}}
 // Called only while the approved spell's native CostPartMana is being paid.
 // Nested mana abilities keep Forge's own payment, using their already available seed mana.
 static Boolean pay(ManaCost toPay,SpellAbility sa,Player payer,boolean effect){
  var approved=current;if(approved==null||approved.plan()==null||approved.cardId()!=sa.getHostCard().getId())return null;
  var cost=ComputerUtilMana.calculateManaCost(new Cost(toPay,effect),sa,payer,false,0,effect);
  if(!cost.toString().equals(approved.cost()))return false;
  var actual=FilterMana.selectedPlan(sa,payer,approved.allowed(),cost);
  if(actual==null||!signature(actual).equals(signature(approved.plan())))return false;
  FilterMana.execute(actual,payer);
  return payer.getManaPool().payManaCostFromPool(cost,sa,false,sa.getPayingMana());
 }
}
