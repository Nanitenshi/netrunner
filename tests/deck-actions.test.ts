import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,projectGame} from '../shared/game.ts';
import {enableRules} from '../shared/engine.ts';
import {initialGame} from '../src/seed.ts';
import {actionSchema} from '../shared/protocol.ts';
const start=()=>enableRules(initialGame());
test('deck actions reveal only requested top cards privately or publicly',()=>{
 const s=start(),deck=s.cards.filter(c=>c.ownerId==='north'&&c.zone==='library');
 assert.equal(projectGame(s,'you').deckCards.length,0);
 const look=applyAction(s,'you',{type:'deckAction',operation:'look',playerId:'north',count:2});
 assert.deepEqual(projectGame(look,'you').deckCards.map(c=>c.id),deck.slice(0,2).map(c=>c.id));
 assert.equal(projectGame(look,'north').deckCards.length,0);assert.equal(projectGame(look,'you').libraryCards.length,0);
 const reveal=applyAction(s,'you',{type:'deckAction',operation:'reveal',playerId:'north'});
 assert.equal(projectGame(reveal,'north').deckCards.length,1);
 assert.equal(projectGame(reveal,'you').deckAccess,undefined);
 reveal.rules!.pending={id:'pending',kind:'scry',ownerId:'north',cardIds:[],value:0,public:false};
 assert.equal(projectGame(applyAction(reveal,'you',{type:'deckAction',operation:'close',playerId:'north'}),'north').deckCards.length,0);
});
test('blind mill and exile never expose the remaining library',()=>{
 for(const operation of ['mill','exile'] as const){const s=start(),first=s.cards.find(c=>c.ownerId==='north'&&c.zone==='library')!;
 const next=applyAction(s,'you',{type:'deckAction',operation,playerId:'north'});
 assert.equal(next.cards.find(c=>c.id===first.id)!.zone,operation==='mill'?'graveyard':'exile');
 assert.equal(projectGame(next,'you').deckCards.length,0);assert.equal(projectGame(next,'you').libraryCards.length,0);}
});
test('stealing requires visible cards, preserves ownership and gives battlefield control',()=>{
 const s=start(),first=s.cards.find(c=>c.ownerId==='north'&&c.zone==='library')!;
 const action={type:'deckAction' as const,operation:'take' as const,playerId:'north',cardIds:[first.id]};
 assert.throws(()=>applyAction(s,'you',action));
 const seen=applyAction(s,'you',{type:'deckAction',operation:'look',playerId:'north'}),next=applyAction(seen,'you',action),card=next.cards.find(c=>c.id===first.id)!;
 assert.equal(card.ownerId,'north');assert.equal(card.controllerId,'you');assert.equal(card.zone,'battlefield');
 assert.throws(()=>applyAction(seen,'you',{...action,operation:'hand'}));
 const returned=applyAction(next,'you',{type:'move',cardId:card.id,zone:'graveyard'});assert.equal(returned.cards.find(c=>c.id===card.id)!.controllerId,'north');
});
test('clash reveals both tops and each owner can bottom their card; changed decks invalidate access',()=>{
 const s=start(),next=applyAction(s,'you',{type:'deckAction',operation:'clash',playerId:'north'});
 assert.equal(projectGame(next,'north').deckCards.length,2);assert.match(next.log.at(-1)!,/Clash/);
 const own=next.cards.find(c=>c.ownerId==='you'&&c.zone==='library')!,order=next.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').map(c=>c.id);
 const bottom=applyAction(next,'you',{type:'deckAction',operation:'bottom',playerId:'you',cardIds:[own.id]});
 assert.deepEqual(bottom.cards.filter(c=>c.ownerId==='you'&&c.zone==='library').map(c=>c.id),[...order.slice(1),own.id]);
 const draw=applyAction(next,'north',{type:'correctDraw',count:1,reason:'Test draw'});assert.equal(projectGame(draw,'you').deckCards.filter(c=>c.ownerId==='north').length,0);
 const seen=applyAction(s,'you',{type:'deckAction',operation:'search',playerId:'you'});const chosen=projectGame(seen,'you').deckCards[0];
 assert.equal(applyAction(seen,'you',{type:'deckAction',operation:'hand',playerId:'you',cardIds:[chosen.id]}).cards.find(c=>c.id===chosen.id)!.zone,'hand');
 assert.equal(actionSchema.safeParse({type:'deckAction',operation:'look',playerId:'north',count:101}).success,false);
});

test('exiled stolen spells stay private until casting and resolve under their caster control',()=>{
 const s=start();s.activePlayer='you';s.phase=3;s.rules!.priority='you';const top=s.cards.find(c=>c.ownerId==='north'&&c.zone==='library')!;top.cardId=s.cards.find(c=>c.zone==='battlefield'&&c.ownerId==='you')!.cardId;
 const seen=applyAction(s,'you',{type:'deckAction',operation:'look',playerId:'north'}),exiled=applyAction(seen,'you',{type:'deckAction',operation:'stealExile',playerId:'north',cardIds:[top.id]});
 assert.equal(projectGame(exiled,'north').cards.find(c=>c.id===top.id)!.cardId,'hidden-card');
 assert.equal(projectGame(exiled,'you').cards.find(c=>c.id===top.id)!.exilePlayer,'you');
 assert.throws(()=>applyAction(exiled,'north',{type:'castHidden',cardId:top.id,conditionsMet:true,costsPaid:true}));
 const cast=applyAction(exiled,'you',{type:'castHidden',cardId:top.id,conditionsMet:true,costsPaid:true});assert.equal(cast.cards.find(c=>c.id===top.id)!.controllerId,'you');assert.equal(cast.rules!.stack.at(-1)!.free,false);
 let resolved=cast;for(const player of cast.players)resolved=applyAction(resolved,player.id,{type:'pass'});
 const card=resolved.cards.find(c=>c.id===top.id)!;assert.equal(card.ownerId,'north');assert.equal(card.controllerId,'you');assert.equal(card.zone,'battlefield');assert.equal(card.exilePlayer,undefined);
});
