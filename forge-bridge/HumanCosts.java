// GPL-3.0-or-later. See LICENSE. Human payments for the pinned Forge adapter.
import forge.ai.AiCostDecision;
import forge.ai.ComputerUtilCost;
import forge.game.GameActionUtil;
import forge.game.card.*;
import forge.game.cost.*;
import forge.game.player.Player;
import forge.game.spellability.SpellAbility;
import forge.game.zone.ZoneType;

final class HumanCosts extends AiCostDecision {
 private final Player payer;
 private final SpellAbility spell;
 private boolean cancelled;
 private boolean collecting;
 private Cost effectCost;
 private final java.util.Set<String> reserved=new java.util.HashSet<>();
 private final java.util.Map<String,java.util.ArrayDeque<java.util.List<String>>> choices=new java.util.HashMap<>();
 HumanCosts(Player player,SpellAbility ability){this(player,ability,false);}
 HumanCosts(Player player,SpellAbility ability,boolean effect){super(player,ability,effect);payer=player;spell=ability;}
 static boolean canPay(SpellAbility sa,Player player){return (forge.ai.ComputerUtilMana.canPayManaCost(sa.getPayCosts(),sa,player,0,false)||FilterMana.canPay(sa,player))&&CostPayment.canPayAdditionalCosts(sa.getPayCosts(),sa,false,player);}

 // Choices of cards stay human. Tap/untap, life, and a named source are deterministic.
 // Other cost families remain explicitly unsupported.
 static boolean ordinaryDiscard(CostPart part){return !(part instanceof CostDiscard)||(!java.util.Set.of("Hand","Random","LastDrawn").contains(part.getType())&&!part.getType().contains("WithSameName")&&!part.getType().contains("WithDifferentNames"));}
 static boolean supported(SpellAbility sa){
  return sa.getPayCosts()!=null&&sa.getPayCosts().getTotalMana().countX()==0&&sa.getPayCosts().getCostParts().stream().allMatch(c->c instanceof CostPartMana||c instanceof CostTap||c instanceof CostUntap||
   c instanceof CostPayLife&&c.getAmount().matches("\\d+")||
   (c instanceof CostDiscard||c instanceof CostSacrifice)&&ordinaryDiscard(c)&&c.getAmount().matches("\\d+")&&(!c.payCostFromSource()||c.getAmount().equals("1")));
 }
 PaymentDecision choose(CardCollectionView candidates,int count,String title){
  if(collecting)candidates=CardLists.filter(candidates,card->!reserved.contains(BatusForge.id(card)));
  if(candidates.size()<count)return null;
  if(count==0)return PaymentDecision.card(new CardCollection());
  if(!collecting){var cached=choices.get(title+":"+count);if(cached==null||cached.isEmpty())return null;var ids=cached.removeFirst();var allowed=new java.util.HashSet<String>();for(var card:candidates)allowed.add(BatusForge.id(card));return allowed.containsAll(ids)?PaymentDecision.card(HumanDecisions.collect(candidates,ids)):null;}
  var details=new java.util.LinkedHashMap<String,Object>();if(effectCost!=null){details.put("purpose","effect-payment");details.put("effectPayment",effectDetails(effectCost,spell,true,false));}else details.put("action",spell.isSpell()?"cast":"activate");
  var answer=HumanDecisions.ask(BatusForge.seat(payer),"cost",effectCost==null?title:title.replace("Zusatzkosten","Effektkosten"),spell.getHostCard().getName(),count,count,false,HumanDecisions.cardOptions(candidates),null,details);
  if(answer.has("answer")){cancelled=true;return null;} // No cost has been paid yet.
  var ids=HumanDecisions.ids(answer,"first");reserved.addAll(ids);choices.computeIfAbsent(title+":"+count,key->new java.util.ArrayDeque<>()).addLast(ids);return PaymentDecision.card(HumanDecisions.collect(candidates,ids));
 }
 boolean prepare(){collecting=true;try{var parts=CostAdjustment.adjust(effectCost==null?spell.getPayCosts():effectCost,spell,effectCost!=null).getCostPartsWithZeroMana();if(parts.stream().anyMatch(part->(part instanceof CostDiscard||part instanceof CostSacrifice)&&part.payCostFromSource()))reserved.add(BatusForge.id(spell.getHostCard()));for(var part:parts)if((part instanceof CostDiscard||part instanceof CostSacrifice)&&!part.payCostFromSource()&&part.accept(this)==null)return false;return true;}finally{collecting=false;}}
 static java.util.Map<String,Object> effectDetails(Cost cost,SpellAbility sa,boolean canPay,boolean alreadyPaid){return effectDetails(cost.toString(),sa,canPay,alreadyPaid);}
 static java.util.Map<String,Object> effectDetails(String cost,SpellAbility sa,boolean canPay,boolean alreadyPaid){return java.util.Map.of("cost",cost,"canPay",canPay,"alreadyPaid",alreadyPaid,"description",sa.getDescription().isBlank()?sa.getStackDescription():sa.getDescription());}
 static boolean effectSupported(Cost cost){return cost.getTotalMana().countX()==0&&cost.getCostParts().stream().allMatch(c->c instanceof CostPartMana||c instanceof CostPayLife&&c.getAmount().matches("\\d+")||(c instanceof CostDiscard||c instanceof CostSacrifice)&&ordinaryDiscard(c)&&c.getAmount().matches("\\d+")&&(!c.payCostFromSource()||c.getAmount().equals("1")))&&(!cost.hasManaCost()||cost.getCostParts().stream().allMatch(c->c instanceof CostPartMana));}
 static boolean effectSupported(Cost cost,SpellAbility sa){return effectSupported(cost)||cost.getCostParts().stream().allMatch(c->c instanceof CostPartMana)&&"X".equals(sa.getParam("UnlessCost"))&&"Count$CardPower".equals(sa.getSVar("X"));}
 static boolean payOptionalEffect(Cost cost,SpellAbility sa,Player payer,boolean alreadyPaid){
  // A resolution payment is a separate decision, never an AI strategy choice.
  if(!effectSupported(cost,sa))throw new IllegalStateException("Diese Effektkosten werden noch nicht sicher unterstützt: "+cost);
  if(cost.getCostParts().stream().allMatch(c->c instanceof CostPartMana))return HumanMana.payEffect(cost,sa,payer,alreadyPaid);
  boolean canPay=ComputerUtilCost.canPayCost(cost,sa,payer,true);
  var answer=HumanDecisions.ask(BatusForge.seat(payer),"confirm","Für diesen Effekt bezahlen?",sa.getHostCard().getName(),0,0,false,java.util.List.of(),null,java.util.Map.of("purpose","effect-payment","effectPayment",effectDetails(cost,sa,canPay,alreadyPaid)));
  if(!answer.get("answer").getAsBoolean()||!canPay)return false;
  var decisions=new HumanCosts(payer,sa,true);decisions.effectCost=cost;if(!decisions.prepare())return false;
  if(!new CostPayment(cost,sa).payComputerCosts(decisions))throw new IllegalStateException("Die bestätigte Effektzahlung konnte nicht vollständig ausgeführt werden");return true;
 }
 static boolean revealEffectSupported(Cost cost){return cost.getCostParts().size()==1&&cost.getCostParts().get(0) instanceof CostReveal r&&!r.payCostFromSource()&&r.getAmount().matches("\\d+")&&r.getRevealFrom().equals(java.util.List.of(ZoneType.Hand))&&!r.getType().equals("SameColor")&&!r.getType().equals("Hand");}
 static boolean payRevealEffect(Cost cost,SpellAbility sa,Player payer){return new CostPayment(cost,sa).payComputerCosts(new HumanCosts(payer,sa,true));}
 @Override public PaymentDecision visit(CostReveal cost){
  var cards=CardLists.getValidCards(payer.getCardsIn(ZoneType.Hand),cost.getType().split(";"),payer,spell.getHostCard(),spell);int count=cost.getAbilityAmount(spell);
  if(cards.size()<count)return null;
  boolean revealLand=count==1&&spell.getHostCard().isLand()&&java.util.Set.of("Port Town","Choked Estuary","Foreboding Ruins","Game Trail","Fortified Village").contains(spell.getHostCard().getName());
  var answer=HumanDecisions.ask(BatusForge.seat(payer),"reveal","Handkarte aufdecken",spell.getHostCard().getName(),count,count,false,HumanDecisions.cardOptions(cards),revealLand?"reveal-land":null);
  if(answer.has("answer")){cancelled=true;return null;}
  return PaymentDecision.card(HumanDecisions.collect(cards,HumanDecisions.ids(answer,"first")));
 }
 @Override public PaymentDecision visit(CostDiscard cost){
  if(cost.payCostFromSource()){var cards=new CardCollection();cards.add(spell.getHostCard());return PaymentDecision.card(cards);}
  var cards=CardLists.getValidCards(payer.getCardsIn(ZoneType.Hand),cost.getType().split(";"),payer,spell.getHostCard(),spell);
  cards=CardLists.filter(cards,c->(!spell.isSpell()||c!=spell.getHostCard())&&c.canBeDiscardedBy(spell,false));
  return choose(cards,cost.getAbilityAmount(spell),"Zusatzkosten · Karte abwerfen");
 }
 @Override public PaymentDecision visit(CostSacrifice cost){
  if(cost.payCostFromSource()){var cards=new CardCollection();cards.add(spell.getHostCard());return PaymentDecision.card(cards);}
  var cards=CardLists.getValidCards(payer.getCardsIn(ZoneType.Battlefield),cost.getType().split(";"),payer,spell.getHostCard(),spell);
  cards=CardLists.filter(cards,CardPredicates.canBeSacrificedBy(spell,false));
  return choose(cards,cost.getAbilityAmount(spell),cost.getType().equals("Creature")?"Zusatzkosten · Kreatur opfern":"Zusatzkosten · Karte opfern");
 }
 static boolean play(SpellAbility sa,Player player){
  BatusForge.require(supported(sa),"Diese Zusatzkosten sind noch nicht im Testumfang");
  if(!HumanMana.approved(sa)&&!canPay(sa,player))return false;
  var decisions=new HumanCosts(player,sa);if(!decisions.prepare()){BatusForge.require(decisions.cancelled,"Die Zusatzkosten können nicht bezahlt werden");return false;}
  var source=sa.getHostCard();var zone=source.getZone();int position=zone.getCards().indexOf(source);
  if(sa.isSpell())sa.setHostCard(BatusForge.game.getAction().moveToStack(source,sa));
  var payment=new CostPayment(sa.getPayCosts(),sa);
  boolean paid;try{paid=sa.checkRestrictions(player)&&payment.payComputerCosts(decisions);}catch(RuntimeException failure){GameActionUtil.rollbackAbility(sa,zone,position,payment,source);throw failure;}
  if(!paid){
   GameActionUtil.rollbackAbility(sa,zone,position,payment,source);
   BatusForge.require(decisions.cancelled,"Kosten konnten nicht bezahlt werden");
   return false;
  }
  BatusForge.game.getStack().add(sa);return true;
 }
}
