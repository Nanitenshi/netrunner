import type {GameState,GameAction} from './game.ts';
import {cardCounterTypes,playerCounterTypes,normalizeCounterName,type CardCounterType,type PlayerCounterType} from './counters.ts';
import {uuid} from './id.ts';
export interface TableTracker {id:string;ownerId:string;kind:'card'|'player'|'custom'|'damage';key:string;value:number;x:number;y:number}
export type TrackerAction={type:'tableTracker';operation:'create'|'move'|'change'|'remove'|'drop';id?:string;kind?:TableTracker['kind'];key?:string;value?:number;x?:number;y?:number;cardId?:string};
export function trackerValue(s:Pick<GameState,'players'>,t:TableTracker){const p=s.players.find(p=>p.id===t.ownerId);return t.kind==='player'?p?.counters?.[t.key as PlayerCounterType]??0:t.kind==='damage'?p?.commanderDamage?.find(d=>d.commanderId===t.key)?.amount??0:t.value;}
export function applyTrackerAction(state:GameState,actor:string,a:TrackerAction,apply:(s:GameState,p:string,a:GameAction)=>GameState):GameState {
 let s=structuredClone(state);s.tableTrackers??=[];
 const amount=a.value??1;
 if(!Number.isInteger(amount)||Math.abs(amount)>999)throw new Error('Ungültige Menge');
 const position=()=>{if(!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x!<0||a.x!>1||a.y!<0||a.y!>1)throw new Error('Ungültige Position');return{x:Math.max(.04,Math.min(.96,a.x!)),y:Math.max(.06,Math.min(.94,a.y!))};};
 let t=s.tableTrackers.find(t=>t.id===a.id&&t.ownerId===actor);
 if(a.operation==='create'){
  if(!a.kind||!['card','player','custom','damage'].includes(a.kind)||typeof a.key!=='string')throw new Error('Ungültiger Zähler');
  const key=a.kind==='custom'?normalizeCounterName(a.key):a.key;
  if(a.kind==='custom'&&(!key||key.length>28||/[\p{C}]/u.test(key))||a.kind==='card'&&!cardCounterTypes.includes(key as CardCounterType)||a.kind==='player'&&!playerCounterTypes.includes(key as PlayerCounterType))throw new Error('Unbekannte Counter-Art');
  if(a.kind==='damage'&&!s.cards.some(c=>c.id===key&&c.isCommander)&&!s.players.find(p=>p.id===actor)?.commanderDamage?.some(d=>d.commanderId===key))throw new Error('Unbekannter Commander');
  if(a.kind==='player'||a.kind==='damage')t=s.tableTrackers.find(t=>t.ownerId===actor&&t.kind===a.kind&&t.key===key);
  if(t){Object.assign(t,position());return s;}
  if(s.tableTrackers.filter(t=>t.ownerId===actor).length>=40)throw new Error('Maximal 40 Tischzähler pro Spieler');
  if(amount<0)throw new Error('Menge darf nicht negativ sein');
  s.tableTrackers.push({id:uuid(),ownerId:actor,kind:a.kind,key,value:amount,...position()});return s;
 }
 if(!t)throw new Error('Nur eigene Tischzähler verändern');
 if(a.operation==='move'){Object.assign(t,position());return s;}
 if(a.operation==='remove'){s.tableTrackers=s.tableTrackers.filter(c=>c.id!==t!.id);return s;}
 if(a.operation==='change'){
  if(t.kind==='player')return apply(s,actor,{type:'playerCounter',counter:t.key as PlayerCounterType,amount});
  if(t.kind==='damage'){if(Math.abs(amount)>100)throw new Error('Commander-Schaden in Schritten bis 100 ändern');return apply(s,actor,{type:'commanderDamage',commanderId:t.key,amount,adjustLife:false});}
  t.value=Math.max(0,Math.min(999,t.value+amount));return s;
 }
 if(a.operation==='drop'){
  const c=s.cards.find(c=>c.id===a.cardId&&c.zone==='battlefield'&&c.controllerId===actor);
  if(!c||!['card','custom'].includes(t.kind))throw new Error('Kartenmarken auf eine eigene Spielfeldkarte ziehen');
  const next=apply(s,actor,t.kind==='card'?{type:'cardCounter',cardId:c.id,counter:t.key as CardCounterType,amount:t.value}:{type:'customCounter',cardId:c.id,name:t.key,amount:t.value});
  next.tableTrackers=next.tableTrackers?.filter(c=>c.id!==t!.id);return next;
 }
 throw new Error('Unbekannte Zähleraktion');
}
