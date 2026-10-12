import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {applyAction} from '../shared/game.ts';
import {cardCounterTypes,markerCount,markedStats} from '../shared/counters.ts';
import {actionSchema} from '../shared/protocol.ts';
test('typed card counters are independent, bounded and authoritative',()=>{
 const original=initialGame();let game=original;const card=game.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
 for(const counter of cardCounterTypes)game=applyAction(game,'you',{type:'cardCounter',cardId:card.id,counter,amount:2});
 const updated=game.cards.find(c=>c.id===card.id)!;for(const type of cardCounterTypes)assert.equal(markerCount(updated,type),2);
 assert.equal(card.markers,undefined);assert.equal(card.counters,0);
 assert.throws(()=>applyAction(game,'north',{type:'cardCounter',cardId:card.id,counter:'shield',amount:1}));
 game=applyAction(game,'you',{type:'cardCounter',cardId:card.id,counter:'shield',amount:-20});assert.equal(markerCount(game.cards.find(c=>c.id===card.id)!,'shield'),0);
 assert.equal(actionSchema.safeParse({type:'cardCounter',cardId:card.id,counter:'injected',amount:1}).success,false);
 assert.equal(actionSchema.safeParse({type:'playerCounter',counter:'poison',amount:1,player:'north'}).success,false);
});
test('plus and minus counters adjust numeric stats without mutating printed or variable values',()=>{
 const card={...initialGame().cards[0],counters:3,markers:{plusOne:3,minusOne:1}};
 assert.deepEqual(markedStats(card,'4','4'),{power:'6',toughness:'6',modified:true});
 assert.deepEqual(markedStats(card,'*','0'),{power:'*',toughness:'2',modified:true});
 assert.deepEqual(markedStats(card,null,null),{power:null,toughness:null,modified:true});
 assert.equal(markerCount({...card,markers:undefined},'plusOne'),3);
});
test('player counters belong to the session actor and copies do not inherit card counters',()=>{
 let game=initialGame();game=applyAction(game,'you',{type:'playerCounter',counter:'poison',amount:3});game=applyAction(game,'you',{type:'playerCounter',counter:'energy',amount:6});
 assert.equal(game.players[0].counters?.poison,3);assert.equal(game.players[0].counters?.energy,6);assert.equal(game.players[1].counters,undefined);
 const card=game.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
 game=applyAction(game,'you',{type:'cardCounter',cardId:card.id,counter:'shield',amount:2});game=applyAction(game,'you',{type:'counter',cardId:card.id,amount:4});
 game=applyAction(game,'you',{type:'copy',cardId:card.id,newId:'fresh-copy'});const copy=game.cards.at(-1)!;
 assert.equal(markerCount(copy,'plusOne'),0);assert.equal(markerCount(copy,'shield'),0);assert.equal(copy.isCommander,false);
});
