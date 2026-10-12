import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,cards} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,projectGame,type GameAction,type GameState} from '../shared/game.ts';
import {actionSchema} from '../shared/protocol.ts';
import {manaTotal} from '../shared/mana.ts';
const fixture=()=>enableRules(initialGame());
const send=(state:GameState,action:GameAction,actor='you')=>applyAction(state,actor,action);
const passAll=(state:GameState)=>{for(let i=0,n=state.players.length-state.rules!.passes.length;i<n;i++)state=send(state,{type:'pass'},state.rules!.priority);return state;};

test('mana generation taps one owned source atomically and never uses the stack; spending is bounded',()=>{
 const original=fixture(),source=original.cards.find(c=>c.controllerId==='you'&&c.zone==='battlefield'&&!c.tapped)!;
 let state=send(original,{type:'mana',color:'G',amount:3,sourceCardId:source.id});
 assert.equal(state.players[0].mana?.G,3);assert.equal(state.cards.find(c=>c.id===source.id)!.tapped,true);assert.equal(source.tapped,false);assert.equal(state.rules!.stack.length,0);assert.equal(state.rules!.priority,'you');
 assert.throws(()=>send(state,{type:'mana',color:'G',amount:1,sourceCardId:source.id}));
 assert.throws(()=>send(state,{type:'mana',color:'G',amount:-4}));
 state=send(state,{type:'mana',color:'G',amount:-2});assert.equal(state.players[0].mana?.G,1);
 for(const actor of ['north','east','west'])assert.deepEqual(projectGame(state,actor).players[0].mana,{G:1});
 assert.throws(()=>send(state,{type:'mana',color:'G',amount:1},'north'));
 const enemy=state.cards.find(c=>c.controllerId==='north'&&c.zone==='battlefield')!;
 assert.throws(()=>send(state,{type:'mana',color:'U',amount:1,sourceCardId:enemy.id}));
 for(const amount of [0,1.5,101,-101,Infinity])assert.throws(()=>send(state,{type:'mana',color:'U',amount}));
 assert.equal(actionSchema.safeParse({type:'mana',color:'X',amount:1}).success,false);
 assert.equal(actionSchema.safeParse({type:'mana',color:'W',amount:1,actor:'north'}).success,false);
});

test('floating mana survives priority and stack resolution, empties at step boundary without life loss',()=>{
 let state=send(fixture(),{type:'mana',color:'U',amount:4});const life=state.players[0].life;
 const spell=state.cards.find(c=>c.ownerId==='you'&&c.zone==='hand'&&cards.find(d=>d.id===c.cardId)?.name==='Rhystic Study')!;
 state=send(state,{type:'cast',cardId:spell.id,costsPaid:true});state=send(state,{type:'pass'});assert.equal(manaTotal(state.players[0].mana),4);
 state=passAll(state);assert.equal(manaTotal(state.players[0].mana),4);assert.equal(state.phase,3);
 state=passAll(state);assert.equal(state.phase,4);assert.equal(manaTotal(state.players[0].mana),0);assert.equal(state.players[0].life,life);
});

test('manual retention is per player, removable, and persisted in a serialized game',()=>{
 let state=send(fixture(),{type:'mana',color:'R',amount:2});state=send(state,{type:'retainMana',enabled:true});
 state=send(state,{type:'pass'});state=send(state,{type:'mana',color:'C',amount:3},'north');state=send(state,{type:'pass'},'north');state=send(state,{type:'pass'},'east');state=send(state,{type:'pass'},'west');state=send(state,{type:'pass'});
 assert.equal(state.phase,4);assert.equal(manaTotal(state.players[0].mana),2);assert.equal(manaTotal(state.players[1].mana),0);
 state=JSON.parse(JSON.stringify(state));state=send(state,{type:'retainMana',enabled:false});state=passAll(state);assert.equal(manaTotal(state.players[0].mana),0);
});

test('mana tools work during own manual resolution but do not interrupt another player or a private choice',()=>{
 let state=send(fixture(),{type:'ability',label:'Manueller Testeffekt'});state=passAll(state);
 state=send(state,{type:'mana',color:'B',amount:3});assert.equal(state.rules!.pending?.kind,'manual');
 assert.throws(()=>send(state,{type:'clearMana'},'north'));state=send(state,{type:'clearMana'});assert.equal(manaTotal(state.players[0].mana),0);
 state=send(state,{type:'resolveEffect',choiceId:state.rules!.pending!.id,effect:{kind:'scry',value:2}});
 assert.throws(()=>send(state,{type:'mana',color:'B',amount:1}));
});
