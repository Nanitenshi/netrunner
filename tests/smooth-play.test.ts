import {test} from 'node:test';import assert from 'node:assert/strict';
import {poolPayment} from '../shared/mana-payment.ts';import {catalogue} from '../shared/catalogue.ts';
import {initialGame} from '../src/seed.ts';import {enableRules} from '../shared/engine.ts';import {applyAction} from '../shared/game.ts';import {quickCounter} from '../src/direct-play.ts';
const setup=()=>{const s=enableRules(initialGame());s.rules!.turnOnly=true;const c=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand')!;c.cardId=catalogue.find(c=>c.name==='Sol Ring')!.id;return {s,c};};
test('pool payment reserves colored and true colorless mana before generic mana without mutation',()=>{
 const pool={W:2,U:1,C:2};assert.deepEqual(poolPayment('{2}{W}{U}',pool),{W:1,U:1,C:2});assert.deepEqual(pool,{W:2,U:1,C:2});assert.equal(poolPayment('{C}',{W:5}),null);assert.equal(poolPayment('{W}{W}',{W:1,C:5}),null);assert.deepEqual(poolPayment('{W}',{W:1,C:2},2),{W:1,C:2});
 for(const cost of ['{X}{R}','{W/U}','{2/W}','{B/P}','nonsense'])assert.equal(poolPayment(cost,{W:99,U:99,R:99,B:99,C:99}),null);
});
test('casting pays and releases priority atomically; insufficient payment cannot move the card',()=>{
 const {s,c}=setup();s.players[0].mana={C:2};const next=applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,payFromPool:true,passPriority:true});assert.equal(next.players[0].mana?.C,1);assert.equal(next.rules!.stack.length,1);assert.equal(next.rules!.priority,'north');assert.deepEqual(next.rules!.passes,['you']);assert.equal(s.players[0].mana.C,2);
 const failed=setup(),before=structuredClone(failed.s);assert.throws(()=>applyAction(failed.s,'you',{type:'cast',cardId:failed.c.id,costsPaid:true,payFromPool:true,passPriority:true}));assert.deepEqual(failed.s,before);
});
test('holding priority keeps the caster in control and commander tax is included in pool payment',()=>{
 const {s,c}=setup();s.players[0].mana={C:1};const held=applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,payFromPool:true,passPriority:false});assert.equal(held.rules!.priority,'you');assert.deepEqual(held.rules!.passes,[]);
 const commander=s.cards.find(c=>c.ownerId==='you'&&c.isCommander)!;commander.commanderCasts=2;s.players[0].mana={W:1,U:1,B:1,G:1,C:4};const next=applyAction(s,'you',{type:'cast',cardId:commander.id,costsPaid:true,payFromPool:true});assert.equal(next.cards.find(c=>c.id===commander.id)!.commanderCasts,3);assert.equal(Object.values(next.players[0].mana!).reduce((a,b)=>a+b,0),0);
});
test('quick counter follows planeswalker, saga and creature context',()=>{
 const c=catalogue.find(c=>c.name==='Sol Ring')!;assert.equal(quickCounter({...c,type:'Legendary Planeswalker — Test'}),'loyalty');assert.equal(quickCounter({...c,type:'Enchantment — Saga'}),'lore');assert.equal(quickCounter({...c,type:'Creature — Cat'}),'plusOne');
});
