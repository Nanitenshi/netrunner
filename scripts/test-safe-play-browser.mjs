import {createNexusServer} from '../server/server.ts';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {io} from 'socket.io-client';
import {catalogue} from '../shared/catalogue.ts';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=createNexusServer({database:':memory:',guest:true});server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
const url='http://127.0.0.1:'+server.http.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});
const deck={id:'safe-first-turn',name:'Erster Zug',commanderId:catalogue.find(c=>c.name==='Isamaru, Hound of Konda').id,quantities:{[catalogue.find(c=>c.name==='Plains').id]:99}};
mkdirSync('.local/browser',{recursive:true});
try{
 for(const touch of process.env.TEST_TOUCH==='true'?[false,true]:[false]){
  const context=await browser.newContext(touch?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1366,height:900}}),page=await context.newPage(),errors=[];let room,observer;
  const until=async check=>{const end=Date.now()+25000;while(!await check()){if(Date.now()>end)throw Error('Safe-play wait timed out');await page.waitForTimeout(30);}};
  const click=async locator=>touch?locator.tap():locator.click();
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.addInitScript(deck=>{localStorage.setItem('nexus.decks',JSON.stringify([deck]));localStorage.setItem('nexus.preferences',JSON.stringify({effects:false,reactionMode:'always'}));},deck);
   await page.goto(url+'/#lobby');await page.getByRole('textbox',{name:'Spielname',exact:true}).fill(touch?'Gast Handy':'Gast Desktop');await click(page.getByRole('button',{name:'Als Gast spielen',exact:true}));
   await page.getByRole('button',{name:'Tisch erstellen',exact:true}).waitFor();
   observer=io(url,{transports:['websocket'],reconnection:false,extraHeaders:{Origin:url,Cookie:(await context.cookies()).map(c=>c.name+'='+c.value).join('; ')}});observer.on('room',v=>room=v);await new Promise((resolve,reject)=>{observer.once('connect',resolve);observer.once('connect_error',reject);});
   await click(page.getByRole('button',{name:'Tisch erstellen',exact:true}));await until(()=>Boolean(room));
   for(let n=1;n<=3;n++){await click(page.getByRole('button',{name:'Bot hinzufügen',exact:true}));await until(()=>room.players.length===n+1);}
   await click(page.getByRole('tab',{name:/Meine Decks/}));await click(page.locator('.pregame-deck').filter({hasText:deck.name}));await click(page.getByRole('button',{name:'Ich bin bereit',exact:false}));
   await click(page.getByRole('button',{name:'Partie starten',exact:true}));await page.getByRole('button',{name:'Behalten',exact:true}).waitFor();await click(page.getByRole('button',{name:'Behalten',exact:true}));await until(()=>room.game?.rules.stage==='playing');
   assert.equal(room.players.filter(p=>p.bot).length,3);const seat=room.seat,ownLand=()=>room.game.cards.filter(c=>c.ownerId===seat&&c.zone==='battlefield'),commander=()=>room.game.cards.find(c=>c.ownerId===seat&&c.isCommander);
   const untouched=JSON.stringify({zone:commander().zone,casts:commander().commanderCasts,stack:room.game.rules.stack,mana:room.game.players.find(p=>p.id===seat).mana});
   await click(page.getByRole('button',{name:'Commander Isamaru, Hound of Konda wirken',exact:true}));
   await page.getByText(/Commander-Tax \+0/).waitFor();assert(await page.getByRole('button',{name:'Bezahlen und wirken',exact:true}).isDisabled());await page.waitForTimeout(200);
   assert.equal(JSON.stringify({zone:commander().zone,casts:commander().commanderCasts,stack:room.game.rules.stack,mana:room.game.players.find(p=>p.id===seat).mana}),untouched);
   await click(page.getByRole('button',{name:'Wirken abbrechen',exact:true}));
   const hand=page.locator('.hand-cards'),handBefore=room.game.cards.filter(c=>c.ownerId===seat&&c.zone==='hand').length;await click(hand.locator('.card').first());
   const play=page.getByRole('button',{name:'Ausgewählte Karte spielen',exact:true});assert.equal(await play.innerText(),'Land spielen');assert(await play.isEnabled());assert.equal(ownLand().length,0);
   const box=await play.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=page.viewportSize().width&&box.y>=0&&box.y+box.height<=page.viewportSize().height,'Land action must be visible');
   await click(play);await until(()=>ownLand().length===1);assert.equal(room.game.rules.landPlays[seat],1);await until(()=>hand.locator('.card').count().then(n=>n===handBefore-1));
   await click(hand.locator('.card').first());assert(await play.isDisabled());assert.match(await page.locator('.selected-play-hint').innerText(),/Landspiele verbraucht/);
   if(!touch){await hand.locator('.card').first().dblclick();await page.waitForTimeout(100);assert.equal(ownLand().length,1);}
   await click(page.getByRole('button',{name:'Kartenauswahl aufheben',exact:true}));
   await click(page.getByRole('button',{name:'Commander Isamaru, Hound of Konda wirken',exact:true}));await page.getByRole('list',{name:'Mana-Vorschau'}).waitFor();assert.match(await page.locator('.auto-mana ol').innerText(),/Plains/);assert(!ownLand()[0].tapped);
   await click(page.getByRole('checkbox',{name:'Priorität nach dem Wirken halten',exact:true}));await click(page.getByRole('button',{name:'Bezahlen und wirken',exact:true}));await until(()=>room.game.rules.stack.length===1);
   assert.equal(commander().zone,'stack');assert.equal(commander().commanderCasts,1);assert(ownLand()[0].tapped);assert.equal(room.game.rules.priority,seat);await page.getByRole('button',{name:'Wirken abbrechen',exact:true}).waitFor({state:'hidden'});
   await click(page.getByRole('button',{name:'Keine Reaktion',exact:true}));await until(()=>commander().zone==='battlefield');assert.equal(room.game.rules.stack.length,0);
   await click(page.getByRole('button',{name:'Zug abgeben',exact:true}));await page.getByRole('dialog',{name:'Zug wirklich abgeben?',exact:true}).waitFor();assert.equal(room.game.turn,1);if(!touch){const handCount=room.game.cards.filter(c=>c.ownerId===seat&&c.zone==='hand').length;await page.keyboard.press('d');await page.waitForTimeout(100);assert.equal(room.game.cards.filter(c=>c.ownerId===seat&&c.zone==='hand').length,handCount,'Dialog must block game shortcuts');}
   await click(page.getByRole('button',{name:'Weiterspielen',exact:true}));assert.equal(room.game.turn,1);
   if(touch)await click(page.getByRole('button',{name:'Zug abgeben',exact:true}));else await page.keyboard.press('F6');await page.getByRole('dialog',{name:'Zug wirklich abgeben?',exact:true}).waitFor();assert.equal(room.game.turn,1);
   await click(page.getByRole('button',{name:'Zug jetzt abgeben',exact:true}));await until(()=>room.game.turn>1);const bot1=room.players[1].id;
   await until(()=>room.game.cards.some(c=>c.ownerId===bot1&&c.zone==='battlefield'&&c.isLand));assert(room.game.hiddenCounts[bot1].library<=92);
   let botCast=false;
   for(let n=0;n<60&&!(room.game.activePlayer===seat&&room.game.turn>1);n++){
    if(room.game.rules.stack.some(s=>s.controllerId!==seat))botCast=true;
    if(room.game.rules.priority===seat&&room.game.rules.stack.length){await click(page.getByRole('button',{name:'Keine Reaktion',exact:true}));}
    await page.waitForTimeout(200);
   }
   assert(botCast,'Bots must cast, not only play lands');assert.equal(room.game.activePlayer,seat);assert(room.game.turn>=5);
   if(!touch){const before=room.game.rules.landPlays[seat]??0;await hand.locator('.card').first().dblclick();await until(()=>room.game.rules.landPlays[seat]===before+1);}
   await page.reload();await page.locator('.hand-cards .card').first().waitFor();assert.equal(commander().zone,'battlefield');assert.equal(commander().commanderCasts,1);
   assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'.local/browser/safe-play-'+(touch?'phone':'desktop')+'.png',fullPage:true});
   console.log('PASS '+(touch?'phone':'desktop')+': guest + 3 bots, mulligan, blocked unpaid commander, land selection/play/limit, payment preview + hold priority, resolution, cancel/confirm end turn, real bot casts, next human turn and reload');
  }catch(error){console.log(await page.locator('body').innerText());await page.screenshot({path:'.local/browser/safe-play-failure.png',fullPage:true});throw error;}
  finally{observer?.disconnect();await context.close();}
 }
}finally{await browser.close();await server.close();}
