import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,projectGame} from '../shared/game.ts';
import {enableRules} from '../shared/engine.ts';
import {initialGame} from '../src/seed.ts';
import {actionSchema} from '../shared/protocol.ts';

function fixture(){
 const s=enableRules(initialGame());
 const card=s.cards.find(c=>c.ownerId==='north'&&c.zone==='battlefield')!;
 assert.ok(card);card.tapped=true;card.counters=3;card.markers={plusOne:3};card.customCounters=[{name:'Wunsch',value:2}];card.incarnation=7;
 return {s,card};
}
test('opponent control moves the permanent, preserves ownership and state, and can be returned',()=>{
 const {s,card}=fixture(),before=structuredClone(card);
 const taken=applyAction(s,'you',{type:'control',cardId:card.id,mode:'take'}),c=taken.cards.find(c=>c.id===card.id)!;
 assert.equal(c.ownerId,'north');assert.equal(c.controllerId,'you');assert.equal(c.incarnation,7);assert.equal(c.tapped,true);assert.deepEqual(c.markers,{plusOne:3});assert.deepEqual(c.customCounters,before.customCounters);
 assert.notDeepEqual(c.position,taken.cards.find(x=>x.id!==c.id&&x.controllerId==='you'&&x.zone==='battlefield')!.position);
 assert.equal(projectGame(taken,'north').cards.find(x=>x.id===card.id)!.controllerId,'you');
 assert.throws(()=>applyAction(taken,'north',{type:'tap',cardId:card.id}));
 assert.throws(()=>applyAction(taken,'north',{type:'control',cardId:card.id,mode:'return'}));
 const returned=applyAction(taken,'you',{type:'control',cardId:card.id,mode:'return'}).cards.find(c=>c.id===card.id)!;
 assert.equal(returned.controllerId,'north');assert.equal(returned.tapped,true);assert.deepEqual(returned.markers,before.markers);
 assert.deepEqual(card,before,'input is unchanged');
});
test('a stolen physical card goes to its owner graveyard or hand, while copies cease to exist',()=>{
 const {s,card}=fixture();card.token=false;
 const taken=applyAction(s,'you',{type:'control',cardId:card.id,mode:'take'});
 for(const zone of ['graveyard','hand'] as const){const moved=applyAction(taken,'you',{type:'move',cardId:card.id,zone}),c=moved.cards.find(c=>c.id===card.id)!;assert.equal(c.ownerId,'north');assert.equal(c.controllerId,'north');assert.equal(c.zone,zone);if(zone==='hand')assert.equal(projectGame(moved,'you').cards.some(c=>c.id===card.id),false);}
 const copied=applyAction(taken,'you',{type:'copy',cardId:card.id,newId:'copy'});
 assert.equal(applyAction(copied,'you',{type:'move',cardId:'copy',zone:'graveyard'}).cards.some(c=>c.id==='copy'),false);
});
test('opponent copies belong to their creator without counters, commander status or private metadata',()=>{
 const {s,card}=fixture();card.isCommander=true;card.commanderCasts=4;card.hiddenFor=['north'];card.hideawaySource='secret';
 const copied=applyAction(s,'you',{type:'copy',cardId:card.id,newId:'copy'}),c=copied.cards.find(c=>c.id==='copy')!;
 assert.equal(c.cardId,card.cardId);assert.equal(c.ownerId,'you');assert.equal(c.controllerId,'you');assert.equal(c.token,true);assert.equal(c.tapped,false);assert.equal(c.counters,0);assert.deepEqual(c.markers,{});assert.deepEqual(c.customCounters,[]);assert.equal(c.isCommander,false);assert.equal(c.commanderCasts,0);assert.equal(c.hiddenFor,undefined);assert.equal(c.hideawaySource,undefined);assert.equal(c.createdToken,undefined);
 assert.equal(projectGame(copied,'north').cards.find(c=>c.id==='copy')!.cardId,card.cardId);
});
test('hidden cards cannot be copied; taking a facedown permanent only reveals it to the new controller',()=>{
 const {s,card}=fixture();card.faceDown=true;card.hiddenFor=['north'];
 assert.throws(()=>applyAction(s,'you',{type:'copy',cardId:card.id,newId:'copy'}));
 const taken=applyAction(s,'you',{type:'control',cardId:card.id,mode:'take'});
 assert.equal(projectGame(taken,'you').cards.find(c=>c.id===card.id)!.cardId,card.cardId);
 const hidden=projectGame(taken,'east').cards.find(c=>c.id===card.id)!;
 assert.equal(hidden.cardId,'hidden-card');assert.equal(hidden.tapped,true);assert.equal(hidden.counters,3);assert.equal('hiddenFor' in hidden,false);
 assert.ok(taken.log.at(-1)!.includes('Verdeckte Karte'));
});
test('leaving the table returns borrowed cards and removes cards owned by the departing player',()=>{
 const {s,card}=fixture();card.token=false;
 const taken=applyAction(s,'you',{type:'control',cardId:card.id,mode:'take'});
 const left=applyAction(taken,'you',{type:'concede'}),returned=left.cards.find(c=>c.id===card.id)!;
 assert.equal(returned.controllerId,'north');assert.equal(returned.ownerId,'north');
 assert.equal(left.cards.some(c=>c.ownerId==='you'),false);
 assert.equal(applyAction(taken,'north',{type:'concede'}).cards.some(c=>c.id===card.id),false);
});
test('control and copy cannot target other zones, interrupt a choice, or be used by eliminated players',()=>{
 const {s,card}=fixture();
 for(const zone of ['library','hand','commander','graveyard','exile','stack'] as const){const state=structuredClone(s);state.cards.find(c=>c.id===card.id)!.zone=zone;assert.throws(()=>applyAction(state,'you',{type:'control',cardId:card.id,mode:'take'}));assert.throws(()=>applyAction(state,'you',{type:'copy',cardId:card.id,newId:'copy'}));}
 s.rules!.pending={id:'choice',kind:'scry',ownerId:'north',cardIds:[],value:0,public:false};
 assert.throws(()=>applyAction(s,'you',{type:'control',cardId:card.id,mode:'take'}));assert.throws(()=>applyAction(s,'you',{type:'copy',cardId:card.id,newId:'copy'}));
 s.rules!.pending=null;s.rules!.lost=['you'];assert.throws(()=>applyAction(s,'you',{type:'control',cardId:card.id,mode:'take'}));
 assert.equal(actionSchema.safeParse({type:'control',cardId:card.id,mode:'take',ownerId:'you'}).success,false);
 assert.equal(actionSchema.safeParse({type:'control',cardId:card.id,mode:'take'}).success,true);
});
