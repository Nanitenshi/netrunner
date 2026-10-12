import {catalogueById} from './catalogue.ts';
import type {CardDefinition} from './cards.ts';
import type {CardInstance,GameState} from './game.ts';

export const cardKeywords=['Flying','Vigilance','Trample','Haste','Lifelink','Deathtouch','First strike','Double strike','Reach','Hexproof','Indestructible','Menace'] as const;
export type CardKeyword=typeof cardKeywords[number];
export type CardEdit={power?:string|null;toughness?:string|null;keywords?:CardKeyword[];note?:string;faceIndex?:number};
export const manaValueOf=(cost:string)=>(cost.match(/\{[^}]+\}/g)??[]).reduce((n,s)=>n+(/^\{\d+\}$/.test(s)?Number(s.slice(1,-1)):/^\{[XYZ]\}$/.test(s)?0:/^\{2\//.test(s)?2:1),0);
export const hasPhysicalFaces=(d:CardDefinition)=>d.faces.length>1&&['transform','modal_dfc','double_faced_token','reversible_card','flip'].includes(d.layout??'');
export function faceDefinition(d:CardDefinition,index=0):CardDefinition{
 const face=d.faces[index];if(!face)return d;
 const value=d.layout==='modal_dfc'||d.layout==='split'||d.layout==='adventure'?manaValueOf(face.mana):d.manaValue;
 return {...d,...face,image:face.image??d.image,art:face.art??d.art,manaValue:value,displayFace:index};
}
export function instanceDefinition(c:Pick<CardInstance,'cardId'|'faceIndex'> & {zone?:CardInstance['zone']}):CardDefinition{
 const d=catalogueById.get(c.cardId);if(!d)throw new Error('Unbekannte Karte');
 const face=faceDefinition(d,c.faceIndex??0);
 // Split cards retain the combined mana value outside the stack.
 if(d.layout==='split'&&c.zone!=='stack')return {...face,manaValue:d.manaValue};
 return face;
}
export const editableStat=(value:unknown):value is string=>typeof value==='string'&&/^(?:-?\d{1,3}|\*|\d{1,2}\+\*)$/.test(value);
export function editCard(card:CardInstance,patch:CardEdit){
 if(!patch||!Object.keys(patch).length||Object.keys(patch).some(k=>!['power','toughness','keywords','note','faceIndex'].includes(k)))throw new Error('Ungültige Kartenänderung');
 for(const key of ['power','toughness'] as const)if(key in patch){const value=patch[key];if(value!==null&&!editableStat(value))throw new Error('Wert als Zahl von −999 bis 999, * oder 1+* eingeben');if(value===null)delete card[key==='power'?'powerOverride':'toughnessOverride'];else card[key==='power'?'powerOverride':'toughnessOverride']=value;}
 if(patch.keywords!==undefined){if(!Array.isArray(patch.keywords)||patch.keywords.length>cardKeywords.length||patch.keywords.some(k=>!cardKeywords.includes(k))||new Set(patch.keywords).size!==patch.keywords.length)throw new Error('Ungültige Fähigkeiten');card.addedKeywords=[...patch.keywords];}
 if(patch.note!==undefined){if(typeof patch.note!=='string'||patch.note.length>160||/[\p{C}]/u.test(patch.note))throw new Error('Notiz: maximal 160 Zeichen in einer Zeile');card.note=patch.note.trim();}
 if(patch.faceIndex!==undefined){const d=catalogueById.get(card.cardId)!;if(card.faceDown||!hasPhysicalFaces(d)||!Number.isInteger(patch.faceIndex)||!d.faces[patch.faceIndex])throw new Error('Diese Kartenseite ist nicht verfügbar');card.faceIndex=patch.faceIndex;card.isLand=instanceDefinition(card).type.includes('Land');}
}
export function attachCard(state:GameState,card:CardInstance,targetId:string|null){
 if(targetId===null){delete card.attachedTo;return;}
 const d=instanceDefinition(card),target=state.cards.find(c=>c.id===targetId);
 if(card.faceDown||!/(?:Aura|Equipment|Fortification)\b/.test(d.type))throw new Error('Nur offene Auren, Ausrüstung und Befestigungen anlegen');
 if(!target||target.id===card.id||target.zone!=='battlefield')throw new Error('Wähle eine andere Karte auf dem Spielfeld');
 const type=instanceDefinition(target).type;
 if(d.type.includes('Equipment')&&!type.includes('Creature')&&!target.faceDown)throw new Error('Ausrüstung an eine Kreatur anlegen');
 if(d.type.includes('Fortification')&&!type.includes('Land'))throw new Error('Befestigung an ein Land anlegen');
 for(let current:CardInstance|undefined=target;current;current=state.cards.find(c=>c.id===current!.attachedTo))if(current.id===card.id)throw new Error('Karten können keinen Anlege-Kreis bilden');
 card.attachedTo=target.id;
 if(card.controllerId===target.controllerId){const count=state.cards.filter(c=>c.id!==card.id&&c.attachedTo===target.id).length;card.position={x:Math.min(.94,target.position.x+.085+count*.045),y:Math.min(.86,target.position.y+.09)};}
}
// Carry linked permanents only on the same playmat. A control change never steals Equipment.
export function repositionCard(state:GameState,card:CardInstance,x:number,y:number){
 const dx=x-card.position.x,dy=y-card.position.y;card.position={x,y};
 const carried=new Set([card.id]);
 const carry=(host:CardInstance)=>{for(const child of state.cards.filter(c=>c.attachedTo===host.id&&c.controllerId===host.controllerId&&c.zone==='battlefield'&&!carried.has(c.id))){carried.add(child.id);child.position={x:Math.max(.04,Math.min(.96,child.position.x+dx)),y:Math.max(.12,Math.min(.88,child.position.y+dy))};carry(child);}};carry(card);
}
