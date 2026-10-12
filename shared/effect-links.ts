import type {CardInstance,GameState,GameAction} from './game.ts';
import {instanceDefinition} from './card-state.ts';
import {uuid} from './id.ts';
export interface EffectLink {id:string;actorId:string;causedById?:string;sourceId?:string;sourceIncarnation?:number;sourceName:string;label:string;turn:number}
export type EffectLinkAction={type:'effectLink';cardIds:string[];sourceId?:string;label?:string;removeId?:string};
export function recordEffectLink(s:GameState,c:CardInstance,actorId:string,label:string,sourceId?:string,causedById=actorId){
 if(!['graveyard','exile'].includes(c.zone))return;
 const source=s.cards.find(c=>c.id===sourceId),publicSource=source&&!source.faceDown&&!['hand','library'].includes(source.zone);
 const link:EffectLink={id:uuid(),actorId,causedById,sourceName:publicSource?instanceDefinition(source).name:'Manueller Effekt',label,turn:s.turn,...(publicSource?{sourceId:source.id,sourceIncarnation:source.incarnation??0}:{})};
 c.effectLinks=[...(c.effectLinks??[]).filter(l=>!(l.actorId===actorId&&l.sourceId===link.sourceId&&l.label===label)),link].slice(-8);
}
export function applyEffectLink(state:GameState,actor:string,a:EffectLinkAction):GameState{
 const s=structuredClone(state);
 if(!Array.isArray(a.cardIds)||!a.cardIds.length||a.cardIds.length>100||new Set(a.cardIds).size!==a.cardIds.length)throw new Error('1–100 verschiedene Karten auswählen');
 const source=s.cards.find(c=>c.id===a.sourceId);
 if(a.sourceId&&(!source||source.faceDown||['hand','library'].includes(source.zone)))throw new Error('Eine offen sichtbare Quelle wählen');
 const label=(a.label??'Effekt').trim();
 if(!a.removeId&&(!label||label.length>80||/[\p{C}]/u.test(label)))throw new Error('Effekt mit 1–80 Zeichen benennen');
 for(const id of a.cardIds){
  const c=s.cards.find(c=>c.id===id);
  if(!c||!['exile','graveyard'].includes(c.zone))throw new Error('Nur Karten im Exil oder Friedhof verknüpfen');
  const owns=c.ownerId===actor||c.controllerId===actor;
  if(a.removeId){const link=c.effectLinks?.find(l=>l.id===a.removeId);if(!link||!owns&&link.actorId!==actor)throw new Error('Diese Verknüpfung gehört nicht dir');c.effectLinks=c.effectLinks?.filter(l=>l.id!==a.removeId);}
  else{if(!owns&&source?.controllerId!==actor)throw new Error('Eigene Quelle für gegnerische Karten auswählen');if((c.effectLinks?.length??0)>=8)throw new Error('Maximal acht Quellen pro Karte');recordEffectLink(s,c,actor,label,a.sourceId,source?.controllerId??actor);}
 }
 s.log=[...s.log,`${s.players.find(p=>p.id===actor)!.name}: ${a.cardIds.length} Karte(n) ${a.removeId?'von einer Quelle gelöst':`mit ${source?instanceDefinition(source).name:label} verknüpft`}.`].slice(-60);return s;
}
export function resolvingSource(s:GameState){const i=s.rules?.resolving;return i?.cardId??i?.sourceCardId??i?.effect?.sourceCardId;}
export const isEffectLinkAction=(a:GameAction):a is EffectLinkAction=>a.type==='effectLink';
