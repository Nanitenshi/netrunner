import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeQuantity,countDeck,createDeck} from '../src/decks.ts';
import {cards} from '../src/seed.ts';
test('new decks contain exactly one commander and no duplicate commander entry',()=>{
  const d=createDeck();assert.equal(countDeck(d),1);
  assert.equal(changeQuantity(d,d.commanderId,1),d);
});
test('adding and removing a card is immutable and keeps totals correct',()=>{
  const d=createDeck();const id=cards.find(c=>c.name==='Sol Ring')!.id;
  const next=changeQuantity(d,id,1);assert.equal(countDeck(next),2);assert.equal(countDeck(d),1);
  assert.equal(countDeck(changeQuantity(next,id,-1)),1);
});
test('invalid cards or quantities cannot corrupt a saved deck',()=>{
  const d=createDeck();const id=cards[4].id;
  assert.equal(changeQuantity(d,'unknown',1),d);assert.equal(changeQuantity(d,id,NaN),d);
  assert.equal(changeQuantity(d,id,1000),d);
  assert.equal(countDeck(changeQuantity(d,id,-1)),1);
});
