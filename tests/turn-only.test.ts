import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';import {enableRules} from '../shared/engine.ts';import {applyAction} from '../shared/game.ts';
import {catalogue} from '../shared/catalogue.ts';
test('an instant can open a response in another turn without an empty phase pass round',()=>{
 const state=enableRules(initialGame());state.rules!.turnOnly=true;
 const card=state.cards.find(c=>c.ownerId==='north'&&c.zone==='hand')!;card.cardId=catalogue.find(c=>c.name==='Opt')!.id;
 const next=applyAction(state,'north',{type:'cast',cardId:card.id,costsPaid:true});assert.equal(next.rules!.stack.length,1);assert.equal(next.rules!.priority,'north');assert.equal(next.activePlayer,'you');
 assert.throws(()=>applyAction(next,'you',{type:'ability',label:'Not my priority yet'}));
});
test('one action hands over the turn, resets land plays, untaps and draws without a phase or discard choice',()=>{
 const state=enableRules(initialGame());state.rules!.turnOnly=true;state.rules!.landPlays.you=1;state.players[0].mana={G:2};state.cards.filter(c=>c.controllerId==='north'&&c.zone==='battlefield').forEach(c=>c.tapped=true);
 const hand=state.cards.filter(c=>c.ownerId==='north'&&c.zone==='hand').length;const next=applyAction(state,'you',{type:'endTurn'});
 assert.equal(next.activePlayer,'north');assert.equal(next.turn,state.turn+1);assert.equal(next.phase,3);assert.equal(next.rules!.priority,'north');assert.deepEqual(next.rules!.landPlays,{});assert.equal(next.rules!.pending,null);assert.deepEqual(next.players[0].mana,{});assert.equal(next.cards.filter(c=>c.ownerId==='north'&&c.zone==='hand').length,hand+1);assert.ok(next.cards.filter(c=>c.controllerId==='north'&&c.zone==='battlefield').every(c=>!c.tapped));assert.equal(state.activePlayer,'you');
});
test('empty stack pass rounds keep the same turn in casual turn mode',()=>{
 let state=enableRules(initialGame());state.rules!.turnOnly=true;
 for(const id of ['you','north','east','west'])state=applyAction(state,id,{type:'pass'});
 assert.equal(state.turn,1);assert.equal(state.activePlayer,'you');assert.equal(state.phase,3);assert.equal(state.rules!.priority,'you');assert.deepEqual(state.rules!.passes,[]);
});
