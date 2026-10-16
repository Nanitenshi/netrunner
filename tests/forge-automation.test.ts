import {test} from 'node:test';
import assert from 'node:assert/strict';
import {automaticRevealLand} from '../shared/forge-automation.ts';
import {projectForge,type ForgeChoice,type ForgeRoom,type ForgeState} from '../shared/forge-protocol.ts';
import {checkForgeStartup,ForgeVersionError} from '../server/forge-worker.ts';
import {createForgeRooms} from '../server/forge-rooms.ts';

const choice:ForgeChoice={id:'choice',seat:0,automation:'reveal-land',kind:'reveal',source:'Port Town',count:1,min:1,max:1,repeat:false,options:[{id:'a',name:'Plains',kind:'card'},{id:'b',name:'Plains',kind:'card'}]};
test('automatic reveal uses one legal option only when names agree',()=>{
 assert.deepEqual(automaticRevealLand(choice,0),{type:'choose',choiceId:'choice',first:['a'],second:[]});
 assert.equal(automaticRevealLand({...choice,options:[choice.options[0],{id:'c',name:'Island',kind:'card'}]},0),null);
 assert.equal(automaticRevealLand({...choice,options:[]},0),null);
});
test('unsupported decisions, private/hidden options, counts and foreign seats never automate',()=>{
 for(const changed of [{automation:undefined},{kind:'cost' as const},{kind:'select' as const},{min:0},{max:2},{repeat:true},{options:[{id:'a',name:'Verdeckte Karte',kind:'hidden'}]},{options:[{id:'a',name:'',kind:'card'}]}])assert.equal(automaticRevealLand({...choice,...changed},0),null);
 assert.deepEqual(automaticRevealLand({...choice,seat:1},1),{type:'choose',choiceId:'choice',first:['a'],second:[]});
 assert.equal(automaticRevealLand(choice,1),null);assert.equal(automaticRevealLand(null,0),null);
 const state:ForgeState={cards:[],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[],choice};
 assert.equal(projectForge(state,1).choice?.automation,undefined);
 assert.equal(automaticRevealLand(projectForge(state,1).choice,1),null);
});
test('automation starts manual, belongs to the authenticated player and survives snapshots only at this table',()=>{
 const host={id:'host',name:'Host',provider:'guest' as const},peer={id:'peer',name:'Peer',provider:'guest' as const};
 const views=new Map<string,ForgeRoom|null>();const rooms=createForgeRooms({java:'unused',runtime:'unused',classes:'unused'},(id,v)=>views.set(id,v));
 try{
  rooms.create(host);rooms.join(peer,{code:views.get(host.id)!.code});
  assert.deepEqual(views.get(host.id)!.automation,{revealLands:false});
  rooms.automation(host,{revealLands:true});
  assert.deepEqual(rooms.snapshot(host.id)?.automation,{revealLands:true});
  assert.deepEqual(views.get(peer.id)!.automation,{revealLands:false});
  for(const input of [{seat:1,revealLands:true},{revealLands:'true'},{revealLands:true,scry:true},{}])assert.throws(()=>rooms.automation(host,input));
  assert.throws(()=>rooms.automation({id:'stranger',name:'Stranger',provider:'guest'},{revealLands:true}));
  rooms.automation(peer,{revealLands:true});rooms.automation(host,{revealLands:false});
  assert.deepEqual(rooms.snapshot(peer.id)?.automation,{revealLands:true});
  rooms.leave(host);rooms.create(host);assert.deepEqual(rooms.snapshot(host.id)?.automation,{revealLands:false});assert.deepEqual(rooms.snapshot(host.id)?.automaticDecisions,[]);
 }finally{rooms.close();}
});

test('Commander startup requires the adapter that marks reviewed optional choices',()=>{
 assert.throws(()=>checkForgeStartup({mode:'commander',features:['ai','human-reveals']},'commander'),ForgeVersionError);
 assert.doesNotThrow(()=>checkForgeStartup({mode:'commander',features:['ai','human-reveals','optional-reveal-automation','payment-review','p0-actions']},'commander'));
});
