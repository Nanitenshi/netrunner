import {uuid} from '../shared/id.ts';
import { cards } from './seed.ts';
export interface Deck { id:string; name:string; commanderId:string; secondCommanderId?:string; commanderColors?:Record<string,'W'|'U'|'B'|'R'|'G'>; quantities:Record<string,number>; cardGroups?:Record<string,string>; notes?:string; }
const known = new Set(cards.map(card=>card.id));
export const countDeck = (deck:Deck) => (deck.secondCommanderId?2:1) + Object.values(deck.quantities).reduce((sum,n)=>sum+n,0);
export function createDeck():Deck {
  return {id:uuid(),name:'Mein Commander-Deck',commanderId:cards[0].id,quantities:{}};
}
export function changeQuantity(deck:Deck,cardId:string,delta:number):Deck {
  if(!known.has(cardId)||(cardId===deck.commanderId||cardId===deck.secondCommanderId)||!Number.isInteger(delta)||Math.abs(delta)>100)return deck;
  const quantities={...deck.quantities};
  const amount=Math.max(0,Math.min(99,(quantities[cardId]||0)+delta));
  if(amount)quantities[cardId]=amount;else delete quantities[cardId];
  return {...deck,quantities};
}
export function readDecks():Deck[] {
  try {
    const data=JSON.parse(localStorage.getItem('nexus.decks')||'[]');
    if(!Array.isArray(data))return [];
    return data.filter((d:Deck)=>typeof d?.id==='string'&&typeof d.name==='string'&&known.has(d.commanderId)&&(!d.secondCommanderId||known.has(d.secondCommanderId))&&d.quantities&&Object.entries(d.quantities).every(([id,n])=>known.has(id)&&id!==d.commanderId&&id!==d.secondCommanderId&&Number.isInteger(n)&&n>0&&n<=99)).map((d:Deck)=>({...d,cardGroups:d.cardGroups&&typeof d.cardGroups==='object'?Object.fromEntries(Object.entries(d.cardGroups).filter(([id,name])=>known.has(id)&&typeof name==='string'&&name.trim().length>0&&name.trim().length<=40).slice(0,500).map(([id,name])=>[id,name.trim()])):undefined,notes:typeof d.notes==='string'?d.notes.slice(0,5000):undefined}));
  }catch{return [];}
}

