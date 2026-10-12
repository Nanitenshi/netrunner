import type {CardDefinition} from './cards.ts';
import {catalogueById} from './catalogue.ts';
import type {DeckData} from './protocol.ts';

export const roleGroups=['Länder','Mana / Ramp','Kartenziehen','Tutoren','Interaktion','Schutz','Friedhof','Kreaturen','Weitere Karten'];
export const typeGroups=['Länder','Kreaturen','Planeswalker','Artefakte','Verzauberungen','Spontanzauber','Hexereien','Schlachten','Weitere Karten'];
const frontType=(card:CardDefinition)=>card.faces[0]?.type??card.type;
export function cardTypeGroup(card:CardDefinition):string{
 const type=frontType(card);
 const groups=[['Land','Länder'],['Creature','Kreaturen'],['Planeswalker','Planeswalker'],['Artifact','Artefakte'],['Enchantment','Verzauberungen'],['Instant','Spontanzauber'],['Sorcery','Hexereien'],['Battle','Schlachten']];
 return groups.find(([word])=>type.includes(word))?.[1]??'Weitere Karten';
}
/** Conservative text suggestions, not a card-rules or synergy interpreter. */
export function suggestedRole(card:CardDefinition):string{
 if(frontType(card).includes('Land'))return 'Länder';
 const text=(card.faces.length?card.faces.map(f=>f.text).join('\n'):card.text).toLowerCase();
 if(/add (?:\{[wubrgc]\}|[a-z\s]*mana)|search your library for[^.]*land card|put[^.]*land[^.]*onto the battlefield/.test(text))return 'Mana / Ramp';
 if(/\bdraw (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|x|that many|\d+) cards?\b/.test(text))return 'Kartenziehen';
 if(/search your library/.test(text))return 'Tutoren';
 if(/counter target|destroy (?:target|all|each)|exile (?:target|all|each)|(?:deals?|deal) [^.]*damage to (?:any target|target creature|each creature)|return target [^.]*to (?:its|their) owner's hand/.test(text))return 'Interaktion';
 if(/hexproof|shroud|ward\b|indestructible|protection from|phase out/.test(text))return 'Schutz';
 if(/return[^.]*from (?:your|a|the|target player's) graveyard|return target[^.]*graveyard|cast[^.]*from your graveyard/.test(text))return 'Friedhof';
 return frontType(card).includes('Creature')?'Kreaturen':'Weitere Karten';
}
export type GroupMode='role'|'type'|'mana'|'none';
export function groupDeck(deck:DeckData,mode:GroupMode,query='',sort:'name'|'mana'='name'){
 const groups=new Map<string,{id:string;n:number;card:CardDefinition}[]>();
 for(const [id,n] of Object.entries(deck.quantities)){
  const card=catalogueById.get(id);if(!card)continue;
  if(!`${card.name} ${card.type} ${card.text} ${card.faces.map(f=>f.text).join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))continue;
  const custom=deck.cardGroups?.[id]?.trim();
  const group=mode==='role'?(custom||suggestedRole(card)):mode==='type'?cardTypeGroup(card):mode==='mana'?(frontType(card).includes('Land')?'Länder':`${card.manaValue} Mana`):'Alle Karten';
  if(!groups.has(group))groups.set(group,[]);groups.get(group)!.push({id,n,card});
 }
 const order=mode==='role'?roleGroups:mode==='type'?typeGroups:[];
 return [...groups].sort(([a],[b])=>{if(mode==='mana')return (a==='Länder'?999:Number(a.split(' ')[0]))-(b==='Länder'?999:Number(b.split(' ')[0]));const x=order.indexOf(a),y=order.indexOf(b);return (x<0?999:x)-(y<0?999:y)||a.localeCompare(b,'de');}).map(([name,rows])=>({name,count:rows.reduce((n,r)=>n+r.n,0),rows:rows.sort((a,b)=>(sort==='mana'?a.card.manaValue-b.card.manaValue:0)||a.card.name.localeCompare(b.card.name))}));
}
export function analyzeDeck(deck:DeckData){
 const curve=Array<number>(8).fill(0),types:Record<string,number>={},colors:Record<string,number>={W:0,U:0,B:0,R:0,G:0,C:0};let total=0,lands=0,spells=0,mana=0;
 for(const [id,n] of Object.entries(deck.quantities)){
  const c=catalogueById.get(id);if(!c)continue;total+=n;const type=cardTypeGroup(c);types[type]=(types[type]??0)+n;
  if(type==='Länder')lands+=n;else{spells+=n;mana+=c.manaValue*n;curve[Math.min(7,Math.floor(c.manaValue))]+=n;}
  for(const color of c.colorIdentity.length?c.colorIdentity:['C'])colors[color]+=n;
 }
 return {total,lands,spells,average:spells?mana/spells:0,curve,types,colors};
}
export function sampleOpeningHand(deck:DeckData):CardDefinition[]{
 const pool=Object.entries(deck.quantities).flatMap(([id,n])=>{const c=catalogueById.get(id);return c?Array.from({length:n},()=>c):[];});
 const bytes=new Uint32Array(1);
 for(let i=pool.length-1;i>0;i--){const limit=Math.floor(4294967296/(i+1))*(i+1);do{crypto.getRandomValues(bytes);}while(bytes[0]>=limit);const j=bytes[0]%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,7);
}
