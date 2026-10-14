import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,cards} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,projectGame,type GameAction,type GameState} from '../shared/game.ts';
import {actionSchema} from '../shared/protocol.ts';
const fixture=()=>enableRules(initialGame());
const send=(state:GameState,action:GameAction,actor='you')=>applyAction(state,actor,action);
const card=(state:GameState,name:string)=>state.cards.find(c=>c.ownerId==='you'&&c.zone==='hand'&&cards.find(d=>d.id===c.cardId)?.name===name)!;

test('late spells bypass casual timing explicitly, reset passes and give every player a response window',()=>{
 let state=send(fixture(),{type:'pass'});state.phase=10;const spell=card(state,'Rhystic Study');
 assert.throws(()=>send(state,{type:'cast',cardId:spell.id,costsPaid:true,manualCostsConfirmed:true}));
 assert.throws(()=>send(state,{type:'lateCast',cardId:spell.id,costsPaid:false,reason:'Vergessen'}));
 const original=structuredClone(state);state=send(state,{type:'lateCast',cardId:spell.id,costsPaid:true,reason:'Vorhin vergessen, mit Runde abgesprochen'});
 assert.equal(original.cards.find(c=>c.id===spell.id)!.zone,'hand');assert.equal(state.rules!.priority,'you');assert.deepEqual(state.rules!.passes,[]);assert.equal(state.phase,10);assert.equal(state.rules!.stack.length,1);assert.match(state.log.at(-1)!,/KORREKTUR/);
});

test('late trigger and own stack withdrawal keep enemy objects and cost/tax accounting explicit',()=>{
 let state=fixture();const commander=state.cards.find(c=>c.ownerId==='you'&&c.isCommander)!;
 state=send(state,{type:'lateCast',cardId:commander.id,costsPaid:true,reason:'Commander nachholen'});const spellId=state.rules!.stack[0].id;
 state=send(state,{type:'lateAbility',label:'Vergessener Versorgungstrigger',abilityType:'triggered',reason:'Trigger vergessen'},'north');const triggerId=state.rules!.stack.at(-1)!.id;
 assert.throws(()=>send(state,{type:'withdrawStack',stackId:triggerId,reason:'Falsches Objekt'}));
 state=send(state,{type:'withdrawStack',stackId:spellId,reason:'Falsch angesagt'});assert.equal(state.rules!.stack[0].id,triggerId);
 assert.equal(state.cards.find(c=>c.id===commander.id)!.zone,'commander');assert.equal(state.cards.find(c=>c.id===commander.id)!.commanderCasts,1);
 state=send(state,{type:'correctCard',cardId:commander.id,zone:'commander',tapped:false,commanderCasts:0,reason:'Tax ebenfalls zurückgesetzt'});assert.equal(state.cards.find(c=>c.id===commander.id)!.commanderCasts,0);
});

test('zone corrections reset markers, preserve hidden hand and library identities, and return a draw to the top',()=>{
 let state=send(fixture(),{type:'pass'});const source=state.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;source.markers={plusOne:3};source.customCounters=[{name:'Test',value:2}];
 state=send(state,{type:'correctCard',cardId:source.id,zone:'hand',tapped:false,reason:'Falsche Zone'});assert.deepEqual(state.cards.find(c=>c.id===source.id)!.customCounters,[]);assert.equal(state.rules!.priority,'north');
 state=send(state,{type:'correctCard',cardId:source.id,zone:'library',tapped:false,libraryPosition:'top',reason:'Zusätzlich gezogene Karte zurück'});
 for(const player of state.players.filter(p=>p.id!=='you'))assert.equal(projectGame(state,player.id).cards.some(c=>c.id===source.id),false);
 state=send(state,{type:'correctDraw',count:1,reason:'Eigentlichen Draw nachholen'});assert.equal(state.cards.find(c=>c.id===source.id)!.zone,'hand');
 assert.ok(state.players.filter(p=>p.id!=='you').every(p=>!projectGame(state,p.id).cards.some(c=>c.id===source.id)));
 const enemy=state.cards.find(c=>c.ownerId==='north'&&c.zone==='battlefield')!;assert.throws(()=>send(state,{type:'correctCard',cardId:enemy.id,zone:'hand',tapped:false,reason:'Nicht meine Karte'}));
 assert.throws(()=>send(state,{type:'correctDraw',count:20,reason:'Zu viele Karten'}));
 assert.equal(actionSchema.safeParse({type:'correctCard',cardId:source.id,zone:'stack',tapped:false,reason:'Ungültige Zone'}).success,false);
});

test('casual correction never interrupts pending resolution or resurrects a finished game',()=>{
 let state=send(fixture(),{type:'ability',label:'Effekt'});for(let i=0;i<4;i++)state=send(state,{type:'pass'},state.rules!.priority);
 for(const action of [{type:'lateAbility',label:'Trigger',reason:'Zu spät'},{type:'correctDraw',count:1,reason:'Zu spät'},{type:'withdrawStack',stackId:'missing',reason:'Zu spät'}] as GameAction[])assert.throws(()=>send(state,action));
 state=fixture();state.rules!.stage='finished';assert.throws(()=>send(state,{type:'correctDraw',count:1,reason:'Spiel beendet'}));
 assert.throws(()=>send(fixture(),{type:'lateAbility',label:'Trigger',reason:''}));
});
