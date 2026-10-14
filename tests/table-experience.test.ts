import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,projectGame,type GameState} from '../shared/game.ts';
import {catalogue} from '../shared/catalogue.ts';
import {actionSchema} from '../shared/protocol.ts';
const fixture=()=>{const s=enableRules(initialGame());s.rules!.turnOnly=true;s.phase=3;return s;};
const passAll=(state:GameState)=>{let s=state;for(let i=0,n=4-s.rules!.passes.length;i<n;i++)s=applyAction(s,s.rules!.priority,{type:'pass'});return s;};
test('online action validation accepts token and Hideaway actions and rejects invalid quantities',()=>{
 assert.ok(actionSchema.safeParse({type:'createToken',tokenId:'token-soldier',count:3}).success);
 assert.ok(actionSchema.safeParse({type:'castHidden',cardId:'hidden-instance',conditionsMet:true,costsPaid:true}).success);
 assert.ok(actionSchema.safeParse({type:'effect',effect:{kind:'hideaway',value:4,sourceCardId:'source'}}).success);
 assert.equal(actionSchema.safeParse({type:'createToken',tokenId:'token-soldier',count:31}).success,false);
});
test('created tokens have separate positions and are removed after leaving the battlefield',()=>{
 let s=applyAction(fixture(),'you',{type:'createToken',tokenId:'token-soldier',count:12});
 const tokens=s.cards.filter(c=>c.createdToken);assert.equal(tokens.length,12);assert.equal(new Set(tokens.map(c=>JSON.stringify(c.position))).size,12);
 assert.throws(()=>applyAction(s,'you',{type:'createToken',tokenId:'not-a-token',count:1}));assert.throws(()=>applyAction(s,'you',{type:'createToken',tokenId:'token-soldier',count:31}));
 s=applyAction(s,'you',{type:'move',cardId:tokens[0].id,zone:'graveyard'});assert.ok(!s.cards.some(c=>c.id===tokens[0].id));
});
test('resolved permanents occupy free positions instead of sharing their hand positions',()=>{
 let s=fixture();const source=catalogue.find(c=>c.name==='Rhystic Study')!;
 for(let i=0;i<3;i++)s.cards.push({id:`study-${i}`,cardId:source.id,ownerId:'you',controllerId:'you',zone:'hand',tapped:false,counters:0,position:{x:.16,y:.34}});
 for(let i=0;i<3;i++)s=passAll(applyAction(s,'you',{type:'cast',cardId:`study-${i}`,costsPaid:true,manualCostsConfirmed:true}));
 const cards=s.cards.filter(c=>c.id.startsWith('study-'));assert.ok(cards.every(c=>c.zone==='battlefield'));assert.equal(new Set(cards.map(c=>JSON.stringify(c.position))).size,3);
});
test('Hideaway privately selects one card, hides its identity online, and preserves the remaining library',()=>{
 let s=fixture();const before=s.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').map(c=>c.id);
 s=passAll(applyAction(s,'you',{type:'effect',effect:{kind:'hideaway',value:4}}));assert.equal(s.rules!.pending!.public,false);assert.equal(projectGame(s,'north').choiceCards.length,0);
 const selected=s.rules!.pending!.cardIds[0];assert.throws(()=>applyAction(s,'you',{type:'choose',choiceId:s.rules!.pending!.id,first:[],second:[],decision:'done'}));
 s=applyAction(s,'you',{type:'choose',choiceId:s.rules!.pending!.id,first:[selected],second:[],decision:'done'});
 const actual=s.cards.find(c=>c.id===selected)!;assert.equal(actual.zone,'exile');assert.equal(actual.faceDown,true);
 const enemy=projectGame(s,'north').cards.find(c=>c.id===selected)!;assert.equal(enemy.cardId,'hidden-card');assert.equal(enemy.hiddenFor,undefined);assert.equal(enemy.hideawaySource,undefined);
 assert.equal(projectGame(s,'you').cards.find(c=>c.id===selected)!.cardId,actual.cardId);
 const rest=s.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').map(c=>c.id);assert.deepEqual(rest.slice(0,before.length-4),before.slice(4));assert.equal(rest.length,before.length-1);assert.equal(s.rules!.pending,null);
 assert.throws(()=>applyAction(s,'north',{type:'castHidden',cardId:selected,conditionsMet:true,costsPaid:true}));
});
test('Hideaway can play the hidden card only after explicit condition confirmation and reveals it',()=>{
 let s=fixture();const spell=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand'&&catalogue.find(d=>d.id===c.cardId)?.name==='Cultivate')!;
 spell.zone='exile';spell.faceDown=true;spell.hiddenFor=['you'];
 assert.throws(()=>applyAction(s,'you',{type:'castHidden',cardId:spell.id,conditionsMet:false,costsPaid:true}));
 s=applyAction(s,'you',{type:'castHidden',cardId:spell.id,conditionsMet:true,costsPaid:true});assert.equal(s.rules!.stack.at(-1)!.free,true);assert.equal(s.cards.find(c=>c.id===spell.id)!.faceDown,undefined);assert.notEqual(projectGame(s,'north').cards.find(c=>c.id===spell.id)!.cardId,'hidden-card');
});
test('a Hideaway land adds its ETB ability to the stack and graveyards preserve arrival order',()=>{
 let s=fixture();const land=catalogue.find(d=>d.name==='Windbrisk Heights')!;assert.ok(land);
 s.cards.push({id:'hideaway-land',cardId:land.id,ownerId:'you',controllerId:'you',zone:'hand',isLand:true,tapped:false,counters:0,position:{x:.1,y:.3}});
 s=applyAction(s,'you',{type:'move',cardId:'hideaway-land',zone:'battlefield'});assert.equal(s.rules!.stack.at(-1)!.effect!.kind,'hideaway');assert.equal(s.rules!.stack.at(-1)!.effect!.value,4);
 s=passAll(s);s=applyAction(s,'you',{type:'choose',choiceId:s.rules!.pending!.id,first:[s.rules!.pending!.cardIds[0]],second:[],decision:'done'});
 const field=s.cards.filter(c=>c.controllerId==='you'&&c.zone==='battlefield');s=applyAction(s,'you',{type:'move',cardId:field[1].id,zone:'graveyard'});s=applyAction(s,'you',{type:'move',cardId:field[0].id,zone:'graveyard'});assert.ok(s.cards.find(c=>c.id===field[0].id)!.zoneOrder!>s.cards.find(c=>c.id===field[1].id)!.zoneOrder!);
});
