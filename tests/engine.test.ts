import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,cards as definitions} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,projectGame,commanderTax,type GameState,type GameAction,type CardInstance} from '../shared/game.ts';
import type {LibraryEffect} from '../shared/rules-types.ts';

const fixture=()=>enableRules(initialGame());
const send=(s:GameState,a:GameAction,actor='you')=>applyAction(s,actor,a);
const allPass=(s:GameState)=>{for(let i=0,n=4-s.rules!.passes.length;i<n;i++)s=send(s,{type:'pass'},s.rules!.priority);return s;};
const own=(s:GameState,zone:string)=>s.cards.filter(c=>c.ownerId==='you'&&c.zone===zone);
const card=(s:GameState,name:string,zone='hand',owner='you')=>s.cards.find(c=>c.ownerId===owner&&c.zone===zone&&definitions.find(d=>d.id===c.cardId)?.name===name)!;
const effect=(s:GameState,e:LibraryEffect)=>allPass(send(s,{type:'effect',effect:e}));
const choose=(s:GameState,first:string[]=[],second:string[]=[],decision:'cast'|'hand'|'decline'|'done'='done',extra={})=>send(s,{type:'choose',choiceId:s.rules!.pending!.id,first,second,decision,...extra});
function lib(s:GameState,names:string[]){s.cards=s.cards.filter(c=>c.ownerId!=='you'||c.zone!=='library');names.forEach((name,i)=>{const d=definitions.find(d=>d.name===name)!;s.cards.push({id:`lib-${i}`,cardId:d.id,ownerId:'you',controllerId:'you',zone:'library',tapped:false,counters:0,isLand:d.type.includes('Land'),position:{x:.2,y:.3}});});return s;}

test('unlimited free mulligans always return seven; keeps gate opening play and the multiplayer first draw',()=>{
  let s=enableRules(initialGame(),true);s.phase=0;
  for(let i=0;i<5;i++){s=send(s,{type:'mulligan'});assert.equal(own(s,'hand').length,7);assert.equal(own(s,'library').length,5);}
  assert.throws(()=>send(s,{type:'effect',effect:{kind:'draw',value:1}}));
  for(const p of s.players)s=send(s,{type:'keep'},p.id);
  assert.equal(s.rules!.stage,'playing');assert.equal(s.phase,1);assert.throws(()=>send(s,{type:'mulligan'}));
  s=allPass(s);assert.equal(s.phase,2);assert.equal(own(s,'hand').length,8);
  s=allPass(s);assert.equal(s.phase,3);assert.equal(own(s,'hand').length,8);
});
test('one object resolves per full pass cycle, caster retains priority and active player gets it after resolution',()=>{
  let s=fixture();const c=card(s,'Rhystic Study');s=send(s,{type:'cast',cardId:c.id,costsPaid:true});
  assert.equal(s.rules!.priority,'you');assert.equal(s.cards.find(x=>x.id===c.id)!.zone,'stack');
  assert.throws(()=>send(s,{type:'pass'},'north'));
  s=send(s,{type:'pass'});s=send(s,{type:'pass'},'north');s=send(s,{type:'pass'},'east');
  assert.equal(s.cards.find(x=>x.id===c.id)!.zone,'stack');s=send(s,{type:'pass'},'west');
  assert.equal(s.cards.find(x=>x.id===c.id)!.zone,'battlefield');assert.equal(s.phase,3);assert.equal(s.rules!.priority,'you');
});
test('Counterspell responds LIFO, invalidates prior passes and checks live spell targets',()=>{
  let s=fixture();s=send(s,{type:'cast',cardId:card(s,'Rhystic Study').id,costsPaid:true});const target=s.rules!.stack[0];
  s=send(s,{type:'pass'});const counter=card(s,'Counterspell','hand','north');
  assert.throws(()=>send(s,{type:'cast',cardId:counter.id,costsPaid:true,targetId:'missing'},'north'));
  s=send(s,{type:'cast',cardId:counter.id,costsPaid:true,targetId:target.id},'north');assert.deepEqual(s.rules!.passes,[]);assert.equal(s.rules!.priority,'north');
  s=allPass(s);assert.equal(s.rules!.stack.length,0);assert.equal(s.cards.find(c=>c.id===target.cardId)!.zone,'graveyard');assert.equal(s.cards.find(c=>c.id===counter.id)!.zone,'graveyard');assert.equal(s.rules!.priority,'you');
});
test('commander tax increments on casting even when countered; source mana value excludes tax',()=>{
  let s=fixture();const c=own(s,'commander')[0];c.commanderCasts=3;
  s=send(s,{type:'cast',cardId:c.id,costsPaid:true});assert.equal(commanderTax(s.cards.find(x=>x.id===c.id)!),8);assert.equal(s.rules!.stack[0].manaValue,4);
  s=send(s,{type:'effect',effect:{kind:'cascade',value:99},sourceId:s.rules!.stack[0].id});assert.equal(s.rules!.stack[1].effect!.value,4);
});
test('noninstant timing, land limit, priority and mana confirmation cannot be bypassed through moving a hand card',()=>{
  let s=fixture();assert.throws(()=>send(s,{type:'cast',cardId:card(s,'Rhystic Study').id,costsPaid:false}));
  assert.throws(()=>send(s,{type:'castCommander',cardId:card(s,'Rhystic Study').id}));
  assert.throws(()=>send(s,{type:'move',cardId:card(s,'Rhystic Study').id,zone:'battlefield'}));
  s=send(s,{type:'pass'});assert.throws(()=>send(s,{type:'cast',cardId:card(s,'Rhystic Study','hand','north').id,costsPaid:true},'north'));
  s=fixture();for(const c of own(s,'library').slice(0,2))c.zone='hand';const lands=own(s,'hand').filter(c=>c.isLand);
  s=send(s,{type:'move',cardId:lands[0].id,zone:'battlefield'});assert.equal(s.rules!.stack.length,0);assert.throws(()=>send(s,{type:'move',cardId:lands[1].id,zone:'battlefield'}));
});
test('private Scry survives serialization; no hidden identities reach other players; choices lock resolution',()=>{
  let s=effect(fixture(),{kind:'scry',value:3});const p=s.rules!.pending!,ids=p.cardIds;
  assert.equal(projectGame(s,'you').choiceCards.length,3);
  for(const enemy of ['north','east','west']){const view=projectGame(s,enemy);assert.equal(view.choiceCards.length,0);ids.forEach(id=>assert.ok(!JSON.stringify(view).includes(`"${id}"`)));}
  assert.throws(()=>send(s,{type:'pass'}));assert.throws(()=>send(s,{type:'shuffle'}));assert.throws(()=>send(s,{type:'choose',choiceId:p.id,first:ids,second:[]},'north'));
  assert.throws(()=>choose(s,[ids[0],ids[0]],[ids[2]]));
  s=JSON.parse(JSON.stringify(s));s=choose(s,[ids[2],ids[0]],[ids[1]]);
  assert.deepEqual(own(s,'library').slice(0,2).map(c=>c.id),[ids[2],ids[0]]);assert.equal(own(s,'library').at(-1)!.id,ids[1]);
  assert.throws(()=>send(s,{type:'choose',choiceId:p.id,first:ids,second:[]}));assert.equal(s.rules!.priority,'you');
});
test('Surveil sends only selected cards to public graveyard and keeps top order',()=>{
  let s=effect(fixture(),{kind:'surveil',value:3});const ids=s.rules!.pending!.cardIds;s=choose(s,[ids[2]],[ids[0],ids[1]]);
  assert.equal(own(s,'library')[0].id,ids[2]);assert.ok(projectGame(s,'north').cards.some(c=>c.id===ids[0]&&c.zone==='graveyard'));
});
test('Discover accepts equality and hand option is not a draw; the rest is bottomed and outside exile',()=>{
  let s=lib(fixture(),['Forest','Arcane Signet','Sol Ring']);s=effect(s,{kind:'discover',value:2});assert.equal(s.rules!.pending!.hitId,'lib-1');
  assert.equal(projectGame(s,'north').choiceCards.length,2);s=choose(s,[],[],'hand');
  assert.equal(s.cards.find(c=>c.id==='lib-1')!.zone,'hand');assert.deepEqual(own(s,'library').map(c=>c.id),['lib-2','lib-0']);assert.equal(own(s,'exile').length,0);assert.equal(s.rules!.stack.length,0);
});
test('Cascade is strictly less, cannot put a card in hand, declining bottoms all exiled cards',()=>{
  let s=effect(lib(fixture(),['Forest','Arcane Signet','Sol Ring','Island']),{kind:'cascade',value:2});assert.equal(s.rules!.pending!.hitId,'lib-2');assert.throws(()=>choose(s,[],[],'hand'));
  const previous=own(s,'hand').length;s=choose(s,[],[],'decline');assert.equal(own(s,'hand').length,previous);assert.equal(own(s,'library')[0].id,'lib-3');assert.deepEqual(new Set(own(s,'library').slice(1).map(c=>c.id)),new Set(['lib-0','lib-1','lib-2']));
});
test('free discovered spell waits on stack for fresh priority cycle, no response during discovery',()=>{
  let s=effect(lib(fixture(),['Forest','Sol Ring','Island']),{kind:'discover',value:1});assert.throws(()=>send(s,{type:'cast',cardId:card(s,'Counterspell','hand','north').id,costsPaid:true},'north'));
  s=choose(s,[],[],'cast',{costsPaid:true});assert.equal(s.rules!.stack.length,1);assert.equal(s.rules!.stack[0].free,true);assert.equal(s.cards.find(c=>c.id==='lib-1')!.zone,'stack');
  s=allPass(s);assert.equal(s.cards.find(c=>c.id==='lib-1')!.zone,'battlefield');
});
test('countering the source does not remove cascade; multiple abilities stay separate',()=>{
  let s=lib(fixture(),['Sol Ring','Arcane Signet','Forest']);s=send(s,{type:'cast',cardId:card(s,'Rhystic Study').id,costsPaid:true});const source=s.rules!.stack[0];
  for(let i=0;i<2;i++)s=send(s,{type:'effect',effect:{kind:'cascade',value:3},sourceId:source.id});
  s=send(s,{type:'pass'});s=send(s,{type:'cast',cardId:card(s,'Counterspell','hand','north').id,costsPaid:true,targetId:source.id},'north');s=allPass(s);
  assert.equal(s.rules!.stack.length,2);s=allPass(s);assert.equal(s.rules!.pending!.hitId,'lib-0');s=choose(s,[],[],'cast',{costsPaid:true});assert.equal(s.rules!.stack.length,2);assert.equal(s.rules!.stack.at(-1)!.kind,'spell');
  s=allPass(s);assert.equal(s.rules!.stack.length,1);s=allPass(s);assert.equal(s.rules!.pending!.hitId,'lib-1');
});
test('no qualifying discovery returns the entire library, zero/empty amounts finish without a stalled choice',()=>{
  for(const kind of ['discover','cascade'] as const){let s=effect(lib(fixture(),['Forest','Island']),{kind,value:0});assert.equal(s.rules!.pending,null);assert.equal(own(s,'library').length,2);assert.equal(own(s,'exile').length,0);}
  for(const kind of ['scry','surveil','look','reveal'] as const){const s=effect(fixture(),{kind,value:0});assert.equal(s.rules!.pending,null);}
});
test('private search enforces ownership, filter, count, public reveal only when requested and tapped destination',()=>{
  let s=effect(fixture(),{kind:'search',value:1,filter:'basic',destination:'battlefield',shuffle:true,tapped:true});const p=s.rules!.pending!,land=s.cards.find(c=>c.id===p.cardIds[0])!;
  assert.equal(projectGame(s,'north').choiceCards.length,0);assert.throws(()=>choose(s,[p.cardIds[2]]));
  s=choose(s,[land.id]);assert.equal(s.cards.find(c=>c.id===land.id)!.zone,'battlefield');assert.equal(s.cards.find(c=>c.id===land.id)!.tapped,true);assert.equal(own(s,'library').length,6);
  s=effect(s,{kind:'search',value:2,filter:'any',destination:'hand',shuffle:false});assert.throws(()=>choose(s,[]));
  const ids=s.rules!.pending!.cardIds.slice(0,2);s=choose(s,ids);assert.ok(ids.every(id=>own(s,'hand').some(c=>c.id===id)));
});
test('Look is private and Reveal public; neither can reorder library cards',()=>{
  for(const kind of ['look','reveal'] as const){let s=effect(fixture(),{kind,value:2});const ids=s.rules!.pending!.cardIds;assert.equal(projectGame(s,'north').choiceCards.length,kind==='look'?0:2);assert.throws(()=>choose(s,[...ids].reverse()));s=choose(s,ids);assert.deepEqual(own(s,'library').slice(0,2).map(c=>c.id),ids);}
});
test('manual spell subeffects resume the original resolution; no fake extra stack or early priority',()=>{
  let s=fixture();const c=card(s,'Cultivate');s=allPass(send(s,{type:'cast',cardId:c.id,costsPaid:true}));assert.equal(s.rules!.pending!.kind,'manual');
  const before=own(s,'hand').length;s=send(s,{type:'resolveEffect',choiceId:s.rules!.pending!.id,effect:{kind:'draw',value:2}});assert.equal(own(s,'hand').length,before+2);assert.equal(s.rules!.pending!.kind,'manual');assert.equal(s.rules!.stack.length,0);assert.equal(s.rules!.priority,'');
  s=send(s,{type:'resolveEffect',choiceId:s.rules!.pending!.id,effect:{kind:'scry',value:2}});s=choose(s,s.rules!.pending!.cardIds);assert.equal(s.rules!.pending!.kind,'manual');s=choose(s);assert.equal(s.cards.find(x=>x.id===c.id)!.zone,'graveyard');assert.equal(s.rules!.priority,'you');
});
test('cleanup asks privately for exact excess, untaps next player and uses stun replacement',()=>{
  let s=fixture();s.phase=10;own(s,'library').slice(0,4).forEach(c=>c.zone='hand');const stunned=card(s,'Sol Ring','battlefield','north');stunned.tapped=true;stunned.markers={stun:1};
  s=allPass(s);assert.equal(s.rules!.pending!.kind,'discard');assert.equal(s.rules!.pending!.value,2);assert.equal(projectGame(s,'north').choiceCards.length,0);assert.throws(()=>choose(s,[],s.rules!.pending!.cardIds));
  const ids=s.rules!.pending!.cardIds;s=choose(s,ids.slice(0,2),ids.slice(2));assert.equal(own(s,'hand').length,7);assert.equal(s.activePlayer,'north');assert.equal(s.phase,1);assert.equal(s.cards.find(c=>c.id===stunned.id)!.tapped,true);assert.equal(s.cards.find(c=>c.id===stunned.id)!.markers!.stun,0);
});
test('failed draw is distinct from an empty library and eliminates after resolution',()=>{
  let s=lib(fixture(),['Forest']);s=effect(s,{kind:'draw',value:1});assert.equal(s.rules!.lost.length,0);s=effect(s,{kind:'draw',value:1});assert.ok(s.rules!.lost.includes('you'));assert.equal(s.activePlayer,'north');assert.ok(!s.cards.some(c=>c.ownerId==='you'));
});
test('invalid numeric inputs and forged choice ids never mutate the original state',()=>{
  const s=fixture(),before=JSON.stringify(s);for(const value of [-1,NaN,1.2,1000])assert.throws(()=>send(s,{type:'effect',effect:{kind:'discover',value}}));assert.equal(JSON.stringify(s),before);
  const pending=effect(s,{kind:'scry',value:2}),saved=JSON.stringify(pending);assert.throws(()=>send(pending,{type:'choose',choiceId:'old',first:[],second:[]}));assert.equal(JSON.stringify(pending),saved);
});

test('a manually activated ability survives its source leaving play and cannot be targeted by Counterspell',()=>{
  let s=fixture();const source=card(s,'Sol Ring','battlefield');s=send(s,{type:'ability',label:'Manueller Effekt',sourceCardId:source.id});const id=s.rules!.stack[0].id;
  s=send(s,{type:'move',cardId:source.id,zone:'graveyard'});s=send(s,{type:'pass'});
  assert.throws(()=>send(s,{type:'cast',cardId:card(s,'Counterspell','hand','north').id,targetId:id,costsPaid:true},'north'));
  s=allPass(s);assert.equal(s.rules!.pending!.kind,'manual');assert.equal(s.rules!.resolving!.label,'Manueller Effekt');s=choose(s);assert.equal(s.rules!.stack.length,0);
});
test('a blinked creature is a new object and is no longer the legal target of the earlier Swords',()=>{
  let s=fixture();const victim=card(s,'Eternal Witness','battlefield','east');s=send(s,{type:'cast',cardId:card(s,'Swords to Plowshares').id,targetId:victim.id,costsPaid:true});
  s=send(s,{type:'pass'});s=send(s,{type:'pass'},'north');s=send(s,{type:'ability',label:'Blink (manuell)',sourceCardId:victim.id},'east');s=allPass(s);
  s=send(s,{type:'move',cardId:victim.id,zone:'exile'},'east');s=send(s,{type:'move',cardId:victim.id,zone:'battlefield'},'east');
  s=send(s,{type:'choose',choiceId:s.rules!.pending!.id,first:[],second:[],decision:'done'},'east');s=allPass(s);
  assert.equal(s.cards.find(c=>c.id===victim.id)!.zone,'battlefield');assert.equal(s.players.find(p=>p.id==='east')!.life,40);
});

test('an effect for another player keeps their looked-at library private even from its controller',()=>{
  let s=effect(fixture(),{kind:'scry',value:2,playerId:'north'});const p=s.rules!.pending!;
  assert.equal(p.ownerId,'north');assert.equal(projectGame(s,'you').choiceCards.length,0);assert.equal(projectGame(s,'north').choiceCards.length,2);
  assert.throws(()=>choose(s,p.cardIds));s=send(s,{type:'choose',choiceId:p.id,first:p.cardIds,second:[]},'north');assert.equal(s.rules!.priority,'you');
});

test('multiface commanders can cast their front face and land backs do not classify front spells as lands',()=>{
 let s=fixture();const esika=definitions.find(c=>c.name==='Esika, God of the Tree // The Prismatic Bridge')!;
 const commander=card(s,"Atraxa, Praetors' Voice",'commander');commander.cardId=esika.id;s=send(s,{type:'cast',cardId:commander.id,costsPaid:true});assert.equal(s.rules!.stack.at(-1)!.label,'Esika, God of the Tree');assert.equal(s.rules!.stack.at(-1)!.manaValue,3);assert.equal(s.cards.find(c=>c.id===commander.id)!.commanderCasts,1);
 s=allPass(s);assert.equal(s.cards.find(c=>c.id===commander.id)!.zone,'battlefield');
 const recovery=definitions.find(c=>c.name==='Bala Ged Recovery // Bala Ged Sanctuary')!;const instance=own(s,'hand')[0];instance.cardId=recovery.id;s=send(s,{type:'cast',cardId:instance.id,costsPaid:true});assert.equal(s.rules!.stack.at(-1)!.label,'Bala Ged Recovery');assert.equal(s.rules!.stack.at(-1)!.manaValue,3);
});


test('manually announced trigger survives its source and neutralizes a permitted stack object only during resolution',()=>{
 let s=fixture();const spell=card(s,'Rhystic Study');s=send(s,{type:'cast',cardId:spell.id,costsPaid:true});const target=s.rules!.stack[0];
 const source=own(s,'battlefield')[0];s=send(s,{type:'ability',abilityType:'triggered',label:'Neutralisiere den Spruch',sourceCardId:source.id});
 assert.equal(s.rules!.stack.at(-1)!.abilityType,'triggered');
 assert.throws(()=>send(s,{type:'counterStack',choiceId:'invalid',stackId:target.id}));
 s=send(s,{type:'move',cardId:source.id,zone:'graveyard'});s=allPass(s);assert.equal(s.rules!.pending?.kind,'manual');
 const choiceId=s.rules!.pending!.id;assert.throws(()=>send(s,{type:'counterStack',choiceId,stackId:target.id},'north'));
 s=send(s,{type:'counterStack',choiceId,stackId:target.id});assert.equal(s.rules!.stack.length,0);assert.equal(s.cards.find(c=>c.id===spell.id)!.zone,'graveyard');
 assert.throws(()=>send(s,{type:'counterStack',choiceId,stackId:target.id}));
 s=choose(s,[],[],'done');assert.equal(s.rules!.pending,null);assert.equal(s.rules!.priority,'you');
});

test('variable-power Swords target falls back to manual resolution without locking a pass cycle',()=>{
 let s=fixture();const swords=card(s,'Swords to Plowshares');const d=definitions.find(c=>c.name==='Tarmogoyf')!;assert.ok(d);
 const target=s.cards.find(c=>c.ownerId==='north'&&c.zone==='battlefield')!;target.cardId=d.id;
 s=send(s,{type:'cast',cardId:swords.id,targetId:target.id,costsPaid:true});s=allPass(s);
 assert.equal(s.rules!.pending?.kind,'manual');assert.equal(s.rules!.resolving?.cardId,swords.id);assert.equal(s.cards.find(c=>c.id===target.id)!.zone,'battlefield');
 assert.throws(()=>send(s,{type:'resolveSwords',choiceId:s.rules!.pending!.id,power:4},'north'));s=send(s,{type:'resolveSwords',choiceId:s.rules!.pending!.id,power:4});assert.equal(s.rules!.priority,'you');assert.equal(s.cards.find(c=>c.id===swords.id)!.zone,'graveyard');assert.equal(s.cards.find(c=>c.id===target.id)!.zone,'exile');assert.equal(s.players.find(p=>p.id==='north')!.life,44);
});
