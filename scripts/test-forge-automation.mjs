import {mock} from 'node:test';
import {ForgeWorker} from '../server/forge-worker.ts';
import {createForgeRooms} from '../server/forge-rooms.ts';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(config).every(Boolean))throw Error('Configure Forge paths');
const id=name=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c.id;};
const users=[{id:'ada',name:'Ada',provider:'guest'},{id:'bela',name:'Bela',provider:'guest'}];
const pairs=[['Port Town','Plains'],['Choked Estuary','Island'],['Foreboding Ruins','Swamp'],['Game Trail','Mountain'],['Fortified Village','Forest']];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function run(deck,test){
 const views=new Map();const rooms=createForgeRooms(config,(user,v)=>views.set(user,v));const view=()=>views.get('ada');
 const wait=async check=>{const end=Date.now()+15000;while(!check()){if(Date.now()>end)throw Error('Automation timeout '+JSON.stringify(view()?.game?.choice));await delay(10);}};
 const act=async(seat,action)=>rooms.action(users[seat],{id:randomUUID(),revision:views.get(users[seat].id).revision,action});
 try{
  rooms.create(users[0]);rooms.join(users[1],{code:view().code});rooms.scenario(users[0],{scenario:'commander'});
  rooms.deck(users[0],deck);rooms.deck(users[1],{id:'peer',name:'Peer',commanderId:id('Isamaru, Hound of Konda'),quantities:{[id('Plains')]:99}});
  for(const user of users)rooms.ready(user,{ready:true});await rooms.start(users[0],{scenario:'commander'});
  const opening=async(name,extra=()=>true)=>{
   const found=()=>view().game.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name===name)&&extra(view().game);
   for(let n=0;!found()&&n<1000;n++)await act(0,{type:'mulligan'});assert(found());
   await act(0,{type:'keep'});await act(1,{type:'keep'});
  };
  await test({rooms,views,view,act,wait,opening});
 }finally{rooms.close();}
}
if(!process.env.FORGE_AUTOMATION_FAILURE_ONLY){
for(const [index,[land,basic]] of pairs.entries())await run({id:'auto',name:land,commanderId:preparedDecks[index].commanderId,quantities:{[id(basic)]:98,[id(land)]:1}},async t=>{
 await t.opening(land);assert.equal(t.view().automation.revealLands,false);
 const source=t.view().game.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name===land);
 t.rooms.automation(users[0],{revealLands:true});await t.act(0,{type:'land',cardId:source.id});
 await t.wait(()=>!t.view().game.choice&&t.view().automaticDecisions.length===1);
 assert.equal(t.view().game.cards.find(c=>c.id===source.id).tapped,false);
 assert.equal(t.view().game.handCounts[0],6);assert.equal(t.view().automaticDecisions[0].cardName,basic);
 const peer=t.views.get('bela');assert.equal(peer.automation.revealLands,false);assert.deepEqual(peer.automaticDecisions,[]);
 assert.equal(peer.game.reveals.flatMap(r=>r.cards).length,1);assert.equal(peer.game.reveals[0].cards[0].name,basic);
 assert.equal(peer.game.cards.filter(c=>c.owner===0&&c.zone==='hand').length,0);
 const snapshot=t.rooms.snapshot('ada');assert.equal(snapshot.automation.revealLands,true);assert.equal(snapshot.automaticDecisions.length,1);
 t.rooms.automation(users[0],{revealLands:false});t.rooms.automation(users[0],{revealLands:true});await delay(100);
 assert.equal(t.view().automaticDecisions.length,1);assert.equal(t.view().game.handCounts[0],6);
 console.log('PASS '+land+': opt-in auto reveal exactly once; private policy/history; native untapped entry; reload snapshot');
});
await run({id:'manual',name:'Manual',commanderId:preparedDecks[0].commanderId,quantities:{[id('Plains')]:98,[id('Port Town')]:1}},async t=>{
 await t.opening('Port Town');const source=t.view().game.cards.find(c=>c.name==='Port Town'&&c.zone==='hand');
 await t.act(0,{type:'land',cardId:source.id});const choice=t.view().game.choice;assert.equal(choice.automation,'reveal-land');
 // The other player's opt-in must not answer Ada's choice.
 t.rooms.automation(users[1],{revealLands:true});await delay(100);assert.equal(t.view().game.choice.id,choice.id);
 await t.act(0,{type:'choose',choiceId:choice.id,first:[],second:[],answer:false});await t.wait(()=>!t.view().game.choice);
 assert(t.view().game.cards.find(c=>c.id===source.id).tapped);assert.deepEqual(t.view().automaticDecisions,[]);assert.deepEqual(t.views.get('bela').game.reveals,[]);
 console.log('PASS manual default: explicit decline; foreign automation cannot answer; no hand leak');
});
await run({id:'mixed',name:'Mixed',commanderId:preparedDecks[0].commanderId,quantities:{[id('Plains')]:49,[id('Island')]:49,[id('Port Town')]:1}},async t=>{
 await t.opening('Port Town',s=>['Plains','Island'].every(name=>s.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name===name)));
 t.rooms.automation(users[0],{revealLands:true});const source=t.view().game.cards.find(c=>c.name==='Port Town'&&c.zone==='hand');await t.act(0,{type:'land',cardId:source.id});
 const choice=t.view().game.choice;assert(choice.options.some(o=>o.name==='Plains'));assert(choice.options.some(o=>o.name==='Island'));await delay(100);
 assert.equal(t.view().game.choice.id,choice.id);assert.deepEqual(t.view().automaticDecisions,[]);assert.deepEqual(t.views.get('bela').game.choice.options,[]);
 t.rooms.automation(users[0],{revealLands:false});assert.equal(t.rooms.snapshot('ada').game.choice.id,choice.id);
 const chosen=choice.options.find(o=>o.name==='Island');await t.act(0,{type:'choose',choiceId:choice.id,first:[chosen.id],second:[]});await t.wait(()=>!t.view().game.choice);
 assert(!t.view().game.cards.find(c=>c.id===source.id).tapped);assert.equal(t.views.get('bela').game.reveals[0].cards[0].id,chosen.id);
 assert.deepEqual(t.view().automaticDecisions,[]);console.log('PASS mixed cards: manual fallback, switch back during pending choice, exact human card revealed');
});
await run({id:'enable',name:'Enable pending',commanderId:preparedDecks[0].commanderId,quantities:{[id('Plains')]:98,[id('Port Town')]:1}},async t=>{
 await t.opening('Port Town');const source=t.view().game.cards.find(c=>c.name==='Port Town'&&c.zone==='hand');await t.act(0,{type:'land',cardId:source.id});assert(t.view().game.choice);
 const pendingId=t.view().game.choice.id;t.rooms.automation(users[0],{revealLands:true});t.rooms.automation(users[0],{revealLands:false});await delay(100);
 assert.equal(t.view().game.choice.id,pendingId);assert.deepEqual(t.view().automaticDecisions,[]);
 t.rooms.automation(users[0],{revealLands:true});await t.wait(()=>!t.view().game.choice&&t.view().automaticDecisions.length===1);
 assert(!t.view().game.cards.find(c=>c.id===source.id).tapped);console.log('PASS opt-in can answer the existing eligible choice without replaying land');
});
await run({id:'none',name:'None',commanderId:preparedDecks[0].commanderId,quantities:{[id('Wastes')]:98,[id('Port Town')]:1}},async t=>{
 await t.opening('Port Town');t.rooms.automation(users[0],{revealLands:true});const source=t.view().game.cards.find(c=>c.name==='Port Town'&&c.zone==='hand');await t.act(0,{type:'land',cardId:source.id});
 assert.equal(t.view().game.choice,null);assert(t.view().game.cards.find(c=>c.id===source.id).tapped);assert.deepEqual(t.view().automaticDecisions,[]);console.log('PASS no eligible hand card: native tapped entry, no invented reveal');
});

}
await run({id:'rejection',name:'Rejected automation',commanderId:preparedDecks[0].commanderId,quantities:{[id('Plains')]:98,[id('Port Town')]:1}},async t=>{
 await t.opening('Port Town');const source=t.view().game.cards.find(c=>c.name==='Port Town'&&c.zone==='hand');await t.act(0,{type:'land',cardId:source.id});const choice=t.view().game.choice;
 const original=ForgeWorker.prototype.action;
 const stub=mock.method(ForgeWorker.prototype,'action',function(seat,action){return action.type==='choose'?Promise.resolve({ok:false,error:'Injected rejection'}):original.call(this,seat,action);});
 try{
  t.rooms.automation(users[0],{revealLands:true});await t.wait(()=>Boolean(t.view().automationError));
  assert.equal(t.view().automation.revealLands,false);assert.equal(t.view().game.choice.id,choice.id);assert.deepEqual(t.view().automaticDecisions,[]);
  assert.throws(()=>t.rooms.automation(users[0],{revealLands:true}),/zuerst manuell/);assert.equal(t.view().automation.revealLands,false);
  t.rooms.automation(users[0],{revealLands:false});assert.throws(()=>t.rooms.automation(users[0],{revealLands:true}),/zuerst manuell/);
 }finally{stub.mock.restore();}
 await t.act(0,{type:'choose',choiceId:choice.id,first:[],second:[],answer:false});await t.wait(()=>!t.view().game.choice);
 assert(t.view().game.cards.find(c=>c.id===source.id).tapped);assert.deepEqual(t.views.get('bela').game.reveals,[]);
 assert.equal(t.views.get('bela').automationError,undefined);t.rooms.automation(users[0],{revealLands:true});assert.equal(t.view().automationError,undefined);assert.equal(t.view().automation.revealLands,true);console.log('PASS injected worker rejection: auto stopped, notice private, existing choice manually declined, no retry/reveal');
});
