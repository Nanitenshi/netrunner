import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,commanderTax,type CardInstance,type GameAction} from '../shared/game.ts';
import {catalogue} from '../shared/catalogue.ts';
import {automaticManaPlan} from '../shared/auto-mana.ts';
import {actionSchema} from '../shared/protocol.ts';
import {readSettings} from '../src/settings.ts';

const setup=()=>{const s=enableRules(initialGame());s.cards=s.cards.filter(c=>c.isCommander);s.players.forEach(p=>p.mana={});return s;};
const add=(s:ReturnType<typeof setup>,name:string,id:string,zone:CardInstance['zone']='battlefield')=>{const c:CardInstance={id,cardId:catalogue.find(c=>c.name===name)!.id,ownerId:'you',controllerId:'you',zone,tapped:false,counters:0,position:{x:.2,y:.5}};s.cards.push(c);return c;};

test('a normal or legacy commander cast without mana leaves command zone, tax, pool and stack unchanged',()=>{
 const s=setup(),c=s.cards.find(c=>c.ownerId==='you')!,before=structuredClone(s);
 for(const action of [{type:'cast',cardId:c.id,costsPaid:true},{type:'cast',cardId:c.id,costsPaid:true,payFromPool:false},{type:'cast',cardId:c.id,costsPaid:true,autoTapSources:[]},{type:'castCommander',cardId:c.id}] satisfies GameAction[]){assert.throws(()=>applyAction(s,'you',action),/Bezahlung|Mana-Pool/);assert.deepEqual(s,before);}
 assert.equal(c.zone,'commander');assert.equal(commanderTax(c),0);assert.equal(s.rules!.stack.length,0);
});

test('ordinary casts validate and debit the pool even without the old payFromPool flag',()=>{
 const s=setup(),c=add(s,'Sol Ring','spell','hand');s.players[0].mana={C:2};
 for(const payFromPool of [undefined,false,true]){const n=applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,payFromPool});assert.deepEqual(n.players[0].mana,{C:1});assert.equal(n.rules!.stack.length,1);assert.deepEqual(s.players[0].mana,{C:2});}
});

test('manual payment is explicit, logged, and never mixed with automatic or pool deduction',()=>{
 const s=setup(),c=s.cards.find(c=>c.ownerId==='you')!;
 const n=applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,manualCostsConfirmed:true});assert.equal(n.cards.find(x=>x.id===c.id)!.zone,'stack');assert.equal(commanderTax(n.cards.find(x=>x.id===c.id)!),2);assert(n.log.some(l=>l.includes('manuelle Bezahlung')));
 for(const extra of [{costsPaid:false},{payFromPool:true},{autoTapSources:[]},{manaSourceIds:[]}])assert.throws(()=>applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,manualCostsConfirmed:true,...extra}));
});

test('missing mana costs and mandatory extra costs never pass as ordinary automatic payments',()=>{
 const s=setup();s.players[0].mana={B:10,U:10,C:10};
 for(const name of ['Ancestral Vision','Village Rites']){
  const c=add(s,name,name,'hand'),before=structuredClone(s);
  assert.throws(()=>applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,payFromPool:true}),/manuell/);
  assert.throws(()=>applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,autoTapSources:[]}),/manuell/);
  assert.deepEqual(s,before);
  assert.equal(applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,manualCostsConfirmed:true}).rules!.stack.length,1);
 }
 assert.equal(automaticManaPlan(s,'you',''),null);
});

test('selected sources override the minimal automatic suggestion without tapping unselected lands',()=>{
 const s=setup(),forest=add(s,'Forest','forest'),island=add(s,'Island','island'),filter=add(s,'Ferrous Lake','filter'),c=add(s,'Sol Ring','spell','hand');
 const plan=automaticManaPlan(s,'you','{1}',0,[island.id,filter.id]);assert(plan);assert.deepEqual(plan.activations.map(a=>a.sourceId),[island.id]);
 const action={type:'cast',cardId:c.id,costsPaid:true,manaSourceIds:[island.id,filter.id],autoTapSources:plan.activations.map(a=>a.sourceId)} satisfies GameAction;
 assert(actionSchema.safeParse(action).success);const n=applyAction(s,'you',action);assert(n.cards.find(x=>x.id===island.id)!.tapped);assert(!n.cards.find(x=>x.id===forest.id)!.tapped);assert(!n.cards.find(x=>x.id===filter.id)!.tapped);
 assert.throws(()=>applyAction(s,'you',{...action,payFromPool:true}));assert(!island.tapped);
});

test('filter selections still need seed mana and stale, duplicated or foreign selections cannot mutate payment',()=>{
 const s=setup(),seed=add(s,'Forest','forest'),filter=add(s,'Ferrous Lake','filter'),c=add(s,'Expressive Iteration','spell','hand');
 assert.equal(automaticManaPlan(s,'you','{U}{R}',0,[filter.id]),null);const plan=automaticManaPlan(s,'you','{U}{R}',0,[seed.id,filter.id]);assert(plan);
 const action={type:'cast',cardId:c.id,costsPaid:true,autoTapSources:plan.activations.map(a=>a.sourceId),manaSourceIds:[seed.id,filter.id]} satisfies GameAction;
 const foreign=add(s,'Island','foreign');foreign.controllerId='north';
 for(const manaSourceIds of [[filter.id],[seed.id,seed.id],[foreign.id],['missing']]){const before=structuredClone(s);assert.throws(()=>applyAction(s,'you',{...action,manaSourceIds}));assert.deepEqual(s,before);}
 seed.tapped=true;const before=structuredClone(s);assert.throws(()=>applyAction(s,'you',action));assert.deepEqual(s,before);
});

test('new profiles get a payment preview while an explicit opt-out remains off',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let preferences='{}';
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>preferences}});
 try{assert.equal(readSettings().autoTap,true);preferences='{"autoTap":false}';assert.equal(readSettings().autoTap,false);preferences='{"autoTap":true}';assert.equal(readSettings().autoTap,true);}finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else Reflect.deleteProperty(globalThis,'localStorage');}
});
