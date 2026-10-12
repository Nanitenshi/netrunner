import type {CardDefinition} from '../shared/cards.ts';
import type {ManaColor} from '../shared/mana.ts';
export const quickCounter=(card:CardDefinition)=>((card.displayFace!==undefined?card:card.faces[0]??card).type.includes('Planeswalker')?'loyalty':(card.displayFace!==undefined?card:card.faces[0]??card).type.includes('Saga')?'lore':'plusOne') as 'loyalty'|'lore'|'plusOne';
export function needsCastDialog(card:CardDefinition){
 const face=card.faces[0]??card;
 return ['Counterspell','Swords to Plowshares'].includes(face.name)||card.layout==='modal_dfc'||/\{X\}/i.test(face.mana)||/as an additional cost|choose (?:one|two|three)|choose a|kicker|multikicker|bargain|casualty|escalate|entwine/i.test(face.text);
}
export function basicLandMana(card:CardDefinition):ManaColor|null{
 const face=card.faces[0]??card;if(!/\bBasic\b.*\bLand\b/.test(face.type))return null;
 const types:Record<string,ManaColor>={Plains:'W',Island:'U',Swamp:'B',Mountain:'R',Forest:'G'};
 const matches=Object.entries(types).filter(([type])=>face.type.includes(type));
 return matches.length===1?matches[0][1]:card.name==='Wastes'?'C':null;
}
