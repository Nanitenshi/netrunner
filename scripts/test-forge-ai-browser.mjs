import {createNexusServer} from '../server/server.ts';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import assert from 'node:assert/strict';
import {io} from 'socket.io-client';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const forge={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(forge).every(Boolean))throw Error('Configure Forge paths');
const id=name=>catalogue.find(c=>c.name===name).id;
const deck={id:'my-ai-test',name:'Mein KI-Testdeck',commanderId:id('Isamaru, Hound of Konda'),quantities:{[id('Plains')]:99}};
const server=createNexusServer({database:':memory:',guest:true,forge});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
const url='http://127.0.0.1:'+server.http.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});
const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));mkdirSync('.local/browser',{recursive:true});
const enabled=async button=>{const end=Date.now()+10000;while(await button.isDisabled()){if(Date.now()>end)throw Error('Button stayed disabled');await page.waitForTimeout(20);}};
let observer,view;
const waitView=async check=>{const end=Date.now()+15000;while(!check()){if(Date.now()>end)throw Error('Room update timeout');await page.waitForTimeout(20);}};
const click=async button=>{const revision=view.revision;await button.click();await waitView(()=>view.revision>revision);};
try{
 await page.goto(url);await page.evaluate(async deck=>{await fetch('/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Ada'})});localStorage.setItem('nexus.decks',JSON.stringify([deck]));},deck);
 await page.goto(url+'/#forge');await page.reload();observer=io(url,{reconnection:false,timeout:10000,extraHeaders:{Origin:url,Cookie:(await context.cookies()).map(c=>c.name+'='+c.value).join('; ')}});observer.on('forge:room',room=>view=room);await Promise.race([once(observer,'connect'),once(observer,'connect_error').then(([error])=>{throw error;})]);await page.getByRole('button',{name:'Testtisch erstellen',exact:true}).click();await waitView(()=>Boolean(view));
 await page.getByRole('combobox',{name:'Testszenario'}).selectOption('commander');await page.getByRole('tab',{name:/Meine Decks/}).click();await page.locator('.pregame-deck').filter({hasText:deck.name}).click();
 const opponent=page.getByRole('combobox',{name:'KI-Gegnerdeck'}),level=page.getByRole('combobox',{name:'KI-Schwierigkeit'});
 assert.equal(await opponent.locator('optgroup[label="Vorbereitete Decks"] option').count(),5);assert.equal(await level.locator('option').count(),3);
 await opponent.selectOption(preparedDecks[1].id);await level.selectOption('easy');await page.getByRole('button',{name:'KI-Gegner hinzufügen',exact:true}).click();await page.locator('.forge-deck-seats').getByText('Forge-KI · Leicht',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Mit diesem Deck bereit',exact:true}).click();await enabled(page.getByRole('button',{name:'Commander-Partie starten',exact:true}));
 await opponent.selectOption(deck.id);await level.selectOption('hard');await page.getByRole('button',{name:'KI-Gegner aktualisieren',exact:true}).click();await page.locator('.forge-deck-seats').getByText('Forge-KI · Schwer',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Commander-Partie starten',exact:true}).isDisabled());
 await page.getByRole('button',{name:'KI entfernen',exact:true}).click();await page.getByRole('button',{name:'KI-Gegner hinzufügen',exact:true}).waitFor();await page.getByRole('button',{name:'KI-Gegner hinzufügen',exact:true}).click();await page.getByRole('button',{name:'KI entfernen',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.local/browser/ai-picker-mobile.png',fullPage:true});await page.setViewportSize({width:1366,height:900});
 await page.getByRole('button',{name:'Mit diesem Deck bereit',exact:true}).click();await page.getByRole('button',{name:'Commander-Partie starten',exact:true}).click();await page.getByRole('heading',{name:'Deine Starthand',exact:true}).waitFor({timeout:65000});assert.match(await page.locator('.forge-opening').innerText(),/1\/2 behalten/);
 await page.getByRole('button',{name:'Starthand behalten',exact:true}).click();await page.locator('.forge-opening').waitFor({state:'hidden'});
 await waitView(()=>view.game?.stage==='playing');
 for(let n=0;!view.game.stack.some(s=>s.controller===1)&&n<100;n++){
  const game=view.game;assert(!game.cards.some(c=>c.owner===1&&['hand','library'].includes(c.zone)),'Wire snapshot must keep AI cards private');
  if(game.active===0&&!game.stack.length&&!game.ending&&!game.combatRunning){const land=game.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.landPlayable);await click(land?page.locator('.forge-hand').getByRole('button',{name:'Plains',exact:true}).first():page.getByRole('button',{name:'Zug beenden',exact:true}));}
  else await click(page.getByRole('button',{name:'Passen',exact:true}));
 }
 assert(view.game.stack.some(s=>s.controller===1),'AI must expose a real casting response window');
 await page.locator('.forge-stack').getByRole('button',{name:/Isamaru/}).waitFor();assert.match(await page.locator('.forge-phase').innerText(),/Ada hat Priorität/);assert.equal(await page.locator('.forge-stack').getByRole('button',{name:/Isamaru/}).count(),1);
 await page.reload();await page.locator('.forge-stack').getByRole('button',{name:/Isamaru/}).waitFor();await page.getByRole('button',{name:'Passen',exact:true}).click();await page.locator('.forge-mat.opponent .forge-creatures').getByRole('button',{name:'Isamaru, Hound of Konda',exact:true}).waitFor();await page.screenshot({path:'.local/browser/ai-match-desktop.png'});
 await page.evaluate(()=>window.confirm=()=>true);await page.getByRole('button',{name:'Aufgeben',exact:true}).click();await page.getByRole('heading',{name:'Partie beendet',exact:true}).waitFor();assert.match(await page.locator('.forge-opening').innerText(),/Forge-KI/);
 await page.getByRole('button',{name:'Testtisch verlassen',exact:true}).click();await page.getByRole('button',{name:'Testtisch erstellen',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS browser: five prepared and own AI decks, three levels, readiness reset, remove, solo start, private opening, AI casting, human response, reload, resolution, concession and leave');
}catch(e){console.log(await page.locator('body').innerText());await page.screenshot({path:'.local/browser/ai-failure.png',fullPage:true});throw e;}finally{observer?.disconnect();await browser.close();await server.close();}
