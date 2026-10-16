import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createForgeRooms} from '../server/forge-rooms.ts';
import {ForgeWorker} from '../server/forge-worker.ts';
import {catalogue} from '../shared/catalogue.ts';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(config).every(Boolean))throw Error('Configure absolute Forge paths');
const users=[{id:'ada',name:'Ada',provider:'guest'},{id:'bela',name:'Bela',provider:'guest'}];
const id=name=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c.id;};
const deck={id:'p0',name:'P0',commanderId:id('Isamaru, Hound of Konda'),quantities:{[id('Plains')]:99}};
const rooms=createForgeRooms(config,()=>{}),view=seat=>rooms.snapshot(users[seat].id),state=()=>view(0).game;
const wait=async check=>{const until=Date.now()+15000;while(!check()){if(Date.now()>until)throw Error('P0 timeout '+JSON.stringify(state()?.choice));await new Promise(r=>setTimeout(r,10));}};
const act=(seat,action)=>rooms.action(users[seat],{id:randomUUID(),revision:view(seat).revision,action});
const choose=async(seat,answer)=>{const choiceId=state().choice.id;await act(seat,{type:'choose',choiceId,answer});await wait(()=>state().choice?.id!==choiceId);};
const resources=()=>({cards:state().cards.map(c=>[c.id,c.zone,c.tapped,c.commanderCasts]),pool:state().manaPools,stack:state().stack,turn:state().turn,priority:state().priority,phase:state().phase,landPlays:state().landPlays});
try{
 rooms.create(users[0]);rooms.join(users[1],{code:view(0).code});rooms.scenario(users[0],{scenario:'commander'});
 for(const u of users){rooms.deck(u,deck);rooms.ready(u,{ready:true});}
 await rooms.start(users[0],{scenario:'commander'});await act(0,{type:'keep'});await act(1,{type:'keep'});
 let commander=state().cards.find(c=>c.owner===0&&c.isCommander);
 const before=structuredClone(resources()),revision=view(0).revision;
 await assert.rejects(act(0,{type:'cast',cardId:commander.id}));assert.deepEqual(resources(),before);assert.equal(view(0).revision,revision+1);assert.equal(view(1).revision,view(0).revision);
 console.log('PASS server publishes the native rejected state to both seats; unpaid commander stays unchanged');
 const land=state().cards.find(c=>c.owner===0&&c.zone==='hand'&&c.landPlayable);
 await assert.rejects(act(1,{type:'land',cardId:land.id}));assert.deepEqual(resources(),before);
 const command={id:randomUUID(),revision:view(0).revision,action:{type:'land',cardId:land.id}};
 await Promise.all([rooms.action(users[0],command),rooms.action(users[0],command)]);
 assert.equal(state().landPlays[0].played,1);assert.equal(state().cards.filter(c=>c.owner===0&&c.zone==='battlefield'&&c.type.includes('Land')).length,1);
 const afterLand=structuredClone(resources());await assert.rejects(rooms.action(users[0],{...command,id:randomUUID()}),/Spielstand/);
 const second=state().cards.find(c=>c.owner===0&&c.zone==='hand');await assert.rejects(act(0,{type:'land',cardId:second.id}));assert.deepEqual(resources(),afterLand);
 console.log('PASS one native land drop, duplicate ID and stale revision guards, foreign/second drop rejected');
 commander=state().cards.find(c=>c.owner===0&&c.isCommander);
 assert.equal(commander.abilities.find(a=>a.spell).cost,'{W}');
 const cast={id:randomUUID(),revision:view(0).revision,action:{type:'cast',cardId:commander.id,holdPriority:true}};
 await rooms.action(users[0],cast);await rooms.action(users[0],cast);
 assert.equal(state().priority,0);assert.equal(state().passes,0);assert.equal(state().stack.length,1);assert.equal(state().cards.find(c=>c.isCommander&&c.owner===0).commanderCasts,1);
 await assert.rejects(act(1,{type:'pass'}));assert.equal(state().stack.length,1);
 await act(0,{type:'pass'});assert.equal(state().priority,1);assert.equal(state().stack.length,1);
 await act(1,{type:'pass'});assert.equal(state().stack.length,0);assert.equal(state().cards.find(c=>c.isCommander&&c.owner===0).zone,'battlefield');
 for(let i=0;i<3;i++){await act(0,{type:'pass'});await act(1,{type:'pass'});}
 assert.equal(state().turn,1);assert.equal(state().ending,false);
 console.log('PASS hold priority, one cast/tax/tap, a single pass cannot resolve, empty passes never end the turn');
 const beforeEnd=structuredClone(resources());await act(0,{type:'endTurn'});assert.equal(state().choice.purpose,'end-turn');assert.deepEqual(resources(),beforeEnd);assert.equal(state().ending,false);
 rooms.automation(users[0],{revealLands:true});assert.equal(state().choice.purpose,'end-turn');assert.equal(view(1).game.choice.purpose,undefined);
 const oldId=state().choice.id;await assert.rejects(act(1,{type:'choose',choiceId:oldId,answer:true}));await choose(0,false);assert.deepEqual(resources(),beforeEnd);
 await assert.rejects(act(0,{type:'choose',choiceId:oldId,answer:true}));
 await act(0,{type:'endTurn'});await choose(0,true);assert.equal(state().phase,'END_OF_TURN');assert.equal(state().turn,1);assert.equal(state().ending,true);
 await act(0,{type:'pass'});assert.equal(state().turn,1);await act(1,{type:'pass'});assert.equal(state().turn,2);assert.equal(state().active,1);assert.equal(state().landPlays[1].played,0);
 const late=state().cards.find(c=>c.owner===0&&c.zone==='hand');await assert.rejects(act(0,{type:'land',cardId:late.id}));
 console.log('PASS engine-owned end-turn confirm/cancel, foreign/stale answer rejection, preserved end-step response window and real turn change');
}finally{rooms.close();}

// Multiple objects must retain LIFO order while the human holds priority.
let s;const worker=new ForgeWorker(config,()=>{},update=>s=update);
const native=async(seat,action,ok=true)=>{const r=await worker.action(seat,action);assert.equal(r.ok,ok,r.error);if(r.state)s=r.state;};
try{
 s=await worker.ready;const bears=s.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Grizzly Bears');
 await native(0,{type:'cast',cardId:bears.id,holdPriority:true});assert.equal(s.priority,0);
 const forest=s.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Forest');await native(0,{type:'land',cardId:forest.id},false);assert.equal(s.landPlays[0].played,0);
 const counter=s.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Counterspell');
 await native(0,{type:'cast',cardId:counter.id,targetId:s.stack[0].id,holdPriority:true});assert.equal(s.stack[0].name,'Counterspell');assert.equal(s.stack.length,2);assert.equal(s.priority,0);
 await native(0,{type:'pass'});assert.equal(s.stack.length,2);await native(1,{type:'pass'});assert.equal(s.stack.length,0);assert.equal(s.priority,0);
 await native(0,{type:'land',cardId:forest.id});assert.equal(s.landPlays[0].played,1);
 console.log('PASS native LIFO response to own spell, hold priority across casts, land blocked on stack and legal after resolution');
}finally{worker.stop();}
