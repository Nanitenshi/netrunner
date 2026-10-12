import {instanceDefinition} from '../shared/card-state.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {applyAction,projectGame,type GameState} from '../shared/game.ts';
import {trackerValue} from '../shared/table-trackers.ts';
import {recordEffectLink} from '../shared/effect-links.ts';
import {enableRules} from '../shared/engine.ts';
import {actionSchema} from '../shared/protocol.ts';
const add=(s:GameState,kind:'card'|'player'|'custom'|'damage',key:string,value=5)=>applyAction(s,'you',{type:'tableTracker',operation:'create',kind,key,value,x:.4,y:.6});
test('loose marks are public physical objects, owned by the authenticated player and movable without changing their quantity',()=>{
 let s=add(initialGame(),'card','plusOne');const t=s.tableTrackers![0];
 assert.equal(projectGame(s,'east').tableTrackers?.[0].value,5);
 assert.throws(()=>applyAction(s,'east',{type:'tableTracker',operation:'move',id:t.id,x:.2,y:.2}),/eigene/);
 s=applyAction(s,'you',{type:'tableTracker',operation:'move',id:t.id,x:.8,y:.9});assert.equal(s.tableTrackers![0].x,.8);assert.equal(s.tableTrackers![0].value,5);
 assert.throws(()=>applyAction(s,'you',{type:'tableTracker',operation:'create',kind:'card',key:'bogus',x:.5,y:.5}),/Counter/);
 assert.throws(()=>applyAction(s,'you',{type:'tableTracker',operation:'create',kind:'custom',key:'flut',x:NaN,y:.5}),/Position/);
});
test('dropping a physical mark applies its full quantity atomically and cannot change opposing or hidden cards',()=>{
 let s=add(initialGame(),'card','plusOne',10),id=s.tableTrackers![0].id;const c=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!,enemy=s.cards.find(c=>c.ownerId==='east'&&c.zone==='battlefield')!;
 assert.throws(()=>applyAction(s,'you',{type:'tableTracker',operation:'drop',id,cardId:enemy.id}),/eigene/);assert.equal(s.tableTrackers!.length,1);
 s=applyAction(s,'you',{type:'tableTracker',operation:'drop',id,cardId:c.id});assert.equal(s.cards.find(x=>x.id===c.id)!.counters,10);assert.equal(s.tableTrackers!.length,0);
 s=add(s,'custom','  Flut  ',3);id=s.tableTrackers![0].id;s=applyAction(s,'you',{type:'tableTracker',operation:'drop',id,cardId:c.id});assert.deepEqual(s.cards.find(x=>x.id===c.id)!.customCounters,[{name:'Flut',value:3}]);
});
test('physical player trackers share canonical counters with menus, cannot duplicate values and removing the object preserves the count',()=>{
 let s=add(initialGame(),'player','energy',0),t=s.tableTrackers![0];s=applyAction(s,'you',{type:'tableTracker',operation:'change',id:t.id,value:5});assert.equal(s.players[0].counters?.energy,5);
 s=add(s,'player','energy',0);assert.equal(s.tableTrackers!.length,1);
 s=applyAction(s,'you',{type:'playerCounter',counter:'energy',amount:2});assert.equal(trackerValue(s,t),7);
 s=applyAction(s,'you',{type:'tableTracker',operation:'remove',id:t.id});assert.equal(s.players[0].counters?.energy,7);
});
test('commander damage trackers follow the actual commander instance and keep life changes separate',()=>{
 let s=initialGame();const commander=s.cards.find(c=>c.ownerId==='east'&&c.isCommander)!;
 s=add(s,'damage',commander.id,0);s=applyAction(s,'you',{type:'tableTracker',operation:'change',id:s.tableTrackers![0].id,value:8});assert.equal(s.players[0].life,40);assert.equal(s.players[0].commanderDamage?.[0].amount,8);assert.equal(trackerValue(s,s.tableTrackers![0]),8);
});
test('manual effect links stamp the real source and actor, survive source departure, and clear when the affected card changes zones',()=>{
 let s=initialGame();const source=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!,target=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand')!;
 s=applyAction(s,'you',{type:'move',cardId:target.id,zone:'exile'});s=applyAction(s,'you',{type:'effectLink',cardIds:[target.id],sourceId:source.id,label:'spielbar bis Zugende'});
 const link=s.cards.find(c=>c.id===target.id)!.effectLinks![0];assert.equal(link.actorId,'you');assert.equal(link.sourceName,'Birds of Paradise');assert.equal(projectGame(s,'east').cards.find(c=>c.id===target.id)!.effectLinks![0].label,'spielbar bis Zugende');
 s=applyAction(s,'you',{type:'move',cardId:source.id,zone:'graveyard'});assert.equal(s.cards.find(c=>c.id===target.id)!.effectLinks![0].sourceName,'Birds of Paradise');
 s=applyAction(s,'you',{type:'move',cardId:target.id,zone:'hand'});assert.equal(s.cards.find(c=>c.id===target.id)!.effectLinks,undefined);
});
test('source linking protects hidden information and allows your public source to annotate opposing exile without granting control',()=>{
 let s=initialGame();const source=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!,target=s.cards.find(c=>c.ownerId==='east'&&c.zone==='hand')!,privateSource=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand')!;
 s=applyAction(s,'east',{type:'move',cardId:target.id,zone:'exile'});
 assert.throws(()=>applyAction(s,'you',{type:'effectLink',cardIds:[target.id],sourceId:privateSource.id}),/sichtbare/);
 assert.throws(()=>applyAction(s,'you',{type:'effectLink',cardIds:[target.id],label:'not mine'}),/Eigene Quelle/);
 s=applyAction(s,'you',{type:'effectLink',cardIds:[target.id],sourceId:source.id});assert.equal(s.cards.find(c=>c.id===target.id)!.ownerId,'east');
 const hidden=s.cards.find(c=>c.id===privateSource.id)!;recordEffectLink(s,s.cards.find(c=>c.id===target.id)!,'you','Manuell',hidden.id);assert.equal(s.cards.find(c=>c.id===target.id)!.effectLinks!.at(-1)!.sourceId,undefined);
});
test('batch links reject duplicates and invalid targets without partly annotating the state',()=>{
 const s=initialGame(),c=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;assert.throws(()=>applyAction(s,'you',{type:'effectLink',cardIds:[c.id,c.id],label:'Test'}),/verschiedene/);assert.throws(()=>applyAction(s,'you',{type:'effectLink',cardIds:[c.id],label:'Test'}),/Exil/);assert.equal(c.effectLinks,undefined);
 assert.equal(actionSchema.safeParse({type:'tableTracker',operation:'move',id:'counter',x:2,y:.2}).success,false);
 assert.equal(actionSchema.safeParse({type:'effectLink',cardIds:['card'],label:'x',actorId:'you'}).success,false);
});
test('scripted mill automatically records the resolving source and player',()=>{
 let s=enableRules(initialGame());const source=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
 s=applyAction(s,'you',{type:'effect',effect:{kind:'mill',value:2,sourceCardId:source.id}});
 for(const p of ['you','north','east','west'])s=applyAction(s,p,{type:'pass'});
 const milled=s.cards.filter(c=>c.ownerId==='you'&&c.zone==='graveyard');assert.equal(milled.length,2);assert.ok(milled.every(c=>c.effectLinks?.[0].sourceId===source.id&&c.effectLinks[0].label==='Mill'));
});
test('hideaway records its public source without revealing the hidden card to opponents',()=>{
 let s=enableRules(initialGame());const source=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
 s=applyAction(s,'you',{type:'effect',effect:{kind:'hideaway',value:2,sourceCardId:source.id}});for(const p of ['you','north','east','west'])s=applyAction(s,p,{type:'pass'});
 const pending=s.rules!.pending!,id=pending.cardIds[0];s=applyAction(s,'you',{type:'choose',choiceId:pending.id,first:[id],second:[]});
 const mine=projectGame(s,'you').cards.find(c=>c.id===id)!,other=projectGame(s,'east').cards.find(c=>c.id===id)!;
 assert.notEqual(mine.cardId,'hidden-card');assert.equal(other.cardId,'hidden-card');assert.equal(other.effectLinks![0].sourceName,'Birds of Paradise');assert.equal(other.effectLinks![0].label,'Hideaway');
});
test('Swords to Plowshares automatically labels the exiled target with its source and caster',()=>{
 let s=enableRules(initialGame());
 // Select by printed identity so deck order is irrelevant.
 const source=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand'&&instanceDefinition(c).name==='Swords to Plowshares')!,target=s.cards.find(c=>c.ownerId==='east'&&c.zone==='battlefield')!;
 assert.ok(source);
 s=applyAction(s,'you',{type:'cast',cardId:source.id,targetId:target.id,costsPaid:true});for(const p of ['you','north','east','west'])s=applyAction(s,p,{type:'pass'});
 const exiled=s.cards.find(c=>c.id===target.id)!;assert.equal(exiled.zone,'exile');assert.equal(exiled.effectLinks![0].sourceName,'Swords to Plowshares');assert.equal(exiled.effectLinks![0].actorId,'you');
});
test('group counters apply atomically to every selected permanent and reject a mixed ownership group without partial changes',()=>{
 let s=initialGame();const own=s.cards.filter(c=>c.ownerId==='you'&&c.zone==='battlefield').slice(0,3),other=s.cards.find(c=>c.ownerId==='east'&&c.zone==='battlefield')!;
 assert.throws(()=>applyAction(s,'you',{type:'batchCardCounters',cardIds:[own[0].id,other.id],counter:'plusOne',amount:5}),/eigene/);assert.equal(s.cards.find(c=>c.id===own[0].id)!.counters,0);
 s=applyAction(s,'you',{type:'batchCardCounters',cardIds:own.map(c=>c.id),counter:'plusOne',amount:5});assert.ok(own.every(c=>s.cards.find(x=>x.id===c.id)!.counters===5));
 s=applyAction(s,'you',{type:'batchCardCounters',cardIds:own.map(c=>c.id),counter:'custom',name:'Flut',amount:12});assert.ok(own.every(c=>s.cards.find(x=>x.id===c.id)!.customCounters?.[0].value===12));
 assert.throws(()=>applyAction(s,'you',{type:'batchCardCounters',cardIds:[own[0].id,own[0].id],counter:'plusOne',amount:1}),/Gruppen/);
});
test('manually linking an opposing source distinguishes the editor from the player responsible for that source',()=>{
 let s=initialGame();const target=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand')!,source=s.cards.find(c=>c.controllerId==='east'&&c.zone==='battlefield')!;
 s=applyAction(s,'you',{type:'move',cardId:target.id,zone:'exile'});s=applyAction(s,'you',{type:'effectLink',cardIds:[target.id],sourceId:source.id,label:'Exil'});const link=s.cards.find(c=>c.id===target.id)!.effectLinks![0];assert.equal(link.actorId,'you');assert.equal(link.causedById,'east');
});
