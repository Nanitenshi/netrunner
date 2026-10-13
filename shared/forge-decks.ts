import {checkDeck} from './deck-rules.ts';
import {catalogueById} from './catalogue.ts';
import type {DeckData} from './protocol.ts';
export interface ForgeDeckCard {name:string;frontName?:string;count:number}
export type ForgeAiDifficulty='easy'|'normal'|'hard';
export const forgeAiLevels={easy:{name:'Leicht',description:'Höchstens eine freiwillige Aktion pro eigenem Zug; keine freiwilligen Antworten im gegnerischen Zug.'},normal:{name:'Normal',description:'Bis zu drei freiwillige Aktionen pro eigenem Zug; reagiert auf gegnerische Aktionen.'},hard:{name:'Schwer',description:'Forge entscheidet ohne zusätzliches Aktionslimit; reagiert auch im gegnerischen Zug.'}} as const;
export interface ForgeDeckConfig {name:string;playerName:string;commanders:ForgeDeckCard[];main:ForgeDeckCard[];ai?:{difficulty:ForgeAiDifficulty}}
/** Catalog IDs become names on the trusted server, never executable scripts or file paths. */
export function toForgeDeck(input:unknown,playerName:string):{deck:DeckData;config:ForgeDeckConfig}{
 const deck=checkDeck(input,true);
 const item=(id:string,count:number):ForgeDeckCard=>{const card=catalogueById.get(id)!;return {name:card.name,...(card.faces[0]?{frontName:card.faces[0].name}:{}),count};};
 for(const id of [deck.commanderId,deck.secondCommanderId].filter(Boolean) as string[])if(/choose a color before/i.test(catalogueById.get(id)!.text))throw Error('Commander mit einer vorab gewählten Zusatzfarbe bitte vorerst am Casual-Tisch spielen.');
 return {deck,config:{name:deck.name,playerName,commanders:[item(deck.commanderId,1),...(deck.secondCommanderId?[item(deck.secondCommanderId,1)]:[])],main:Object.entries(deck.quantities).map(([id,count])=>item(id,count))}};
}
