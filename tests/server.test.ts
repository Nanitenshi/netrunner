import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {io,type Socket} from 'socket.io-client';
import {createNexusServer} from '../server/server.ts';
import {starterDeck,checkDeck} from '../shared/deck-rules.ts';
import type {RoomView,Reply} from '../shared/protocol.ts';
import {applyAction,commanderCost,commanderTax} from '../shared/game.ts';
import {initialGame} from '../src/seed.ts';
import {catalogue} from '../shared/catalogue.ts';

async function running(options:Parameters<typeof createNexusServer>[0]={database:':memory:',guest:true}){
 const server=createNexusServer(options);server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
 const port=(server.http.address() as {port:number}).port;return {...server,url:`http://127.0.0.1:${port}`};
}
async function identity(url:string,name:string){const res=await fetch(`${url}/api/guest`,{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify({name})});assert.equal(res.status,200);return {cookie:res.headers.get('set-cookie')!.split(';')[0],user:(await res.json()).user};}
async function client(url:string,cookie:string){
 const socket=io(url,{transports:['websocket'],extraHeaders:{Origin:url,Cookie:cookie},autoConnect:false,reconnection:false});
 const updates:(RoomView|null)[]=[];socket.on('room',room=>updates.push(room));socket.connect();await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 return {socket,updates,get room(){return updates.at(-1)!;},send:async(event:string,input:unknown={})=>await socket.timeout(3000).emitWithAck(event,input) as Reply};
}
const until=async(check:()=>boolean)=>{for(let i=0;i<100;i++){if(check())return;await new Promise(r=>setTimeout(r,15));}assert.fail('Timed out waiting for replicated state');};

test('turn-only online game skips phase confirmations and preserves stack response rounds',async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{for(const name of ['Turn-A','Turn-B']){const p=await identity(server.url,name);clients.push(await client(server.url,p.cookie));}
  await clients[0].send('room:create');await until(()=>Boolean(clients[0].room));await clients[1].send('room:join',{code:clients[0].room!.code});for(const c of clients)await c.send('room:ready',{ready:true});await clients[0].send('room:start');for(const c of clients)await c.send('game:action',{id:randomUUID(),action:{type:'keep'}});await until(()=>clients[0].room?.game?.rules?.stage==='playing');
  assert.equal(clients[0].room!.game!.rules!.turnOnly,true);assert.equal(clients[0].room!.game!.phase,3);
  const revision=clients[0].room!.revision;await clients[0].send('game:autoPass',{revision,policy:{enabled:true,ownStops:[],opponentStops:[]}});assert.equal(clients[0].room!.revision,revision);
  assert.equal((await clients[1].send('game:action',{id:randomUUID(),action:{type:'endTurn'}})).ok,false);
  await clients[0].send('game:action',{id:randomUUID(),action:{type:'ability',label:'Response window'}});await until(()=>clients[0].room!.game!.rules!.stack.length===1);
  assert.equal((await clients[0].send('game:action',{id:randomUUID(),action:{type:'endTurn'}})).ok,false);
  await clients[0].send('game:action',{id:randomUUID(),action:{type:'pass'}});await until(()=>clients[1].room!.game!.rules!.priority===clients[1].room!.seat);await clients[1].send('game:action',{id:randomUUID(),action:{type:'pass'}});await until(()=>Boolean(clients[0].room!.game!.rules!.pending));
  await clients[0].send('game:action',{id:randomUUID(),action:{type:'choose',choiceId:clients[0].room!.game!.rules!.pending!.id,first:[],second:[],decision:'done'}});
  await until(()=>!clients[0].room!.game!.rules!.pending);const id=randomUUID();assert.equal((await clients[0].send('game:action',{id,action:{type:'endTurn'}})).ok,true);await until(()=>clients[0].room!.game!.turn===2);await clients[0].send('game:action',{id,action:{type:'endTurn'}});assert.equal(clients[0].room!.game!.turn,2);assert.equal(clients[0].room!.game!.activePlayer,clients[1].room!.seat);assert.equal(clients[0].room!.game!.phase,3);
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});

test('online cast pays mana and hands over priority once despite duplicate delivery',async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{for(const name of ['Cast-A','Cast-B']){const p=await identity(server.url,name);clients.push(await client(server.url,p.cookie));}
  await clients[0].send('room:create');await until(()=>Boolean(clients[0].room));await clients[1].send('room:join',{code:clients[0].room!.code});await clients[0].send('room:deck',starterDeck());for(const c of clients)await c.send('room:ready',{ready:true});await clients[0].send('room:start');for(const c of clients)await c.send('game:action',{id:randomUUID(),action:{type:'keep'}});await until(()=>clients[0].room?.game?.rules?.stage==='playing');
  for(const color of ['W','U','B','G'])assert.equal((await clients[0].send('game:action',{id:randomUUID(),action:{type:'mana',color,amount:1}})).ok,true);
  const card=clients[0].room!.game!.cards.find(c=>c.ownerId===clients[0].room!.seat&&c.isCommander)!;const input={id:randomUUID(),action:{type:'cast',cardId:card.id,costsPaid:true,payFromPool:true,passPriority:true}};assert.equal((await clients[0].send('game:action',input)).ok,true);assert.equal((await clients[0].send('game:action',input)).ok,true);
  await until(()=>clients[1].room!.game!.rules!.stack.length===1);const game=clients[1].room!.game!;assert.equal(game.rules!.priority,clients[1].room!.seat);assert.deepEqual(game.rules!.passes,[clients[0].room!.seat]);assert.equal(Object.values(game.players[0].mana!).reduce((a,b)=>a+b,0),0);assert.equal(game.cards.find(c=>c.id===card.id)!.commanderCasts,1);
  await clients[1].send('game:action',{id:randomUUID(),action:{type:'pass'}});await until(()=>clients[0].room!.game!.cards.find(c=>c.id===card.id)?.zone==='battlefield');
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});

test('account deck storage preserves user categories and notes',async()=>{
 const server=await running();try{
  const person=await identity(server.url,'Deckgruppen');const deck={...starterDeck(),cardGroups:{[catalogue.find(c=>c.name==='Sol Ring')!.id]:'Artefakt-Synergie'},notes:'Mein Spielplan'};
  const headers={Origin:server.url,Cookie:person.cookie,'Content-Type':'application/json'};
  const result=await fetch(`${server.url}/api/decks`,{method:'PUT',headers,body:JSON.stringify({decks:[deck]})});assert.equal(result.status,200);
  const saved=await fetch(`${server.url}/api/decks`,{headers});assert.equal(saved.status,200);const data=await saved.json();assert.deepEqual(data.decks[0].cardGroups,deck.cardGroups);assert.equal(data.decks[0].notes,deck.notes);
 }finally{await server.close();}
});

test('four independent sessions: lobby, privacy, authorization, actions, duplicate delivery, reconnect and finish',async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const people=await Promise.all(['Ada','Bela','Cora','Dino','Extra'].map(name=>identity(server.url,name)));
  for(const p of people)clients.push(await client(server.url,p.cookie));
  assert.equal((await clients[0].send('room:create')).ok,true);await until(()=>Boolean(clients[0].room));
  const code=clients[0].room!.code;
  for(const c of clients.slice(1,4))assert.equal((await c.send('room:join',{code})).ok,true);
  assert.equal((await clients[4].send('room:join',{code})).ok,false);
  assert.equal((await clients[1].send('room:start')).ok,false);
  assert.equal((await clients[0].send('room:start')).ok,false);
  for(const c of clients.slice(0,4))assert.equal((await c.send('room:ready',{ready:true})).ok,true);
  assert.equal((await clients[0].send('room:start')).ok,true);
  await until(()=>clients.slice(0,4).every(c=>Boolean(c.room?.game)));
  for(const [i,c] of clients.slice(0,4).entries()){
   const g=c.room!.game!;assert.equal(g.players.length,4);assert.equal(g.cards.filter(c=>c.zone==='hand').length,7);
   assert.ok(g.cards.every(card=>card.zone!=='library'&&(card.zone!=='hand'||card.ownerId===people[i].user.id)));
   assert.equal(g.hiddenCounts[people[i].user.id].library,92);
   assert.equal(g.cards.filter(c=>c.isCommander).length,4);
   const ownHand=clients[(i+1)%4].room!.game!.cards.filter(c=>c.zone==='hand');
   assert.ok(ownHand.every(card=>!JSON.stringify(c.updates).includes(card.id)));
  }
  const action=(i:number,action:unknown,id=randomUUID())=>clients[i].send('game:action',{id,action});
  for(let i=0;i<4;i++)assert.equal((await action(i,{type:'keep'})).ok,true);
  const passCycle=async()=>{for(let i=0;i<4;i++)assert.equal((await action(i,{type:'pass'})).ok,true);};
  await passCycle();await passCycle();
  const enemy=clients[1].room!.game!.cards.find(c=>c.isCommander&&c.ownerId===people[1].user.id)!;
  assert.equal((await action(0,{type:'move',cardId:enemy.id,zone:'hand'})).ok,false);
  assert.equal((await action(0,{type:'life',amount:1,actor:people[1].user.id})).ok,false);
  assert.equal((await action(0,{type:'banana'})).ok,false);
  const id=randomUUID();assert.equal((await action(0,{type:'life',amount:-3},id)).ok,true);assert.equal((await action(0,{type:'life',amount:-3},id)).ok,true);
  await until(()=>clients.slice(0,4).every(c=>c.room!.game!.players[0].life===37));
  const manaId=randomUUID();assert.equal((await action(0,{type:'mana',color:'G',amount:3},manaId)).ok,true);assert.equal((await action(0,{type:'mana',color:'G',amount:3},manaId)).ok,true);
  await until(()=>clients.slice(0,4).every(c=>c.room!.game!.players[0].mana?.G===3));
  assert.equal((await action(1,{type:'mana',color:'U',amount:1})).ok,true);
  const commander=clients[0].room!.game!.cards.find(c=>c.isCommander&&c.ownerId===people[0].user.id)!;
  assert.equal((await action(0,{type:'cast',cardId:commander.id,costsPaid:true})).ok,true);
  await passCycle();
  await action(0,{type:'move',cardId:commander.id,zone:'commander'});
  await action(0,{type:'cast',cardId:commander.id,costsPaid:true});
  await passCycle();
  await until(()=>clients[3].room!.game!.cards.find(c=>c.id===commander.id)?.commanderCasts===2);
  assert.equal((await action(0,{type:'cardCounter',cardId:commander.id,counter:'plusOne',amount:3})).ok,true);
  assert.equal((await action(0,{type:'cardCounter',cardId:commander.id,counter:'shield',amount:1})).ok,true);
  assert.equal((await action(0,{type:'playerCounter',counter:'energy',amount:4})).ok,true);
  await until(()=>clients[3].room!.game!.players[0].counters?.energy===4);
  assert.equal(clients[3].room!.game!.cards.find(c=>c.id===commander.id)!.markers?.plusOne,3);
  assert.equal((await action(0,{type:'copy',cardId:commander.id,newId:'client-chosen-id'})).ok,true);
  assert.equal((await action(0,{type:'draw'})).ok,true);
  await until(()=>clients[0].room!.game!.cards.filter(c=>c.zone==='hand').length===9);
  assert.ok(!clients[0].room!.game!.cards.some(c=>c.id==='client-chosen-id'));
  assert.ok(clients[0].room!.game!.cards.filter(c=>c.token).every(c=>!c.isCommander));
  clients[0].socket.disconnect();const again=await client(server.url,people[0].cookie);clients.push(again);
  await until(()=>Boolean(again.room?.game));assert.equal(again.room!.code,code);assert.equal(again.room!.game!.players[0].life,37);
  assert.equal(again.room!.game!.cards.filter(c=>c.zone==='hand').length,9);
  assert.equal((await clients[1].send('room:finish')).ok,false);
  assert.equal((await again.send('room:finish')).ok,true);await until(()=>clients[1].room?.started===false);
  await again.send('room:leave');await until(()=>clients[1].room?.hostId===people[1].user.id);
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});

test('HTTP auth, CSRF, guest switch, account deck isolation and revoked socket session',async()=>{
 const server=await running();let socket:Socket|undefined;
 try{
  assert.equal((await fetch(`${server.url}/api/decks`)).status,401);
  assert.equal((await fetch(`${server.url}/api/guest`,{method:'POST',body:'{"name":"bad"}'})).status,403);
  const a=await identity(server.url,'Ada'),b=await identity(server.url,'Bela');
  const headers={Origin:server.url,Cookie:a.cookie,'Content-Type':'application/json'};
  assert.equal((await fetch(`${server.url}/api/decks`,{method:'PUT',headers,body:JSON.stringify({decks:[starterDeck()]})})).status,200);
  assert.equal((await (await fetch(`${server.url}/api/decks`,{headers:{Cookie:b.cookie}})).json()).decks.length,0);
  assert.equal((await (await fetch(`${server.url}/api/decks`,{headers:{Cookie:a.cookie}})).json()).decks.length,1);
  const c=await client(server.url,a.cookie);socket=c.socket;const disconnected=new Promise<void>(resolve=>socket!.once('disconnect',()=>resolve()));
  await fetch(`${server.url}/api/logout`,{method:'POST',headers,body:'{}'});await disconnected;
  assert.equal((await fetch(`${server.url}/api/decks`,{headers:{Cookie:a.cookie}})).status,401);
 }finally{socket?.disconnect();await server.close();}
 const closed=await running({database:':memory:',guest:false});try{assert.equal((await fetch(`${closed.url}/api/guest`,{method:'POST',headers:{Origin:closed.url},body:'{"name":"A"}'})).status,403);}finally{await closed.close();}
});

test('Discord authorization code callback binds state to browser, exchanges server-side and cannot be replayed',async()=>{
 let exchanges=0;
 const fetcher=(async(url:string|URL|Request,init?:RequestInit)=>{
  if(String(url).endsWith('/token')){exchanges++;assert.ok(String(init?.body).includes('client_secret=test-secret'));return Response.json({access_token:'private-access-token'});}
  assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer private-access-token');return Response.json({id:'123456789',username:'discord-user',global_name:'Discord Name'});
 }) as typeof fetch;
 const server=await running({database:':memory:',guest:false,publicURL:'http://nexus.test',clientId:'123',clientSecret:'test-secret',fetcher});
 try{
  const res=await fetch(`${server.url}/auth/discord`,{redirect:'manual'});assert.equal(res.status,302);
  const url=new URL(res.headers.get('location')!);assert.equal(url.searchParams.get('scope'),'identify');assert.ok(!url.href.includes('secret'));
  const cookie=res.headers.get('set-cookie')!.split(';')[0];const state=url.searchParams.get('state');const callback=`${server.url}/auth/discord/callback?state=${state}&code=test-code`;
  assert.equal((await fetch(callback,{redirect:'manual'})).status,400);
  const result=await fetch(callback,{headers:{Cookie:cookie},redirect:'manual'});assert.equal(result.status,302);assert.equal(exchanges,1);
  const session=result.headers.get('set-cookie')!;assert.ok(session.includes('HttpOnly'));assert.ok(!session.includes('private-access-token'));
  const profile=await(await fetch(`${server.url}/api/session`,{headers:{Cookie:session.split(';')[0]}})).json();assert.equal(profile.user.provider,'discord');assert.equal(profile.user.name,'Discord Name');
  assert.equal((await fetch(callback,{headers:{Cookie:cookie},redirect:'manual'})).status,400);assert.equal(exchanges,1);
 }finally{await server.close();}
});

test('sessions, account decks and reserved room survive a server restart',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'nexus-test-'));const database=join(directory,'state.sqlite');let server=await running({database,guest:true});
 let socket:Socket|undefined;
 try{
  const person=await identity(server.url,'Persisted');const first=await client(server.url,person.cookie);socket=first.socket;await first.send('room:create');await until(()=>Boolean(first.room));const code=first.room!.code;socket.disconnect();
  await server.close();server=await running({database,guest:true});const second=await client(server.url,person.cookie);socket=second.socket;await until(()=>Boolean(second.room));assert.equal(second.room!.code,code);
 }finally{socket?.disconnect();await server.close();assert.ok(directory.startsWith(join(tmpdir(),'nexus-test-')));rmSync(directory,{recursive:true,force:true});}
});

test('commander designation, tax and printed mana value are independent; moving is not casting',()=>{
 let game=initialGame();const id=game.cards.find(c=>c.ownerId==='you'&&c.isCommander)!.id;
 const get=()=>game.cards.find(c=>c.id===id)!;
 assert.equal(commanderTax(get()),0);game=applyAction(game,'you',{type:'move',cardId:id,zone:'battlefield'});game=applyAction(game,'you',{type:'move',cardId:id,zone:'commander'});assert.equal(commanderTax(get()),0);
 game=applyAction(game,'you',{type:'castCommander',cardId:id});assert.equal(commanderTax(get()),2);
 assert.throws(()=>applyAction(game,'you',{type:'castCommander',cardId:id}));
 assert.equal(commanderCost('{G}{W}{U}{B}',2),'{2}{G}{W}{U}{B}');assert.equal(commanderCost('{4}{G}{G}',4),'{8}{G}{G}');
 const deck=starterDeck();assert.equal(checkDeck(deck,true).commanderId,deck.commanderId);
 assert.throws(()=>checkDeck({...deck,quantities:{}},true));
});

test('private resolution survives actual server restart; foreign, stale and duplicated choices cannot corrupt it',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'nexus-rules-'));const database=join(directory,'state.sqlite');let server=await running({database,guest:true});
 let clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const people=await Promise.all(['One','Two','Three','Four'].map(name=>identity(server.url,name)));
  for(const person of people)clients.push(await client(server.url,person.cookie));
  await clients[0].send('room:create');await until(()=>Boolean(clients[0].room));const code=clients[0].room!.code;
  for(const c of clients.slice(1))await c.send('room:join',{code});for(const c of clients)await c.send('room:ready',{ready:true});await clients[0].send('room:start');await until(()=>Boolean(clients[0].room?.game));
  const action=async(i:number,action:unknown,id=randomUUID())=>await clients[i].send('game:action',{id,action});
  const passCycle=async()=>{for(let n=0;n<4;n++){const id=clients[0].room!.game!.rules!.priority;const index=people.findIndex(p=>p.user.id===id);assert.equal((await action(index,{type:'pass'})).ok,true);await until(()=>clients[0].room!.game!.rules!.priority!==id);}};
  assert.equal((await action(0,{type:'pass'})).ok,false);
  for(let n=0;n<3;n++)assert.equal((await action(0,{type:'mulligan'})).ok,true);
  assert.equal(clients[0].room!.game!.cards.filter(c=>c.zone==='hand').length,7);
  for(let i=0;i<4;i++)await action(i,{type:'keep'});await passCycle();await passCycle();
  await action(0,{type:'effect',effect:{kind:'scry',value:3}});await passCycle();await until(()=>Boolean(clients[0].room!.game!.rules!.pending));
  const choice=clients[0].room!.game!.rules!.pending!,ids=choice.cardIds;
  for(const c of clients.slice(1)){assert.equal(c.room!.game!.choiceCards.length,0);ids.forEach(id=>assert.ok(!JSON.stringify(c.room).includes(`"${id}"`)));}
  clients.forEach(c=>c.socket.disconnect());await server.close();server=await running({database,guest:true});clients=[];
  for(const p of people)clients.push(await client(server.url,p.cookie));await until(()=>clients.every(c=>Boolean(c.room?.game)));
  assert.equal(clients[0].room!.game!.rules!.pending!.id,choice.id);assert.deepEqual(clients[0].room!.game!.choiceCards.map(c=>c.id),ids);
  const command={type:'choose',choiceId:choice.id,first:[ids[2],ids[0]],second:[ids[1]],decision:'done'};
  assert.equal((await action(1,command)).ok,false);const uuid=randomUUID();assert.equal((await action(0,command,uuid)).ok,true);const revision=clients[0].room!.revision;
  assert.equal((await action(0,command,uuid)).ok,true);assert.equal(clients[0].room!.revision,revision);assert.equal((await action(0,command)).ok,false);
  assert.equal(clients[0].room!.game!.rules!.pending,null);assert.equal(clients[0].room!.game!.rules!.priority,people[0].user.id);
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();assert.ok(directory.startsWith(join(tmpdir(),'nexus-rules-')));rmSync(directory,{recursive:true,force:true});}
});

test('online partner deck puts both commanders in the command zone and keeps 98 library cards private',async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const people=await Promise.all(['Partner','Two','Three','Four'].map(name=>identity(server.url,name)));
  for(const p of people)clients.push(await client(server.url,p.cookie));
  assert.equal((await clients[0].send('room:create')).ok,true);await until(()=>Boolean(clients[0].room));
  for(const c of clients.slice(1))assert.equal((await c.send('room:join',{code:clients[0].room!.code})).ok,true);
  const find=(name:string)=>catalogue.find(c=>c.name===name)!;
  const deck={id:'online-pair',name:'Tymna Thrasios',commanderId:find('Tymna the Weaver').id,secondCommanderId:find('Thrasios, Triton Hero').id,quantities:{[find('Forest').id]:98}};
  assert.equal((await clients[0].send('room:deck',deck)).ok,true);
  for(const c of clients)assert.equal((await c.send('room:ready',{ready:true})).ok,true);
  assert.equal((await clients[0].send('room:start')).ok,true);await until(()=>clients.every(c=>Boolean(c.room?.game)));
  const g=clients[0].room!.game!;assert.equal(g.cards.filter(c=>c.ownerId===people[0].user.id&&c.zone==='commander').length,2);
  assert.equal(g.hiddenCounts[people[0].user.id].library,91);
  for(const c of clients.slice(1)){assert.ok(!c.room!.game!.cards.some(card=>card.ownerId===people[0].user.id&&card.zone==='hand'));assert.equal(c.room!.game!.cards.filter(card=>card.ownerId===people[0].user.id&&card.isCommander).length,2);}
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});
for(const seats of [2,3])test(`${seats} players can start, pass priority and share server-generated random results`,async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const people=await Promise.all(Array.from({length:seats},(_,i)=>identity(server.url,`Player ${i}`)));
  for(const p of people)clients.push(await client(server.url,p.cookie));
  await clients[0].send('room:create');await until(()=>Boolean(clients[0].room));
  await clients[0].send('room:ready',{ready:true});assert.equal((await clients[0].send('room:start')).ok,false);
  for(const c of clients.slice(1))await c.send('room:join',{code:clients[0].room!.code});
  assert.equal((await clients[0].send('room:start')).ok,false);
  for(const c of clients)await c.send('room:ready',{ready:true});assert.equal((await clients[0].send('room:start')).ok,true);
  await until(()=>clients.every(c=>c.room?.game?.players.length===seats));
  for(const c of clients)assert.equal((await c.send('game:action',{id:randomUUID(),action:{type:'keep'}})).ok,true);
  for(const c of clients)assert.equal((await c.send('game:action',{id:randomUUID(),action:{type:'pass'}})).ok,true);
  const id=randomUUID(),action={type:'rollDice',sides:6,count:3};assert.equal((await clients[0].send('game:action',{id,action})).ok,true);
  await until(()=>clients.every(c=>c.room!.game!.log.at(-1)?.includes('3W6')===true));
  const result=clients[0].room!.game!.log.at(-1);for(const c of clients)assert.equal(c.room!.game!.log.at(-1),result);
  const revision=clients[0].room!.revision;await clients[0].send('game:action',{id,action});assert.equal(clients[0].room!.revision,revision);
  const correctionId=randomUUID(),correction={type:'lateAbility',abilityType:'triggered',label:'Nachgeholter Versorgungstrigger',reason:'Mit der Runde abgesprochen'};
  assert.equal((await clients[1].send('game:action',{id:correctionId,action:correction})).ok,true);assert.equal((await clients[1].send('game:action',{id:correctionId,action:correction})).ok,true);
  await until(()=>clients.every(c=>c.room!.game!.rules!.stack.length===1));
  const trigger=clients[0].room!.game!.rules!.stack[0];assert.equal(clients[0].room!.game!.rules!.priority,people[1].user.id);assert.equal(trigger.abilityType,'triggered');
  assert.equal((await clients[0].send('game:action',{id:randomUUID(),action:{type:'withdrawStack',stackId:trigger.id,reason:'Fremdes Objekt'}})).ok,false);
  assert.equal((await clients[1].send('game:action',{id:randomUUID(),action:{type:'withdrawStack',stackId:trigger.id,reason:'Falscher Trigger'}})).ok,true);
  assert.equal((await clients[1].send('game:action',{id:randomUUID(),action:{type:'correctDraw',count:1,reason:'Vergessener Draw'}})).ok,true);
  await until(()=>clients.every(c=>c.room!.game!.hiddenCounts[people[1].user.id].hand===8));
  assert.equal(clients[0].room!.game!.cards.some(c=>c.ownerId===people[1].user.id&&c.zone==='hand'),false);

 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});

for(const pair of [false,true])test(`online planeswalker commander${pair?' partner pair':''} is accepted and starts in command zone`,async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const people=await Promise.all(['Walker','Opponent'].map(name=>identity(server.url,name)));for(const p of people)clients.push(await client(server.url,p.cookie));
  await clients[0].send('room:create');await until(()=>Boolean(clients[0].room));await clients[1].send('room:join',{code:clients[0].room!.code});
  const find=(name:string)=>catalogue.find(c=>c.name===name)!;const a=find(pair?'Will Kenrith':'Daretti, Scrap Savant'),b=pair?find('Rowan Kenrith'):undefined;
  const d={id:'pw-online',name:'Planeswalker test',commanderId:a.id,...(b?{secondCommanderId:b.id}:{}),quantities:{[find(pair?'Island':'Mountain').id]:pair?98:99}};
  assert.equal((await clients[0].send('room:deck',d)).ok,true);for(const c of clients)await c.send('room:ready',{ready:true});assert.equal((await clients[0].send('room:start')).ok,true);await until(()=>clients.every(c=>Boolean(c.room?.game)));
  for(const c of clients){const own=c.room!.game!.cards.filter(card=>card.ownerId===people[0].user.id&&card.isCommander);assert.equal(own.length,pair?2:1);assert.ok(own.every(card=>card.zone==='commander'&&card.commanderCasts===0));assert.ok(own.some(card=>card.cardId===a.id));if(b)assert.ok(own.some(card=>card.cardId===b.id));}
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});

test('solo room: host controls bots, capacity is bounded, bots keep/pass, pause and reconnect are safe',async()=>{
 const server=await running({database:':memory:',guest:true,botDelayMs:30});const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{
  const people=await Promise.all(['Solo','Visitor'].map(name=>identity(server.url,name)));for(const p of people)clients.push(await client(server.url,p.cookie));const host=clients[0],visitor=clients[1];
  await host.send('room:create');await until(()=>Boolean(host.room));assert.equal((await host.send('room:botAdd')).ok,true);await until(()=>host.room!.players.length===2);const bot=host.room!.players.find(p=>p.bot)!;assert.equal(bot.ready,true);assert.equal(bot.connected,true);
  await visitor.send('room:join',{code:host.room!.code});assert.equal((await visitor.send('room:botAdd')).ok,false);assert.equal((await visitor.send('room:botRemove',{id:bot.id})).ok,false);await visitor.send('room:leave');
  await host.send('room:botAdd');await host.send('room:botAdd');assert.equal((await host.send('room:botAdd')).ok,false);await until(()=>host.room!.players.length===4);for(const b of host.room!.players.filter(p=>p.bot).slice(1))await host.send('room:botRemove',{id:b.id});
  await host.send('room:ready',{ready:true});assert.equal((await host.send('room:start')).ok,true);await until(()=>Boolean(host.room!.game));assert.equal((await host.send('room:botRemove',{id:bot.id})).ok,false);await host.send('game:action',{id:randomUUID(),action:{type:'keep'}});await until(()=>host.room!.game!.rules!.stage==='playing');assert.equal(host.room!.botsPaused,false);
  assert.ok(!host.room!.game!.cards.some(c=>c.ownerId===bot.id&&c.zone==='hand'));await host.send('room:botPause',{paused:true});await until(()=>host.room!.botsPaused===true);await host.send('game:action',{id:randomUUID(),action:{type:'pass'}});await until(()=>host.room!.game!.rules!.priority===bot.id);const revision=host.room!.revision;await new Promise(r=>setTimeout(r,800));assert.equal(host.room!.revision,revision);
  await host.send('room:botPause',{paused:false});await until(()=>host.room!.game!.rules!.priority===people[0].user.id);assert.equal((await host.send('game:botLife',{id:bot.id,amount:-3})).ok,true);await until(()=>host.room!.game!.players.find(p=>p.id===bot.id)!.life===37);
  host.socket.disconnect();await new Promise(r=>setTimeout(r,100));const reconnect=await client(server.url,people[0].cookie);clients.push(reconnect);await until(()=>Boolean(reconnect.room));assert.equal(reconnect.room!.players.find(p=>p.bot)!.id,bot.id);assert.equal(reconnect.room!.game!.players.find(p=>p.id===bot.id)!.life,37);await reconnect.send('room:finish');await until(()=>reconnect.room!.game===null);assert.equal(reconnect.room!.players.find(p=>p.bot)!.ready,true);
  await reconnect.send('room:leave');await visitor.send('room:create');assert.equal(visitor.room!.players.length,1);
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});

test('leaving a live match concedes, transfers host and permits the next match',async()=>{
 const server=await running();const clients:Awaited<ReturnType<typeof client>>[]=[];
 try{const people=await Promise.all(['Leaving','Remaining'].map(n=>identity(server.url,n)));for(const p of people)clients.push(await client(server.url,p.cookie));
 assert.equal((await clients[0].send('room:create')).ok,true);await until(()=>Boolean(clients[0].room));const code=clients[0].room!.code;
 await clients[1].send('room:join',{code});for(const c of clients)await c.send('room:ready',{ready:true});await clients[0].send('room:start');await until(()=>Boolean(clients[1].room?.game));
 assert.equal((await clients[0].send('room:leave')).ok,true);await until(()=>clients[0].room===null&&clients[1].room?.players.length===1);
 assert.equal(clients[1].room!.hostId,people[1].user.id);assert.equal(clients[1].room!.game!.rules!.stage,'finished');assert.ok(clients[1].room!.game!.rules!.lost.includes(people[0].user.id));
 assert.equal((await clients[1].send('room:finish')).ok,true);await until(()=>clients[1].room?.started===false);assert.equal((await clients[0].send('room:join',{code})).ok,true);
 }finally{clients.forEach(c=>c.socket.disconnect());await server.close();}
});
