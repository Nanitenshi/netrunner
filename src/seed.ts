import type { GameState, CardInstance, Zone } from '../shared/game';
import type { CardDefinition } from '../shared/cards';
export {catalogue as cards} from '../shared/catalogue.ts';
import {catalogue as cards,catalogueById} from '../shared/catalogue.ts';
export const definition = (id:string):CardDefinition => {const card=catalogueById.get(id);if(!card)throw new Error('Unbekannte Karte');return card;};
export function initialGame(): GameState {
  const players = [
    { id: 'you', name: 'Du', commander: "Atraxa, Praetors' Voice", color: '#63dfca', life: 40 },
    { id: 'north', name: 'Spieler 2', commander: 'The Ur-Dragon', color: '#e1ad71', life: 40 },
    { id: 'east', name: 'Spieler 3', commander: 'Muldrotha, the Gravetide', color: '#9c94e9', life: 40 },
    { id: 'west', name: 'Spieler 4', commander: 'Edgar Markov', color: '#e38a99', life: 40 },
  ];
  const instances: CardInstance[] = [];
  const add = (ownerId: string, name: string, zone: Zone, x = .1, y = .3) => {
    const card = cards.find(c => c.name === name)!;
    instances.push({ id: `${ownerId}-${instances.length}`, cardId: card.id, ownerId, controllerId: ownerId, zone, tapped: false, counters: 0, position: { x, y }, isCommander:zone==='commander',commanderCasts:0,isLand:card.type.includes('Land') });
  };
  players.forEach((p, i) => {
    add(p.id, p.commander, 'commander');
    const field = i === 0 ? ['Birds of Paradise', 'Sol Ring', 'Arcane Signet', 'Command Tower', 'Breeding Pool', 'Forest'] : i === 1 ? ['Sol Ring', 'Lightning Greaves', 'Command Tower'] : i === 2 ? ['Eternal Witness', 'Llanowar Elves', 'Forest'] : ['Vampire Nighthawk', 'Skullclamp', 'Command Tower'];
    const placement={land:0,spell:0};
    field.forEach(name=>{const land=cards.find(c=>c.name===name)!.type.includes('Land');const n=land?placement.land++:placement.spell++;add(p.id,name,'battlefield',.14+n*.23,land?.81:.30);});
    if(i>0) ['Forest','Island','Arcane Signet'].forEach((name,j)=>add(p.id,name,'battlefield',.15+j*.22,.75));
    ['Counterspell','Swords to Plowshares','Rhystic Study','Cultivate','Eternal Witness'].forEach(name => add(p.id, name, 'hand'));
    ['Island','Forest','Sol Ring','Arcane Signet','Birds of Paradise','Cultivate','Counterspell'].forEach(name => add(p.id, name, 'library'));
  });
  return { players, cards: instances, activePlayer: 'you', phase: 3, turn: 1, log: ['Lokaler Testtisch geöffnet · keine Online-Verbindung'] };
}

