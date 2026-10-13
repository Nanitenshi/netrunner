// GPL-3.0-or-later. See LICENSE. Human choices for the pinned Forge adapter.
import com.google.gson.*;
import forge.game.card.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;

public final class HumanDecisions {
 private static volatile Pending pending;
 private static class Pending {
  final Map<String,Object> descriptor;final Set<String> allowed;
  final CompletableFuture<JsonObject> answer=new CompletableFuture<>();boolean answered;
  Pending(Map<String,Object> d,List<Map<String,Object>> options){descriptor=d;allowed=new HashSet<>();for(var o:options)allowed.add((String)o.get("id"));}
 }
 static JsonObject ask(int seat,String kind,String title,String source,int min,int max,boolean repeat,List<Map<String,Object>> options){
  var d=new LinkedHashMap<String,Object>();d.put("id",UUID.randomUUID().toString());d.put("seat",seat);d.put("kind",kind);d.put("title",title);d.put("source",source);d.put("min",min);d.put("max",max);d.put("repeat",repeat);d.put("count",min);d.put("options",options);
  var p=new Pending(d,options);pending=p;BatusForge.choice=d;BatusForge.publishPause();
  try{return p.answer.get();}catch(Exception e){throw new IllegalStateException("Entscheidung wurde unterbrochen",e);}finally{pending=null;BatusForge.choice=null;}
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
   else if(kind.equals("cost")&&a.has("answer")){BatusForge.require(!a.get("answer").getAsBoolean()&&all.isEmpty(),"Kostenabbruch ist ungültig");}
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
