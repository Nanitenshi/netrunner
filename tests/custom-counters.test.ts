import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {applyAction,projectGame} from '../shared/game.ts';
import {enableRules} from '../shared/engine.ts';
import {changeCustomCounter} from '../shared/counters.ts';
import {groupBattlefield} from '../src/opponent-layout.ts';
import {actionSchema} from '../shared/protocol.ts';

test('custom counters normalize names, combine deltas and reject malformed or unbounded input',()=>{
 const input=[{name:'Flut',value:3}];
 assert.deepEqual(changeCustomCounter(input,'  FLUT  ',2),[{name:'Flut',value:5}]);
 assert.equal(input[0].value,3);
 assert.deepEqual(changeCustomCounter(input,'Flut',-9),[]);
 assert.equal(changeCustomCounter(input,'Flut',999)[0].value,999);
 for(const name of ['', '   ','A'.repeat(29),'Flut\u0000'])assert.throws(()=>changeCustomCounter([],name,1));
 for(const amount of [NaN,Infinity,1.5,1000])assert.throws(()=>changeCustomCounter([],'Flut',amount));
 const full=Array.from({length:16},(_,i)=>({name:`Marke ${i}`,value:1}));
 assert.throws(()=>changeCustomCounter(full,'Noch eine',1));assert.equal(changeCustomCounter(full,'Marke 0',1)[0].value,2);
 assert.equal(actionSchema.safeParse({type:'customCounter',name:'Flut',amount:1,playerId:'north'}).success,false);
});
test('custom counters obey card ownership, keep hidden cards private, clear on zone changes and copies',()=>{
 let g=enableRules(initialGame());const card=g.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
 assert.throws(()=>applyAction(g,'north',{type:'customCounter',cardId:card.id,name:'Flut',amount:2}));
 g=applyAction(g,'you',{type:'customCounter',cardId:card.id,name:'Flut',amount:2});
 assert.equal(projectGame(g,'north').cards.find(c=>c.id===card.id)?.customCounters?.[0].value,2);
 g=applyAction(g,'you',{type:'copy',cardId:card.id,newId:'custom-copy'});
 assert.deepEqual(g.cards.find(c=>c.id==='custom-copy')?.customCounters,[]);
 g=applyAction(g,'you',{type:'move',cardId:card.id,zone:'hand'});
 assert.deepEqual(g.cards.find(c=>c.id===card.id)?.customCounters,[]);
 g=applyAction(g,'you',{type:'customCounter',cardId:card.id,name:'Geheim',amount:1});
 assert.ok(!projectGame(g,'north').cards.some(c=>c.id===card.id));
 g=applyAction(g,'you',{type:'customCounter',name:'Segen',amount:4});
 assert.equal(g.players[0].customCounters?.[0].value,4);assert.equal(g.players[1].customCounters,undefined);
});
test('scripted zone changes clear custom counters and grouping preserves distinct custom markers',()=>{
 let g=enableRules(initialGame());const commander=g.cards.find(c=>c.isCommander&&c.ownerId==='you')!;
 g=applyAction(g,'you',{type:'customCounter',cardId:commander.id,name:'Flut',amount:2});
 g=applyAction(g,'you',{type:'cast',cardId:commander.id,costsPaid:true});
 assert.deepEqual(g.cards.find(c=>c.id===commander.id)?.customCounters,[]);
 const land=initialGame().cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield'&&c.isLand)!;
 const a={...land,id:'a',customCounters:[{name:'A',value:1},{name:'B',value:2}]};
 const b={...land,id:'b',customCounters:[{name:'B',value:2},{name:'A',value:1}]};
 const c={...land,id:'c',customCounters:[{name:'B',value:1}]};
 assert.equal(groupBattlefield([a,b,c],true).length,2);
});
test('commander damage tracks each actual commander, survives zone changes and optionally adjusts life once',()=>{
 let g=enableRules(initialGame());const a=g.cards.find(c=>c.ownerId==='north'&&c.isCommander)!,b=g.cards.find(c=>c.ownerId==='east'&&c.isCommander)!;
 assert.ok(a&&b);
 g=applyAction(g,'you',{type:'commanderDamage',commanderId:a.id,amount:12,adjustLife:true});
 assert.equal(g.players[0].life,28);assert.equal(g.players[0].commanderDamage?.[0].amount,12);
 g=applyAction(g,'you',{type:'commanderDamage',commanderId:b.id,amount:12,adjustLife:false});
 assert.equal(g.rules!.lost.length,0);assert.equal(g.players[0].life,28);
 g=applyAction(g,'north',{type:'move',cardId:a.id,zone:'graveyard'});
 g=applyAction(g,'you',{type:'life',amount:50});
 g=applyAction(g,'you',{type:'commanderDamage',commanderId:a.id,amount:9,adjustLife:false});
 assert.ok(g.rules!.lost.includes('you'));assert.equal(g.players[0].life,78);
});
test('commander damage rejects unknown cards, is received by actor only and corrections use the effective delta',()=>{
 let g=enableRules(initialGame());const commander=g.cards.find(c=>c.isCommander)!;const normal=g.cards.find(c=>!c.isCommander)!;
 assert.throws(()=>applyAction(g,'you',{type:'commanderDamage',commanderId:normal.id,amount:3,adjustLife:false}));
 assert.throws(()=>applyAction(g,'you',{type:'commanderDamage',commanderId:commander.id,amount:NaN,adjustLife:false}));
 g=applyAction(g,'you',{type:'commanderDamage',commanderId:commander.id,amount:4,adjustLife:true});
 g=applyAction(g,'you',{type:'commanderDamage',commanderId:commander.id,amount:-10,adjustLife:true});
 assert.equal(g.players[0].life,40);assert.equal(g.players[0].commanderDamage?.[0].amount,0);assert.equal(g.players[1].commanderDamage,undefined);
 assert.equal(actionSchema.safeParse({type:'commanderDamage',commanderId:commander.id,amount:3,adjustLife:false,playerId:'north'}).success,false);
});

test('partner commander damage remains separate through a control change; copies are not commander sources',()=>{
 let g=enableRules(initialGame());const first=g.cards.find(c=>c.ownerId==='north'&&c.isCommander)!;
 const second={...g.cards.find(c=>c.ownerId==='east'&&c.isCommander)!,id:'partner-second',ownerId:'north',controllerId:'north'};g.cards.push(second);
 for(const source of [first,second])g=applyAction(g,'you',{type:'commanderDamage',commanderId:source.id,amount:12,adjustLife:false});
 assert.equal(g.rules!.lost.includes('you'),false);assert.deepEqual(g.players[0].commanderDamage?.map(d=>d.amount),[12,12]);
 g=applyAction(g,'north',{type:'correctCard',cardId:first.id,zone:'battlefield',tapped:false,reason:'Test placement'});
 g=applyAction(g,'you',{type:'control',cardId:first.id,mode:'take'});
 g=applyAction(g,'you',{type:'commanderDamage',commanderId:first.id,amount:2,adjustLife:false});
 assert.equal(g.players[0].commanderDamage?.find(d=>d.commanderId===first.id)?.amount,14);
 g=applyAction(g,'you',{type:'copy',cardId:first.id,newId:'commander-copy'});
 assert.throws(()=>applyAction(g,'you',{type:'commanderDamage',commanderId:'commander-copy',amount:1,adjustLife:false}));
});
