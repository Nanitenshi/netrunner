// GPL-3.0-or-later. Bounded planning for ordinary tap mana and fixed generic-cost filters.
import forge.ai.ComputerUtilMana;
import forge.game.card.*;
import forge.game.cost.*;
import forge.game.player.Player;
import forge.game.spellability.*;
import forge.game.zone.ZoneType;
import forge.card.mana.ManaCostShard;
import java.util.*;

final class FilterMana {
 static final String COLORS="WUBRGC";
 record Option(SpellAbility ability,int cost,int[] produces,String choice){}
 record Node(List<int[]> pools,int[] used,int previous,Option activation){}
 record Quality(int taps,int waste,int flexibility) implements Comparable<Quality>{public int compareTo(Quality other){int c=Integer.compare(taps,other.taps);if(c==0)c=Integer.compare(waste,other.waste);if(c==0)c=Integer.compare(flexibility,other.flexibility);return c;}}
 static List<Option> reconstruct(List<Node> nodes,int index){if(index<0)return null;var result=new ArrayList<Option>();for(int n=index;nodes.get(n).activation()!=null;n=nodes.get(n).previous())result.add(nodes.get(n).activation());Collections.reverse(result);return result;}
 static boolean blank(String value){return value==null||value.isBlank();}
 static List<Option> plan(SpellAbility spell,Player payer){
  return plan(spell,payer,null,null,true);
 }
 static List<Option> selectedPlan(SpellAbility spell,Player payer,Set<String> allowed,forge.game.mana.ManaCostBeingPaid actual){return plan(spell,payer,allowed,actual,false);}
 static List<Option> plan(SpellAbility spell,Player payer,Set<String> allowed,forge.game.mana.ManaCostBeingPaid actual,boolean requireFilter){
  // Extra payments and variable/restricted mana keep their existing explicit path.
  if(!spell.getPayCosts().getCostParts().stream().allMatch(c->c instanceof CostPartMana)||spell.isOffering()||spell.isEmerge()||spell.hasParam("ManaConversion"))return null;
  var cost=actual==null?ComputerUtilMana.calculateManaCost(spell.getPayCosts(),spell,payer,true,0,false):actual;
  if(cost.getXcounter()!=0)return null;int[] required=new int[6];int generic=cost.getGenericManaAmount();
  for(var shard:cost.getUnpaidShards()){if(shard==ManaCostShard.GENERIC)continue;String text=shard.toString().replace("{","").replace("}","");if(text.length()!=1||COLORS.indexOf(text)<0)return null;required[COLORS.indexOf(text)]++;}
  int[] initial=new int[6];for(var mana:payer.getManaPool()){if(mana.isRestricted()||!mana.meetsManaRestrictions(spell))return null;int mask=mana.getColor();int index=mask==0||mask==32?5:Integer.numberOfTrailingZeros(mask);if(index>5)return null;initial[index]++;}
  // Replacement/discount effects need the native solver; don't approximate them during replay.
  for(var card:BatusForge.game.getCardsIn(ZoneType.Battlefield)){
   if(card.getReplacementEffects().stream().anyMatch(r->r.getMode()==forge.game.replacement.ReplacementType.ProduceMana))return null;
   if(card.getStaticAbilities().stream().anyMatch(s->s.hasParam("Mode")&&List.of("ReduceCost","RaiseCost","SetCost","ManaConvert").contains(s.getParam("Mode"))))return null;
  }
  var groups=new ArrayList<List<List<Option>>>();var ranks=new ArrayList<Integer>();var byKey=new HashMap<String,Integer>();boolean filter=false;
  for(var card:payer.getCardsIn(ZoneType.Battlefield)){
   if(allowed!=null&&!allowed.contains(BatusForge.id(card)))continue;
   if(card.isTapped()||card.isCreature())continue;var options=new ArrayList<Option>();
   for(var ability:card.getManaAbilities()){
    ability.setActivatingPlayer(payer);var payment=ability.getPayCosts();var mana=ability.getManaPart();
    if(mana==null||!ability.canPlay()||ability.getSubAbility()!=null||!payment.hasTapCost()||!payment.getCostParts().stream().allMatch(c->c instanceof CostPartMana||c instanceof CostTap)||!blank(mana.getManaRestrictions())||!blank(mana.getExtraManaRestriction())||mana.getTriggersWhenSpent())continue;
    var part=payment.getCostMana();String amount=part==null?"0":part.getManaCostFor(ability).toString().replace("{","").replace("}","").replace(" ","");if(!amount.matches("\\d{1,2}"))continue;int activate=Integer.parseInt(amount);if(activate>12)continue;
    String raw=mana.getOrigProduced();String multiplier=ability.getParamOrDefault("Amount","1");if(!multiplier.matches("\\d{1,2}"))continue;int times=Integer.parseInt(multiplier);if(times<1||times>12)continue;
    if(mana.isAnyMana()||mana.isComboMana()||ability.getApi()==forge.game.ability.ApiType.ManaReflected){if(times!=1)continue;var reflected=CardUtil.getReflectableManaColors(ability);for(int c=0;c<6;c++){String color=COLORS.substring(c,c+1);if(mana.canProduce(color,ability)||reflected.contains(forge.card.MagicColor.toLongString(forge.card.MagicColor.fromName(color)))){int[] output=new int[6];output[c]=1;options.add(new Option(ability,activate,output,color));}}}
    else {if(raw==null||!raw.matches("[WUBRGC0-9 ]+"))continue;int[] output=new int[6];for(String token:raw.trim().split(" +")){if(token.matches("\\d{1,2}"))output[5]+=Integer.parseInt(token)*times;else if(token.length()==1&&COLORS.indexOf(token)>=0)output[COLORS.indexOf(token)]+=times;}if(Arrays.stream(output).sum()>0&&Arrays.stream(output).sum()<=24)options.add(new Option(ability,activate,output,""));}
   }
   if(options.isEmpty())continue;filter|=options.stream().anyMatch(o->o.cost()>0);
   int colors=0;for(int c=0;c<6;c++){final int color=c;if(options.stream().anyMatch(o->o.produces()[color]>0))colors++;}
   int rank=colors+(int)card.getSpellAbilities().stream().filter(a->!a.isManaAbility()&&!a.isLandAbility()&&!a.isSpell()).count()*100+card.getStaticAbilities().size()*10+card.getTriggers().size()*10;
   String key=rank+":"+options.stream().map(o->o.cost()+Arrays.toString(o.produces())+o.choice()).reduce("",(a,b)->a+";"+b);
   Integer group=byKey.get(key);if(group==null){group=groups.size();byKey.put(key,group);groups.add(new ArrayList<>());ranks.add(rank);}groups.get(group).add(options);
  }
  if(requireFilter&&!filter)return null;var nodes=new ArrayList<Node>();nodes.add(new Node(List.of(initial),new int[groups.size()],-1,null));var seen=new HashSet<String>();seen.add(poolKey(nodes.get(0).pools())+Arrays.toString(nodes.get(0).used()));
  int best=-1,requiredTotal=Arrays.stream(required).sum()+generic;Quality quality=null;
  for(int index=0;index<nodes.size()&&index<8000;index++){
   var node=nodes.get(index);int taps=Arrays.stream(node.used()).sum();
   if(quality!=null&&taps>quality.taps())break;
   if(node.pools().stream().allMatch(pool->pays(pool,required,generic))){int flexibility=0;for(int g=0;g<groups.size();g++)flexibility+=node.used()[g]*ranks.get(g);var candidate=new Quality(taps,node.pools().stream().mapToInt(pool->Arrays.stream(pool).sum()-requiredTotal).max().orElse(0),flexibility);if(quality==null||candidate.compareTo(quality)<0){best=index;quality=candidate;}continue;}
   if(taps>=64||quality!=null&&taps>=quality.taps())continue;
   for(int g=0;g<groups.size();g++){int used=node.used()[g];if(used==groups.get(g).size())continue;for(var option:groups.get(g).get(used)){
    // Forge chooses which floating colors pay generic activation costs. A plan
    // must still pay the final spell for every possible choice, not just one.
    var possible=new TreeMap<String,int[]>();boolean safe=true;
    for(var before:node.pools()){var spent=spendGeneric(before,option.cost());if(spent==null||spent.isEmpty()){safe=false;break;}for(var pool:spent){for(int c=0;c<6;c++)pool[c]+=option.produces()[c];possible.put(Arrays.toString(pool),pool);}if(possible.size()>512){safe=false;break;}}
    if(!safe)continue;var nextPools=new ArrayList<>(possible.values());int[] nextUsed=node.used().clone();nextUsed[g]++;String key=poolKey(nextPools)+Arrays.toString(nextUsed);if(seen.add(key)){if(nodes.size()>=8000)return reconstruct(nodes,best);nodes.add(new Node(nextPools,nextUsed,index,option));}
   }}
  }return reconstruct(nodes,best);
 }
 static boolean pays(int[] pool,int[] required,int generic){int extra=0;for(int c=0;c<6;c++){if(pool[c]<required[c])return false;extra+=pool[c]-required[c];}return extra>=generic;}
 static String poolKey(List<int[]> pools){return pools.stream().map(Arrays::toString).sorted().reduce("",(a,b)->a+";"+b);}
 static List<int[]> spendGeneric(int[] pool,int amount){var result=new ArrayList<int[]>();distribute(pool.clone(),0,amount,result);return result.size()>512?null:result;}
 static void distribute(int[] pool,int index,int amount,List<int[]> result){if(result.size()>512)return;if(amount==0){result.add(pool.clone());return;}if(index==6)return;int available=pool[index];for(int n=Math.min(amount,available);n>=0;n--){pool[index]=available-n;distribute(pool,index+1,amount-n,result);}pool[index]=available;}
 static boolean canPay(SpellAbility spell,Player payer){return plan(spell,payer)!=null;}
 static void prepare(SpellAbility spell,Player payer){var plan=plan(spell,payer);BatusForge.require(plan!=null,"Filtermana reicht nicht aus");execute(plan,payer);}
 static void execute(List<Option> plan,Player payer){for(var step:plan){var part=step.ability().getManaPart();String before=part.getExpressChoice();try{if(!step.choice().isEmpty())part.setExpressChoice(step.choice());BatusForge.require(HumanCosts.play(step.ability(),payer),"Manafähigkeit konnte nicht bezahlt werden");}finally{part.setExpressChoice(before);}}}
}
