import {test} from 'node:test';
import assert from 'node:assert/strict';
import {automaticManaPlan,printedManaAbilities} from '../shared/auto-mana.ts';
import {catalogue} from '../shared/catalogue.ts';
import {applyAction,projectGame,type CardInstance} from '../shared/game.ts';
import {enableRules} from '../shared/engine.ts';
import {initialGame} from '../src/seed.ts';
import {actionSchema} from '../shared/protocol.ts';

const card=(name:string)=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c;};
function setup(names:string[],spell='Expressive Iteration'){
 const s=enableRules(initialGame());s.cards=s.cards.filter(c=>c.isCommander);s.players.forEach(p=>p.mana={});
 const add=(name:string,zone:CardInstance['zone'])=>{const c:CardInstance={id:'mana-test-'+s.cards.length,cardId:card(name).id,ownerId:'you',controllerId:'you',zone,tapped:false,counters:0,position:{x:.2,y:.5}};s.cards.push(c);return c;};
 const sources=names.map(n=>add(n,'battlefield')),c=add(spell,'hand');return {s,sources,c};
}

test('Oracle parsing keeps complete output bundles and recognizes all Odyssey-style filters and signets',()=>{
 assert.deepEqual(printedManaAbilities(card('Ferrous Lake')),[{cost:'{1}',produces:{U:1,R:1}}]);
 for(const [name,produces] of [['Skycloud Expanse',{W:1,U:1}],['Darkwater Catacombs',{U:1,B:1}],['Shadowblood Ridge',{B:1,R:1}],['Mossfire Valley',{R:1,G:1}],['Sungrass Prairie',{G:1,W:1}],['Izzet Signet',{U:1,R:1}]] as const){assert.deepEqual(printedManaAbilities(card(name)),[{cost:'{1}',produces}]);}
 assert.deepEqual(printedManaAbilities(card('Sol Ring')),[{cost:'',produces:{C:2}}]);
 assert.equal(printedManaAbilities(card('Breeding Pool')).length,2);
 assert.equal(printedManaAbilities(card('Command Tower'),['W','U']).length,2);
 assert.deepEqual(printedManaAbilities(card('Command Tower'),[]),[]);
});

test('Ferrous Lake uses seed mana before producing both colors, and leaves surplus floating',()=>{
 const {s,sources}=setup(['Forest','Ferrous Lake']);const before=structuredClone(s),plan=automaticManaPlan(s,'you','{U}{R}');assert(plan);
 assert.deepEqual(plan.activations.map(a=>a.sourceId),sources.map(c=>c.id));assert.deepEqual(plan.activations[1].spent,{G:1});assert.deepEqual(plan.remaining,{});assert.deepEqual(s,before);
 const floating=setup(['Ferrous Lake']);floating.s.players[0].mana={C:2};const p=automaticManaPlan(floating.s,'you','{U}');assert(p);assert.deepEqual(p.remaining,{R:1,C:1});
 assert.equal(automaticManaPlan(setup(['Ferrous Lake']).s,'you','{U}{R}'),null);
 assert.equal(automaticManaPlan(setup(['Ferrous Lake','Izzet Signet']).s,'you','{U}{R}'),null);
});

test('activation payment explores alternatives instead of consuming a needed color; hybrid filters work',()=>{
 const {s}=setup(['Ferrous Lake']);s.players[0].mana={W:1,B:1};const p=automaticManaPlan(s,'you','{W}{U}{R}');assert(p);assert.deepEqual(p.activations[0].spent,{B:1});assert.deepEqual(p.remaining,{});
 const hybrid=setup(['Island','Cascade Bluffs']);const h=automaticManaPlan(hybrid.s,'you','{R}{R}');assert(h);assert.deepEqual(h.activations[1].spent,{U:1});assert.deepEqual(h.activations[1].produces,{R:2});
 const wrong=setup(['Forest','Cascade Bluffs']);assert.equal(automaticManaPlan(wrong.s,'you','{R}{R}'),null);
 const chained=setup(['Sol Ring','Izzet Signet','Skycloud Expanse']);assert(automaticManaPlan(chained.s,'you','{W}{U}{U}{R}'));
});

test('uses pool first, minimizes taps, pays true colorless and includes commander tax',()=>{
 const {s}=setup(['Forest','Sol Ring','Ferrous Lake']);const p=automaticManaPlan(s,'you','{2}');assert(p);assert.equal(p.activations.length,1);assert.equal(s.cards.find(c=>c.id===p.activations[0].sourceId)!.cardId,card('Sol Ring').id);
 s.players[0].mana={U:1,R:1};assert.equal(automaticManaPlan(s,'you','{U}{R}')!.activations.length,0);
 assert.equal(automaticManaPlan(setup(['Forest']).s,'you','{C}'),null);
 const tax=automaticManaPlan(setup(['Forest','Sol Ring','Ferrous Lake']).s,'you','{U}{R}',2);assert(tax);assert.equal(tax.activations.length,3);assert.deepEqual(tax.remaining,{});
 for(const cost of ['{X}{R}','{W/U}','{B/P}','garbage'])assert.equal(automaticManaPlan(s,'you',cost),null);
});

test('ignores foreign, tapped, hidden, creature and conditional/sacrifice/life/restricted sources',()=>{
 const {s,sources}=setup(['Forest','Island','Mountain','Birds of Paradise','Treasure Vault','Cavern of Souls','City of Brass']);sources[0].tapped=true;sources[1].controllerId='north';sources[2].faceDown=true;
 assert.equal(automaticManaPlan(s,'you','{W}'),null);
 for(const text of ['{T}, Pay 1 life: Add {U}.','{T}, Sacrifice this land: Add {U}{R}.','{T}: Add {U}. Activate only if you control an Island.','{T}: Add {U}. Spend this mana only to cast creature spells.','{T}: Add {U} for each Island you control.'])assert.deepEqual(printedManaAbilities({type:'Land',text}),[]);
});

test('server casts with filter lands atomically; stale or forged previews cannot tap anything',()=>{
 const {s,c,sources}=setup(['Forest','Ferrous Lake']);const action={type:'cast',cardId:c.id,costsPaid:true,autoTapSources:sources.map(c=>c.id),passPriority:true} as const;
 assert.equal(actionSchema.safeParse(action).success,true);
 const next=applyAction(s,'you',action);assert.equal(next.rules!.stack[0].cardId,c.id);assert.equal(next.rules!.priority,'north');assert(next.cards.filter(c=>sources.some(o=>o.id===c.id)).every(c=>c.tapped));assert.deepEqual(next.players[0].mana,{});assert(sources.every(c=>!c.tapped));
 for(const ids of [[sources[1].id],[sources[0].id,sources[0].id],['not-owned'],[]]){const before=structuredClone(s);assert.throws(()=>applyAction(s,'you',{...action,autoTapSources:ids}));assert.deepEqual(s,before);}
 sources[0].tapped=true;const before=structuredClone(s);assert.throws(()=>applyAction(s,'you',action));assert.deepEqual(s,before);
 const target=setup(['Forest','Ferrous Lake'],'Counterspell');target.s.players[0].mana={U:1};const plan=automaticManaPlan(target.s,'you','{U}{U}');assert(plan);const unchanged=structuredClone(target.s);assert.throws(()=>applyAction(target.s,'you',{type:'cast',cardId:target.c.id,costsPaid:true,autoTapSources:plan.activations.map(a=>a.sourceId),targetId:'invalid'}));assert.deepEqual(target.s,unchanged);
});

test('manual casts stay manual, and identical lands do not cause permutation growth',()=>{
 const {s,c}=setup(['Forest','Ferrous Lake']);const next=applyAction(s,'you',{type:'cast',cardId:c.id,costsPaid:true,manualCostsConfirmed:true});assert(next.cards.filter(c=>c.zone==='battlefield').every(c=>!c.tapped));
 const large=setup(Array(40).fill('Forest'));assert.equal(automaticManaPlan(large.s,'you','{20}{G}{G}')!.activations.length,22);assert.equal(automaticManaPlan(large.s,'you','{W}'),null);
});

test('public commander identity survives private library moves and combines partner colors',()=>{
 const {s}=setup(['Command Tower']);const commander=s.cards.find(c=>c.isCommander&&c.ownerId==='you')!;commander.zone='library';
 assert.deepEqual(automaticManaPlan(s,'you','{U}'),automaticManaPlan(projectGame(s,'you'),'you','{U}'));
 s.players[0].commander='Tymna the Weaver + Kraum, Ludevic\'s Opus';assert(automaticManaPlan(s,'you','{R}'));assert.equal(automaticManaPlan(s,'you','{G}'),null);
});

test('a modal land uses the active physical face rather than the front spell',()=>{
 const {s,sources}=setup(['Bala Ged Recovery // Bala Ged Sanctuary']);assert.equal(automaticManaPlan(s,'you','{G}'),null);sources[0].faceIndex=1;
 assert.deepEqual(automaticManaPlan(s,'you','{G}')!.activations[0].produces,{G:1});
});
