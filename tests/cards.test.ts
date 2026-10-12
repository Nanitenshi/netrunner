import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeScryfallCard, type ScryfallCard} from '../shared/cards.ts';
import {cards} from '../src/seed.ts';
const fixture: ScryfallCard = {
  id:'fixture',name:'Test card',cmc:2,color_identity:['G'],colors:['G'],mana_cost:'{1}{G}',
  type_line:'Creature',power:'*',toughness:'1+*',scryfall_uri:'https://scryfall.com',image_uris:{large:'https://example.test/card.jpg'},
};
test('cached Atraxa, artifact and land have distinct identity, mana value and base stats',()=>{
  const atraxa=cards.find(c=>c.name==="Atraxa, Praetors' Voice")!;
  assert.deepEqual(atraxa.colorIdentity,['W','U','B','G']);assert.equal(atraxa.manaValue,4);
  assert.equal(atraxa.power,'4');assert.equal(atraxa.toughness,'4');
  const sol=cards.find(c=>c.name==='Sol Ring')!;
  assert.deepEqual(sol.colorIdentity,[]);assert.equal(sol.manaValue,1);assert.equal(sol.power,null);assert.equal(sol.toughness,null);
  const land=cards.find(c=>c.name==='Breeding Pool')!;
  assert.deepEqual(land.colors,[]);assert.deepEqual(land.colorIdentity,['U','G']);assert.equal(land.manaValue,0);
});
test('zero power stays zero; mana production does not become color identity',()=>{
  const birds=cards.find(c=>c.name==='Birds of Paradise')!;
  assert.equal(birds.power,'0');assert.equal(birds.toughness,'1');assert.deepEqual(birds.colorIdentity,['G']);
  assert.deepEqual(cards.find(c=>c.name==='Command Tower')!.colorIdentity,[]);
});
test('variable stats remain strings and mana value uses the API field',()=>{
  const card=normalizeScryfallCard({...fixture,mana_cost:'{X}{G}{G}',cmc:2});
  assert.equal(card.power,'*');assert.equal(card.toughness,'1+*');assert.equal(card.manaValue,2);
  assert.equal(normalizeScryfallCard({...fixture,cmc:.5}).manaValue,.5);
  assert.equal(normalizeScryfallCard({...fixture,power:undefined,toughness:undefined}).power,null);
});
test('card colors and identity are independent and normalized to WUBRG order',()=>{
  const card=normalizeScryfallCard({...fixture,colors:[],color_identity:['G','R','W']});
  assert.deepEqual(card.colors,[]);assert.deepEqual(card.colorIdentity,['W','R','G']);
});
test('double-faced cards keep both faces, using the front image and front stats',()=>{
  const card=normalizeScryfallCard({...fixture,image_uris:undefined,colors:undefined,power:undefined,toughness:undefined,mana_cost:undefined,
    card_faces:[{name:'Front',mana_cost:'{1}{G}',colors:['G'],power:'2',toughness:'3',image_uris:{large:'https://example.test/front.jpg'}},
    {name:'Back',colors:['R'],power:'5',toughness:'4'}],color_identity:['R','G']});
  assert.equal(card.power,'2');assert.equal(card.toughness,'3');assert.equal(card.mana,'{1}{G}');
  assert.equal(card.faces[1].power,'5');assert.deepEqual(card.colorIdentity,['R','G']);
});
test('invalid metadata is rejected rather than silently shown as colorless or zero',()=>{
  assert.throws(()=>normalizeScryfallCard({...fixture,cmc:NaN}));
  assert.throws(()=>normalizeScryfallCard({...fixture,color_identity:['purple']}));
  assert.throws(()=>normalizeScryfallCard({...fixture,image_uris:undefined}));
});
