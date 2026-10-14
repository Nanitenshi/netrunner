import {createNexusServer} from '../server/server.ts';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {io} from 'socket.io-client';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const forge={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(forge).every(Boolean))throw Error('Configure Forge paths');
const server=createNexusServer({database:':memory:',guest:true,forge});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');const url='http://127.0.0.1:'+server.http.address().port;
const id=name=>catalogue.find(c=>c.name===name).id;
const decks=[{id:'mixed',name:'Mixed reveal',commanderId:preparedDecks[0].commanderId,quantities:{[id('Plains')]:49,[id('Island')]:49,[id('Port Town')]:1}},{id:'same',name:'Same reveal',commanderId:preparedDecks[0].commanderId,quantities:{[id('Plains')]:98,[id('Port Town')]:1}}];
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});const pages=[],errors=[];let observer,room;mkdirSync('.local/browser',{recursive:true});
const until=async check=>{const end=Date.now()+15000;while(!await check()){if(Date.now()>end)throw Error('Automation browser timeout');await pages[0].waitForTimeout(20);}};
try{
 for(const name of ['Ada','Bela']){
  const context=await browser.newContext(name==='Ada'?{viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1}:{viewport:{width:1366,height:900}}),page=await context.newPage();pages.push(page);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.evaluate(async({name,decks})=>{const r=await fetch('/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(!r.ok)throw Error('Login failed');localStorage.setItem('nexus.decks',JSON.stringify(decks));},{name,decks});await page.goto(url+'/#forge');await page.reload();
 }
 const [a,b]=pages;observer=io(url,{reconnection:false,extraHeaders:{Origin:url,Cookie:(await a.context().cookies()).map(c=>c.name+'='+c.value).join('; ')}});observer.on('forge:room',v=>room=v);await Promise.race([once(observer,'connect'),once(observer,'connect_error').then(([e])=>{throw e;})]);
 const act=async(page,locator)=>{const revision=room.revision;if(page===a)await locator.tap();else await locator.click();await until(()=>room.revision>revision);};
 const settings=async()=>{await a.getByRole('button',{name:room.game?.choice?.seat===room.seat?'Automatik einstellen':room.game?'Deine Entscheidungen':'Entscheidungen',exact:true}).tap();await a.getByRole('dialog',{name:'Deine Entscheidungen',exact:true}).waitFor();};
 const close=async()=>a.getByRole('button',{name:'Entscheidungseinstellungen schließen',exact:true}).tap();
 const mode=async automatic=>{await act(a,a.getByRole('radio',{name:automatic?'Automatisch, wenn eindeutig':'Selbst entscheiden',exact:true}));await until(()=>room.automation.revealLands===automatic);};
 const table=async deck=>{
  await a.getByRole('button',{name:'Testtisch erstellen',exact:true}).tap();await until(()=>Boolean(room));await b.getByRole('textbox',{name:'Testtisch-Code'}).fill(room.code);await b.getByRole('button',{name:'Beitreten',exact:true}).click();await until(()=>room.players.length===2);
  await a.getByRole('combobox',{name:'Testszenario'}).selectOption('commander');
  for(const page of pages){await page.getByRole('tab',{name:/Meine Decks/}).click();await page.locator('.pregame-deck').filter({hasText:deck.name}).click();await page.getByRole('button',{name:'Mit diesem Deck bereit',exact:true}).click();}await until(()=>room.players.every(p=>p.ready));
  await settings();assert(await a.getByRole('radio',{name:'Selbst entscheiden',exact:true}).isChecked());await mode(true);await close();
  await a.getByRole('button',{name:'Commander-Partie starten',exact:true}).tap();await a.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor({timeout:65000});
  const found=()=>room.game.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name==='Port Town')&&(deck.id!=='mixed'||['Plains','Island'].every(name=>room.game.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name===name)));
  for(let n=0;!found()&&n<1000;n++){await act(a,a.getByRole('button',{name:'Neue sieben Karten',exact:true}));await a.waitForTimeout(150);}assert(found());
  await act(a,a.getByRole('button',{name:'Starthand behalten',exact:true}));await act(b,b.getByRole('button',{name:'Starthand behalten',exact:true}));
  await a.locator('.forge-hand').getByRole('button',{name:'Port Town',exact:true}).tap();await a.getByRole('button',{name:'Als Land spielen',exact:true}).tap();
 };
 const leave=async()=>{await a.evaluate(()=>window.confirm=()=>true);await a.getByRole('button',{name:'Testtisch verlassen',exact:true}).tap();await until(()=>room===null);await b.getByRole('button',{name:'Testtisch erstellen',exact:true}).waitFor();};
 await table(decks[0]);await a.getByRole('heading',{name:'Handkarte aufdecken',exact:true}).waitFor();assert.equal(await b.locator('.forge-decision').count(),0);
 assert.match(await a.locator('.forge-automation-hint').innerText(),/Verschiedene/);const choiceId=room.game.choice.id;await a.reload();await a.getByRole('heading',{name:'Handkarte aufdecken',exact:true}).waitFor();assert.equal(room.game.choice.id,choiceId);assert(room.automation.revealLands);
 await a.locator('.forge-decision-options button').last().tap();const chosen=room.game.choice.options.at(-1),chosenId=chosen.id;
 await settings();await a.setViewportSize({width:844,height:390});assert(await a.getByRole('radio',{name:'Automatisch, wenn eindeutig',exact:true}).isChecked());await mode(false);await a.screenshot({path:'.local/browser/automation-settings-landscape.png'});
 const box=await a.getByRole('button',{name:'Entscheidungseinstellungen schließen',exact:true}).boundingBox();assert(box.y>=0&&box.y+box.height<=390);await close();assert.equal(await a.locator('.forge-decision-options button.chosen').count(),1);
 await act(a,a.getByRole('button',{name:'Aufdecken bestätigen',exact:true}));await until(()=>!room.game.choice);assert.deepEqual(room.automaticDecisions,[]);assert(!room.game.cards.find(c=>c.name==='Port Town'&&c.zone==='battlefield').tapped);
 await b.getByRole('button',{name:'Aufgedeckte Karten ansehen',exact:true}).click();assert.equal(await b.locator('.forge-reveals figcaption').count(),1);assert.equal(await b.locator('.forge-reveals figcaption').innerText(),chosen.name);await b.getByRole('button',{name:'Aufgedeckte Karten schließen',exact:true}).click();assert(room.game.cards.some(c=>c.id===chosenId&&c.zone==='hand'));
 await leave();await a.setViewportSize({width:390,height:844});await table(decks[1]);await until(()=>!room.game.choice&&room.automaticDecisions.length===1);assert(!room.game.cards.find(c=>c.name==='Port Town'&&c.zone==='battlefield').tapped);
 await settings();assert.equal(await a.locator('.forge-automation-settings li').count(),1);assert.match(await a.locator('.forge-automation-settings li').innerText(),/Port Town: Plains/);await close();await a.reload();await until(()=>Boolean(room.game));await settings();assert(await a.getByRole('radio',{name:'Automatisch, wenn eindeutig',exact:true}).isChecked());assert.equal(await a.locator('.forge-automation-settings li').count(),1);
 await mode(false);await close();await a.screenshot({path:'.local/browser/automation-mobile-finished.png'});assert.equal(room.automaticDecisions.length,1);
 await b.getByRole('button',{name:'Deine Entscheidungen',exact:true}).click();assert(await b.getByRole('radio',{name:'Selbst entscheiden',exact:true}).isChecked());assert.equal(await b.locator('.forge-automation-settings li').count(),0);await b.getByRole('button',{name:'Entscheidungseinstellungen schließen',exact:true}).click();
 const rejected=await observer.timeout(8000).emitWithAck('forge:automation',{revealLands:true,seat:1});assert.equal(rejected.ok,false);assert.equal(room.automation.revealLands,false);
 await leave();assert.deepEqual(errors,[]);console.log('PASS two browsers: touch settings, opt-in auto, mixed-card fallback, manual switch preserves selection, own consent/history, reconnect, new-table reset, landscape, invalid foreign setting rejected');
}catch(e){if(pages[0]){console.log(await pages[0].locator('body').innerText());await pages[0].screenshot({path:'.local/browser/automation-failure.png',fullPage:true});}throw e;}finally{observer?.disconnect();await browser.close();await server.close();}
