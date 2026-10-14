import {createNexusServer} from '../server/server.ts';
import {once} from 'node:events';
import {readFileSync,mkdirSync} from 'node:fs';
import {io} from 'socket.io-client';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const forge={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(forge).every(Boolean))throw Error('Configure Forge paths');
const server=createNexusServer({database:':memory:',guest:true,clientId:'',clientSecret:'',forge});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const url='http://127.0.0.1:'+server.http.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});const pages=[],sockets=[],errors=[],deckRequests=[];let room,forgeRoom;
mkdirSync('.local/browser',{recursive:true});
const until=async fn=>{const end=Date.now()+15000;while(!await fn()){if(Date.now()>end)throw Error('Guest browser timeout');await pages[0].waitForTimeout(20);}};
const text='Commander\n1 Isamaru, Hound of Konda\n\nDeck\n99 Plains';
try{
 for(let n=0;n<3;n++){
  const context=await browser.newContext(n===0?{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1}:{viewport:{width:1366,height:900}});const page=await context.newPage();pages.push(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname==='/api/decks')deckRequests.push(r.method());});
  await page.goto(url+(n===1?'/#forge':'/#lobby'));
 }
 const [a,b,c]=pages;
 const imported=async(page,list,name)=>{
  await page.goto(url+'/#decks');await page.locator('.deck-import summary').click();await page.getByRole('button',{name:'Deckliste einfügen',exact:true}).click();await page.getByRole('textbox',{name:'Deckliste einfügen',exact:true}).fill(list);await page.getByRole('button',{name:'Import prüfen',exact:true}).click();await page.getByRole('textbox',{name:'Importierter Deckname',exact:true}).fill(name);await page.getByRole('button',{name:'Als neues Deck erstellen',exact:true}).click();
  await until(()=>page.getByRole('textbox',{name:'Deckname',exact:true}).inputValue().then(v=>v===name));
  assert.equal(await page.getByRole('button',{name:'Im Konto speichern',exact:true}).count(),0);
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('nexus.decks')));assert.equal(data.length,1);return data[0];
 };
 for(const [page,name] of [[a,'Gast-Ada'],[b,'Gast-Bela']]){
  await page.getByRole('textbox',{name:'Spielname',exact:true}).fill(name);await page.getByRole('button',{name:'Als Gast spielen',exact:true}).click();
  await (page===a?page.getByRole('button',{name:'Tisch erstellen',exact:true}):page.getByRole('button',{name:'Testtisch erstellen',exact:true})).waitFor();
  const session=await page.evaluate(async()=>await(await fetch('/api/session')).json());assert.equal(session.user.provider,'guest');assert.equal(session.discordReady,false);assert.equal(await page.getByRole('link',{name:'Mit Discord anmelden ↗',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>localStorage.getItem('nexus.profileName')),name);
 }
 const ownA=await imported(a,text,'Ada lokal'),ownB=await imported(b,text,'Bela lokal');
 const downloadEvent=a.waitForEvent('download');await a.getByRole('button',{name:'Exportieren',exact:true}).click();const download=await downloadEvent;assert.match(download.suggestedFilename(),/Ada lokal/);const exported=readFileSync(await download.path(),'utf8');assert.match(exported,/99 Plains/);
 const importedC=await imported(c,exported,'Import auf anderem Gerät');assert.equal(importedC.commanderId,ownA.commanderId);assert.deepEqual(importedC.quantities,ownA.quantities);
 await a.reload();assert.equal(await a.getByRole('textbox',{name:'Deckname',exact:true}).inputValue(),'Ada lokal');assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('nexus.decks'))),[ownA]);
 const connect=async page=>{const socket=io(url,{transports:['websocket'],reconnection:false,extraHeaders:{Origin:url,Cookie:(await page.context().cookies()).map(c=>c.name+'='+c.value).join('; ')}});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;};
 const host=await connect(a),peer=await connect(b);host.on('room',v=>room=v);host.on('forge:room',v=>forgeRoom=v);
 const send=async(socket,event,input={})=>{const r=await socket.timeout(10000).emitWithAck(event,input);assert(r.ok,r.error);};
 await a.goto(url+'/#lobby');await b.goto(url+'/#lobby');await a.getByRole('button',{name:'Tisch erstellen',exact:true}).click();await until(()=>Boolean(room));await b.getByRole('textbox',{name:'Raumcode',exact:true}).fill(room.code);await b.getByRole('button',{name:'Beitreten',exact:true}).click();await until(()=>room.players.length===2);
 for(const [page,name] of [[a,'Ada lokal'],[b,'Bela lokal']]){await page.getByRole('tab',{name:/Meine Decks/}).click();await page.locator('.pregame-deck').filter({hasText:name}).click();await page.getByRole('button',{name:'Ich bin bereit',exact:false}).click();}
 await until(()=>room.players.every(p=>p.ready));await a.getByRole('button',{name:'Partie starten',exact:true}).click();await until(()=>room.started);
 for(const socket of [host,peer])await send(socket,'game:action',{id:randomUUID(),action:{type:'keep'}});
 await until(()=>room.game?.rules?.stage==='playing');assert(room.game.cards.every(card=>card.zone!=='hand'||card.ownerId===room.seat));const code=room.code;await a.reload();await a.locator('.tabletop-app').waitFor();await until(()=>room.code===code);assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('nexus.decks'))),[ownA]);
 await send(host,'room:leave');await send(peer,'room:leave');await until(()=>room===null);
 await a.goto(url+'/#forge');await b.goto(url+'/#forge');await a.getByRole('button',{name:'Testtisch erstellen',exact:true}).click();await until(()=>Boolean(forgeRoom));await b.getByRole('textbox',{name:'Testtisch-Code',exact:true}).fill(forgeRoom.code);await b.getByRole('button',{name:'Beitreten',exact:true}).click();await until(()=>forgeRoom.players.length===2);await a.getByRole('combobox',{name:'Testszenario',exact:true}).selectOption('commander');
 for(const [page,name] of [[a,'Ada lokal'],[b,'Bela lokal']]){await page.getByRole('tab',{name:/Meine Decks/}).click();await page.locator('.pregame-deck').filter({hasText:name}).click();await page.getByRole('button',{name:'Mit diesem Deck bereit',exact:true}).click();}
 await until(()=>forgeRoom.players.every(p=>p.ready));assert.equal(await a.getByText('Kontodecks konnten nicht geladen werden.',{exact:false}).count(),0);await a.getByRole('button',{name:'Commander-Partie starten',exact:true}).click();await a.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor({timeout:65000});
 const forgeCode=forgeRoom.code;await a.reload();await a.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor();assert.equal(forgeRoom.code,forgeCode);assert(forgeRoom.game.cards.every(card=>card.zone!=='hand'||card.owner===forgeRoom.seat));
 for(const page of [a,b])await page.getByRole('button',{name:'Starthand behalten',exact:true}).click();await until(()=>forgeRoom.game.stage==='playing');await a.screenshot({path:'.local/browser/guest-commander-mobile.png'});
 assert.deepEqual(deckRequests,[],'Guests must not load or upload account decks automatically');
 const forbidden=await a.evaluate(async()=>{const r=await fetch('/api/decks',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({decks:[]})});return r.status;});assert.equal(forbidden,403);
 await send(host,'forge:leave');await a.goto(url+'/#account');await a.getByRole('button',{name:'Abmelden',exact:true}).click();await a.getByRole('button',{name:'Als Gast spielen',exact:true}).waitFor();assert.equal(await a.getByRole('textbox',{name:'Spielname',exact:true}).inputValue(),'Gast-Ada');assert.deepEqual(await a.evaluate(()=>JSON.parse(localStorage.getItem('nexus.decks'))),[ownA]);
 await a.screenshot({path:'.local/browser/guest-access-mobile.png'});assert.deepEqual(errors,[]);console.log('PASS guest UI on phone/desktop: lobby and Forge entry, local import/save/reload/export/other-device import, casual multiplayer and native Commander, private hands, no account requests, rejected upload and logout retaining decks/profile');
}catch(e){if(pages[0]){console.log(await pages[0].locator('body').innerText());await pages[0].screenshot({path:'.local/browser/guest-failure.png',fullPage:true});}throw e;}finally{sockets.forEach(s=>s.disconnect());await browser.close();await server.close();}
