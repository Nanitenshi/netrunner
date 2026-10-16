import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forgeDamageError,forgePassLabel,toggleForgeBlock} from '../src/forge-combat.ts';
import {projectForge,type ForgeChoice,type ForgeState} from '../shared/forge-protocol.ts';
const blocks:ForgeChoice={id:'choice',seat:1,kind:'blockers',count:0,options:[{id:'b:a',name:'Bear → A',kind:'block',cardId:'b',targetId:'a',maxBlocks:1},{id:'b:c',name:'Bear → C',kind:'block',cardId:'b',targetId:'c',maxBlocks:1},{id:'w:a',name:'Wall → A',kind:'block',cardId:'w',targetId:'a',maxBlocks:2},{id:'w:c',name:'Wall → C',kind:'block',cardId:'w',targetId:'c',maxBlocks:2},{id:'w:d',name:'Wall → D',kind:'block',cardId:'w',targetId:'d',maxBlocks:2}]};
test('a normal blocker changes assignment in one click while native extra capacity is respected',()=>{
 assert.deepEqual(toggleForgeBlock(blocks,['b:a','w:a'],'b:c'),['w:a','b:c']);
 assert.deepEqual(toggleForgeBlock(blocks,['b:a','w:a'],'w:c'),['b:a','w:a','w:c']);
 assert.deepEqual(toggleForgeBlock(blocks,['w:a','w:c'],'w:d'),['w:a','w:c']);
 assert.deepEqual(toggleForgeBlock(blocks,['w:a','w:c'],'w:a'),['w:c']);
 assert.deepEqual(toggleForgeBlock(blocks,['b:a'],'forged'),['b:a']);
});
const damage:ForgeChoice={id:'damage',seat:0,kind:'damage',count:6,options:[{id:'a',name:'Bear',kind:'card'},{id:'b',name:'Lion',kind:'card'},{id:'defender',name:'Opponent',kind:'player'}],damage:{trample:true,ordered:false,lethal:{a:2,b:2},suggested:{a:2,b:2,defender:2}}};
test('damage confirmation requires full, legal distribution and permits strategic overassignment',()=>{
 assert.equal(forgeDamageError(damage,damage.damage!.suggested),'');
 assert.equal(forgeDamageError(damage,{a:4,b:2}),'');
 assert.match(forgeDamageError(damage,{a:1,b:2,defender:3}),/Trampelschaden/);
 assert.match(forgeDamageError(damage,{a:2,b:2}),/2 Schaden/);
 assert.match(forgeDamageError(damage,{a:1.5,b:2.5,defender:2}),/ganze/);
 const death={...damage,count:3,damage:{...damage.damage!,lethal:{a:1,b:1}}};
 assert.equal(forgeDamageError(death,{a:1,b:1,defender:1}),'');
 const ordered={...damage,damage:{...damage.damage!,ordered:true}};
 assert.match(forgeDamageError(ordered,{a:1,b:5}),/vorherigen/);
 assert.equal(forgeDamageError(damage,{a:1,b:5}),'');
});
test('native combat choice details remain exclusive to their deciding seat',()=>{
 const state:ForgeState={choice:{...damage,error:'Retry'},cards:[],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[]};
 assert.deepEqual(projectForge(state,0).choice?.damage,damage.damage);
 assert.equal(projectForge(state,1).choice?.damage,undefined);
 assert.equal(projectForge(state,1).choice?.error,undefined);
 assert.deepEqual(projectForge(state,1).choice?.options,[]);
});
test('priority hints explain each response window and the top stack object only',()=>{
 assert.match(forgePassLabel({stack:[],combatRunning:true,phase:'COMBAT_DECLARE_BLOCKERS'}),/vor dem Schaden/);
 assert.match(forgePassLabel({stack:[],combatRunning:true,phase:'COMBAT_FIRST_STRIKE_DAMAGE'}),/nach Erstschlagschaden/);
 assert.match(forgePassLabel({stack:[{id:'x',name:'Spell',controller:0,description:''}],combatRunning:true,phase:'COMBAT_DECLARE_BLOCKERS'}),/oberste Stack-Objekt/);
 assert.match(forgePassLabel({stack:[]}),/Zug beenden/);
});
