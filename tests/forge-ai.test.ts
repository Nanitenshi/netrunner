import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createForgeRooms} from '../server/forge-rooms.ts';
import {checkForgeStartup,ForgeVersionError} from '../server/forge-worker.ts';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {projectForge,type ForgeRoom,type ForgeState} from '../shared/forge-protocol.ts';
import type {User} from '../shared/protocol.ts';
const host:User={id:'host',name:'Host',provider:'guest'},guest:User={id:'guest',name:'Guest',provider:'guest'};
const plain=catalogue.find(c=>c.name==='Plains')!,commander=catalogue.find(c=>c.name==='Isamaru, Hound of Konda')!;
const own={id:'own',name:'Own',commanderId:commander.id,quantities:{[plain.id]:99}};
function setup(){const views=new Map<string,ForgeRoom|null>();const rooms=createForgeRooms({java:'unused',runtime:'unused',classes:'unused'},(id,view)=>views.set(id,view));rooms.create(host);rooms.scenario(host,{scenario:'commander'});return {rooms,views,view:()=>views.get(host.id)!};}
test('AI config uses a real deck and public difficulty; changes reset human readiness and keep the bot ready',()=>{
 const {rooms,views,view}=setup();rooms.deck(host,own);rooms.ready(host,{ready:true});rooms.opponent(host,{deck:preparedDecks[1],difficulty:'hard'});
 assert.equal(view().players.length,2);assert.equal(view().players[1].isAi,true);assert.equal(view().players[1].difficulty,'hard');assert.equal(view().players[1].deckName,preparedDecks[1].name);assert.equal(view().players[1].cardCount,100);assert.equal(view().players[1].ready,true);assert.equal(view().players[0].ready,false);assert.equal(views.size,1,'No bot socket or human session');assert.equal(rooms.has(view().players[1].id),false);
 rooms.ready(host,{ready:true});rooms.opponent(host,{deck:own,difficulty:'easy'});assert.equal(view().aiOpponent?.deckId,'own');assert.equal(view().players[0].ready,false);rooms.opponent(host,{remove:true});assert.equal(view().players.length,1);assert.equal(view().aiOpponent,undefined);rooms.close();
});
test('invalid bot deck, fake difficulty or fields cannot alter an existing opponent',()=>{
 const {rooms,view}=setup();rooms.opponent(host,{deck:own,difficulty:'normal'});const revision=view().revision;
 for(const input of [{deck:{...own,quantities:{}},difficulty:'easy'},{deck:own,difficulty:'expert'},{deck:own,difficulty:'hard',seat:0},{remove:true,difficulty:'easy'},{deck:{...own,ai:{profile:'secret'}},difficulty:'easy'}])assert.throws(()=>rooms.opponent(host,input));
 assert.equal(view().revision,revision);assert.equal(view().aiOpponent?.difficulty,'normal');rooms.close();
});
test('only the host can configure AI and an occupied human seat is never replaced',()=>{
 const {rooms,view}=setup();rooms.join(guest,{code:view().code});assert.throws(()=>rooms.opponent(guest,{deck:own,difficulty:'easy'}),/Gastgeber/);assert.throws(()=>rooms.opponent(host,{deck:own,difficulty:'easy'}),/Menschen/);assert.equal(view().players[1].id,guest.id);rooms.close();
});
test('AI prevents fixture start, mode change removes the bot and a new human can join',async()=>{
 const {rooms,view}=setup();rooms.opponent(host,{deck:own,difficulty:'normal'});assert.throws(()=>rooms.join(guest,{code:view().code}));await assert.rejects(rooms.start(host,{scenario:'standard'}),/Commander-Modus/);assert.equal(view().starting,false);rooms.scenario(host,{scenario:'combat'});assert.equal(view().players.length,1);assert.equal(view().aiOpponent,undefined);rooms.join(guest,{code:view().code});assert.equal(view().players.length,2);rooms.close();
});
test('AI support must be advertised by the native bridge; opponent hand and library never enter the human view',()=>{
 assert.throws(()=>checkForgeStartup({mode:'commander'},'commander',true),ForgeVersionError);assert.doesNotThrow(()=>checkForgeStartup({mode:'commander',features:['ai','human-reveals','optional-reveal-automation','payment-review','p0-actions','action-preparation']},'commander',true));
 const state:ForgeState={cards:[{id:'hidden',name:'Secret',owner:1,controller:1,zone:'hand',tapped:false,token:false,type:'Creature'},{id:'library',name:'Top secret',owner:1,controller:1,zone:'library',tapped:false,token:false,type:'Land'}],stack:[],life:[40,40],active:1,priority:0,passes:0,turn:2,log:[]};const view=projectForge(state,0);assert.deepEqual(view.cards,[]);assert.deepEqual(view.handCounts,[0,1]);assert.deepEqual(view.libraryCounts,[0,1]);
});
