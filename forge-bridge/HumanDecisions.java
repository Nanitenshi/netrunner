// GPL-3.0-or-later. See LICENSE. Human choices for the pinned Forge adapter.
import com.google.gson.*;
import forge.game.card.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class HumanDecisions {
 private static volatile Pending pending;
 private static Preparation preparing;
 static final class Cancelled extends RuntimeException {private static final long serialVersionUID=1L;}
 // Only announcement choices may be cancelled. Resolution choices never inherit
 // this permission, even when a cost or a cast produces a new trigger.
 static final class Preparation implements AutoCloseable {
  final forge.game.spellability.SpellAbility ability;
  final forge.game.spellability.AbilitySub sub;
  final List<forge.game.spellability.AbilitySub> modes;
  final forge.game.cost.Cost cost;
  final Map<forge.game.spellability.SpellAbility,forge.game.spellability.TargetChoices> targets=new LinkedHashMap<>();
  final int seat;boolean committed;
  Preparation(forge.game.spellability.SpellAbility sa,int who){
   BatusForge.require(preparing==null,"Eine Aktion wird bereits vorbereitet");ability=sa;seat=who;sub=sa.getSubAbility();modes=sa.getChosenList()==null?null:new ArrayList<>(sa.getChosenList());cost=sa.getPayCosts().copy();
   for(var current=sa;current!=null;current=current.getSubAbility())targets.put(current,current.getTargets().clone());preparing=this;
  }
  void seal(){if(preparing==this)preparing=null;}
  void commit(){committed=true;seal();}
  public void close(){seal();if(!committed){ability.setSubAbility(sub);ability.setChosenList(modes);ability.setPayCosts(cost);targets.forEach((sa,value)->sa.setTargets(value));}}
 }
 static Preparation prepare(forge.game.spellability.SpellAbility sa,int seat){return new Preparation(sa,seat);}
 private static final List<Map<String,Object>> reveals=new ArrayList<>();
 // Each callback is delivered by Forge to a specific permitted viewer.
 // Keep a bounded journal per viewer; never infer publicity from the card's zone.
 static void reveal(int viewer,String title,String source,List<Map<String,Object>> cards){
  if(cards.isEmpty())return;
  reveals.add(Map.of("id",UUID.randomUUID().toString(),"seat",viewer,"title",title==null||title.isBlank()?"Aufgedeckte Karten":title,"source",source,"cards",List.copyOf(cards)));
  while(reveals.stream().filter(r->(int)r.get("seat")==viewer).count()>8){for(int i=0;i<reveals.size();i++)if((int)reveals.get(i).get("seat")==viewer){reveals.remove(i);break;}}
 }
 static List<Map<String,Object>> reveals(){return List.copyOf(reveals);}
 private static class Pending {
  final Map<String,Object> descriptor;final Set<String> allowed;
  final CompletableFuture<JsonObject> answer=new CompletableFuture<>();boolean answered;
  Pending(Map<String,Object> d,List<Map<String,Object>> options){descriptor=d;allowed=new HashSet<>();for(var o:options)allowed.add((String)o.get("id"));}
 }
 static JsonObject ask(int seat,String kind,String title,String source,int min,int max,boolean repeat,List<Map<String,Object>> options){
  return ask(seat,kind,title,source,min,max,repeat,options,null);
 }
 static JsonObject ask(int seat,String kind,String title,String source,int min,int max,boolean repeat,List<Map<String,Object>> options,String automation){
  return ask(seat,kind,title,source,min,max,repeat,options,automation,Map.of());
 }
 static JsonObject ask(int seat,String kind,String title,String source,int min,int max,boolean repeat,List<Map<String,Object>> options,String automation,Map<String,Object> details){
  var d=new LinkedHashMap<String,Object>();if(automation!=null)d.put("automation",automation);d.put("id",UUID.randomUUID().toString());d.put("seat",seat);d.put("kind",kind);d.put("title",title);d.put("source",source);d.put("min",min);d.put("max",max);d.put("repeat",repeat);d.put("count",min);d.put("options",options);
  boolean cancellable=preparing!=null&&preparing.seat==seat&&(kind.equals("targets")||kind.equals("modes"));if(cancellable){d.put("canCancel",true);d.put("action",preparing.ability.isSpell()?"cast":"activate");}
  d.putAll(details);var p=new Pending(d,options);pending=p;BatusForge.choice=d;BatusForge.publishPause();
  JsonObject result;try{result=p.answer.get();}catch(Exception e){throw new IllegalStateException("Entscheidung wurde unterbrochen",e);}finally{pending=null;BatusForge.choice=null;}
  if(cancellable&&result.has("answer")&&!result.get("answer").getAsBoolean())throw new Cancelled();return result;
 }
 static List<String> ids(JsonObject a,String key){var result=new ArrayList<String>();if(a.has(key))for(var v:a.getAsJsonArray(key))result.add(v.getAsString());return result;}
 static void answer(int who,JsonObject a){
  var p=pending;BatusForge.require(p!=null,"Keine laufende Effektentscheidung");
  synchronized(p){
   var d=p.descriptor;BatusForge.require(!p.answered,"Entscheidung wurde bereits beantwortet");BatusForge.require(who==(int)d.get("seat"),"Der andere Spieler entscheidet");BatusForge.require(a.get("choiceId").getAsString().equals(d.get("id")),"Entscheidung nicht mehr aktuell");
   var first=ids(a,"first");var second=ids(a,"second");var all=new ArrayList<String>(first);all.addAll(second);
   BatusForge.require(p.allowed.containsAll(all),"Ungültige Auswahl");String kind=(String)d.get("kind");
   if(!kind.equals("number"))BatusForge.require(!a.has("value"),"Diese Auswahl benötigt keine Zahl");
   if(kind.equals("number")){BatusForge.require(all.isEmpty()&&!a.has("answer")&&a.has("value"),"Zahl fehlt");double value=a.get("value").getAsDouble();BatusForge.require(Double.isFinite(value)&&value==Math.rint(value)&&value>=(int)d.get("min")&&value<=(int)d.get("max"),"Zahl außerhalb des erlaubten Bereichs");}
   else if((Boolean.TRUE.equals(d.get("canCancel"))||kind.equals("cost")||kind.equals("reveal")||kind.equals("payment"))&&a.has("answer")){BatusForge.require(!a.get("answer").getAsBoolean()&&all.isEmpty(),"Abbruch ist ungültig");}
   else if(kind.equals("confirm")){BatusForge.require(a.has("answer")&&all.isEmpty(),"Bestätigung fehlt");}
   else {BatusForge.require(!a.has("answer"),"Diese Entscheidung ist keine Bestätigung");
    if(!(boolean)d.get("repeat"))BatusForge.require(new HashSet<>(all).size()==all.size(),"Doppelte Auswahl");
    if(kind.equals("scry")||kind.equals("surveil")){BatusForge.require(new HashSet<>(all).equals(p.allowed)&&all.size()==p.allowed.size(),"Alle angesehenen Karten zuordnen");}
    else{BatusForge.require(second.isEmpty(),"Keine zweite Liste zulässig");BatusForge.require(first.size()>=(int)d.get("min")&&first.size()<=(int)d.get("max"),"Falsche Anzahl gewählt");}
   }
   p.answered=true;p.answer.complete(a.deepCopy());
  }
 }
 static List<Map<String,Object>> cardOptions(Iterable<Card> cards){var result=new ArrayList<Map<String,Object>>();for(var c:cards)result.add(BatusForge.target(c));return result;}
 static CardCollection collect(Iterable<Card> cards,List<String> ids){var byId=new HashMap<String,Card>();for(var c:cards)byId.put(BatusForge.id(c),c);var result=new CardCollection();for(var id:ids)result.add(byId.get(id));return result;}
 static CardCollection select(int who,String title,String source,CardCollectionView cards,int min,int max){return selectVisible(who,title,source,cards,min,max,null);}
 static CardCollection selectVisible(int who,String title,String source,CardCollectionView cards,int min,int max,CardCollectionView visible){
  if(cards.isEmpty())return new CardCollection();max=Math.min(max,cards.size());min=Math.min(min,max);var options=new ArrayList<Map<String,Object>>();
  for(var card:cards)options.add(visible==null||visible.contains(card)?BatusForge.target(card):Map.of("id",BatusForge.id(card),"name","Verdeckte Karte","kind","hidden"));
  var answer=ask(who,"select",title,source,min,max,false,options);return collect(cards,ids(answer,"first"));
 }
}
