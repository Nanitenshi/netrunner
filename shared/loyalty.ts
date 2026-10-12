import type {CardDefinition} from './cards.ts';
export function loyaltyCosts(card:Pick<CardDefinition,'text'|'type'>){
 if(!card.type.includes('Planeswalker'))return [];
 return card.text.split('\n').flatMap(line=>{const match=line.match(/^\s*([+\-−]?(?:\d+|X))\s*:\s*(.+)$/i);return match?[{cost:match[1].replace('−','-').toUpperCase(),text:match[2]}]:[];});
}
export function loyaltyDelta(cost:string,x=0){
 if(!Number.isInteger(x)||x<0||x>999)throw new Error('X muss zwischen 0 und 999 liegen');
 return cost.includes('X')?(cost.startsWith('-')?-x:x):Number(cost);
}
