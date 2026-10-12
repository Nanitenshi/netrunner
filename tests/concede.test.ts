import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction} from '../shared/game.ts';
test('concession bypasses priority, removes owned objects and advances active seat immutably',()=>{
 const original=enableRules(initialGame());original.rules!.priority='north';original.rules!.stack=[{id:'x',controllerId:'you',kind:'ability',label:'Test'}];
 const next=applyAction(original,'you',{type:'concede'});assert.deepEqual(next.rules!.lost,['you']);assert.equal(next.activePlayer,'north');assert.equal(next.rules!.stack.length,0);assert.ok(next.cards.every(c=>c.ownerId!=='you'));assert.equal(original.rules!.lost.length,0);
});
test('concession during mulligan lets remaining kept players start',()=>{
 let s=enableRules(initialGame(),true);for(const p of s.players.filter(p=>p.id!=='you'))s=applyAction(s,p.id,{type:'keep'});
 s=applyAction(s,'you',{type:'concede'});assert.equal(s.rules!.stage,'playing');assert.equal(s.activePlayer,'north');
});
test('concession clears own unresolved choice and finishes at one survivor',()=>{
 let s=enableRules(initialGame());s.rules!.resolving={id:'r',controllerId:'you',kind:'ability',label:'Test'};s.rules!.pending={id:'p',ownerId:'you',kind:'manual',cardIds:[],public:true,value:0};
 s=applyAction(s,'you',{type:'concede'});assert.equal(s.rules!.pending,null);assert.equal(s.rules!.resolving,null);assert.equal(s.rules!.priority,'north');
 s=applyAction(s,'north',{type:'concede'});s=applyAction(s,'east',{type:'concede'});assert.equal(s.rules!.stage,'finished');assert.equal(s.rules!.priority,'');assert.throws(()=>applyAction(s,s.players.find(p=>!s.rules!.lost.includes(p.id))!.id,{type:'concede'}));
});
test('another player conceding preserves a pending private choice',()=>{
 let s=enableRules(initialGame());s.rules!.pending={id:'p',ownerId:'you',kind:'scry',cardIds:s.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').slice(0,2).map(c=>c.id),public:false,value:2};s.rules!.priority='';
 s=applyAction(s,'north',{type:'concede'});assert.equal(s.rules!.pending?.id,'p');assert.equal(s.rules!.priority,'');
});
