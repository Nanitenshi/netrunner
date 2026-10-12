import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyAction,projectGame,type GameState,type CardInstance,type Zone} from '../shared/game.ts';
import {enableRules} from '../shared/engine.ts';
import {initialGame} from '../src/seed.ts';
import {catalogue} from '../shared/catalogue.ts';
import {instanceDefinition,hasPhysicalFaces} from '../shared/card-state.ts';
import {markedStats} from '../shared/counters.ts';
import {actionSchema} from '../shared/protocol.ts';
import {needsCastDialog} from '../src/direct-play.ts';
import {groupBattlefield} from '../src/opponent-layout.ts';
const def=(name:string)=>{const d=catalogue.find(c=>c.name===name);assert.ok(d,name);return d;};
const fixture=()=>{const s=enableRules(initialGame());s.rules!.turnOnly=true;return s;};
function add(s:GameState,name:string,zone:Zone='battlefield',owner='you'){
 const d=def(name),c:CardInstance={id:`added-${s.cards.length}`,cardId:d.id,zone,ownerId:owner,controllerId:owner,position:{x:.35,y:.35},tapped:false,counters:0};s.cards.push(c);return c;
}
const resolve=(s:GameState)=>{for(let i=0;i<4;i++)s=applyAction(s,s.rules!.priority,{type:'pass'});return s;};
test('manual base values combine with counters, synchronize, and reset independently',()=>{
 let s=fixture();const c=add(s,'Birds of Paradise');c.counters=2;c.markers={plusOne:2};
 s=applyAction(s,'you',{type:'editCard',cardId:c.id,patch:{power:'5',toughness:'6',keywords:['Haste'],note:'+3/+0 bis Zugende'}});
 const changed=s.cards.find(x=>x.id===c.id)!;
 assert.deepEqual(markedStats(changed,'0','1'),{power:'7',toughness:'8',modified:true});
 assert.deepEqual(projectGame(s,'north').cards.find(x=>x.id===c.id)!.addedKeywords,['Haste']);
 assert.equal(c.powerOverride,undefined,'reducer does not mutate input');
 s=applyAction(s,'you',{type:'editCard',cardId:c.id,patch:{power:null,toughness:null}});
 assert.equal(markedStats(s.cards.find(x=>x.id===c.id)!,'0','1').power,'2');
 assert.deepEqual(s.cards.find(x=>x.id===c.id)!.addedKeywords,['Haste']);
 s=applyAction(s,'you',{type:'move',cardId:c.id,zone:'hand'});const moved=s.cards.find(x=>x.id===c.id)!;
 assert.equal(moved.note,undefined);assert.equal(moved.addedKeywords,undefined);assert.equal(moved.counters,0);
});
test('server rejects foreign edits, nonbattlefield state, malformed values and invisible side selection',()=>{
 const s=fixture(),c=add(s,'Birds of Paradise');
 assert.throws(()=>applyAction(s,'north',{type:'editCard',cardId:c.id,patch:{power:'9'}}));
 for(const patch of [{power:'1000'},{power:'NaN'},{faceIndex:1},{keywords:['Invented']},{note:'a'.repeat(161)},{}])assert.throws(()=>applyAction(s,'you',{type:'editCard',cardId:c.id,patch} as any));
 c.zone='hand';assert.throws(()=>applyAction(s,'you',{type:'editCard',cardId:c.id,patch:{power:'9'}}));
 assert.equal(actionSchema.safeParse({type:'editCard',cardId:c.id,patch:{ownerId:'north'}}).success,false);
 assert.equal(actionSchema.safeParse({type:'editCard',cardId:c.id,patch:{power:'*',toughness:'1+*'}}).success,true);
});
test('transform preserves counters and incarnation but leaving the battlefield restores the front',()=>{
 let s=fixture();const c=add(s,'Delver of Secrets // Insectile Aberration');c.incarnation=4;c.counters=1;
 s=applyAction(s,'you',{type:'editCard',cardId:c.id,patch:{faceIndex:1}});const transformed=s.cards.find(x=>x.id===c.id)!;
 assert.equal(instanceDefinition(transformed).name,'Insectile Aberration');assert.equal(instanceDefinition(transformed).power,'3');assert.equal(instanceDefinition(transformed).manaValue,1);
 assert.ok(instanceDefinition(transformed).image.includes('/back/'));assert.equal(transformed.incarnation,4);assert.equal(transformed.counters,1);
 s=applyAction(s,'you',{type:'move',cardId:c.id,zone:'graveyard'});assert.equal(instanceDefinition(s.cards.find(x=>x.id===c.id)!).name,'Delver of Secrets');
 assert.equal(hasPhysicalFaces(def('Fire // Ice')),false);
});
test('modal commander back casts on stack with its own mana value and commander tax',()=>{
 let s=fixture();const c=add(s,'Esika, God of the Tree // The Prismatic Bridge','commander');c.isCommander=true;c.commanderCasts=2;
 s=applyAction(s,'you',{type:'cast',cardId:c.id,faceIndex:1,costsPaid:true});
 assert.equal(s.rules!.stack[0].label,'The Prismatic Bridge');assert.equal(s.rules!.stack[0].manaValue,5);assert.equal(s.cards.find(x=>x.id===c.id)!.commanderCasts,3);
 assert.equal(instanceDefinition(s.cards.find(x=>x.id===c.id)!).name,'The Prismatic Bridge');
 s=resolve(s);assert.equal(s.cards.find(x=>x.id===c.id)!.zone,'battlefield');assert.equal(s.cards.find(x=>x.id===c.id)!.faceIndex,1);
 s=applyAction(s,'you',{type:'move',cardId:c.id,zone:'commander'});assert.equal(s.cards.find(x=>x.id===c.id)!.faceIndex,undefined);
});
test('modal land back uses land allowance and no stack; transform back cannot be cast from hand',()=>{
 let s=fixture();const c=add(s,'Bala Ged Recovery // Bala Ged Sanctuary','hand');
 s=applyAction(s,'you',{type:'move',cardId:c.id,zone:'battlefield',faceIndex:1});
 assert.equal(s.rules!.stack.length,0);assert.equal(s.rules!.landPlays.you,1);assert.equal(instanceDefinition(s.cards.find(x=>x.id===c.id)!).name,'Bala Ged Sanctuary');assert.equal(s.cards.find(x=>x.id===c.id)!.isLand,true);assert.equal(s.cards.find(x=>x.id===c.id)!.tapped,true);assert.equal(s.cards.find(x=>x.id===c.id)!.position.y,.82);
 const delver=add(s,'Delver of Secrets // Insectile Aberration','hand');assert.throws(()=>applyAction(s,'you',{type:'cast',cardId:delver.id,faceIndex:1,costsPaid:true}));
 const land=add(s,'Bala Ged Recovery // Bala Ged Sanctuary','hand');assert.throws(()=>applyAction(s,'you',{type:'move',cardId:land.id,zone:'battlefield',faceIndex:1}));
});
test('attachments move with own host and equipment stays when host leaves; Auras go to owner graveyard',()=>{
 let s=fixture();const host=add(s,'Birds of Paradise'),equipment=add(s,'Lightning Greaves'),aura=add(s,'Rancor','battlefield','north');
 s=applyAction(s,'you',{type:'attach',cardId:equipment.id,targetId:host.id});s=applyAction(s,'north',{type:'attach',cardId:aura.id,targetId:host.id});
 const before=s.cards.find(x=>x.id===equipment.id)!.position;
 s=applyAction(s,'you',{type:'position',cardId:host.id,x:.55,y:.50});
 const moved=s.cards.find(x=>x.id===equipment.id)!;assert.ok(Math.abs(moved.position.x-before.x-.2)<1e-6);
 assert.equal(s.cards.find(x=>x.id===aura.id)!.controllerId,'north');
 s=applyAction(s,'you',{type:'move',cardId:host.id,zone:'hand'});
 assert.equal(s.cards.find(x=>x.id===equipment.id)!.zone,'battlefield');assert.equal(s.cards.find(x=>x.id===equipment.id)!.attachedTo,undefined);
 assert.equal(s.cards.find(x=>x.id===aura.id)!.zone,'graveyard');assert.equal(s.cards.find(x=>x.id===aura.id)!.ownerId,'north');
});
test('control changes keep attachment ownership and association, copies omit attachment and bonuses',()=>{
 let s=fixture();const host=add(s,'Birds of Paradise'),equipment=add(s,'Lightning Greaves');
 s=applyAction(s,'you',{type:'attach',cardId:equipment.id,targetId:host.id});s=applyAction(s,'you',{type:'editCard',cardId:equipment.id,patch:{power:'8',keywords:['Flying'],note:'Text'}});
 s=applyAction(s,'north',{type:'control',cardId:host.id,mode:'take'});
 const source=s.cards.find(c=>c.id===equipment.id)!;assert.equal(source.controllerId,'you');assert.equal(source.attachedTo,host.id);
 s=applyAction(s,'north',{type:'copy',cardId:equipment.id,newId:'copy'});const copy=s.cards.find(c=>c.id==='copy')!;
 assert.equal(copy.attachedTo,undefined);assert.equal(copy.powerOverride,undefined);assert.equal(copy.note,undefined);assert.equal(copy.addedKeywords,undefined);
 s=applyAction(s,'you',{type:'concede'});assert.equal(s.cards.some(c=>c.id===host.id),false);assert.equal(s.cards.find(c=>c.id==='copy')!.attachedTo,undefined);
});
test('attachment guards prevent invalid targets, stealing edits and cycles',()=>{
 let s=fixture();const host=add(s,'Birds of Paradise'),equipment=add(s,'Lightning Greaves'),aura=add(s,'Rancor'),aura2=add(s,'Rancor');
 assert.throws(()=>applyAction(s,'north',{type:'attach',cardId:equipment.id,targetId:host.id}));
 assert.throws(()=>applyAction(s,'you',{type:'attach',cardId:equipment.id,targetId:equipment.id}));
 assert.throws(()=>applyAction(s,'you',{type:'attach',cardId:equipment.id,targetId:s.cards.find(c=>c.zone==='battlefield'&&c.isLand)!.id}));
 s=applyAction(s,'you',{type:'attach',cardId:aura.id,targetId:aura2.id});assert.throws(()=>applyAction(s,'you',{type:'attach',cardId:aura2.id,targetId:aura.id}));
 s=applyAction(s,'you',{type:'attach',cardId:aura.id,targetId:null});assert.equal(s.cards.find(c=>c.id===aura.id)!.attachedTo,undefined,'explicit manual detaching does not silently remove a card');
});
test('Swords uses edited power and counters once; split cards keep combined mana value in library',()=>{
 let s=fixture();const c=add(s,'Birds of Paradise','battlefield','north');c.counters=2;c.powerOverride='5';
 const swords=s.cards.find(c=>c.ownerId==='you'&&c.zone==='hand'&&instanceDefinition(c).name==='Swords to Plowshares')!;
 s=applyAction(s,'you',{type:'cast',cardId:swords.id,targetId:c.id,costsPaid:true});s=resolve(s);assert.equal(s.players.find(p=>p.id==='north')!.life,47);
 const split=add(s,'Fire // Ice','library');assert.equal(instanceDefinition(split).manaValue,4);
});
test('distinct manual state does not merge in overview and ETB target text no longer forces confirmation',()=>{
 const s=fixture(),a=add(s,'Forest'),b=add(s,'Forest');a.powerOverride='3';assert.equal(groupBattlefield([a,b]).length,2);
 assert.equal(needsCastDialog(def('Eternal Witness')),false);assert.equal(needsCastDialog(def('Counterspell')),true);assert.equal(needsCastDialog(def('Esika, God of the Tree // The Prismatic Bridge')),true);
});
