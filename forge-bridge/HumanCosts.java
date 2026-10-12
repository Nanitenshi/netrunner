// GPL-3.0-or-later. See LICENSE. Human payments for the pinned Forge adapter.
import forge.ai.AiCostDecision;
import forge.ai.ComputerUtil;
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
 HumanCosts(Player player,SpellAbility ability){super(player,ability,false);payer=player;spell=ability;}

 // The fixture deliberately supports ordinary discard/sacrifice costs only.
 // Never silently delegate a new non-mana cost to the AI.
 static boolean supported(SpellAbility sa){
  return sa.getPayCosts().getCostParts().stream().allMatch(c->c instanceof CostPartMana||
   c instanceof CostDiscard&&!c.payCostFromSource()&&c.getType().equals("Card")&&c.getAmount().matches("\\d+")||
   c instanceof CostSacrifice&&!c.payCostFromSource()&&c.getType().equals("Creature")&&c.getAmount().matches("\\d+"));
 }
 PaymentDecision choose(CardCollectionView candidates,int count,String title){
  if(candidates.size()<count)return null;
  if(count==0)return PaymentDecision.card(new CardCollection());
  var answer=HumanDecisions.ask(BatusForge.seat(payer),"cost",title,spell.getHostCard().getName(),count,count,false,HumanDecisions.cardOptions(candidates));
  if(answer.has("answer")){cancelled=true;return null;} // No cost has been paid yet.
  return PaymentDecision.card(HumanDecisions.collect(candidates,HumanDecisions.ids(answer,"first")));
 }
 @Override public PaymentDecision visit(CostDiscard cost){
  var cards=CardLists.getValidCards(payer.getCardsIn(ZoneType.Hand),cost.getType().split(";"),payer,spell.getHostCard(),spell);
  cards=CardLists.filter(cards,c->c.canBeDiscardedBy(spell,false));
  return choose(cards,cost.getAbilityAmount(spell),"Zusatzkosten · Karte abwerfen");
 }
 @Override public PaymentDecision visit(CostSacrifice cost){
  var cards=CardLists.getValidCards(payer.getCardsIn(ZoneType.Battlefield),cost.getType().split(";"),payer,spell.getHostCard(),spell);
  cards=CardLists.filter(cards,CardPredicates.canBeSacrificedBy(spell,false));
  return choose(cards,cost.getAbilityAmount(spell),"Zusatzkosten · Kreatur opfern");
 }
 static boolean play(SpellAbility sa,Player player){
  BatusForge.require(supported(sa),"Diese Zusatzkosten sind noch nicht im Testumfang");
  if(sa.getPayCosts().getCostParts().stream().allMatch(c->c instanceof CostPartMana)){BatusForge.require(ComputerUtil.playStack(sa,player,BatusForge.game),"Kosten konnten nicht bezahlt werden");return true;}
  if(!ComputerUtilCost.canPayCost(sa,player,false))return false;
  var source=sa.getHostCard();var zone=source.getZone();int position=zone.getCards().indexOf(source);
  sa.setHostCard(BatusForge.game.getAction().moveToStack(source,sa));
  var payment=new CostPayment(sa.getPayCosts(),sa);
  var decisions=new HumanCosts(player,sa);
  if(!sa.checkRestrictions(player)||!payment.payComputerCosts(decisions)){
   GameActionUtil.rollbackAbility(sa,zone,position,payment,source);
   BatusForge.require(decisions.cancelled,"Kosten konnten nicht bezahlt werden");
   return false;
  }
  BatusForge.game.getStack().add(sa);return true;
 }
}
