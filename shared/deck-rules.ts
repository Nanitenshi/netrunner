import {catalogue,catalogueById,isCommander,commanderPair} from './catalogue.ts';
import {deckSchema,type DeckData} from './protocol.ts';
export {catalogue};
export function checkDeck(input:unknown,complete=false):DeckData {
 const deck=deckSchema.parse(input);
 const commander=catalogueById.get(deck.commanderId);
 if(!commander||!isCommander(commander))throw new Error('Wähle einen legalen Commander aus dem Katalog');
 const second=deck.secondCommanderId?catalogueById.get(deck.secondCommanderId):undefined;
 if(deck.secondCommanderId&&(!second||!commanderPair(commander,second)))throw new Error('Diese Commander dürfen nicht gemeinsam gespielt werden');
 const identity=new Set([...commander.colorIdentity,...(second?.colorIdentity??[])]);
 for(const c of [commander,second].filter(c=>Boolean(c))){if(c&&/choose a color before/i.test(c.text)){const chosen=deck.commanderColors?.[c.id];if(complete&&!chosen)throw new Error(`${c.name}: Farbe vor dem Spiel wählen`);if(chosen)identity.add(chosen);}}
 const seen=new Set([commander.oracleId??commander.name,...(second?[second.oracleId??second.name]:[])]);
 for(const [id,n] of Object.entries(deck.quantities)){
   const card=catalogueById.get(id);
   if(!card||id===commander.id||id===second?.id)throw new Error('Unbekannte Karte oder Commander doppelt im Deck');
   const unique=card.oracleId??card.name;if(seen.has(unique))throw new Error(`${card.name}: doppelte Karte`);seen.add(unique);
   if(complete&&card.colorIdentity.some(color=>!identity.has(color)))throw new Error(`${card.name}: außerhalb der Farbidentität`);
   const unlimited=/A deck can have any number of cards named/.test(card.text);
   const number=card.text.match(/A deck can have up to (\w+) cards named/);
   const limit=number?({two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9} as Record<string,number>)[number[1]]:undefined;
   if(complete&&n>1&&!(card.type.includes('Basic')&&card.type.includes('Land'))&&!unlimited&&!(limit&&n<=limit))throw new Error(`${card.name}: nur ${limit??1} Exemplar(e) erlaubt`);
 }
 const total=(second?2:1)+Object.values(deck.quantities).reduce((a,b)=>a+b,0);
 if(total>250)throw new Error('Maximal 250 Karten einschließlich Commander');
 if(complete&&total<100)throw new Error('Mindestens 100 Karten einschließlich Commander (Hausregel: bis 250)');
 return deck;
}
export function starterDeck():DeckData {
 const commander=catalogue[0];
 const spells=catalogue.slice(0,20).filter(c=>c.id!==commander.id&&!c.type.includes('Legendary')&&!c.type.includes('Basic Land')&&c.colorIdentity.every(color=>commander.colorIdentity.includes(color)));
 const quantities=Object.fromEntries(spells.map(c=>[c.id,1]));const remaining=99-spells.length;
 quantities[catalogue.find(c=>c.name==='Forest')!.id]=Math.ceil(remaining/2);
 quantities[catalogue.find(c=>c.name==='Island')!.id]=Math.floor(remaining/2);
 return {id:'starter-atraxa',name:'Atraxa · Netzwerk-Testdeck',commanderId:commander.id,quantities};
}
