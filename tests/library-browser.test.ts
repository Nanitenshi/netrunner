import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,projectGame} from '../shared/game.ts';
import {enableRules} from '../shared/engine.ts';
import {initialGame} from '../src/seed.ts';
import {actionSchema} from '../shared/protocol.ts';

test('casual library browsing is private, leaves order intact and does not block the table',()=>{
 const initial=enableRules(initialGame()),order=initial.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').map(c=>c.id);
 const opened=applyAction(initial,'you',{type:'browseLibrary',open:true});
 assert.equal(projectGame(opened,'you').libraryCards.length,order.length);assert.equal(projectGame(opened,'north').libraryCards.length,0);
 assert.equal(projectGame(opened,'you').cards.some(c=>c.zone==='library'),false);assert.equal(opened.rules!.pending,null);
 const otherAction=applyAction(opened,'north',{type:'life',amount:1});assert.equal(otherAction.players.find(p=>p.id==='north')!.life,41);
 const closed=applyAction(otherAction,'you',{type:'browseLibrary',open:false});assert.equal(projectGame(closed,'you').libraryCards.length,0);
 assert.deepEqual(closed.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').map(c=>c.id),order);
});
test('library picks validate ownership and move the selected physical cards without revealing private picks',()=>{
 const opened=applyAction(enableRules(initialGame()),'you',{type:'browseLibrary',open:true}),own=projectGame(opened,'you').libraryCards[0],enemy=opened.cards.find(c=>c.ownerId==='north'&&c.zone==='library')!;
 const pick={type:'libraryPick' as const,cardIds:[own.id],destination:'hand' as const,shuffle:false,tapped:false};
 assert.throws(()=>applyAction(opened,'you',{...pick,cardIds:[enemy.id]}));assert.throws(()=>applyAction(opened,'you',{...pick,cardIds:[own.id,own.id]}));assert.throws(()=>applyAction(opened,'north',pick));
 const moved=applyAction(opened,'you',pick);assert.equal(moved.cards.find(c=>c.id===own.id)!.zone,'hand');assert.equal(projectGame(moved,'north').cards.some(c=>c.id===own.id),false);assert.equal(projectGame(moved,'you').libraryCards.length,0);
 assert.equal(moved.log.at(-1)!.includes(own.cardId),false);
});
test('library picks retain selected top order, shuffle only the remainder and support tapped permanents',()=>{
 const opened=applyAction(enableRules(initialGame()),'you',{type:'browseLibrary',open:true}),cards=projectGame(opened,'you').libraryCards.slice(0,2),ids=cards.map(c=>c.id);
 const top=applyAction(opened,'you',{type:'libraryPick',cardIds:ids,destination:'library',shuffle:true,tapped:false});
 assert.deepEqual(top.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').slice(0,2).map(c=>c.id),ids);
 const moved=applyAction(opened,'you',{type:'libraryPick',cardIds:ids,destination:'battlefield',shuffle:true,tapped:true});assert.ok(moved.cards.filter(c=>ids.includes(c.id)).every(c=>c.zone==='battlefield'&&c.tapped));assert.notDeepEqual(moved.cards.find(c=>c.id===ids[0])!.position,moved.cards.find(c=>c.id===ids[1])!.position);
 assert.equal(actionSchema.safeParse({type:'libraryPick',cardIds:ids,destination:'stack',shuffle:true,tapped:false}).success,false);
});
test('library picks cannot interrupt a scripted private choice',()=>{
 const s=applyAction(enableRules(initialGame()),'you',{type:'browseLibrary',open:true}),card=projectGame(s,'you').libraryCards[0];
 s.rules!.pending={id:'private-choice',kind:'scry',ownerId:'north',cardIds:[],value:0,public:false};
 assert.throws(()=>applyAction(s,'you',{type:'libraryPick',cardIds:[card.id],destination:'hand',shuffle:false,tapped:false}));
 assert.doesNotThrow(()=>applyAction(s,'you',{type:'browseLibrary',open:false}));
});
