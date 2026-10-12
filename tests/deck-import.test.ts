import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDeckList,importedDeck} from '../shared/deck-import.ts';
import {catalogue} from '../shared/catalogue.ts';
import {checkDeck} from '../shared/deck-rules.ts';
import {deckstatsURL,fetchDeckstats,deckstatsDocument} from '../server/deckstats.ts';
const id=(name:string)=>catalogue.find(c=>c.name===name)!.id;
test('Deckstats and Arena exports preserve commander, set suffixes, quantities and exclude sideboards',()=>{
 const p=parseDeckList('//Commander\n1 Atraxa, Praetors\' Voice (2XM) 190\n\n//Main\n49 Forest\n50 Island\n\n//Sideboard\n1 Sol Ring');
 assert.equal(p.total,100);assert.deepEqual(p.issues,[]);assert.equal(p.warnings.length,1);
 const d=importedDeck(p,'test',p.commanderIds[0]);assert.equal(d.quantities[id('Forest')],49);assert.equal(d.quantities[id('Sol Ring')],undefined);assert.doesNotThrow(()=>checkDeck(d,true));
});
test('named partners are imported as two commanders and combine color identity',()=>{
 const p=parseDeckList('Commander\n1 Tymna the Weaver\n1 Thrasios, Triton Hero\nDeck\n98 Forest');
 const d=importedDeck(p,'pair',p.commanderIds[0],p.commanderIds[1]);assert.doesNotThrow(()=>checkDeck(d,true));
});
test('unknown names, malformed rows and duplicate commanders cannot silently create a partial deck',()=>{
 for(const list of ['Commander\n1 Atraxa, Praetors\' Voice\nDeck\n1 Not A Real Card','Commander\n1 Atraxa, Praetors\' Voice\nDeck\ninvalid line','Commander\n2 Atraxa, Praetors\' Voice']){const p=parseDeckList(list);assert.ok(p.issues.length);assert.throws(()=>importedDeck(p,'bad',id("Atraxa, Praetors' Voice")));}
 const p=parseDeckList("2 Atraxa, Praetors' Voice\n98 Forest");assert.throws(()=>importedDeck(p,'bad',id("Atraxa, Praetors' Voice")),/genau einmal/);
});
test('front-face aliases and curly apostrophes match full catalogue names',()=>{
 const p=parseDeckList('1 Atraxa, Praetors’ Voice\n1 Bala Ged Recovery\n1 Sol Ring #Ramp');assert.deepEqual(p.issues,[]);assert.equal(p.total,3);assert.equal(p.commanderIds[0],id("Atraxa, Praetors' Voice"));assert.ok(p.quantities[id('Bala Ged Recovery // Bala Ged Sanctuary')]);
});
test('Deckstats URL validation prevents other destinations, credentials and non-deck paths',()=>{
 for(const link of ['http://deckstats.net/decks/1-test','https://deckstats.net.evil.test/decks/1-test','https://localhost/decks/1-test','https://name:secret@deckstats.net/decks/1-test','https://deckstats.net/auth','https://deckstats.net:8443/decks/1-test'])assert.throws(()=>deckstatsURL(link));
 assert.equal(deckstatsURL('https://deckstats.net/decks/123/456-my-deck?lng=de#x').href,'https://deckstats.net/decks/123/456-my-deck');
});
test('public export retrieval rejects redirects outside Deckstats, blocks and oversized responses',async()=>{
 const redirect=(async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/admin'}})) as typeof fetch;
 await assert.rejects(fetchDeckstats('https://deckstats.net/decks/1-test',redirect));
 await assert.rejects(fetchDeckstats('https://deckstats.net/decks/1-test',(async()=>new Response('blocked',{status:403})) as typeof fetch),/blockiert/);
 await assert.rejects(fetchDeckstats('https://deckstats.net/decks/1-test',(async()=>new Response('x',{headers:{'content-length':'3000000'}})) as typeof fetch),/groß/);
 const data=await fetchDeckstats('https://deckstats.net/decks/1-test',(async()=>new Response('Commander\n1 Grist, the Hunger Tide\nDeck\n99 Forest')) as typeof fetch);assert.equal(parseDeckList(data.text).total,100);
});
test('HTML error pages cannot be interpreted as deck cards',()=>{
 assert.throws(()=>deckstatsDocument('<html><h1>Login required</h1></html>'),/Textliste|Export/);
 const payload={props:{deck:{name:'Pair',cards:[{card:{name:'Tymna the Weaver'},pivot:{quantity:1,is_commander:true}},{card:{name:'Forest'},pivot:{quantity:99}},{card:{name:'Sol Ring'},pivot:{quantity:1,board:'sideboard'}}]}}};
 const data=deckstatsDocument('<div data-page="'+JSON.stringify(payload).replace(/"/g,'&quot;')+'"></div>');assert.equal(data.name,'Pair');assert.equal(parseDeckList(data.text).total,100);
});
