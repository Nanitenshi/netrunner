import type {CardInstance} from '../shared/game';
import {customCounterKey,cardCounterTypes,markerCount} from '../shared/counters.ts';
import {definition} from './seed.ts';
import {instanceDefinition} from '../shared/card-state.ts';
export interface BattlefieldGroup {key:string;cards:CardInstance[];section:'creatures'|'permanents'|'lands'}
export const battlefieldSection=(card:CardInstance):BattlefieldGroup['section']=>{
 const type=instanceDefinition(card).type;
 return type.includes('Creature')?'creatures':type.includes('Land')?'lands':'permanents';
};
// Presentation only. Distinct tap states, counters, controllers and commanders never merge.
export function groupBattlefield(cards:CardInstance[],groupIdentical=true,ungrouped:ReadonlySet<string>=new Set()):BattlefieldGroup[]{
 const groups=new Map<string,BattlefieldGroup>();
 const attachmentHosts=new Set(cards.map(c=>c.attachedTo).filter(Boolean));
 for(const card of cards){
  const canGroup=groupIdentical&&!ungrouped.has(card.id)&&!card.isCommander&&!card.combat&&!card.faceDown&&!attachmentHosts.has(card.id)&&(card.token||definition(card.cardId).type.includes('Land'));
  const key=canGroup?JSON.stringify([card.cardId,card.ownerId,card.controllerId,card.tapped,Boolean(card.token),card.faceIndex,card.powerOverride,card.toughnessOverride,card.addedKeywords,card.note,card.attachedTo,card.temporaryPower,card.temporaryToughness,cardCounterTypes.map(type=>markerCount(card,type)),customCounterKey(card.customCounters)]):card.id;
  const group=groups.get(key);
  if(group)group.cards.push(card);else groups.set(key,{key,cards:[card],section:battlefieldSection(card)});
 }
 return [...groups.values()];
}
