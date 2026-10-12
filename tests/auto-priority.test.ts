import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';import {enableRules} from '../shared/engine.ts';
import {canAutoPass,hasPossibleReaction,defaultOwnStops,defaultOpponentStops} from '../shared/auto-priority.ts';
import {catalogue} from '../shared/catalogue.ts';
import {reconcileHand,moveHandCard} from '../src/hand-order.ts';
const policy={enabled:true,ownStops:defaultOwnStops,opponentStops:defaultOpponentStops};
const responseFixture=()=>{const s=enableRules(initialGame());s.rules!.turnOnly=true;s.rules!.priority='you';s.rules!.stack=[{id:'spell',controllerId:'north',kind:'spell',label:'Spell'}];s.cards=s.cards.filter(c=>c.ownerId!=='you'||c.zone==='library');return s;};
test('reaction modes only pass live response windows and always preserves priority',()=>{
 const s=responseFixture();assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'always'}),false);assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'off'}),true);assert.equal(canAutoPass(s,'north',{...policy,reactionMode:'off'}),false);s.rules!.stack=[];assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'off'}),false);
});
test('auto response keeps instants and ambiguous activated abilities available',()=>{
 const s=responseFixture();assert.equal(hasPossibleReaction(s,'you'),false);assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'auto'}),true);
 const counter=catalogue.find(c=>c.name==='Counterspell')!;s.cards.push({id:'counter',cardId:counter.id,ownerId:'you',controllerId:'you',zone:'hand',tapped:false,counters:0,position:{x:.2,y:.2}});assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'auto'}),false);s.rules!.stack[0].kind='ability';assert.equal(hasPossibleReaction(s,'you'),false);
 const card=catalogue.find(c=>c.name==='Walking Ballista')!;s.cards.push({id:'ballista',cardId:card.id,ownerId:'you',controllerId:'you',zone:'battlefield',tapped:false,counters:0,position:{x:.5,y:.5}});assert.equal(hasPossibleReaction(s,'you'),true);
});
test('no reaction mode passes an unresolved choice or a lost player',()=>{
 const s=responseFixture();s.rules!.pending={id:'choice',ownerId:'you',kind:'manual',cardIds:[],value:0,public:true};assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'off'}),false);s.rules!.pending=null;s.rules!.lost=['you'];assert.equal(canAutoPass(s,'you',{...policy,reactionMode:'off'}),false);
});
test('auto priority only advances eligible empty steps for the current player',()=>{
 const s=enableRules(initialGame());s.phase=2;assert.ok(canAutoPass(s,'you',policy));assert.equal(canAutoPass(s,'north',policy),false);s.phase=3;assert.equal(canAutoPass(s,'you',policy),false);s.rules!.priority='north';assert.ok(canAutoPass(s,'north',policy));s.phase=6;assert.equal(canAutoPass(s,'north',policy),false);
});
test('auto priority preserves response windows, choices, mana and player safety',()=>{
 const s=enableRules(initialGame());s.phase=2;s.rules!.stack=[{id:'spell',controllerId:'north',kind:'ability',label:'Trigger'}];assert.equal(canAutoPass(s,'you',policy),false);s.rules!.stack=[];s.rules!.pending={id:'p',ownerId:'you',kind:'manual',cardIds:[],value:0,public:true};assert.equal(canAutoPass(s,'you',policy),false);s.rules!.pending=null;s.players[0].mana={C:1};assert.equal(canAutoPass(s,'you',policy),false);s.players[0].mana={};assert.equal(canAutoPass(s,'you',{...policy,enabled:false}),false);s.rules!.lost=['you'];assert.equal(canAutoPass(s,'you',policy),false);
});
test('private hand ordering adds new arrivals, removes departed cards and moves without duplication',()=>{
 const order=['c','a','b'];assert.deepEqual(reconcileHand(order,['a','b','d']),['a','b','d']);assert.deepEqual(moveHandCard(order,'c','b',true),['a','b','c']);assert.deepEqual(moveHandCard(order,'b','c'),['b','c','a']);assert.deepEqual(order,['c','a','b']);assert.deepEqual(moveHandCard(order,'unknown','a'),order);assert.deepEqual(reconcileHand(['a','a'],['a','b']),['a','b']);
});
