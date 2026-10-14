import {removePlayerObjects} from './player-exit.ts';
import {cleanTableTools} from './table-tools.ts';
import {recordEffectLink,resolvingSource} from './effect-links.ts';
import {landPlayAllowance} from './land-plays.ts';
import {instanceDefinition} from './card-state.ts';
import {markedStats} from './counters.ts';
import {enterZone,freePosition,cleanAttachments} from './placement.ts';
import {poolPayment,manualCastPaymentReason} from './mana-payment.ts';
import {automaticManaPlan} from './auto-mana.ts';
import {catalogueById} from './catalogue.ts';
import type {CardInstance,GameAction,GameState,Zone} from './game.ts';
import type {LibraryEffect,PendingChoice,RulesState,StackItem} from './rules-types.ts';
import {effectKinds} from './rules-types.ts';
import {manaTotal} from './mana.ts';

export const turnSteps=['Enttappen','Versorgung','Ziehen','Hauptphase','Kampfbeginn','Angreifer','Blocker','Kampfschaden','Kampfende','Hauptphase II','Ende','Aufräumen'];
const data=instanceDefinition;
const rules=(s:GameState)=>s.rules!;
const library=(s:GameState,id:string)=>s.cards.filter(c=>c.ownerId===id&&c.zone==='library');
const hand=(s:GameState,id:string)=>s.cards.filter(c=>c.ownerId===id&&c.zone==='hand');
const alive=(s:GameState)=>s.players.filter(p=>!rules(s).lost.includes(p.id));
const name=(s:GameState,id:string)=>s.players.find(p=>p.id===id)?.name??id;
const log=(s:GameState,text:string)=>{s.log=[...s.log,text].slice(-60);};
const uid=(s:GameState)=>`rule-${++rules(s).sequence}`;
function assert(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(message);}
function integer(value:number){assert(Number.isInteger(value)&&value>=0&&value<=999,'Bitte eine ganze Zahl von 0 bis 999 eingeben');}

// Rejection sampling avoids modulo bias; the authoritative server is the only online caller.
function shuffle<T>(values:T[]):T[]{
  const result=[...values];const bytes=new Uint32Array(1);
  for(let i=result.length-1;i>0;i--){const limit=Math.floor(4294967296/(i+1))*(i+1);do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);const j=bytes[0]%(i+1);[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function orderLibrary(s:GameState,id:string,ordered:CardInstance[]){
  const ids=new Set(ordered.map(c=>c.id));s.cards=s.cards.filter(c=>!ids.has(c.id));
  ordered.forEach(c=>{delete c.effectLinks;c.zone='library';c.controllerId=c.ownerId;c.tapped=false;c.counters=0;c.markers={};c.customCounters=[];});s.cards.push(...ordered);
}
function move(s:GameState,c:CardInstance,zone:Zone){enterZone(s,c,zone);}
function draw(s:GameState,id:string,count:number){
  for(let i=0;i<count;i++){const c=library(s,id)[0];if(!c){if(!rules(s).failedDraw.includes(id))rules(s).failedDraw.push(id);break;}move(s,c,'hand');}
  log(s,`${name(s,id)} zieht ${count} Karte(n).`);
}
function priority(s:GameState,actor:string){
  const r=rules(s);assert(r.stage==='playing','Zuerst müssen alle ihre Starthand behalten');
  assert(!r.pending&&!r.resolving,'Die laufende Verrechnung / Auswahl zuerst abschließen');
  assert(!r.lost.includes(actor)&&r.priority===actor,'Du hast gerade keine Priorität');
}
function sorceryTiming(s:GameState,actor:string){assert(s.activePlayer===actor&&[3,9].includes(s.phase)&&!rules(s).stack.length,'Nur in deiner Hauptphase bei leerem Stack möglich');}
function setPriority(s:GameState){const r=rules(s);r.passes=[];r.priority=s.activePlayer;settle(s);}

// A bounded set of state-based actions, not a general continuous-effect/card-text engine.
export function settle(s:GameState){
  cleanTableTools(s);cleanAttachments(s);
  const r=s.rules;if(!r||r.pending||r.resolving||r.stage!=='playing')return;
  const defeated=s.players.filter(p=>!r.lost.includes(p.id)&&(p.life<=0||(p.counters?.poison??0)>=10||r.failedDraw.includes(p.id)||(p.commanderDamage??[]).some(d=>d.amount>=21)));
  for(const p of defeated){r.lost.push(p.id);log(s,`${p.name} scheidet aus.`);removePlayerObjects(s,p.id);r.passes=[];}
  cleanTableTools(s);cleanAttachments(s);
  s.tableTrackers=s.tableTrackers?.filter(t=>!r.lost.includes(t.ownerId));
  s.cards=s.cards.filter(c=>!c.token||['battlefield','stack'].includes(c.zone));
  if(alive(s).length<=1){r.stage='finished';r.priority='';return;}
  if(r.lost.includes(s.activePlayer)){
    emptyMana(s);
    const index=s.players.findIndex(p=>p.id===s.activePlayer);s.activePlayer=Array.from({length:s.players.length},(_,i)=>s.players[(index+i+1)%s.players.length]).find(p=>!r.lost.includes(p.id))!.id;s.phase=r.turnOnly?3:1;s.turn++;r.landPlays={};r.landBonus={};untap(s);
  }
  if(r.lost.includes(r.priority))r.priority=s.activePlayer;
}
function untap(s:GameState){s.cards.filter(c=>c.controllerId===s.activePlayer&&c.zone==='battlefield').forEach(c=>{const stun=c.markers?.stun??0;if(c.tapped&&stun>0)c.markers={...c.markers,stun:stun-1};else c.tapped=false;});}
export function enableRules(state:GameState,opening=false):GameState{
  const s=structuredClone(state);if(s.rules)return s;
  s.rules={version:1,stage:opening?'mulligan':'playing',priority:s.activePlayer,passes:[],kept:[],mulligans:{},landPlays:{},stack:[],pending:null,resolving:null,sequence:0,lost:[],failedDraw:[]};
  if(!opening&&s.phase===0){s.phase=s.rules.turnOnly?3:1;untap(s);}
  return s;
}
function addHideaway(s:GameState,c:CardInstance){const d=data(c);const escaped=d.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp(`(?:^|\\n)(?:${escaped}|This (?:land|creature|artifact)) enters(?: the battlefield)? tapped\\.`,'i').test(d.text))c.tapped=true;const match=d.text.match(/(?:^|\n)Hideaway(?:\s+(\d+))?/i);if(!match)return;const value=Number(match[1]??4);if(value<1||value>999)return;rules(s).stack.push({id:uid(s),kind:'ability',controllerId:c.controllerId,sourceCardId:c.id,label:`Hideaway ${value}`,effect:{kind:'hideaway',value,sourceCardId:c.id}});log(s,`${name(s,c.controllerId)}: Hideaway ${value} auf dem Stack.`);}
function finishResolution(s:GameState){const r=rules(s);const item=r.resolving;if(item?.continuation){delete item.continuation;pending(s,item.controllerId,'manual',s.cards.filter(c=>c.id===item.cardId),0,true);return;}if(item?.cardId){const c=s.cards.find(c=>c.id===item.cardId);if(c?.zone==='stack'){move(s,c,/Instant|Sorcery/.test(data(c).type)?'graveyard':'battlefield');if(!/Instant|Sorcery/.test(data(c).type))addHideaway(s,c);}}r.pending=null;r.resolving=null;setPriority(s);}
function pending(s:GameState,ownerId:string,kind:PendingChoice['kind'],cards:CardInstance[],value=0,isPublic=false,effect?:LibraryEffect){rules(s).pending={id:uid(s),ownerId,kind,cardIds:cards.map(c=>c.id),value,public:isPublic,effect};}
function legalSearch(c:CardInstance,filter:LibraryEffect['filter']){const type=data(c).type;return !filter||filter==='any'||(filter==='basic'?/\bBasic\b.*\bLand\b/.test(type):type.includes(filter==='land'?'Land':'Creature'));}
function validateEffect(effect:LibraryEffect){assert(effectKinds.includes(effect.kind),'Unbekannter Bibliothekseffekt');integer(effect.value);assert(!effect.destination||['hand','battlefield','library'].includes(effect.destination),'Ungültiges Ziel');assert(!effect.filter||['any','land','basic','creature'].includes(effect.filter),'Ungültiger Suchfilter');}
function perform(s:GameState,actor:string,effect:LibraryEffect){
  actor=effect.playerId??actor;assert(s.players.some(p=>p.id===actor),'Unbekannter ausführender Spieler');
  if(!alive(s).some(p=>p.id===actor)){log(s,'Die Bibliotheksaktion entfällt: Spieler bereits ausgeschieden.');finishResolution(s);return;}
  validateEffect(effect);const {kind,value}=effect;const cards=library(s,actor);
  if(kind==='draw'){draw(s,actor,value);finishResolution(s);return;}
  if(kind==='mill'){cards.slice(0,value).forEach(c=>{move(s,c,'graveyard');recordEffectLink(s,c,rules(s).resolving?.controllerId??actor,'Mill',effect.sourceCardId??resolvingSource(s));});log(s,`${name(s,actor)} millt ${Math.min(value,cards.length)} Karte(n).`);finishResolution(s);return;}
  if(kind==='discover'||kind==='cascade'){
    const exiled:CardInstance[]=[];let hit:CardInstance|undefined;
    for(const c of cards){move(s,c,'exile');recordEffectLink(s,c,actor,kind==='discover'?'Discover':'Cascade',effect.sourceCardId??resolvingSource(s));exiled.push(c);const d=data(c);if(!d.type.includes('Land')&&(kind==='discover'?d.manaValue<=value:d.manaValue<value)){hit=c;break;}}
    log(s,`${kind==='discover'?'Discover':'Cascade'} ${value}: ${exiled.length} Karte(n) ins Exil.`);
    if(!hit){orderLibrary(s,actor,[...library(s,actor),...shuffle(exiled)]);finishResolution(s);return;}
    pending(s,actor,kind,exiled,value,true,effect);rules(s).pending!.hitId=hit.id;return;
  }
  const selected=kind==='search'?cards:cards.slice(0,value);
  if(!selected.length){if(kind==='search'&&effect.shuffle)orderLibrary(s,actor,shuffle(cards));finishResolution(s);return;}
  pending(s,actor,kind,selected,value,kind==='reveal',effect);
}
function selectPlayFace(c:CardInstance,index=0){
  const d=catalogueById.get(c.cardId)!;assert(Number.isInteger(index)&&index>=0&&(index===0||d.layout==='modal_dfc'&&Boolean(d.faces[index])),'Diese Rückseite kann nicht aus der Hand gewirkt oder gespielt werden');c.faceIndex=index;
}
function cast(s:GameState,actor:string,c:CardInstance,targetId?:string,free=false){
  const d=data(c),r=rules(s);assert(!d.type.includes('Land'),'Länder werden gespielt, nicht gewirkt');
  assert(r.stack.length<200,'Zu viele Stack-Einträge');
  // Front faces are playable; alternate faces are not selected implicitly.
  const multi=d.faces.length>0;
  assert(!multi||Boolean(d.mana),'Diese Vorderseite hat keine bezahlbaren Manakosten');
  if(d.name==='Counterspell')assert(r.stack.some(item=>item.kind==='spell'&&item.id===targetId),'Wähle einen Spruch auf dem Stack als Ziel');
  if(d.name==='Swords to Plowshares')assert(s.cards.some(c=>c.id===targetId&&c.zone==='battlefield'&&data(c).type.includes('Creature')),'Wähle eine Kreatur als Ziel');
  if(c.isCommander&&c.zone==='commander')c.commanderCasts=(c.commanderCasts??0)+1;
  const faceIndex=c.faceIndex;move(s,c,'stack');c.controllerId=actor;c.baseControllerId=actor;c.faceIndex=faceIndex;const item:StackItem={id:uid(s),controllerId:actor,kind:'spell',cardId:c.id,label:d.name,manaValue:multi?(d.mana.match(/\{[^}]+\}/g)??[]).reduce((n,symbol)=>n+(/^\{\d+\}$/.test(symbol)?Number(symbol.slice(1,-1)):/^\{[XYZ]\}$/.test(symbol)?0:/^\{2\//.test(symbol)?2:1),0):d.manaValue,targetId,targetVersion:s.cards.find(c=>c.id===targetId)?.incarnation??0,free};r.stack.push(item);r.passes=[];
  log(s,`${name(s,actor)} wirkt ${d.name}${free?' ohne Manakosten':''}.`);
}
export function castLinkedSpellCopy(s:GameState,actor:string,original:CardInstance,targetId?:string){
 const r=rules(s);assert(/Instant|Sorcery/.test(data(original).type),'Eine Spontanzauber- oder Hexerei-Karte wählen');
 assert(r.pending?.kind==='manual'&&r.pending.ownerId===actor||!r.pending&&!r.resolving&&(r.priority===actor||r.turnOnly&&!r.stack.length),'Spruchkopie nur mit Priorität oder in eigener manueller Verrechnung wirken');
 const copy:CardInstance={id:`copy-${uid(s)}`,cardId:original.cardId,ownerId:actor,controllerId:actor,zone:'hand',token:true,isCommander:false,tapped:false,counters:0,position:{x:.5,y:.5},incarnation:0};
 s.cards.push(copy);cast(s,actor,copy,targetId,true);if(!r.pending&&!r.resolving)r.priority=actor;
}
function resolveTop(s:GameState){
  const r=rules(s),item=r.stack.pop()!;r.resolving=item;r.priority='';r.passes=[];
  if(item.effect){perform(s,item.controllerId,item.effect);return;}
  if(item.kind==='ability'){pending(s,item.controllerId,'manual',[],0,true);return;}
  const c=s.cards.find(c=>c.id===item.cardId);if(!c){finishResolution(s);return;}
  const d=data(c);log(s,`${item.label} wird verrechnet.`);
  if(d.name==='Counterspell'){
    const target=r.stack.find(i=>i.id===item.targetId&&i.kind==='spell');
    if(target){const targetCard=s.cards.find(c=>c.id===target.cardId);if(targetCard)move(s,targetCard,'graveyard');r.stack=r.stack.filter(i=>i.id!==target.id);log(s,`${target.label} wurde neutralisiert.`);}else log(s,'Das Ziel ist nicht mehr legal.');
    finishResolution(s);return;
  }
  if(d.name==='Swords to Plowshares'){
    const target=s.cards.find(c=>c.id===item.targetId&&(c.incarnation??0)===(item.targetVersion??0)&&c.zone==='battlefield'&&data(c).type.includes('Creature'));
    if(target){const value=markedStats(target,data(target).power,data(target).toughness).power;const power=value===null?NaN:Number(value);if(!Number.isFinite(power)){log(s,'Variable Stärke: Stärke bestimmen, Leben und Exil manuell ausführen.');pending(s,item.controllerId,'manual',[c],0,true);return;}const adjusted=Math.max(0,power);s.players.find(p=>p.id===target.controllerId)!.life+=adjusted;move(s,target,'exile');recordEffectLink(s,target,rules(s).resolving!.controllerId,'Swords to Plowshares',resolvingSource(s));}else log(s,'Das Ziel ist nicht mehr legal.');
    finishResolution(s);return;
  }
  if(!/Instant|Sorcery/.test(d.type)){finishResolution(s);return;}
  // Unknown text is explicit: its controller performs supported subeffects or manual table actions, then completes resolution.
  pending(s,item.controllerId,'manual',[c],0,true);
}
function emptyMana(s:GameState){
  for(const player of s.players){if(!player.retainMana&&manaTotal(player.mana)){player.mana={};log(s,`${player.name}: ungenutztes Mana verfällt beim Schrittwechsel.`);}}
}
function nextStep(s:GameState){
  const r=rules(s);emptyMana(s);s.phase++;
  if(s.phase===2)draw(s,s.activePlayer,1);
  if(s.phase===11){
    const excess=hand(s,s.activePlayer).length-7;
    if(excess>0){pending(s,s.activePlayer,'discard',hand(s,s.activePlayer),excess);r.priority='';return;}
    newTurn(s);return;
  }
  log(s,turnSteps[s.phase]);setPriority(s);
}
function newTurn(s:GameState){
  emptyMana(s);
  const r=rules(s),players=alive(s),index=players.findIndex(p=>p.id===s.activePlayer);s.activePlayer=players[(index+1)%players.length].id;s.turn++;s.phase=r.turnOnly?3:1;r.landPlays={};r.landBonus={};untap(s);if(r.turnOnly)draw(s,s.activePlayer,1);log(s,`${name(s,s.activePlayer)}: Zug ${s.turn}.`);setPriority(s);
}
function exactPartition(p:PendingChoice,first:string[],second:string[]){const all=[...first,...second];assert(all.length===p.cardIds.length&&new Set(all).size===all.length&&all.every(id=>p.cardIds.includes(id)),'Jede betrachtete Karte muss genau einmal einsortiert sein');}
function choose(s:GameState,actor:string,action:Extract<GameAction,{type:'choose'}>){
  const r=rules(s),p=r.pending;assert(p&&p.id===action.choiceId&&p.ownerId===actor,'Diese Auswahl ist nicht mehr offen oder gehört einem anderen Spieler');
  const selected=action.first.map(id=>s.cards.find(c=>c.id===id)!);
  if(p.kind==='discover'||p.kind==='cascade'){
    const hit=s.cards.find(c=>c.id===p.hitId)!;assert(hit?.zone==='exile','Der Treffer liegt nicht mehr im Exil');
    assert(action.decision==='cast'||(p.kind==='discover'?action.decision==='hand':action.decision==='decline'),'Wähle Wirken oder die angebotene Alternative');
    if(action.decision==='cast'){assert(action.costsPaid===true,'Zusätzliche Kosten und Ziele zuerst bestätigen');const mv=data(hit).manaValue;assert(p.kind==='discover'?mv<=p.value:mv<p.value,'Der gewirkte Spruch erfüllt den Manawert nicht');cast(s,actor,hit,action.targetId,true);}
    if(action.decision==='hand')move(s,hit,'hand');
    const rest=s.cards.filter(c=>p.cardIds.includes(c.id)&&c.zone==='exile');orderLibrary(s,actor,[...library(s,actor),...shuffle(rest)]);finishResolution(s);return;
  }
  if(p.kind==='manual'){assert(action.decision==='done','Effektabschluss bestätigen');finishResolution(s);return;}
  if(p.kind==='hideaway'){
    assert(action.first.length===1&&p.cardIds.includes(action.first[0]),'Eine betrachtete Karte für Hideaway wählen');
    const hidden=selected[0];assert(hidden.zone==='library'&&hidden.ownerId===actor,'Hideaway-Karte liegt nicht mehr in deiner Bibliothek');
    move(s,hidden,'exile');hidden.faceDown=true;hidden.hiddenFor=[actor];hidden.hideawaySource=p.effect?.sourceCardId;recordEffectLink(s,hidden,actor,'Hideaway',p.effect?.sourceCardId??resolvingSource(s));
    const rest=p.cardIds.filter(id=>id!==hidden.id).map(id=>s.cards.find(c=>c.id===id)!).filter(c=>c.zone==='library');const restIds=new Set(rest.map(c=>c.id));
    orderLibrary(s,actor,[...library(s,actor).filter(c=>!restIds.has(c.id)),...shuffle(rest)]);log(s,`${name(s,actor)} legt eine Hideaway-Karte verdeckt ins Exil.`);finishResolution(s);return;
  }
  if(p.kind==='search'){
    assert(new Set(action.first).size===action.first.length&&action.first.every(id=>p.cardIds.includes(id)),'Ungültige Suchauswahl');
    assert(action.first.length<=p.value&&selected.every(c=>legalSearch(c,p.effect?.filter)),'Die Auswahl passt nicht zur Suche');
    if((p.effect?.filter??'any')==='any')assert(selected.length===Math.min(p.value,p.cardIds.length),'Bei einer Suche ohne Merkmal die geforderte Anzahl auswählen');
    const destination=p.effect?.destination??'hand';selected.forEach(c=>{move(s,c,destination);if(destination==='battlefield')c.tapped=p.effect?.tapped??false;});
    let rest=library(s,actor).filter(c=>!action.first.includes(c.id));if(p.effect?.shuffle)rest=shuffle(rest);
    orderLibrary(s,actor,destination==='library'?[...selected,...rest]:rest);
    if(p.effect?.reveal)log(s,`${name(s,actor)} zeigt: ${selected.map(c=>data(c).name).join(', ')||'keine Karte'}.`);else log(s,`${name(s,actor)} findet ${selected.length} Karte(n).`);
    finishResolution(s);return;
  }
  exactPartition(p,action.first,action.second);
  const second=action.second.map(id=>s.cards.find(c=>c.id===id)!);
  if(p.kind==='discard'){assert(selected.length===p.value,'Die genaue Anzahl Karten zum Abwerfen wählen');selected.forEach(c=>move(s,c,'graveyard'));r.pending=null;newTurn(s);return;}
  if(p.kind==='reveal'||p.kind==='look'){assert(action.first.join('|')===p.cardIds.join('|')&&!action.second.length,'Betrachtete Karten bleiben in ihrer Reihenfolge');finishResolution(s);return;}
  const rest=library(s,actor).filter(c=>!p.cardIds.includes(c.id));
  if(p.kind==='surveil')second.forEach(c=>{move(s,c,'graveyard');recordEffectLink(s,c,actor,'Surveil',p.effect?.sourceCardId??resolvingSource(s));});
  orderLibrary(s,actor,[...selected,...rest,...(p.kind==='scry'?second:[])]);
  log(s,`${name(s,actor)} beendet ${p.kind==='scry'?'Scry':'Surveil'} ${p.value}.`);finishResolution(s);
}

export const rulesActionTypes=['setLandBonus','castHidden','endTurn','concede','mulligan','keep','pass','shuffle','cast','effect','ability','choose','resolveEffect','counterStack','lateCast','lateAbility','withdrawStack','resolveSwords'] as const;
export function applyRulesAction(state:GameState,actor:string,action:GameAction):GameState{
  const s=structuredClone(state),r=rules(s);assert(r,'Regel-Engine ist nicht aktiv');assert(s.players.some(p=>p.id===actor)&&!r.lost.includes(actor),'Kein aktiver Spieler');
  if(action.type==='setLandBonus'){
    assert(r.stage==='playing'&&s.activePlayer===actor,'Zusätzliche Landspiele nur für deinen aktuellen Zug freigeben');
    assert(!r.pending&&!r.resolving||r.pending?.kind==='manual'&&r.pending.ownerId===actor,'Zuerst die laufende Auswahl abschließen');
    assert(Number.isInteger(action.count)&&action.count>=0&&action.count<=998,'Zusätzliche Landspiele: ganze Zahl von 0 bis 998');
    r.landBonus={...r.landBonus,[actor]:action.count};log(s,`${name(s,actor)}: ${action.count} zusätzliche Landspiele für diesen Zug (manuell).`);return s;
  }
  if(action.type==='endTurn'){
    assert(r.turnOnly&&r.stage==='playing'&&s.activePlayer===actor,'Nur der Spieler am Zug kann den Zug abgeben');assert(!r.stack.length&&!r.pending&&!r.resolving,'Zuerst Stack und Auswahl abschließen');newTurn(s);return s;
  }
  if(action.type==='concede'){
    assert(r.stage!=='finished','Die Partie ist bereits beendet');
    r.lost.push(actor);s.tableTrackers=s.tableTrackers?.filter(t=>t.ownerId!==actor);log(s,`${name(s,actor)} gibt auf.`);r.passes=[];
    removePlayerObjects(s,actor);
    r.stack=r.stack.filter(i=>i.controllerId!==actor);
    if(r.resolving?.controllerId===actor){r.resolving=null;r.pending=null;}
    else if(r.pending?.ownerId===actor){r.pending=null;if(r.resolving){delete r.resolving.continuation;finishResolution(s);}}
    if(r.pending)r.pending.cardIds=r.pending.cardIds.filter(id=>s.cards.some(c=>c.id===id));
    cleanTableTools(s);cleanAttachments(s);
    const remaining=alive(s);
    if(remaining.length<=1){r.stage='finished';r.priority='';r.pending=null;r.resolving=null;r.stack=[];return s;}
    if(r.lost.includes(s.activePlayer)){
      const index=s.players.findIndex(p=>p.id===s.activePlayer);
      s.activePlayer=Array.from({length:s.players.length},(_,i)=>s.players[(index+i+1)%s.players.length]).find(p=>!r.lost.includes(p.id))!.id;
      if(r.stage==='playing'){emptyMana(s);s.phase=r.turnOnly?3:1;s.turn++;r.landPlays={};r.landBonus={};untap(s);}
    }
    if(!r.pending&&!r.resolving&&(!r.priority||r.lost.includes(r.priority)))r.priority=s.activePlayer;
    if(r.stage==='mulligan'&&remaining.every(p=>r.kept.includes(p.id))){r.stage='playing';s.phase=r.turnOnly?3:1;untap(s);if(r.turnOnly)draw(s,s.activePlayer,1);setPriority(s);}
    settle(s);return s;
  }
  if(action.type==='lateCast'||action.type==='lateAbility'||action.type==='withdrawStack'){
    assert(r.stage==='playing'&&!r.pending&&!r.resolving,'Korrekturen erst nach der laufenden Auswahl oder Verrechnung ausführen');
    const reason=action.reason?.trim();assert(reason&&reason.length>=3&&reason.length<=160,'Korrektur mit 3–160 Zeichen begründen');
    r.priority=actor;r.passes=[];
    if(action.type==='lateCast'){
      const card=s.cards.find(c=>c.id===action.cardId);assert(card&&card.ownerId===actor&&card.controllerId===actor&&(card.zone==='hand'||card.zone==='commander'&&card.isCommander),'Spruch aus eigener Hand oder Kommandozone nachholen');assert(action.costsPaid===true,'Kosten und Ziele zuerst bestätigen');cast(s,actor,card,action.targetId);log(s,`KORREKTUR · ${name(s,actor)} holt einen Spruch nach · ${reason}`);return s;
    }
    if(action.type==='withdrawStack'){
      const item=r.stack.find(item=>item.id===action.stackId&&item.controllerId===actor);assert(item,'Nur eigene offene Stack-Objekte zurücknehmen');
      if(item.cardId){const card=s.cards.find(c=>c.id===item.cardId);if(card?.zone==='stack')move(s,card,card.isCommander?'commander':'hand');}
      r.stack=r.stack.filter(i=>i.id!==item.id);log(s,`KORREKTUR · ${name(s,actor)} nimmt ${item.label} zurück (Kosten / Commander-Tax bei Bedarf manuell korrigieren) · ${reason}`);return s;
    }
    const next=applyRulesAction(s,actor,{type:'ability',label:action.label,sourceCardId:action.sourceCardId,abilityType:action.abilityType});log(next,`KORREKTUR · ${name(next,actor)} holt eine Fähigkeit nach · ${reason}`);return next;
  }
  if(action.type==='mulligan'||action.type==='keep'){
    assert(r.stage==='mulligan'&&!r.kept.includes(actor),'Deine Starthand wurde bereits behalten');
    if(action.type==='mulligan'){const all=[...library(s,actor),...hand(s,actor)];assert(all.length>=7,'Nicht genügend Karten für sieben neue Handkarten');orderLibrary(s,actor,shuffle(all));library(s,actor).slice(0,7).forEach(c=>move(s,c,'hand'));r.mulligans[actor]=(r.mulligans[actor]??0)+1;log(s,`${name(s,actor)} nimmt einen kostenlosen Mulligan auf sieben.`);}
    else{r.kept.push(actor);log(s,`${name(s,actor)} behält sieben Karten.`);if(alive(s).every(p=>r.kept.includes(p.id))){r.stage='playing';s.phase=r.turnOnly?3:1;untap(s);if(r.turnOnly)draw(s,s.activePlayer,1);setPriority(s);}}
    return s;
  }
  if(action.type==='choose'){choose(s,actor,action);return s;}
  if(action.type==='resolveSwords'){
    const item=r.resolving,p=r.pending,source=s.cards.find(c=>c.id===item?.cardId);
    assert(p?.id===action.choiceId&&p.kind==='manual'&&p.ownerId===actor&&source&&data(source).name==='Swords to Plowshares','Kein eigener Swords-Effekt in Verrechnung');
    assert(Number.isInteger(action.power)&&Math.abs(action.power)<=999,'Aktuelle Stärke als ganze Zahl von −999 bis 999 angeben');
    const target=s.cards.find(c=>c.id===item!.targetId&&(c.incarnation??0)===(item!.targetVersion??0)&&c.zone==='battlefield'&&data(c).type.includes('Creature'));
    if(target){const amount=Math.max(0,action.power);s.players.find(p=>p.id===target.controllerId)!.life+=amount;move(s,target,'exile');recordEffectLink(s,target,rules(s).resolving!.controllerId,'Swords to Plowshares',resolvingSource(s));log(s,`${name(s,actor)} bestätigt aktuelle Stärke ${action.power}: ${amount} Leben, Ziel im Exil.`);}else log(s,'Das Swords-Ziel ist nicht mehr legal.');
    finishResolution(s);return s;
  }
  if(action.type==='counterStack'){
    const p=r.pending;assert(p?.id===action.choiceId&&p.kind==='manual'&&p.ownerId===actor&&r.resolving,'Nur während deiner manuellen Verrechnung möglich');
    const target=r.stack.find(item=>item.id===action.stackId);assert(target,'Das Stack-Ziel ist nicht mehr vorhanden');
    if(target.cardId){const card=s.cards.find(c=>c.id===target.cardId);if(card?.zone==='stack')move(s,card,'graveyard');}
    r.stack=r.stack.filter(item=>item.id!==target.id);log(s,`${name(s,actor)} neutralisiert ${target.label} (Karteneffekt manuell bestätigt).`);return s;
  }
  if(action.type==='resolveEffect'){
    const p=r.pending;assert(p&&p.kind==='manual'&&p.id===action.choiceId&&p.ownerId===actor,'Kein eigener Effekt in Verrechnung');
    // A continuation returns to the same manual resolution after each subeffect.
    const original=r.resolving!;r.resolving={...original,continuation:true};
    perform(s,actor,action.effect);return s;
  }
  if(action.type==='move'&&action.zone==='battlefield')assert(r.priority===actor,'Land spielen benötigt deine Priorität');
  if(r.turnOnly&&!r.stack.length&&!r.pending&&!r.resolving&&!['pass','nextPhase'].includes(action.type))r.priority=actor;
  priority(s,actor);
  if(action.type==='pass'||action.type==='nextPhase'){
    r.passes.push(actor);const players=alive(s);
    if(r.passes.length===players.length){if(r.stack.length)resolveTop(s);else if(r.turnOnly)setPriority(s);else nextStep(s);}
    else r.priority=players[(players.findIndex(p=>p.id===actor)+1)%players.length].id;
  }else if(action.type==='castHidden'){
    const c=s.cards.find(c=>c.id===action.cardId);assert(c&&c.zone==='exile'&&c.faceDown&&c.hiddenFor?.includes(actor),'Keine spielberechtigte verdeckte Exilkarte');const stolen=c.exilePlayer===actor;if(stolen&&!data(c).type.includes('Instant')&&!/(^|\n)Flash\b/.test(data(c).text))sorceryTiming(s,actor);assert(action.conditionsMet===true&&action.costsPaid===true,'Bedingung und Zusatzkosten mit der Runde prüfen');
    if(data(c).type.includes('Land')){assert(s.activePlayer===actor&&landPlayAllowance(s,actor).remaining>0,'Hideaway-Land nur im eigenen Zug und mit freiem Landspiel');move(s,c,'battlefield');c.controllerId=actor;c.baseControllerId=actor;c.position=freePosition(s,c);r.landPlays[actor]=(r.landPlays[actor]??0)+1;addHideaway(s,c);}else cast(s,actor,c,action.targetId,!stolen);
  }else if(action.type==='cast'||action.type==='castCommander'){
    const c=s.cards.find(c=>c.id===action.cardId);assert(c&&c.ownerId===actor&&c.controllerId===actor,'Diese Karte gehört dir nicht');assert(c.zone==='hand'||(c.zone==='commander'&&c.isCommander),'Nur aus Hand oder Kommandozone wirken');
    if(action.type==='castCommander')assert(c.isCommander&&c.zone==='commander','Commander ist nicht in der Kommandozone');
    if(action.type==='cast')assert(action.costsPaid===true,'Kosten zuerst bestätigen');
    selectPlayFace(c,action.type==='cast'?action.faceIndex:0);
    const d=data(c);if(!d.type.includes('Instant')&&!/(^|\n)Flash\b/.test(d.text))sorceryTiming(s,actor);
    const paymentRestriction=manualCastPaymentReason(d);
    assert(action.type==='cast'&&action.manualCostsConfirmed===true||!paymentRestriction,paymentRestriction??'Zahlungsart prüfen');
    if(action.type==='cast'&&action.autoTapSources!==undefined){
      assert(!action.manualCostsConfirmed&&!action.payFromPool,'Nur eine Zahlungsart wählen');
      if(action.manaSourceIds)assert(new Set(action.manaSourceIds).size===action.manaSourceIds.length&&action.manaSourceIds.every(id=>s.cards.some(source=>source.id===id&&source.controllerId===actor&&source.zone==='battlefield'&&!source.tapped&&!source.faceDown)),'Gewählte Manaquellen sind nicht mehr verfügbar');
      const plan=automaticManaPlan(s,actor,d.mana,c.zone==='commander'&&c.isCommander?2*(c.commanderCasts??0):0,action.manaSourceIds);
      assert(plan,'Keine automatische Bezahlung möglich; Sonderkosten manuell bezahlen');
      assert(plan.activations.length===action.autoTapSources.length&&plan.activations.every((a,i)=>a.sourceId===action.autoTapSources![i]),'Manaquellen haben sich geändert; Vorschau erneut prüfen');
      for(const activation of plan.activations){const source=s.cards.find(c=>c.id===activation.sourceId)!;source.tapped=true;log(s,`${name(s,actor)} tappt ${data(source).name} für Mana.`);}
      s.players.find(p=>p.id===actor)!.mana=plan.remaining;log(s,`${name(s,actor)} bezahlt automatisch.`);
    }else if(action.type==='cast'&&action.manualCostsConfirmed===true){
      assert(!action.payFromPool&&action.manaSourceIds===undefined,'Manuelle Bezahlung nicht mit einer Mana-Abbuchung kombinieren');
      log(s,`${name(s,actor)} bestätigt die manuelle Bezahlung von ${d.name} (Kosten und Sonderkosten am Tisch geprüft).`);
    }else{
      assert(action.type!=='cast'||action.manaSourceIds===undefined,'Manaquellen benötigen eine neue Bezahlungsvorschau');
      const player=s.players.find(p=>p.id===actor)!;
      const payment=poolPayment(d.mana,player.mana,c.zone==='commander'&&c.isCommander?2*(c.commanderCasts??0):0);
      assert(payment,'Mana-Pool reicht für diese Kosten nicht aus. Manaquellen wählen oder die manuelle Bezahlung ausdrücklich bestätigen.');
      for(const [color,n] of Object.entries(payment))player.mana={...player.mana,[color]:(player.mana?.[color as keyof typeof player.mana]??0)-n!};
      log(s,`${name(s,actor)} bezahlt aus dem Mana-Pool.`);
    }
    cast(s,actor,c,action.type==='cast'?action.targetId:undefined);
    if(action.type==='cast'&&action.passPriority){const players=alive(s);r.passes=[actor];r.priority=players[(players.findIndex(p=>p.id===actor)+1)%players.length].id;}
  }else if(action.type==='ability'){
    const label=action.label.trim();assert(label.length>0&&label.length<=100,'Fähigkeit bitte kurz benennen');
    assert(!action.abilityType||['activated','triggered'].includes(action.abilityType),'Unbekannte Fähigkeitsart');
    if(action.sourceCardId)assert(s.cards.some(c=>c.id===action.sourceCardId&&(c.controllerId===actor||action.abilityType==='triggered'&&c.ownerId===actor)&&(['battlefield','graveyard','exile','commander'] as Zone[]).includes(c.zone)&&(action.abilityType==='triggered'||c.zone==='battlefield')),'Wähle eine eigene öffentliche Quelle; aktivierte Fähigkeiten benötigen hier eine Quelle auf dem Spielfeld');
    assert(r.stack.length<200,'Zu viele Stack-Einträge');r.stack.push({id:uid(s),kind:'ability',controllerId:actor,label,sourceCardId:action.sourceCardId,abilityType:action.abilityType??'activated'});r.passes=[];log(s,`${name(s,actor)} ${action.abilityType==='triggered'?'meldet Trigger':'aktiviert'}: ${label} (manuell angesagt).`);
  }else if(action.type==='effect'){
    validateEffect(action.effect);const effect={...action.effect};
    if(effect.playerId)assert(alive(s).some(p=>p.id===effect.playerId),'Unbekannter ausführender Spieler');
    if(effect.kind==='cascade'&&action.sourceId){const source=r.stack.find(i=>i.id===action.sourceId&&i.kind==='spell'&&i.controllerId===actor);assert(source,'Wähle deinen auslösenden Spruch auf dem Stack');effect.value=source.manaValue!;}
    assert(r.stack.length<200,'Zu viele Stack-Einträge');r.stack.push({id:uid(s),kind:'ability',controllerId:actor,label:`${effect.kind} ${effect.value}`,effect});r.passes=[];log(s,`${name(s,actor)} legt ${effect.kind} ${effect.value} auf den Stack (Fähigkeit manuell angesagt).`);
  }else if(action.type==='draw'){assert(!r.stack.length,'Zum Ziehen durch einen Effekt das Aktionsmenü verwenden');draw(s,actor,1);log(s,'Manuelle Ziehaktion.');settle(s);
  }else if(action.type==='shuffle'){orderLibrary(s,actor,shuffle(library(s,actor)));log(s,`${name(s,actor)} mischt die Bibliothek (manuell).`);
  }else if(action.type==='move'&&action.zone==='battlefield'){
    const c=s.cards.find(c=>c.id===action.cardId);assert(c&&c.ownerId===actor&&c.controllerId===actor&&c.zone==='hand','Nur eigene Handkarten als Land spielen');selectPlayFace(c,action.faceIndex);assert(data(c).type.includes('Land'),'Spruch über „Wirken“ auf den Stack legen');sorceryTiming(s,actor);assert(landPlayAllowance(s,actor).remaining>0,'Alle Landspiele verbraucht. Weitere über Landspiele freigeben');const faceIndex=c.faceIndex;move(s,c,'battlefield');c.faceIndex=faceIndex;c.isLand=true;c.position=freePosition(s,c);r.landPlays[actor]=(r.landPlays[actor]??0)+1;addHideaway(s,c);r.passes=[];log(s,`${name(s,actor)} spielt ein Land.`);
  }else throw new Error('Unbekannte Regelaktion');
  settle(s);return s;
}

// Manual table tools stay available for card text outside the supported scripts, but never interrupt a private choice.
export function guardTableAction(s:GameState,actor:string,action:GameAction){
  if(action.type==='browseLibrary'&&!action.open||action.type==='deckAction'&&action.operation==='close')return;
  const r=rules(s);assert(r.stage==='playing','Die Starthand zuerst behalten');assert(!r.lost.includes(actor),'Du bist ausgeschieden');
  if(action.type==='browseLibrary')return;
  if(action.type==='libraryPick'){assert(!r.pending&&!r.resolving||r.pending?.kind==='manual'&&r.pending.ownerId===actor,'Zuerst die laufende Kartenauswahl abschließen');return;}
  if(action.type==='correctCard'||action.type==='correctDraw'){assert(!r.pending&&!r.resolving,'Korrekturen erst nach der laufenden Auswahl oder Verrechnung ausführen');return;}
  if(['mana','clearMana','retainMana'].includes(action.type)){
    assert(r.pending?.kind==='manual'&&r.pending.ownerId===actor||!r.pending&&!r.resolving&&(r.priority===actor||r.turnOnly&&!r.stack.length),'Mana nur mit Priorität oder während deiner manuellen Verrechnung ändern');return;
  }
  if(['position','arrange','rollDice','flipCoin'].includes(action.type))return;
  if(r.pending){assert(r.pending.kind==='manual'&&r.pending.ownerId===actor,'Zuerst die offene Auswahl abschließen');}
  if('cardId'in action){const c=s.cards.find(c=>c.id===action.cardId);assert(c?.zone!=='stack','Stack-Karten werden nur durch Verrechnung bewegt');}
  if(action.type==='move'){assert(action.zone!=='stack','Zum Wirken die Stack-Aktion verwenden');assert(action.zone!=='library','Bibliotheksreihenfolge nur über Bibliotheksaktionen ändern');}
}

export function projectRules(s:GameState,viewer:string):RulesState|undefined{
  if(!s.rules)return undefined;const r=structuredClone(s.rules);if(r.pending&&!r.pending.public&&r.pending.ownerId!==viewer){r.pending.cardIds=[];delete r.pending.hitId;}return r;
}
