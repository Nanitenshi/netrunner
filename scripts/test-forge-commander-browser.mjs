import {createNexusServer} from '../server/server.ts';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {catalogue} from '../shared/catalogue.ts';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const forge={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(forge).every(Boolean))throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES.');
const card=name=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c;};
const decks=[{id:'ada-own',name:'Ada · Eigenes Commander-Deck',commanderId:card('Isamaru, Hound of Konda').id,quantities:{[card('Plains').id]:99}},{id:'bela-own',name:'Bela · Eigenes Commander-Deck',commanderId:card('Ruxa, Patient Professor').id,quantities:{[card('Forest').id]:99}}];
const server=createNexusServer({database:':memory:',guest:true,forge});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
const url='http://127.0.0.1:'+server.http.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});
const pages=[],errors=[];mkdirSync('.local/browser',{recursive:true});
try{
 for(const [i,name] of ['Ada','Bela'].entries()){
  const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();pages.push(page);page.on('pageerror',error=>errors.push(error.message));await page.goto(url);
  await page.evaluate(async({name,deck,local})=>{const res=await fetch('/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(!res.ok)throw Error('Guest login');if(local)localStorage.setItem('nexus.decks',JSON.stringify([deck]));else{const saved=await fetch('/api/decks',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({decks:[deck]})});if(!saved.ok)throw Error('Account deck save');}},{name,deck:decks[i],local:i===0});
  await page.goto(url+'/#forge');await page.reload();
 }
 const [a,b]=pages;
 await a.getByRole('button',{name:'Testtisch erstellen',exact:true}).click();await a.getByText('Einladungscode:').waitFor();await b.getByRole('textbox',{name:'Testtisch-Code'}).fill(await a.locator('.forge-lobby p b').innerText());await b.getByRole('button',{name:'Beitreten',exact:true}).click();
 await a.getByRole('combobox',{name:'Testszenario'}).selectOption('commander');await a.getByRole('heading',{name:'Commander mit eigenen Decks',exact:true}).waitFor();await b.getByRole('heading',{name:'Commander mit eigenen Decks',exact:true}).waitFor();assert(await a.getByRole('button',{name:'Commander-Partie starten',exact:true}).isDisabled());
 for(const [i,page] of pages.entries()){await page.getByRole('tab',{name:/Meine Decks/}).click();await page.locator('.pregame-deck').filter({hasText:decks[i].name}).click();await page.locator('.forge-deck-seats').getByText(new RegExp(decks[i].name+' · 100 Karten')).waitFor();}
 assert.equal(await a.locator('.pregame-deck').filter({hasText:decks[1].name}).count(),0);assert.equal(await b.locator('.pregame-deck').filter({hasText:decks[0].name}).count(),0);
 await a.setViewportSize({width:390,height:844});assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:'.local/browser/commander-decks-mobile.png',fullPage:true});await a.setViewportSize({width:1366,height:900});
 await a.getByRole('button',{name:'Mit diesem Deck bereit',exact:true}).click();assert(await a.getByRole('button',{name:'Commander-Partie starten',exact:true}).isDisabled());await b.getByRole('button',{name:'Mit diesem Deck bereit',exact:true}).click();await a.getByRole('button',{name:'Commander-Partie starten',exact:true}).click();
 await a.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor({timeout:65000});await b.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor();assert.equal(await a.locator('.forge-hand .forge-card').count(),7);assert.equal(await b.locator('.forge-hand .forge-card').count(),7);
 assert.equal(await a.locator('.forge-hand').getByRole('button',{name:'Forest',exact:true}).count(),0);assert.equal(await b.locator('.forge-hand').getByRole('button',{name:'Plains',exact:true}).count(),0);assert.match(await a.getByLabel('Ada Kommandozone').innerText(),/Commander-Tax \+0/);
 await a.getByRole('button',{name:'Neue sieben Karten',exact:true}).click();await a.getByText('1 kostenlose Mulligans · 0/2 behalten',{exact:true}).waitFor();await b.reload();await b.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor();assert.equal(await b.locator('.forge-hand .forge-card').count(),7);
 await a.setViewportSize({width:390,height:844});assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await a.screenshot({path:'.local/browser/commander-opening-mobile.png',fullPage:true});await a.setViewportSize({width:1366,height:900});
 await a.getByRole('button',{name:'Starthand behalten',exact:true}).click();await b.getByRole('button',{name:'Starthand behalten',exact:true}).click();await a.locator('.forge-opening').waitFor({state:'hidden'});
 await a.locator('.forge-hand').getByRole('button',{name:'Plains',exact:true}).first().click();await a.locator('.forge-command .forge-card.playable').waitFor();await a.locator('.forge-command').getByRole('button',{name:'Isamaru, Hound of Konda',exact:true}).click();await b.locator('.forge-stack').getByRole('button',{name:/Isamaru/}).waitFor();
 await b.getByRole('button',{name:'Passen',exact:true}).click();await a.getByRole('button',{name:'Passen',exact:true}).click();await a.locator('.forge-creatures').getByRole('button',{name:'Isamaru, Hound of Konda',exact:true}).waitFor();await a.screenshot({path:'.local/browser/commander-game-desktop.png'});
 assert.equal(await a.locator('.forge-lands .forge-card.tapped').count(),1);assert.equal(await b.locator('.forge-command').getByRole('button',{name:'Ruxa, Patient Professor',exact:true}).count(),1);
 await b.evaluate(()=>window.confirm=()=>true);await b.getByRole('button',{name:'Aufgeben',exact:true}).click();await a.getByRole('heading',{name:'Partie beendet',exact:true}).waitFor();await b.getByRole('heading',{name:'Partie beendet',exact:true}).waitFor();assert.match(await a.locator('.forge-opening').innerText(),/Ada/);
 await a.getByRole('button',{name:'Testtisch verlassen',exact:true}).click();await b.getByRole('button',{name:'Testtisch erstellen',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS two browsers: local/account deck selection, privacy, shared mode, readiness, full own decks, mulligan, reload, commander zone, actual cast/payment, mobile layout, concession and leave');
}catch(error){if(pages[0]){console.log(await pages[0].locator('body').innerText());await pages[0].screenshot({path:'.local/browser/commander-failure.png',fullPage:true});}throw error;}
finally{await browser.close();await server.close();}
