import {catalogueById} from '../shared/catalogue.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,projectGame} from '../shared/game.ts';
import {enableRules,settle} from '../shared/engine.ts';
import {initialGame} from '../src/seed.ts';
import {instanceDefinition} from '../shared/card-state.ts';
import {markedStats} from '../shared/counters.ts';
import {actionSchema} from '../shared/protocol.ts';
function fixture(){const s=enableRules(initialGame());s.activePlayer='you';s.phase=3;s.rules!.priority='you';s.rules!.turnOnly=true;const own=s.cards.filter(c=>c.ownerId==='you'&&c.zone==='battlefield'),enemy=s.cards.find(c=>c.ownerId==='north'&&c.zone==='battlefield')!;return {s,own,enemy};}
test('batch movements are atomic, preserve owner and can safely be corrected',()=>{
 const {s,own,enemy}=fixture(),ids=own.slice(0,2).map(c=>c.id);
 assert.throws(()=>applyAction(s,'you',{type:'batchCards',cardIds:[ids[0],enemy.id],operation:'exile'}));assert.equal(s.cards.find(c=>c.id===ids[0])!.zone,'battlefield');
 const next=applyAction(s,'you',{type:'batchCards',cardIds:ids,operation:'sacrifice'});assert.ok(ids.every(id=>next.cards.find(c=>c.id===id)!.zone==='graveyard'));
 assert.equal(projectGame(next,'north').tableEdits,undefined);assert.equal(projectGame(next,'north').recentTableEdits[0].canUndo,false);
 const undo=applyAction(next,'you',{type:'undoTableEdit',editId:next.tableEdits!.at(-1)!.id,reason:'Falsche Auswahl'});assert.ok(ids.every(id=>undo.cards.find(c=>c.id===id)!.zone==='battlefield'));
 assert.throws(()=>applyAction(next,'north',{type:'undoTableEdit',editId:next.tableEdits!.at(-1)!.id,reason:'Falsche Auswahl'}));
 const changed=applyAction(next,'you',{type:'move',cardId:ids[0],zone:'hand'});assert.throws(()=>applyAction(changed,'you',{type:'undoTableEdit',editId:next.tableEdits!.at(-1)!.id,reason:'Falsche Auswahl'}));
});
test('batch counters and tap avoid partial mixed-ownership edits',()=>{
 const {s,own}=fixture();const next=applyAction(s,'you',{type:'batchCards',cardIds:own.map(c=>c.id),operation:'tap'});assert.ok(next.cards.filter(c=>own.some(x=>x.id===c.id)).every(c=>c.tapped));
 const untap=applyAction(next,'you',{type:'batchCards',cardIds:own.map(c=>c.id),operation:'untap'});assert.ok(untap.cards.filter(c=>own.some(x=>x.id===c.id)).every(c=>!c.tapped));
 assert.equal(actionSchema.safeParse({type:'batchCards',cardIds:[],operation:'tap'}).success,false);
});
test('combat is shared, taps attackers and clears stale blockers and turn marks',()=>{
 const {s,own,enemy}=fixture(),attacker=own.find(c=>instanceDefinition(c).type.includes('Creature'))!;enemy.cardId=attacker.cardId;attacker.tapped=false;enemy.tapped=false;
 const attack=applyAction(s,'you',{type:'combat',operation:'attack',cardIds:[attacker.id],targetId:'north'});assert.equal(attack.cards.find(c=>c.id===attacker.id)!.combat!.targetId,'north');
 const block=applyAction(attack,'north',{type:'combat',operation:'block',cardIds:[enemy.id],targetId:attacker.id});assert.equal(projectGame(block,'east').cards.find(c=>c.id===enemy.id)!.combat!.kind,'block');
 const ended=applyAction(block,'you',{type:'combat',operation:'end',cardIds:[]});assert.ok(ended.cards.every(c=>!c.combat));
 const moved=applyAction(block,'you',{type:'batchCards',operation:'exile',cardIds:[attacker.id]});assert.equal(moved.cards.find(c=>c.id===enemy.id)!.combat,undefined);
 const turn=applyAction(block,'you',{type:'endTurn'});assert.ok(turn.cards.every(c=>!c.combat));
 assert.throws(()=>applyAction(s,'north',{type:'combat',operation:'attack',cardIds:[enemy.id],targetId:'you'}));
});
test('timed stat effects add to marks, expire at turn/source exit and cannot survive target reentry',()=>{
 const {s,own}=fixture(),card=own.find(c=>instanceDefinition(c).power!==null)!,source=own.find(c=>c.id!==card.id)!;const d=instanceDefinition(card);card.counters=2;
 const effected=applyAction(s,'you',{type:'timedEffect',cardIds:[card.id],label:'Kampftrick',duration:'turn',power:3,toughness:4});
 assert.equal(markedStats(effected.cards.find(c=>c.id===card.id)!,d.power,d.toughness).power,String(Number(d.power)+5));
 const expired=applyAction(effected,'you',{type:'endTurn'});assert.equal(expired.timedEffects!.length,0);assert.equal(expired.cards.find(c=>c.id===card.id)!.temporaryPower,undefined);
 const sourced=applyAction(s,'you',{type:'timedEffect',cardIds:[card.id],label:'Aura-Effekt',duration:'source',sourceId:source.id,power:1,toughness:1});const gone=applyAction(sourced,'you',{type:'batchCards',cardIds:[source.id],operation:'exile'});assert.equal(gone.timedEffects!.length,0);
 const moved=applyAction(effected,'you',{type:'batchCards',cardIds:[card.id],operation:'sacrifice'});assert.equal(moved.timedEffects!.length,0);
 const manual=applyAction(s,'you',{type:'timedEffect',cardIds:[card.id],label:'Erinnerung',duration:'manual',power:0,toughness:0});assert.throws(()=>applyAction(manual,'north',{type:'endEffect',effectId:manual.timedEffects![0].id}));
});
test('linked returns move the linked physical cards and respect authorization',()=>{
 const {s,own,enemy}=fixture(),source=own[0],target=own[1];let next=applyAction(s,'you',{type:'batchCards',cardIds:[target.id],operation:'exile'});next=applyAction(next,'you',{type:'effectLink',cardIds:[target.id],sourceId:source.id,label:'Rückkehr'});
 const returned=applyAction(next,'you',{type:'linkedCards',sourceId:source.id,cardIds:[target.id],operation:'battlefield'});assert.equal(returned.cards.find(c=>c.id===target.id)!.zone,'battlefield');assert.equal(returned.cards.find(c=>c.id===target.id)!.effectLinks,undefined);
 assert.throws(()=>applyAction(next,'north',{type:'linkedCards',sourceId:source.id,cardIds:[target.id],operation:'hand'}));assert.throws(()=>applyAction(next,'you',{type:'linkedCards',sourceId:source.id,cardIds:[enemy.id],operation:'hand'}));
});
test('leaving clears owned cards and grants, returns control effects but exiles foreign cards originally cast by leaver',()=>{
 const {s,own,enemy}=fixture();let next=applyAction(s,'you',{type:'control',cardId:enemy.id,mode:'take'});
 const another=next.cards.find(c=>c.ownerId==='north'&&c.zone==='library')!;next=applyAction(next,'you',{type:'deckAction',operation:'look',playerId:'north'});const top=projectGame(next,'you').deckCards[0];next=applyAction(next,'you',{type:'deckAction',operation:'take',playerId:'north',cardIds:[top.id]});
 next=applyAction(next,'you',{type:'timedEffect',cardIds:[enemy.id],label:'Erinnerung',duration:'manual',power:0,toughness:0});const left=applyAction(next,'you',{type:'concede'});
 assert.ok(left.cards.every(c=>c.ownerId!=='you'));assert.equal(left.cards.find(c=>c.id===enemy.id)!.controllerId,'north');assert.equal(left.cards.find(c=>c.id===top.id)!.zone,'exile');assert.equal(left.timedEffects!.length,0);assert.ok((left.deckAccess??[]).every(g=>g.viewer!=='you'));
});

test('undo restores a source-bound bonus together with its source, but refuses a later unrelated effect',()=>{
 const {s,own}=fixture(),target=own[0],source=own[1];const effected=applyAction(s,'you',{type:'timedEffect',cardIds:[target.id],sourceId:source.id,label:'Quelle',duration:'source',power:2,toughness:2});
 const gone=applyAction(effected,'you',{type:'batchCards',cardIds:[source.id],operation:'exile'});assert.equal(gone.timedEffects!.length,0);
 const undo=applyAction(gone,'you',{type:'undoTableEdit',editId:gone.tableEdits!.at(-1)!.id,reason:'Falsche Karte'});assert.equal(undo.timedEffects!.length,1);assert.equal(undo.cards.find(c=>c.id===target.id)!.temporaryPower,2);
 const later=applyAction(gone,'you',{type:'timedEffect',cardIds:[target.id],label:'Neuer Effekt',duration:'manual',power:1,toughness:1});assert.throws(()=>applyAction(later,'you',{type:'undoTableEdit',editId:gone.tableEdits!.at(-1)!.id,reason:'Falsche Karte'}));
});
test('owner leaving removes a stolen card and its spell object without leaving an orphan stack item',()=>{
 const {s,own}=fixture();const top=s.cards.find(c=>c.ownerId==='north'&&c.zone==='library')!;top.cardId=own.find(c=>instanceDefinition(c).type.includes('Creature'))!.cardId;
 let next=applyAction(s,'you',{type:'deckAction',operation:'look',playerId:'north'});next=applyAction(next,'you',{type:'deckAction',operation:'stealExile',playerId:'north',cardIds:[top.id]});next=applyAction(next,'you',{type:'castHidden',cardId:top.id,conditionsMet:true,costsPaid:true});
 const ownerLeft=applyAction(next,'north',{type:'concede'});assert.ok(!ownerLeft.cards.some(c=>c.id===top.id));assert.ok(!ownerLeft.rules!.stack.some(i=>i.cardId===top.id));
 const casterLeft=applyAction(next,'you',{type:'concede'});assert.equal(casterLeft.cards.find(c=>c.id===top.id)!.zone,'exile');assert.equal(casterLeft.rules!.stack.length,0);
});

test('a linked spell copy uses the stack, leaves the original card and vanishes after resolution',()=>{
 const {s,own,enemy}=fixture(),source=own[0],original=s.cards.find(c=>c.ownerId==='you'&&c.zone==='library')!;
 original.cardId=[...catalogueById.values()].find(d=>d.name==='Swords to Plowshares')!.id;enemy.cardId=own.find(c=>instanceDefinition(c).type.includes('Creature'))!.cardId;
 let next=applyAction(s,'you',{type:'correctCard',cardId:original.id,zone:'graveyard',tapped:false,reason:'Test vorbereiten'});next=applyAction(next,'you',{type:'effectLink',cardIds:[original.id],sourceId:source.id,label:'Kopie wirken'});
 assert.throws(()=>applyAction(next,'you',{type:'linkedCards',sourceId:source.id,cardIds:[original.id],operation:'spellCopy'}));
 let cast=applyAction(next,'you',{type:'linkedCards',sourceId:source.id,cardIds:[original.id],operation:'spellCopy',targetId:enemy.id});const copiedId=cast.rules!.stack.at(-1)!.cardId!;
 assert.equal(cast.rules!.stack.at(-1)!.free,true);assert.equal(cast.cards.find(c=>c.id===original.id)!.zone,'graveyard');assert.notEqual(copiedId,original.id);
 for(const player of cast.players)cast=applyAction(cast,player.id,{type:'pass'});assert.equal(cast.cards.find(c=>c.id===enemy.id)!.zone,'exile');assert.ok(!cast.cards.some(c=>c.id===copiedId));assert.equal(cast.cards.find(c=>c.id===original.id)!.zone,'graveyard');
});
