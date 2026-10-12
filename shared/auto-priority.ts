import type {GameState} from './game.ts';
import {manaTotal} from './mana.ts';
import {catalogueById} from './catalogue.ts';
import {instanceDefinition} from './card-state.ts';
export const casualOwnStops=[1,3,9,10];
export const casualOpponentStops=[1,10];
export const turnStage=(phase:number)=>phase<=2?'Upkeep':phase<10?'Spielzug':'Endstep';
export const defaultOwnStops=[1,3,4,5,6,7,9,10];
export const defaultOpponentStops=[4,5,6,7,10];
export type ReactionMode='off'|'always'|'auto';
export interface AutoPriorityPolicy{enabled:boolean;ownStops:number[];opponentStops:number[];reactionMode?:ReactionMode;}
// Costs and arbitrary Oracle conditions remain manual. Ambiguous answers keep priority.
export function hasPossibleReaction(state:Pick<GameState,'rules'|'cards'>,actor:string){
 const r=state.rules;if(!r)return false;
 return state.cards.some(card=>{
  if(card.controllerId!==actor)return false;
  if(card.zone==='exile'&&card.faceDown&&card.hiddenFor?.includes(actor))return true;
  const data=catalogueById.get(card.cardId);if(!data)return card.zone==='hand'||card.zone==='battlefield';
  const face=instanceDefinition(card),text=face.text;
  if(card.zone==='hand'){
   if(data.layout==='modal_dfc'&&data.faces.some(f=>f.type.includes('Instant')||/(^|\n)Flash\b/i.test(f.text)))return true;
   if(face.type.includes('Instant')||/(^|\n)Flash\b/i.test(text)){
    if(data.name==='Counterspell')return r.stack.some(o=>o.kind==='spell');
    if(data.name==='Swords to Plowshares')return state.cards.some(c=>c.zone==='battlefield'&&(catalogueById.get(c.cardId)?.type.includes('Creature')));
    return true;
   }
   return /\b(Cycling|Channel|Ninjutsu)\b/i.test(text);
  }
  if(card.zone==='battlefield')return text.split('\n').some(line=>line.includes(':')&&!(card.tapped&&line.split(':')[0].includes('{T}'))&&!/^\s*Add\b/i.test(line.split(':').slice(1).join(':')))||/\b(instant|flash)\b/i.test(text)&&/\bcast\b/i.test(text);
  return false;
 });
}
export function canAutoPass(state:Pick<GameState,'rules'|'cards'|'players'|'activePlayer'|'phase'>,actor:string,policy:AutoPriorityPolicy){
 const r=state.rules;
 if(policy.reactionMode){
  if(!policy.enabled||!r||r.stage!=='playing'||r.priority!==actor||r.pending||r.resolving||!r.stack.length||r.lost.includes(actor))return false;
  return policy.reactionMode==='off'||policy.reactionMode==='auto'&&!hasPossibleReaction(state,actor);
 }
 if(!policy.enabled||!r||r.turnOnly||r.stage!=='playing'||r.priority!==actor||r.pending||r.resolving||r.stack.length||r.lost.includes(actor))return false;
 const player=state.players.find(p=>p.id===actor);if(!player||manaTotal(player.mana))return false;
 return !(state.activePlayer===actor?policy.ownStops:policy.opponentStops).includes(state.phase);
}
