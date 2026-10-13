import {checkDeck} from './deck-rules.ts';
import {catalogueById} from './catalogue.ts';
import type {DeckData} from './protocol.ts';
export interface ForgeDeckCard {name:string;frontName?:string;count:number}
export interface ForgeDeckConfig {name:string;playerName:string;commanders:ForgeDeckCard[];main:ForgeDeckCard[]}
/** Catalog IDs become names on the trusted server, never executable scripts or file paths. */
export function toForgeDeck(input:unknown,playerName:string):{deck:DeckData;config:ForgeDeckConfig}{
 const deck=checkDeck(input,true);
 const item=(id:string,count:number):ForgeDeckCard=>{const card=catalogueById.get(id)!;return {name:card.name,...(card.faces[0]?{frontName:card.faces[0].name}:{}),count};};
 for(const id of [deck.commanderId,deck.secondCommanderId].filter(Boolean) as string[])if(/choose a color before/i.test(catalogueById.get(id)!.text))throw Error('Commander mit einer vorab gewählten Zusatzfarbe bitte vorerst am Casual-Tisch spielen.');
 return {deck,config:{name:deck.name,playerName,commanders:[item(deck.commanderId,1),...(deck.secondCommanderId?[item(deck.secondCommanderId,1)]:[])],main:Object.entries(deck.quantities).map(([id,count])=>item(id,count))}};
}
