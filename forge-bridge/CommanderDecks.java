// GPL-3.0-or-later. Own deck initialization for the pinned Forge adapter.
import com.google.gson.*;
import forge.StaticData;
import forge.deck.*;
import forge.game.*;
import forge.game.card.*;
import forge.game.player.*;
import forge.game.phase.PhaseType;
import forge.game.zone.ZoneType;
import forge.item.PaperCard;
import java.util.*;

final class CommanderDecks {
 static final boolean[] kept={false,false};static final int[] mulligans={0,0};
 static PaperCard paper(JsonObject item){
  var name=item.get("name").getAsString();var cards=StaticData.instance().getCommonCards();var p=cards.getCard(name);
  if(p==null)p=cards.getCard(name.replace(" // "," / "));
  if(p==null&&item.has("frontName"))p=cards.getCard(item.get("frontName").getAsString());return p;
 }
 static List<Map<String,Object>> missing(JsonArray specs){
  BatusForge.require(specs!=null&&specs.size()==2,"Genau zwei Decks benötigt");var issues=new ArrayList<Map<String,Object>>();
  for(int i=0;i<2;i++){var spec=specs.get(i).getAsJsonObject();var missing=new LinkedHashSet<String>();for(var section:List.of("commanders","main"))for(var entry:spec.getAsJsonArray(section)){var item=entry.getAsJsonObject();if(paper(item)==null)missing.add(item.get("name").getAsString());}if(!missing.isEmpty())issues.add(Map.of("seat",i,"cards",new ArrayList<>(missing)));}return issues;
 }
 static void init(JsonArray specs){
  var registered=new ArrayList<RegisteredPlayer>();
  for(var entry:specs){var spec=entry.getAsJsonObject();var deck=new Deck(spec.get("name").getAsString());
   var commanders=spec.getAsJsonArray("commanders");BatusForge.require(commanders.size()>=1&&commanders.size()<=2,"Ein oder zwei Commander benötigt");int total=commanders.size();
   for(var item:commanders)deck.getOrCreate(DeckSection.Commander).add(paper(item.getAsJsonObject()),1);
   for(var item:spec.getAsJsonArray("main")){var c=item.getAsJsonObject();int count=c.get("count").getAsInt();BatusForge.require(count>=1&&count<=99,"Ungültige Kartenanzahl");total+=count;deck.getMain().add(paper(c),count);}
   BatusForge.require(total>=100&&total<=250,"Commander-Deck benötigt 100 bis 250 Karten");
   var rp=RegisteredPlayer.forCommander(deck);rp.setPlayer(spec.has("ai")?ForgeAi.lobby(spec,registered.size()):new BatusForge.HumanLobby(spec.get("playerName").getAsString()));registered.add(rp);
  }
  var rules=new GameRules(GameType.Commander);rules.addAppliedVariant(GameType.Commander);
  BatusForge.game=new Match(rules,registered,"BatusMTG Commander").createGame();var g=BatusForge.game;BatusForge.seatedPlayers=g.getPlayers().toArray(new Player[0]);g.setNoGUIUser();g.setAge(GameStage.Mulligan);
  for(int i=0;i<2;i++){var p=BatusForge.player(i);p.setLife(40,null);p.initVariantsZones(registered.get(i));for(var paper:registered.get(i).getDeck().getMain().toFlatList()){var c=Card.fromPaperCard(paper,p);p.getZone(ZoneType.Library).add(c);}p.shuffle(null);p.drawCards(7);}
  g.getAction().checkStaticAbilities(false);g.copyLastState();BatusForge.log.add("Eigene Commander-Decks · Starthände wählen");ForgeAi.opening();
 }
 static boolean opening(){return BatusForge.commanderMode&&!(kept[0]&&kept[1]);}
 static void keep(int who){BatusForge.require(opening()&&!kept[who],"Starthand bereits behalten");kept[who]=true;if(!opening()){
  var g=BatusForge.game;g.setAge(GameStage.Play);g.setStartingPlayer(BatusForge.player(0));g.getPhaseHandler().devModeSet(PhaseType.MAIN1,BatusForge.player(0),1);g.getAction().checkStaticAbilities(false);g.copyLastState();BatusForge.settle();BatusForge.log.add("Commander-Partie gestartet");
 }}
 static void mulligan(int who){BatusForge.require(opening()&&!kept[who],"Starthand bereits behalten");var p=BatusForge.player(who);for(var c:new CardCollection(p.getCardsIn(ZoneType.Hand))){p.getZone(ZoneType.Hand).remove(c);p.getZone(ZoneType.Library).add(c);}p.shuffle(null);p.drawCards(7);mulligans[who]++;BatusForge.log.add(p.getName()+" nimmt einen kostenlosen Mulligan auf sieben");}
}
