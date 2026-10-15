import {createServer} from 'vite';
import {createNexusServer} from '../server/server.ts';
import {once} from 'node:events';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
mkdirSync('.local/browser',{recursive:true});
// Isolated deterministic fixture using the actual cast panel, projection and authoritative engine.
writeFileSync('.local/mana-fixture.html','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/.local/mana-fixture.tsx"></script></body></html>');
writeFileSync('.local/mana-fixture.tsx',`
import {useState,useEffect,useRef} from 'react';import {createRoot} from 'react-dom/client';
import MechanicsPanel from '../src/MechanicsPanel';import {ArtworkProvider} from '../src/artworks';
import {initialGame} from '../src/seed';import {catalogue} from '../shared/catalogue';import {enableRules} from '../shared/engine';import {applyAction,projectGame} from '../shared/game';
import '../src/style.css';import '../src/styles.css';import '../src/mechanics.css';
function fixture(mode='filter'){const s=enableRules(initialGame());s.cards=s.cards.filter(c=>c.isCommander);s.players.forEach(p=>p.mana={});
const names=mode==='insufficient'?['Ferrous Lake']:mode==='hybrid'?['Island','Cascade Bluffs']:['Forest','Ferrous Lake'];
for(const [index,name] of [...names,mode==='hybrid'?'Goblin Piker':'Expressive Iteration'].entries()){s.cards.push({id:'fixture-'+index,cardId:catalogue.find(c=>c.name===name).id,ownerId:'you',controllerId:'you',zone:index===names.length?'hand':'battlefield',tapped:false,counters:0,position:{x:.2,y:.5}});}return s;}
function Fixture(){const [s,set]=useState(fixture),[id,setId]=useState('fixture-2'),rejectNext=useRef(false);
useEffect(()=>{window.manaFixture={snapshot:()=>s,rejectNext:()=>{rejectNext.current=true;},reset:(mode)=>{const next=fixture(mode);set(next);setId(next.cards.at(-1).id);}};},[s]);
return <div className="app" style={{'--accent':'#64ceff','--ui-scale':1}}><MechanicsPanel defaultAutoTap active autoStack={false} searchRequest={0} view={projectGame(s,'you')} seat="you" dispatch={a=>{if(rejectNext.current){rejectNext.current=false;return Promise.resolve(false);}set(old=>applyAction(old,'you',a));return Promise.resolve(true);}} castId={id} closeCast={()=>setId(null)} onInspect={()=>{}} onCast={setId}/></div>;}
createRoot(document.getElementById('root')).render(<ArtworkProvider><Fixture/></ArtworkProvider>);
`);
const vite=await createServer({configLoader:'native',server:{host:'127.0.0.1',port:0,strictPort:false}});await vite.listen();
const fixtureURL='http://127.0.0.1:'+vite.httpServer.address().port+'/.local/mana-fixture.html';
const server=createNexusServer({database:':memory:',guest:true});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
const url='http://127.0.0.1:'+server.http.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});
const errors=[],page=await browser.newPage({viewport:{width:1366,height:900}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(fixtureURL);await page.getByRole('list',{name:'Mana-Vorschau'}).waitFor();
 assert.match(await page.locator('.auto-mana ol').innerText(),/Forest[\s\S]*Ferrous Lake.*bezahlt \{1\}.*U ×1 \+ R ×1/);
 assert((await page.evaluate(()=>window.manaFixture.snapshot().cards.filter(c=>c.zone==='battlefield').map(c=>c.tapped))).every(t=>!t));
 await page.screenshot({path:'.local/browser/auto-mana-desktop.png'});
 await page.getByRole('button',{name:'Wirken abbrechen',exact:true}).click();assert.equal((await page.evaluate(()=>window.manaFixture.snapshot().rules.stack)).length,0);
 await page.evaluate(()=>window.manaFixture.reset('filter'));await page.setViewportSize({width:390,height:844});await page.locator('.auto-mana ol').waitFor();
 const bounds=await page.locator('.cast-tray').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'.local/browser/auto-mana-mobile.png',fullPage:true});
 await page.evaluate(()=>window.manaFixture.rejectNext());await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).click();await page.waitForTimeout(100);
 assert(await page.getByLabel('Spruch wirken',{exact:true}).isVisible(),'Rejected cast must leave the cost review open');assert.equal((await page.evaluate(()=>window.manaFixture.snapshot().rules.stack)).length,0);assert((await page.evaluate(()=>window.manaFixture.snapshot().cards.filter(c=>c.zone==='battlefield').map(c=>c.tapped))).every(t=>!t));
 await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).click();
 await page.waitForFunction(()=>window.manaFixture.snapshot().rules.stack.length===1);assert((await page.evaluate(()=>window.manaFixture.snapshot().cards.filter(c=>c.zone==='battlefield').map(c=>c.tapped))).every(Boolean));
 assert.deepEqual(await page.evaluate(()=>window.manaFixture.snapshot().players[0].mana),{});
 await page.evaluate(()=>window.manaFixture.reset('insufficient'));await page.getByText(/Keine sichere automatische Bezahlung/).waitFor();assert(await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).isDisabled());
 await page.getByRole('combobox',{name:'Mana-Zahlung',exact:true}).selectOption('manual');assert(await page.getByRole('button',{name:'Manuell bezahlt – wirken',exact:true}).isDisabled());await page.getByRole('checkbox',{name:/Ich habe Mana/}).check();await page.getByRole('button',{name:'Manuell bezahlt – wirken',exact:true}).click();await page.waitForFunction(()=>window.manaFixture.snapshot().rules.stack.length===1);assert.equal(await page.evaluate(()=>window.manaFixture.snapshot().cards.find(c=>c.zone==='battlefield').tapped),false);
 await page.evaluate(()=>window.manaFixture.reset('filter'));await page.getByRole('combobox',{name:'Mana-Zahlung',exact:true}).selectOption('sources');
 await page.getByRole('checkbox',{name:'Ferrous Lake als Manaquelle',exact:true}).check();assert(await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).isDisabled());
 await page.getByRole('checkbox',{name:'Forest als Manaquelle',exact:true}).check();await page.getByRole('list',{name:'Mana-Vorschau'}).waitFor();assert(await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).isEnabled());
 assert((await page.evaluate(()=>window.manaFixture.snapshot().cards.filter(c=>c.zone==='battlefield').map(c=>c.tapped))).every(t=>!t));await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).click();await page.waitForFunction(()=>window.manaFixture.snapshot().rules.stack.length===1);
 assert((await page.evaluate(()=>window.manaFixture.snapshot().cards.filter(c=>c.zone==='battlefield').map(c=>c.tapped))).every(Boolean));
 await page.evaluate(()=>window.manaFixture.reset('hybrid'));await page.locator('.auto-mana ol').waitFor();assert.match(await page.locator('.auto-mana ol').innerText(),/Island[\s\S]*Cascade Bluffs/);
 // Production app: the preference routes simple casts through the reviewable preview.
 await page.setViewportSize({width:1366,height:900});await page.addInitScript(()=>localStorage.setItem('nexus.preferences',JSON.stringify({autoTap:true,simpleControls:true})));await page.goto(url+'/#arena');
 await page.locator('.hand-cards .card').first().waitFor();const spell=page.locator('.hand-slot').filter({has:page.getByTitle('Rhystic Study',{exact:true})}).locator('.card');await spell.dblclick();
 await page.getByRole('combobox',{name:'Mana-Zahlung',exact:true}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Mana-Zahlung',exact:true}).inputValue(),'auto');await page.locator('.auto-mana ol').waitFor();
 await page.getByRole('button',{name:'Wirken abbrechen',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS payment preview, cancellation, rejected acknowledgement, automatic cast, insufficient mana, explicit manual fallback, selected filter sources, hybrid filter and production preference');
}catch(error){await page.screenshot({path:'.local/browser/auto-mana-failure.png',fullPage:true});console.log(await page.locator('body').innerText());throw error;}
finally{await browser.close();await vite.close();await server.close();}
