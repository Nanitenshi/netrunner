import {loyaltyCosts,loyaltyDelta} from './loyalty.ts';
import {applyTableTools,type TableToolAction,type TimedEffect,type TableEdit,type CombatMark} from './table-tools.ts';
import {applyDeckAction,projectDeckAccess,type DeckAction,type DeckAccess} from './deck-actions.ts';
import {applyEffectLink,recordEffectLink,resolvingSource,type EffectLink,type EffectLinkAction} from './effect-links.ts';
import {applyTrackerAction,type TableTracker,type TrackerAction} from './table-trackers.ts';
import {editCard,attachCard,repositionCard,instanceDefinition,type CardEdit,type CardKeyword} from './card-state.ts';
import {enterZone,freePosition} from './placement.ts';
import {tokenById} from './tokens.ts';
import {uuid} from './id.ts';
import {catalogueById} from './catalogue.ts';
import {manaColors,manaNames,type ManaPool,type ManaColor} from './mana.ts';
import {applyRulesAction,guardTableAction,projectRules,rulesActionTypes,settle,turnSteps} from './engine.ts';
import type {RulesAction,RulesState} from './rules-types.ts';
import {changeCustomCounter,type CustomCounter,cardCounterTypes,playerCounterTypes,cardCounters,playerCounters,markerCount,type CardCounterType,type PlayerCounterType} from './counters.ts';
export type Zone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'commander' | 'stack';
export type { CardDefinition } from './cards.ts';
export interface CardInstance { combat?:CombatMark;temporaryPower?:number;temporaryToughness?:number;baseControllerId?:string;controlHistory?:string[];exilePlayer?:string; effectLinks?:EffectLink[]; faceIndex?:number; powerOverride?:string; toughnessOverride?:string; addedKeywords?:CardKeyword[]; note?:string; attachedTo?:string; id: string; cardId: string; ownerId: string; controllerId: string; zone: Zone; tapped: boolean; counters: number; position: { x: number; y: number }; zoneOrder?:number;faceDown?:boolean;hiddenFor?:string[];hideawaySource?:string;createdToken?:boolean;incarnation?:number; token?: boolean; isCommander?: boolean; commanderCasts?: number; isLand?:boolean; markers?:Partial<Record<CardCounterType,number>>; customCounters?:CustomCounter[]; }
export interface Player { id: string; name: string; commander: string; color: string; life: number; mana?:ManaPool; retainMana?:boolean; counters?:Partial<Record<PlayerCounterType,number>>; customCounters?:CustomCounter[]; commanderDamage?:{commanderId:string;ownerId:string;name:string;amount:number}[]; }
export interface GameState { timedEffects?:TimedEffect[];tableEdits?:TableEdit[];deckAccess?:DeckAccess[]; tableTrackers?:TableTracker[]; libraryReaders?:string[]; players: Player[]; cards: CardInstance[]; activePlayer: string; phase: number; turn: number; log: string[]; rules?:RulesState; }
export type TableAction = {type:'loyaltyCost';cardId:string;index:number;x:number} | {type:'batchCardCounters';cardIds:string[];counter:CardCounterType|'custom';name?:string;amount:number} | {type:'browseLibrary';open:boolean}|{type:'libraryPick';cardIds:string[];destination:'hand'|'battlefield'|'graveyard'|'exile'|'library';shuffle:boolean;tapped:boolean} | {type:'createToken';tokenId:string;count:number} | {type:'rollDice';sides:number;count:number} | {type:'flipCoin';count:number} | {type:'customCounter';cardId?:string;name:string;amount:number} | {type:'commanderDamage';commanderId:string;amount:number;adjustLife:boolean} | { type: 'life'; amount: number } | {type:'cardCounter';cardId:string;counter:CardCounterType;amount:number} | {type:'playerCounter';counter:PlayerCounterType;amount:number} | { type: 'draw' } | { type: 'move'; cardId: string; zone: Zone; faceIndex?:number } | { type: 'castCommander'; cardId: string } | { type: 'tap'; cardId: string } | { type: 'counter'; cardId: string; amount: number } | { type: 'nextPhase' } | { type: 'position'; cardId: string; x: number; y: number } | { type: 'copy'; cardId: string; newId: string } | { type: 'arrange' } | { type: 'untapAll' };
export type ManaAction={type:'mana';color:ManaColor;amount:number;sourceCardId?:string}|{type:'clearMana'}|{type:'retainMana';enabled:boolean};
export type CorrectionAction={type:'correctCard';cardId:string;zone:Exclude<Zone,'stack'>;tapped:boolean;commanderCasts?:number;libraryPosition?:'top'|'bottom';reason:string}|{type:'correctDraw';count:number;reason:string};
export type ControlAction={type:'control';cardId:string;mode:'take'|'return'};
export type CardStateAction={type:'editCard';cardId:string;patch:CardEdit}|{type:'attach';cardId:string;targetId:string|null};
export type GameAction = TableToolAction | DeckAction | EffectLinkAction | TrackerAction | TableAction | RulesAction | ManaAction | CorrectionAction | ControlAction | CardStateAction;
export type GameView = ReturnType<typeof projectGame>;
export const commanderTax = (card:CardInstance) => card.isCommander ? 2 * (card.commanderCasts ?? 0) : 0;
export function commanderCost(mana:string, tax:number):string {
  if(!tax)return mana;
  const generic=mana.match(/\{(\d+)\}/);
  return `{${tax+Number(generic?.[1]??0)}}${generic?mana.replace(generic[0],''):mana}`;
}
export const phases = turnSteps;
// The server invokes this reducer using the authenticated seat, never a client supplied actor.
export function applyAction(state:GameState,actor:string,action:GameAction):GameState {
  if(!state.players.some(p=>p.id===actor))throw new Error('Unbekannter Spieler');
  const scripted=(rulesActionTypes as readonly string[]).includes(action.type);
  if(state.rules){
    if(scripted||['draw','nextPhase','castCommander'].includes(action.type)||(action.type==='move'&&action.zone==='battlefield'&&state.rules.pending?.kind!=='manual'))return applyRulesAction(state,actor,action);
    guardTableAction(state,actor,action);
  }else if(scripted)throw new Error('Regel-Engine ist nicht aktiv');
  if(['batchCards','combat','timedEffect','endEffect','linkedCards','undoTableEdit'].includes(action.type))return applyTableTools(state,actor,action as TableToolAction);
  if(action.type==='deckAction'){const next=applyDeckAction(state,actor,action);settle(next);return next;}
  if(action.type==='effectLink')return applyEffectLink(state,actor,action);
  if(action.type==='tableTracker')return applyTrackerAction(state,actor,action,applyAction);
  const next=applyTableAction(state,actor,action as TableAction|ManaAction|CorrectionAction|ControlAction|CardStateAction);settle(next);return next;
}
function applyTableAction(state: GameState, actor: string, action: TableAction|ManaAction|CorrectionAction|ControlAction|CardStateAction): GameState {
  if (!state.players.some(p => p.id === actor)) throw new Error('Unbekannter Spieler');
  const next = structuredClone(state);
  const player = next.players.find(p => p.id === actor)!;
  let message = '';
  if(action.type==='batchCardCounters'){
    if(!Array.isArray(action.cardIds)||!action.cardIds.length||action.cardIds.length>200||new Set(action.cardIds).size!==action.cardIds.length||!Number.isInteger(action.amount)||Math.abs(action.amount)>999||action.counter!=='custom'&&!cardCounterTypes.includes(action.counter))throw new Error('Ungültige Gruppenmarken');
    const chosen=action.cardIds.map(id=>next.cards.find(c=>c.id===id));
    if(chosen.some(c=>!c||c.controllerId!==actor||c.zone!=='battlefield'))throw new Error('Gruppenmarken nur auf eigene Spielfeldkarten legen');
    for(const c of chosen){if(!c)continue;if(action.counter==='custom')c.customCounters=changeCustomCounter(c.customCounters,action.name??'',action.amount);else{const count=Math.max(0,Math.min(999,markerCount(c,action.counter)+action.amount));c.markers={...c.markers,[action.counter]:count};if(action.counter==='plusOne')c.counters=count;}}
    message=`${player.name}: ${chosen.length} Karten · ${action.counter==='custom'?action.name:cardCounters[action.counter].name} ${action.amount>0?'+':''}${action.amount} je Karte.`;
  }else if(action.type==='browseLibrary'){
    const readers=new Set(next.libraryReaders??[]);if(action.open)readers.add(actor);else readers.delete(actor);next.libraryReaders=[...readers];
    if(!action.open)return next;
    message=`${player.name} sieht die eigene Bibliothek durch.`;
  }else if(action.type==='libraryPick'){
    if(!next.libraryReaders?.includes(actor)||!Array.isArray(action.cardIds)||action.cardIds.length>100||new Set(action.cardIds).size!==action.cardIds.length||!['hand','battlefield','graveyard','exile','library'].includes(action.destination))throw new Error('Ungültige Bibliotheksauswahl');
    const chosen=action.cardIds.map(id=>next.cards.find(c=>c.id===id));
    if(chosen.some(c=>!c||c.ownerId!==actor||c.zone!=='library'))throw new Error('Wähle nur Karten aus deiner Bibliothek');
    for(const c of chosen){if(!c)continue;if(action.destination!=='library'){enterZone(next,c,action.destination);c.tapped=action.destination==='battlefield'&&action.tapped;}}
    const selectedIds=new Set(action.cardIds),rest=next.cards.filter(c=>c.ownerId===actor&&c.zone==='library'&&(action.destination!=='library'||!selectedIds.has(c.id)));
    if(action.shuffle){const bytes=new Uint32Array(1);for(let i=rest.length-1;i>0;i--){const limit=Math.floor(4294967296/(i+1))*(i+1);do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);const j=bytes[0]%(i+1);[rest[i],rest[j]]=[rest[j],rest[i]];}}
    const ordered=action.destination==='library'?[...chosen as CardInstance[],...rest]:rest;
    next.cards=[...next.cards.filter(c=>c.ownerId!==actor||c.zone!=='library'),...ordered];next.libraryReaders=(next.libraryReaders??[]).filter(id=>id!==actor);
    message=`${player.name} nimmt ${chosen.length} Karte(n) aus der Bibliothek${action.shuffle?' und mischt den Rest':''}.`;
  }else if(action.type==='createToken'){
    const d=tokenById.get(action.tokenId);if(!d||!Number.isInteger(action.count)||action.count<1||action.count>30||next.cards.length+action.count>1200)throw new Error('1–30 bekannte Token erzeugen');
    for(let i=0;i<action.count;i++){const token:CardInstance={id:uuid(),cardId:d.id,ownerId:actor,controllerId:actor,zone:'battlefield',token:true,createdToken:true,isLand:/\bLand\b/.test(d.type),tapped:false,counters:0,position:{x:0,y:0}};token.position=freePosition(next,token);next.cards.push(token);}
    message=`${player.name} erzeugt ${action.count}× ${d.name}.`;
  }else if(action.type==='correctDraw'||action.type==='correctCard'){
    const reason=action.reason?.trim();if(!reason||reason.length<3||reason.length>160)throw new Error('Korrektur mit einer kurzen Begründung von 3–160 Zeichen erklären');
    if(action.type==='correctDraw'){
      if(!Number.isInteger(action.count)||action.count<1||action.count>20)throw new Error('1–20 Karten nachziehen');
      const cards=next.cards.filter(c=>c.ownerId===actor&&c.zone==='library');if(cards.length<action.count)throw new Error('Nicht genug Karten für diese Korrektur');
      cards.slice(0,action.count).forEach(c=>{c.zone='hand';c.incarnation=(c.incarnation??0)+1;});
      message=`KORREKTUR · ${player.name} zieht ${action.count} Karte(n) nach · ${reason}`;
    }else{
      const card=next.cards.find(c=>c.id===action.cardId);if(!card||card.ownerId!==actor||card.controllerId!==actor||card.zone==='stack')throw new Error('Nur eigene Karten außerhalb des Stacks korrigieren');
      if(!['hand','battlefield','graveyard','exile','commander','library'].includes(action.zone)||action.zone==='commander'&&!card.isCommander)throw new Error('Ungültige Korrektur-Zone');
      if(typeof action.tapped!=='boolean'||action.libraryPosition&&!['top','bottom'].includes(action.libraryPosition))throw new Error('Ungültige Korrektur');
      if(action.commanderCasts!==undefined){if(!card.isCommander||!Number.isInteger(action.commanderCasts)||action.commanderCasts<0||action.commanderCasts>100)throw new Error('Nur Commander-Castzahl von 0–100 korrigieren');card.commanderCasts=action.commanderCasts;}
      const from=card.zone;if(from!==action.zone)enterZone(next,card,action.zone);
      card.zone=action.zone;card.tapped=action.zone==='battlefield'&&action.tapped;
      if(action.zone==='library'){next.cards=next.cards.filter(c=>c.id!==card.id);if(action.libraryPosition==='bottom')next.cards.push(card);else next.cards.unshift(card);}
      const cardName=from==='hand'||from==='library'? 'eine eigene Karte':catalogueById.get(card.cardId)!.name;
      message=`KORREKTUR · ${player.name}: ${cardName} → ${action.zone}${action.zone==='battlefield'?(card.tapped?' · getappt':' · ungetappt'):''}${action.commanderCasts!==undefined?` · Commander ${action.commanderCasts}× gewirkt`:''} · ${reason}`;
    }
  }else if(action.type==='mana'){
    if(!manaColors.includes(action.color)||!Number.isInteger(action.amount)||!action.amount||Math.abs(action.amount)>100)throw new Error('Mana als ganze Zahl von −100 bis 100 ändern');
    const value=(player.mana?.[action.color]??0)+action.amount;
    if(value<0||value>999)throw new Error('Nicht genügend Mana oder Mana-Limit erreicht');
    if(action.sourceCardId){
      const source=next.cards.find(c=>c.id===action.sourceCardId);
      if(action.amount<1||!source||source.controllerId!==actor||source.zone!=='battlefield'||source.tapped)throw new Error('Die Manaquelle muss ungetappt auf deinem Spielfeld liegen');
      source.tapped=true;
    }
    player.mana={...player.mana,[action.color]:value};
    if(next.rules&&!next.rules.pending)next.rules.passes=[];
    message=`${player.name}: ${action.amount>0?'+':''}${action.amount} ${manaNames[action.color]}-Mana${action.sourceCardId?' · Quelle getappt':''} (manuell)`;
  }else if(action.type==='clearMana'){
    player.mana={};message=`${player.name} leert den Mana-Pool.`;
  }else if(action.type==='retainMana'){
    if(typeof action.enabled!=='boolean')throw new Error('Ungültige Mana-Ausnahme');
    player.retainMana=action.enabled;message=`${player.name}: Mana bei Schrittwechsel ${action.enabled?'erhalten (Karteneffekt manuell bestätigt)':'wieder leeren'}.`;
  }else if(action.type==='rollDice'||action.type==='flipCoin'){
    const sides=action.type==='flipCoin'?2:action.sides;
    if(!Number.isInteger(sides)||sides<2||sides>1000||!Number.isInteger(action.count)||action.count<1||action.count>20)throw new Error('Wähle 1–20 Würfe und 2–1000 Seiten');
    const limit=Math.floor(4294967296/sides)*sides;
    const values=Array.from({length:action.count},()=>{const bytes=new Uint32Array(1);do{globalThis.crypto.getRandomValues(bytes);}while(bytes[0]>=limit);return bytes[0]%sides+1;});
    message=action.type==='flipCoin'?`${player.name} wirft ${action.count} Münze(n): ${values.map(v=>v===1?'Kopf':'Zahl').join(', ')}`:`${player.name} würfelt ${action.count}W${sides}: ${values.join(', ')} · Summe ${values.reduce((a,b)=>a+b,0)}`;
  } else if(action.type==='customCounter'){
    const card=action.cardId?next.cards.find(c=>c.id===action.cardId):undefined;
    if(action.cardId&&(!card||card.controllerId!==actor))throw new Error('Diese Karte gehört dir nicht');
    const target=card??player;target.customCounters=changeCustomCounter(target.customCounters,action.name,action.amount);
    message=`${player.name}: ${card?'Karten':'Spieler'}-Counter ${action.name} ${action.amount>0?'+':''}${action.amount}`;
  } else if(action.type==='commanderDamage'){
    if(!Number.isInteger(action.amount)||Math.abs(action.amount)>100||typeof action.adjustLife!=='boolean')throw new Error('Ungültiger Commander-Schaden');
    const commander=next.cards.find(c=>c.id===action.commanderId&&c.isCommander);
    const previous=player.commanderDamage?.find(d=>d.commanderId===action.commanderId);
    if(!commander&&!previous)throw new Error('Unbekannter Commander');
    const owner=next.players.find(p=>p.id===(commander?.ownerId??previous!.ownerId))!;
    const entry=previous??{commanderId:action.commanderId,ownerId:owner.id,name:commander?catalogueById.get(commander.cardId)!.name:owner.commander,amount:0};
    const value=Math.max(0,Math.min(999,entry.amount+action.amount)),delta=value-entry.amount;
    player.commanderDamage=[...(player.commanderDamage??[]).filter(d=>d.commanderId!==action.commanderId),{...entry,amount:value}];
    if(action.adjustLife)player.life-=delta;
    message=`${player.name}: ${entry.name} · ${value}/21 Commander-Kampfschaden${action.adjustLife?' · Leben angepasst':''}`;
  } else if (action.type === 'life') {
    if (!Number.isInteger(action.amount) || Math.abs(action.amount) > 100) throw new Error('Ungültige Lebenspunkte');
    player.life += action.amount; message = `${player.name}: ${action.amount > 0 ? '+' : ''}${action.amount} Leben`;
  } else if(action.type==='playerCounter'){
    if(!playerCounterTypes.includes(action.counter)||!Number.isInteger(action.amount)||Math.abs(action.amount)>999)throw new Error('Ungültiger Spieler-Counter');
    player.counters={...player.counters,[action.counter]:Math.max(0,Math.min(999,(player.counters?.[action.counter]??0)+action.amount))};
    message=`${player.name}: ${playerCounters[action.counter].name} ${action.amount>0?'+':''}${action.amount}`;
  } else if (action.type === 'draw') {
    const card = next.cards.find(c => c.ownerId === actor && c.zone === 'library');
    if (!card) throw new Error('Bibliothek ist leer');
    card.zone = 'hand'; message = `${player.name} zieht eine Karte`;
  } else if (action.type === 'nextPhase') {
    if (state.activePlayer !== actor) throw new Error('Du bist nicht am Zug');
    next.phase = (next.phase + 1) % phases.length;
    if (next.phase === 0) { next.activePlayer = next.players[(next.players.findIndex(p => p.id === actor) + 1) % next.players.length].id; next.turn++; }
    message = `${phases[next.phase]}`;
  } else if (action.type === 'arrange' || action.type === 'untapAll') {
    const indexes={land:0,spell:0};
    next.cards.filter(c => c.controllerId === actor && c.zone === 'battlefield').forEach(c => {
      if (action.type === 'untapAll') c.tapped = false;
      else {const index=c.isLand?indexes.land++:indexes.spell++;c.position = { x: 0.09 + (index % 7) * 0.13, y: c.isLand?0.78:0.26+Math.min(1,Math.floor(index/7))*.2 };}
    });
    message = action.type === 'arrange' ? 'Spielfeld aufgeräumt' : 'Eigene Karten enttappt';
  } else {
    const card = next.cards.find(c => c.id === action.cardId);
    if (!card) throw new Error('Diese Karte ist nicht mehr im Spiel');
    if (action.type === 'control') {
      if(card.zone!=='battlefield'||!['take','return'].includes(action.mode))throw new Error('Kontrolle nur auf dem Spielfeld ändern');
      if(action.mode==='return'&&card.controllerId!==actor)throw new Error('Nur von dir kontrollierte Karten zurückgeben');
      const target=action.mode==='take'?actor:card.ownerId;
      if(target===card.controllerId)throw new Error('Die Karte liegt bereits auf diesem Spielfeld');
      if(!next.players.some(p=>p.id===target)||next.rules?.lost.includes(target))throw new Error('Dieser Spieler ist ausgeschieden');
      if(action.mode==='take')card.controlHistory=[...(card.controlHistory??[]),card.controllerId];else card.controlHistory=[];delete card.combat;card.controllerId=target;card.position=freePosition(next,card);
      if(card.faceDown)card.hiddenFor=[...new Set([...(card.hiddenFor??[]),target])];
      message=`${player.name}: ${card.faceDown?'Verdeckte Karte':catalogueById.get(card.cardId)?.name??'Karte'} ${action.mode==='take'?'übernommen':`an ${next.players.find(p=>p.id===target)!.name} zurückgegeben`}.`;
    } else if (action.type === 'copy') {
      if(card.zone!=='battlefield'||card.faceDown||!action.newId||next.cards.some(c=>c.id===action.newId))throw new Error('Nur offen liegende Spielfeldkarten als Token kopieren');
      if(next.cards.length>=1200)throw new Error('Zu viele Kartenkopien');
      const copy:CardInstance={id:action.newId,cardId:card.cardId,ownerId:actor,controllerId:actor,zone:'battlefield',token:true,isLand:card.isLand,faceIndex:card.faceIndex,isCommander:false,commanderCasts:0,counters:0,markers:{},customCounters:[],tapped:false,position:{x:0,y:0},incarnation:0,zoneOrder:Math.max(0,...next.cards.map(c=>c.zoneOrder??0))+1};
      const d=instanceDefinition(copy);if(d.type.includes('Planeswalker')&&/^\d+$/.test(d.loyalty??''))copy.markers={loyalty:Number(d.loyalty)};copy.position=freePosition(next,copy);next.cards.push(copy);
      message=`${player.name} erzeugt eine Token-Kopie von ${catalogueById.get(card.cardId)?.name??'einer Karte'}.`;
    } else {
    if (card.controllerId !== actor) throw new Error('Diese Karte kontrollierst du nicht');
    if (action.type==='editCard'||action.type==='attach') {
      if(card.zone!=='battlefield')throw new Error('Nur Karten auf deinem Spielfeld bearbeiten');
      if(action.type==='editCard')editCard(card,action.patch);else attachCard(next,card,action.targetId);
      message=`${player.name}: ${card.faceDown?'Verdeckte Karte':instanceDefinition(card).name} ${action.type==='editCard'?'angepasst':action.targetId?'angelegt':'gelöst'}.`;
    } else if (action.type === 'position') {
      if (card.zone !== 'battlefield' || !Number.isFinite(action.x) || !Number.isFinite(action.y)) throw new Error('Ungültige Position');
      repositionCard(next,card,Math.max(0.06,Math.min(0.94,action.x)),Math.max(0.1,Math.min(0.9,action.y)));
      message = 'Karte platziert';
    } else if(action.type === 'castCommander') {
      if(!card.isCommander || card.zone!=='commander')throw new Error('Commander ist nicht in der Kommandozone');
      const tax=commanderTax(card);
      card.commanderCasts=(card.commanderCasts??0)+1;card.zone='battlefield';card.tapped=false;
      message=`${player.name} wirkt den Commander (Tax +${tax}; Kosten manuell bezahlen)`;
    } else if (action.type === 'move') {
      if (!['library','hand','battlefield','graveyard','exile','commander'].includes(action.zone)) throw new Error('Ungültige Zone');
      if(action.zone==='commander'&&!card.isCommander)throw new Error('Nur der bestimmte Commander darf in die Kommandozone');
      enterZone(next,card,action.zone);if(['exile','graveyard'].includes(action.zone)&&next.rules?.resolving)recordEffectLink(next,card,actor,next.rules.resolving.label,resolvingSource(next)); message = `${player.name} bewegt eine Karte`;
    } else if(action.type==='loyaltyCost'){
      if(card.zone!=='battlefield'||card.faceDown||!Number.isInteger(action.index))throw new Error('Wähle einen offenen Planeswalker');
      const cost=loyaltyCosts(instanceDefinition(card))[action.index];if(!cost)throw new Error('Unbekannte Loyalitätskosten');
      const value=markerCount(card,'loyalty')+loyaltyDelta(cost.cost,action.x);if(value<0||value>999)throw new Error('Nicht genügend Loyalität oder Wert zu groß');
      card.markers={...card.markers,loyalty:value};message=`${player.name}: ${instanceDefinition(card).name} · Loyalität ${value} (nur Marken).`;
    } else if (action.type === 'cardCounter') {
      if(!cardCounterTypes.includes(action.counter)||!Number.isInteger(action.amount)||Math.abs(action.amount)>999)throw new Error('Ungültiger Karten-Counter');
      const amount=Math.max(0,Math.min(999,markerCount(card,action.counter)+action.amount));
      card.markers={...card.markers,[action.counter]:amount};if(action.counter==='plusOne')card.counters=amount;
      message=`${player.name}: ${cardCounters[action.counter].name}-Counter ${action.amount>0?'+':''}${action.amount}`;
    } else if (action.type === 'tap') {
      if (card.zone !== 'battlefield') throw new Error('Nur auf dem Spielfeld möglich');
      card.tapped = !card.tapped; message = card.tapped ? 'Karte getappt' : 'Karte enttappt';
    } else {
      if (!Number.isInteger(action.amount) || Math.abs(action.amount) > 100) throw new Error('Ungültiger Zähler');
      card.counters = Math.max(0, Math.min(999,card.counters + action.amount));card.markers={...card.markers,plusOne:card.counters}; message = '+1/+1-Counter geändert';
    }
  }
  }
  next.log = [...next.log, message].slice(-30); return next;
}
// Never serialize the full GameState for opponents. Hidden cards expose counts only.
export function projectGame(state: GameState, viewer: string) {
  return { ...state, tableEdits:undefined, recentTableEdits:(state.tableEdits??[]).map((e,i,all)=>({id:e.id,actorId:e.actorId,label:e.label,turn:e.turn,canUndo:i===all.length-1&&e.actorId===viewer&&e.turn===state.turn})), deckAccess:undefined, deckCards:projectDeckAccess(state,viewer), libraryCards:state.libraryReaders?.includes(viewer)?state.cards.filter(c=>c.ownerId===viewer&&c.zone==='library').slice().sort((a,b)=>(catalogueById.get(a.cardId)?.name??'').localeCompare(catalogueById.get(b.cardId)?.name??'')):[], rules:projectRules(state,viewer), choiceCards:state.rules?.pending&&(state.rules.pending.public||state.rules.pending.ownerId===viewer)?state.cards.filter(c=>state.rules!.pending!.cardIds.includes(c.id)):[], commanderTaxByPlayer:Object.fromEntries(state.players.map(p=>[p.id,state.cards.filter(c=>c.ownerId===p.id&&c.isCommander).reduce((sum,c)=>sum+commanderTax(c),0)])), cards: state.cards.filter(c => c.zone !== 'library' && (c.zone !== 'hand' || c.ownerId === viewer)).map(c=>c.faceDown&&!c.hiddenFor?.includes(viewer)?{id:c.id,cardId:'hidden-card',ownerId:c.ownerId,controllerId:c.controllerId,zone:c.zone,faceDown:true,effectLinks:c.effectLinks,attachedTo:c.attachedTo,powerOverride:c.powerOverride,toughnessOverride:c.toughnessOverride,addedKeywords:c.addedKeywords,note:c.note,tapped:c.tapped,counters:c.counters,markers:c.markers,customCounters:c.customCounters,position:c.position,zoneOrder:c.zoneOrder}:c), hiddenCounts: Object.fromEntries(state.players.map(p => [p.id, {library: state.cards.filter(c => c.ownerId === p.id && c.zone === 'library').length, hand: state.cards.filter(c => c.ownerId === p.id && c.zone === 'hand').length}])) };
}
