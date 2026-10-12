import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../shared/catalogue.ts';
import {suggestedRole,groupDeck,analyzeDeck,sampleOpeningHand} from '../shared/deck-analysis.ts';
import {deckSchema} from '../shared/protocol.ts';
import {starterDeck,checkDeck} from '../shared/deck-rules.ts';
const card=(name:string)=>catalogue.find(c=>c.name===name)!;
const fixture=()=>({...starterDeck(),quantities:Object.fromEntries(([['Forest',36],['Sol Ring',1],['Rhystic Study',1],['Counterspell',1],['Cultivate',1]] as [string,number][]).map(([name,n])=>[card(name as string).id,n]))});
test('role suggestions distinguish lands, ramp, draw and interaction; overrides group once',()=>{
 assert.equal(suggestedRole(card('Forest')),'Länder');assert.equal(suggestedRole(card('Sol Ring')),'Mana / Ramp');assert.equal(suggestedRole(card('Cultivate')),'Mana / Ramp');assert.equal(suggestedRole(card('Rhystic Study')),'Kartenziehen');assert.equal(suggestedRole(card('Counterspell')),'Interaktion');
 const deck={...fixture(),cardGroups:{[card('Sol Ring').id]:'Artefakt-Synergie'}};const groups=groupDeck(deck,'role');assert.equal(groups.find(g=>g.name==='Artefakt-Synergie')?.count,1);assert.equal(groups.reduce((n,g)=>n+g.count,0),40);assert.equal(groups.flatMap(g=>g.rows).filter(r=>r.card.name==='Sol Ring').length,1);
 assert.equal(groupDeck(deck,'type').find(g=>g.name==='Artefakte')?.count,1);assert.equal(groupDeck(deck,'mana').find(g=>g.name==='1 Mana')?.count,1);assert.equal(groupDeck(deck,'role','counter target')[0].rows[0].card.name,'Counterspell');
});
test('analysis counts copies, excludes lands and commanders from spell curve and handles multi-color identities',()=>{
 const result=analyzeDeck(fixture());assert.equal(result.total,40);assert.equal(result.lands,36);assert.equal(result.spells,4);assert.equal(result.curve[1],1);assert.equal(result.curve[2],1);assert.equal(result.curve[3],2);assert.equal(result.average,2.25);assert.equal(result.colors.G,37);assert.equal(result.colors.C,1);
 const empty=analyzeDeck({...fixture(),quantities:{}});assert.equal(empty.average,0);assert.ok(empty.curve.every(n=>n===0));
});
test('test hands use the actual library multiplicities, keep commanders out and never mutate the deck',()=>{
 const deck=fixture(),before=structuredClone(deck);for(let i=0;i<30;i++){const hand=sampleOpeningHand(deck);assert.equal(hand.length,7);assert.ok(hand.every(c=>c.id!==deck.commanderId));for(const c of hand)assert.ok(hand.filter(x=>x.id===c.id).length<=deck.quantities[c.id]);}assert.deepEqual(deck,before);assert.equal(sampleOpeningHand({...deck,quantities:{[card('Sol Ring').id]:1}}).length,1);
});
test('groups and notes round-trip through server validation without changing legality',()=>{
 const deck={...starterDeck(),cardGroups:{[card('Sol Ring').id]:'Eigene Gruppe'},notes:'Plan: Mana und Karten aufbauen.'};assert.deepEqual(checkDeck(deck,true).cardGroups,deck.cardGroups);assert.equal(deckSchema.parse(deck).notes,deck.notes);assert.throws(()=>deckSchema.parse({...deck,notes:'x'.repeat(5001)}));assert.throws(()=>deckSchema.parse({...deck,cardGroups:{x:'x'.repeat(41)}}));assert.ok(deckSchema.safeParse(starterDeck()).success);
});
