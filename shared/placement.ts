import type {CardInstance,GameState,Zone} from './game.ts';
import {instanceDefinition} from './card-state.ts';
export function cleanAttachments(state:GameState){
 for(const c of state.cards)if(c.attachedTo&&!state.cards.some(t=>t.id===c.attachedTo&&t.zone==='battlefield')){
  delete c.attachedTo;
  if(c.zone==='battlefield'&&instanceDefinition(c).type.includes('Aura'))enterZone(state,c,'graveyard');
 }
}
export function freePosition(state:GameState,card:Pick<CardInstance,'id'|'controllerId'|'isLand'>){
 const occupied=state.cards.filter(c=>c.id!==card.id&&c.controllerId===card.controllerId&&c.zone==='battlefield');
 const rows=card.isLand?[.82,.50,.18]:[.18,.50,.82];
 const slots=rows.flatMap(y=>Array.from({length:7},(_,i)=>({x:.08+i*.14,y})));
 const score=(p:{x:number;y:number})=>occupied.reduce((total,c)=>{const dx=Math.abs(c.position.x-p.x),dy=Math.abs(c.position.y-p.y);return total+(dx<.001&&dy<.001?1000:dx<.105&&dy<.26?1:0);},0);
 return slots.find(p=>score(p)===0)??slots.slice().sort((a,b)=>score(a)-score(b))[0];
}
export function enterZone(state:GameState,card:CardInstance,zone:Zone){
 const changed=card.zone!==zone;
 const preserveFace=card.zone==='stack'&&zone==='battlefield';
 if(changed)card.incarnation=(card.incarnation??0)+1;
 if(changed)card.zoneOrder=Math.max(0,...state.cards.map(c=>c.zoneOrder??0))+1;
 card.zone=zone;card.tapped=false;card.counters=0;card.markers={};card.customCounters=[];
 if(changed){delete card.combat;delete card.controlHistory;delete card.temporaryPower;delete card.temporaryToughness;delete card.exilePlayer;delete card.effectLinks;delete card.faceDown;delete card.hiddenFor;delete card.hideawaySource;delete card.powerOverride;delete card.toughnessOverride;delete card.addedKeywords;delete card.note;delete card.attachedTo;if(!preserveFace)delete card.faceIndex;card.isLand=instanceDefinition(card).type.includes('Land');cleanAttachments(state);}
 if(zone!=='battlefield'&&zone!=='stack'){card.controllerId=card.ownerId;delete card.baseControllerId;}else if(changed&&zone==='battlefield')card.baseControllerId=card.controllerId;
 if(zone==='battlefield'&&changed){card.position=freePosition(state,card);const d=instanceDefinition(card);if(d.type.includes('Planeswalker')&&/^\d+$/.test(d.loyalty??''))card.markers={loyalty:Math.min(999,Number(d.loyalty))};}
}
