// BatusMTG interactive integration prototype. See README.md and LICENSE.
import forge.GuiDesktop;
import forge.gui.GuiBase;
import forge.model.FModel;
import forge.StaticData;
import forge.deck.Deck;
import forge.game.*;
import forge.game.card.*;
import forge.game.player.*;
import forge.game.phase.PhaseType;
import forge.game.spellability.*;
import forge.game.zone.ZoneType;
import forge.ai.ComputerUtil;
import forge.ai.PlayerControllerAi;
import forge.ai.LobbyPlayerAi;
import forge.LobbyPlayer;
import forge.game.combat.Combat;
import forge.ai.ComputerUtilCost;
import com.google.gson.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import org.apache.commons.lang3.tuple.ImmutablePair;
import forge.game.ability.ApiType;
import forge.game.ability.effects.CharmEffect;
import forge.game.trigger.WrappedAbility;
import forge.util.collect.FCollectionView;


public class BatusForge {
 static final Gson JSON=new GsonBuilder().serializeNulls().create();static Game game;static int active=0,priority=0,passes=0,turn=1;static final List<String> log=new ArrayList<>();
 static boolean ending=false,endWindow=false;static String resolvingSource="";static volatile Map<String,Object> choice=null;static CardCollection discardSelection=null;
 static class HumanFixtureController extends PlayerControllerAi {
  HumanFixtureController(Player p,LobbyPlayer lobby){super(p.getGame(),p,lobby);}
  int who(){return seat(getPlayer());}String source(SpellAbility sa){return sa==null?"":sa.getHostCard().getName();}
  @Override public void declareAttackers(Player attacker,Combat combat){}
  @Override public CardCollectionView chooseCardsToDiscardToMaximumHandSize(int count){require(discardSelection!=null&&discardSelection.size()==count,"Abwerfen muss vom Spieler gewählt werden");var result=discardSelection;discardSelection=null;return result;}
  ImmutablePair<CardCollection,CardCollection> arrange(CardCollection cards,String kind){if(cards.isEmpty())return ImmutablePair.of(new CardCollection(),new CardCollection());var a=HumanDecisions.ask(who(),kind,kind.equals("scry")?"Scry":"Surveil",resolvingSource,0,cards.size(),false,HumanDecisions.cardOptions(cards));return ImmutablePair.of(HumanDecisions.collect(cards,HumanDecisions.ids(a,"first")),HumanDecisions.collect(cards,HumanDecisions.ids(a,"second")));}
  @Override public ImmutablePair<CardCollection,CardCollection> arrangeForScry(CardCollection cards){return arrange(cards,"scry");}
  @Override public ImmutablePair<CardCollection,CardCollection> arrangeForSurveil(CardCollection cards){return arrange(cards,"surveil");}
  boolean confirm(String message,String source){return HumanDecisions.ask(who(),"confirm",message,source,0,0,false,List.of()).get("answer").getAsBoolean();}
  @Override public boolean confirmAction(SpellAbility sa,PlayerActionConfirmMode mode,String message,List<String> options,Card card,Map<String,Object> params){return confirm(message,source(sa));}
  @Override public boolean confirmTrigger(WrappedAbility wrapper){return wrapper.isMandatory()||confirm("Optionalen Trigger nutzen?",source(wrapper));}
  @Override public CardCollectionView choosePermanentsToSacrifice(SpellAbility sa,int min,int max,CardCollectionView cards,String message){return HumanDecisions.select(who(),"Opfer wählen",source(sa),cards,min,max);}
  @Override public CardCollectionView choosePermanentsToDestroy(SpellAbility sa,int min,int max,CardCollectionView cards,String message){return HumanDecisions.select(who(),"Karten wählen",source(sa),cards,min,max);}
  @Override public CardCollectionView chooseCardsForEffect(CardCollectionView cards,SpellAbility sa,String title,int min,int max,boolean optional,Map<String,Object> params){return HumanDecisions.select(who(),"Karten wählen",source(sa),cards,optional?0:min,max);}
  @Override public CardCollection chooseCardsToDiscardFrom(Player p,SpellAbility sa,CardCollection cards,int min,int max,CardCollectionView visible){return HumanDecisions.selectVisible(who(),"Abwerfen",source(sa),cards,min,max,visible);}
  @Override public CardCollectionView orderMoveToZoneList(CardCollectionView cards,ZoneType zone,SpellAbility sa){return cards.size()<2?cards:HumanDecisions.select(who(),"Reihenfolge wählen · "+zone.name(),source(sa),cards,cards.size(),cards.size());}
  @Override public <T extends GameEntity> T chooseSingleEntityForEffect(FCollectionView<T> options,DelayedReveal reveal,SpellAbility sa,String title,boolean optional,Player related,Map<String,Object> params){var chosen=chooseEntitiesForEffect(options,optional?0:1,1,reveal,sa,title,related,params);return chosen.isEmpty()?null:chosen.get(0);}
  @Override public <T extends GameEntity> List<T> chooseEntitiesForEffect(FCollectionView<T> options,int min,int max,DelayedReveal reveal,SpellAbility sa,String title,Player related,Map<String,Object> params){if(options.isEmpty())return List.of();var list=new ArrayList<T>();options.forEach(list::add);var descriptors=new ArrayList<Map<String,Object>>();for(var e:list)descriptors.add(e instanceof Card?target((Card)e):Map.of("id","player:"+seat((Player)e),"name",e.getName(),"kind","player"));var a=HumanDecisions.ask(who(),"select","Auswahl treffen",source(sa),min,Math.min(max,list.size()),false,descriptors);var result=new ArrayList<T>();for(var id:HumanDecisions.ids(a,"first"))for(int i=0;i<descriptors.size();i++)if(id.equals(descriptors.get(i).get("id")))result.add(list.get(i));return result;}
  @Override public List<AbilitySub> chooseModeForAbility(SpellAbility sa,List<AbilitySub> modes,int min,int max,boolean repeat){var options=new ArrayList<Map<String,Object>>();for(int i=0;i<modes.size();i++)options.add(Map.of("id","mode:"+i,"name",modes.get(i).getDescription(),"kind","mode"));var a=HumanDecisions.ask(who(),"modes","Modus wählen",source(sa),min,max,repeat,options);var result=new ArrayList<AbilitySub>();for(var key:HumanDecisions.ids(a,"first"))result.add(modes.get(Integer.parseInt(key.substring(5))));return result;}
  @Override public boolean chooseTargetsFor(SpellAbility sa){var options=targets(sa);for(var p:game.getPlayers())if(sa.canTarget(p))options.add(Map.of("id","player:"+seat(p),"name",p.getName(),"kind","player"));if(options.size()<sa.getMinTargets())return false;var a=HumanDecisions.ask(who(),"targets","Ziele wählen",source(sa),sa.getMinTargets(),Math.min(sa.getMaxTargets(),options.size()),false,options);sa.resetTargets();for(var key:HumanDecisions.ids(a,"first")){if(key.startsWith("stack:"))sa.getTargets().add(stackTarget(key).getSpellAbility());else if(key.startsWith("player:"))sa.getTargets().add(player(Integer.parseInt(key.substring(7))));else sa.getTargets().add(card(key));}return sa.isTargetNumberValid();}
  @Override public List<SpellAbility> orderSimultaneousSa(List<SpellAbility> abilities){if(abilities.size()<2)return abilities;boolean identicalLife=abilities.stream().allMatch(a->(a.getHostCard().getName().equals("Soul Warden")||a.getHostCard().getName().equals("Soul's Attendant"))&&a.getHostCard()==abilities.get(0).getHostCard());if(identicalLife)return abilities;var options=new ArrayList<Map<String,Object>>();for(int i=0;i<abilities.size();i++)options.add(Map.of("id","ability:"+i,"name",abilities.get(i).toString(),"kind","ability"));var a=HumanDecisions.ask(who(),"order","Trigger-Reihenfolge · zuerst gelegt liegt unten","",abilities.size(),abilities.size(),false,options);var result=new ArrayList<SpellAbility>();for(var key:HumanDecisions.ids(a,"first"))result.add(abilities.get(Integer.parseInt(key.substring(8))));return result;}
  boolean prepare(SpellAbility sa){if(sa.getApi()==ApiType.Charm&&!CharmEffect.makeChoices(sa))return false;for(SpellAbility current=sa;current!=null;current=current.getSubAbility()){if(current.getActivatingPlayer()==null)current.setActivatingPlayer(sa.getActivatingPlayer());if(current.usesTargeting()&&!chooseTargetsFor(current))return false;}return true;}
  @Override public void orderAndPlaySimultaneousSa(List<SpellAbility> abilities){for(var sa:orderSimultaneousSa(abilities)){if(sa.isTrigger()&&!sa.isCopied()){if(prepare(sa))ComputerUtil.playStack(sa,getPlayer(),game);}else{if(sa.isCopied()&&sa.isSpell()){if(!sa.getHostCard().isInZone(ZoneType.Stack))sa.setHostCard(game.getAction().moveToStack(sa.getHostCard(),sa));else game.getStackZone().add(sa.getHostCard());}if(sa.isMayChooseNewTargets()&&confirm("Neue Ziele wählen?",source(sa))&&!prepare(sa))continue;game.getStack().add(sa);}}}
  @Override public boolean playTrigger(Card host,WrappedAbility wrapper,boolean mandatory){var sa=wrapper.getWrappedAbility();if(sa.getApi()==ApiType.Charm&&!CharmEffect.makeChoices(sa))return false;for(SpellAbility current=sa;current!=null;current=current.getSubAbility())if(current.usesTargeting()&&!chooseTargetsFor(current))return false;return ComputerUtil.playNoStack(wrapper.getActivatingPlayer(),wrapper,getGame(),true);}
 }
 static class HumanLobby extends LobbyPlayerAi {HumanLobby(String name){super(name,null);}@Override public Player createIngamePlayer(Game g,int id){var p=new Player(getName(),g,id);p.setFirstController(new HumanFixtureController(p,this));return p;}}
 static final Set<String> SPELLS=Set.of("Grizzly Bears","Swords to Plowshares","Counterspell","Raise the Alarm","Divination","Preordain","Impulse","Innocent Blood","You Meet in a Tavern","Man-o'-War");
 static void require(boolean b,String message){if(!b)throw new IllegalArgumentException(message);}
 static Player player(int seat){require(seat==0||seat==1,"Unbekannter Sitz");return game.getPlayers().get(seat);}
 static int seat(Player p){return game.getPlayers().indexOf(p);}
 static String id(Card c){return Integer.toString(c.getId());}
 static Card add(Player p,String name,ZoneType zone){var paper=StaticData.instance().getCommonCards().getCard(name);require(paper!=null,"Karte fehlt in Forge");var c=Card.fromPaperCard(paper,p);p.getZone(zone).add(c);return c;}
 static void init(boolean decisions){
  var registered=new ArrayList<RegisteredPlayer>();for(int i=0;i<2;i++){var rp=new RegisteredPlayer(new Deck("Integrationstest"));rp.setPlayer(new HumanLobby("Spieler "+(i+1)));registered.add(rp);}
  game=new Match(new GameRules(GameType.Constructed),registered,"BatusMTG Forge Test").createGame();game.setNoGUIUser();game.setAge(GameStage.Play);game.getPhaseHandler().devModeSet(PhaseType.MAIN1,player(0),1);
  for(int i=0;i<2;i++){var p=player(i);p.setLife(40,null);for(var n:List.of("Forest","Forest","Island","Island","Plains","Plains"))add(p,n,ZoneType.Battlefield);add(p,"Grizzly Bears",ZoneType.Battlefield);add(p,decisions?"Soul's Attendant":"Soul Warden",ZoneType.Battlefield);if(decisions){add(p,"Swamp",ZoneType.Battlefield);add(p,"Swamp",ZoneType.Battlefield);}for(var n:decisions?List.of("Preordain","Impulse","Innocent Blood","You Meet in a Tavern","Raise the Alarm","Man-o'-War"):List.of("Forest","Grizzly Bears","Swords to Plowshares","Counterspell","Raise the Alarm","Divination"))add(p,n,ZoneType.Hand);for(int j=0;j<12;j++)add(p,j%2==0?"Forest":"Island",ZoneType.Library);}
  game.getAction().checkStaticAbilities(false);game.copyLastState();log.add("Zwei Spieler · Automatik-Testtisch");
 }
 static Card card(String id){return game.getCardsInGame().stream().filter(c->id(c).equals(id)).findFirst().orElseThrow(()->new IllegalArgumentException("Karte nicht gefunden"));}
 static SpellAbility spell(Card c,Player p){var sa=c.getSpellAbilities().stream().filter(s->s.isSpell()).findFirst().orElseThrow(()->new IllegalArgumentException("Kein Spruch"));sa.setActivatingPlayer(p);return sa;}
 static Map<String,Object> target(Card c){return Map.of("id",id(c),"name",c.getName(),"kind","card");}
 static List<Map<String,Object>> targets(SpellAbility sa){var result=new ArrayList<Map<String,Object>>();if(!sa.usesTargeting())return result;for(var c:game.getCardsInGame())if(c.isInZone(ZoneType.Battlefield)&&sa.canTarget(c))result.add(target(c));for(var si:game.getStack())if(sa.canTarget(si.getSpellAbility()))result.add(Map.of("id","stack:"+si.getId(),"name",si.getSpellAbility().getHostCard().getName(),"kind","stack"));return result;}
 static SpellAbilityStackInstance stackTarget(String id){for(var si:game.getStack())if(("stack:"+si.getId()).equals(id))return si;throw new IllegalArgumentException("Stack-Ziel fehlt");}
 static void cast(int who,String cardId,String targetId){
  require(choice==null,"Bitte zuerst Karten zum Abwerfen wählen");require(who==priority,"Der andere Spieler hat Priorität");var p=player(who);var c=card(cardId);require(c.getController()==p&&c.isInZone(ZoneType.Hand),"Nur eigene Handkarten wirken");require(SPELLS.contains(c.getName()),"Diese Karte ist noch nicht im Testumfang");var sa=spell(c,p);
  require(sa.canPlay(),"Dieser Spruch ist hier nicht legal");require(ComputerUtilCost.canPayCost(sa,p,false),"Nicht genügend Mana");
  if(sa.getApi()==ApiType.Charm)require(CharmEffect.makeChoices(sa),"Kein gültiger Modus");
  for(SpellAbility sub=sa.getSubAbility();sub!=null;sub=sub.getSubAbility())if(sub.usesTargeting())require(sub.getActivatingPlayer().getController().chooseTargetsFor(sub),"Keine gültigen Ziele");
  if(sa.usesTargeting()){
   require(targetId!=null,"Wähle ein Ziel");sa.resetTargets();if(targetId.startsWith("stack:")){var target=stackTarget(targetId);require(sa.canTarget(target.getSpellAbility()),"Ungültiges Ziel");sa.getTargets().add(target.getSpellAbility());}
   else{var t=card(targetId);require(sa.canTarget(t),"Ungültiges Ziel");sa.getTargets().add(t);}require(sa.isTargetNumberValid(),"Zielanzahl ist ungültig");
  }else require(targetId==null,"Dieser Spruch hat kein Ziel");
  require(ComputerUtil.playStack(sa,p,game),"Kosten konnten nicht bezahlt werden");passes=0;priority=1-who;game.getPhaseHandler().setPriority(player(priority));game.getAction().checkStateEffects(false);game.getTriggerHandler().runWaitingTriggers();game.getStack().addAllTriggeredAbilitiesToStack();log.add("Spieler "+(who+1)+" wirkt "+c.getName());
 }
 static void settle(){game.getAction().checkStateEffects(false);game.getTriggerHandler().runWaitingTriggers();game.getStack().addAllTriggeredAbilitiesToStack();active=seat(game.getPhaseHandler().getPlayerTurn());turn=game.getPhaseHandler().getTurn();priority=active;game.getPhaseHandler().setPriority(player(priority));}
 // Forge 2.0.15 has no public single-phase API. This pinned adapter calls the
 // same three hooks as mainLoopStep, never devModeSet after initial setup.
 static void phaseStep(){
  require(game.getStack().isEmpty(),"Stack zuerst verrechnen");var handler=game.getPhaseHandler();
  try{for(var name:List.of("onPhaseEnd","advanceToNextPhase","onPhaseBegin")){var method=handler.getClass().getDeclaredMethod(name);method.setAccessible(true);method.invoke(handler);}}catch(Exception e){throw new IllegalStateException("Forge-Phasenadapter fehlgeschlagen",e);}
  settle();
 }
 static boolean requestDiscard(){var p=player(active);int count=p.isUnlimitedHandSize()?0:Math.max(0,p.getCardsIn(ZoneType.Hand).size()-p.getMaxHandSize());if(count==0||discardSelection!=null)return false;choice=Map.of("id",UUID.randomUUID().toString(),"seat",active,"kind","discard","count",count,"options",p.getCardsIn(ZoneType.Hand).stream().map(BatusForge::target).toList());return true;}
 static void continueTurn(){
  for(int steps=0;steps<30;steps++){
   var phase=game.getPhaseHandler().getPhase();if(!game.getStack().isEmpty())return;
   if(phase==PhaseType.END_OF_TURN&&requestDiscard())return;
   phaseStep();phase=game.getPhaseHandler().getPhase();
   if(phase==PhaseType.MAIN1){ending=false;log.add("Zug "+turn+" · Spieler "+(active+1));return;}
   if(!game.getStack().isEmpty())return;
  }throw new IllegalStateException("Zu viele Phasenübergänge");
 }
 static void approachEnd(){for(int steps=0;steps<20;steps++){if(game.getPhaseHandler().getPhase()==PhaseType.END_OF_TURN){endWindow=true;return;}if(!game.getStack().isEmpty())return;phaseStep();}throw new IllegalStateException("Zugende nicht erreicht");}
 static void endTurn(int who){require(choice==null,"Abwerfen zuerst wählen");require(!ending&&who==active&&who==priority,"Nur der aktive Spieler mit Priorität kann den Zug beenden");require(game.getStack().isEmpty(),"Stack zuerst verrechnen");ending=true;endWindow=false;passes=0;approachEnd();log.add("Zugende · Reaktionen möglich");}
 static void discard(int who,JsonObject action){require(choice!=null&&who==(int)choice.get("seat"),"Du hast keine Abwerfentscheidung");require(action.get("choiceId").getAsString().equals(choice.get("id")),"Entscheidung nicht mehr aktuell");var ids=new HashSet<String>();var chosen=new CardCollection();for(var entry:action.getAsJsonArray("cardIds")){var key=entry.getAsString();require(ids.add(key),"Eine Karte wurde doppelt gewählt");var c=card(key);require(c.getOwner()==player(who)&&c.isInZone(ZoneType.Hand),"Nur eigene Handkarten abwerfen");chosen.add(c);}require(chosen.size()==(int)choice.get("count"),"Falsche Anzahl Karten");discardSelection=chosen;choice=null;continueTurn();}
 static void land(int who,String cardId){require(choice==null&&who==priority,"Du hast keine Priorität");var p=player(who);var c=card(cardId);require(c.getOwner()==p&&c.isInZone(ZoneType.Hand)&&c.isLand(),"Nur eigene Länder aus der Hand spielen");var sa=c.getSpellAbilities().stream().filter(a->a.isLandAbility()).findFirst().orElseThrow();sa.setActivatingPlayer(p);require(p.canPlayLand(c,false,sa),"Hier kann kein weiteres Land gespielt werden");p.playLand(c,sa);passes=0;settle();log.add("Spieler "+(who+1)+" spielt "+c.getName());}
 static void pass(int who){require(choice==null,"Bitte zuerst abwerfen");require(who==priority,"Der andere Spieler hat Priorität");passes++;if(passes==2){passes=0;if(!game.getStack().isEmpty()){var label=game.getStack().peekAbility().getHostCard().getName();resolvingSource=label;try{game.getStack().resolveStack();}finally{resolvingSource="";}settle();log.add(label+" verrechnet");if(ending&&game.getStack().isEmpty()){if(!endWindow)approachEnd();else if(game.getPhaseHandler().getPhase()!=PhaseType.END_OF_TURN)continueTurn();}}else if(ending){if(!endWindow)approachEnd();else continueTurn();}priority=active;}else priority=1-who;game.getPhaseHandler().setPriority(player(priority));}
 static Map<String,Object> state(){
  var cards=new ArrayList<Map<String,Object>>();for(var c:game.getCardsInGame()){
   if(c.getZone()==null)continue;var d=new LinkedHashMap<String,Object>();d.put("id",id(c));d.put("name",c.getName());d.put("owner",seat(c.getOwner()));d.put("controller",seat(c.getController()));d.put("zone",c.getZone().getZoneType().name().toLowerCase());d.put("tapped",c.isTapped());d.put("token",c.isToken());d.put("type",c.getType().toString());if(c.isCreature()){d.put("power",c.getNetPower());d.put("toughness",c.getNetToughness());}
   if(c.isInZone(ZoneType.Hand)&&c.isLand()){var sa=c.getSpellAbilities().stream().filter(a->a.isLandAbility()).findFirst().orElse(null);d.put("playable",choice==null&&seat(c.getOwner())==priority&&sa!=null&&c.getOwner().canPlayLand(c,false,sa));}
   if(c.isInZone(ZoneType.Hand)&&SPELLS.contains(c.getName())){var sa=spell(c,c.getController());d.put("targetRequired",sa.usesTargeting());d.put("targets",targets(sa));d.put("playable",choice==null&&seat(c.getController())==priority&&sa.canPlay()&&ComputerUtilCost.canPayCost(sa,c.getController(),false));}cards.add(d);
  }
  var stack=new ArrayList<Map<String,Object>>();for(var si:game.getStack()){var sa=si.getSpellAbility();stack.add(Map.of("id","stack:"+si.getId(),"name",sa.getHostCard().getName(),"controller",seat(sa.getActivatingPlayer()),"description",sa.toString()));}
  var result=new LinkedHashMap<String,Object>();result.put("phase",game.getPhaseHandler().getPhase().name());result.put("ending",ending);result.put("choice",choice);result.putAll(Map.of("cards",cards,"stack",stack,"life",List.of(player(0).getLife(),player(1).getLife()),"active",active,"priority",priority,"passes",passes,"turn",turn,"log",new ArrayList<>(log.subList(Math.max(0,log.size()-20),log.size()))));return result;
 }
 static void action(JsonObject request){int who=request.get("seat").getAsInt();var a=request.getAsJsonObject("action");switch(a.get("type").getAsString()){
  case "cast":cast(who,a.get("cardId").getAsString(),a.has("targetId")?a.get("targetId").getAsString():null);break;
  case "pass":pass(who);break;
  case "endTurn":endTurn(who);break;
  case "land":land(who,a.get("cardId").getAsString());break;
  case "discard":discard(who,a);break;
  default:throw new IllegalArgumentException("Diese Aktion ist noch nicht im Forge-Test verfügbar");
 }}
 static PrintStream protocol;static String requestId;static boolean responded;static AtomicBoolean busy=new AtomicBoolean();
 static synchronized void emit(Map<String,Object> data){protocol.println("@@BATUSFORGE@@"+JSON.toJson(data));protocol.flush();}
 static void publishPause(){var frame=new LinkedHashMap<String,Object>();frame.put("state",state());if(!responded){frame.put("id",requestId);frame.put("ok",true);frame.put("paused",true);responded=true;}else frame.put("update",true);emit(frame);}
 public static void main(String[] args)throws Exception{
  protocol=new PrintStream(new FileOutputStream(FileDescriptor.out),true,StandardCharsets.UTF_8);System.setOut(System.err);GuiBase.setInterface(new GuiDesktop());FModel.initialize(null,null);init(Arrays.asList(args).contains("--decisions"));
  emit(Map.of("ready",true,"state",state()));var executor=Executors.newSingleThreadExecutor();
  try(var input=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8))){String line;while((line=input.readLine())!=null){JsonObject r;try{r=JsonParser.parseString(line).getAsJsonObject();}catch(Exception e){continue;}var id=r.get("id").getAsString();var a=r.getAsJsonObject("action");
   if(a.get("type").getAsString().equals("choose")){try{HumanDecisions.answer(r.get("seat").getAsInt(),a);emit(Map.of("id",id,"ok",true,"accepted",true));}catch(Exception e){emit(Map.of("id",id,"ok",false,"error",e.getMessage()));}continue;}
   if(!busy.compareAndSet(false,true)){emit(Map.of("id",id,"ok",false,"error","Bitte zuerst die laufende Entscheidung beantworten"));continue;}
   final JsonObject request=r;executor.submit(()->{requestId=id;responded=false;String error=null;try{action(request);}catch(Exception e){error=e.getMessage()==null?"Forge-Aktion fehlgeschlagen":e.getMessage();}var reply=new LinkedHashMap<String,Object>();reply.put("state",state());busy.set(false);if(responded){reply.put("update",true);if(error!=null)reply.put("error",error);}else{reply.put("id",id);reply.put("ok",error==null);if(error!=null)reply.put("error",error);}emit(reply);});
  }}executor.shutdownNow();System.exit(0);
 }
}
