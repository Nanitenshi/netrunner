import {createNexusServer} from '../server/server.ts';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const forge={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(forge).every(Boolean))throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES first.');
const server=createNexusServer({database:':memory:',guest:true,forge});
server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
const url='http://127.0.0.1:'+server.http.address().port;
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-proxy-server']});
const pages=[],errors=[];mkdirSync('.local/browser',{recursive:true});
try{
 for(const name of ['Ada','Bela']){
  const context=await browser.newContext({viewport:{width:1366,height:900}}),page=await context.newPage();pages.push(page);
  page.on('pageerror',error=>errors.push(error.message));await page.goto(url+'/');
  await page.evaluate(async name=>{const response=await fetch('/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(!response.ok)throw Error('Guest login failed');},name);
  await page.goto(url+'/#forge');await page.reload();
 }
 const [a,b]=pages;
 await a.getByRole('button',{name:'Testtisch erstellen',exact:true}).click();await a.getByText('Einladungscode:').waitFor();
 await b.getByRole('textbox',{name:'Testtisch-Code'}).fill(await a.locator('.forge-lobby p b').innerText());await b.getByRole('button',{name:'Beitreten',exact:true}).click();
 await a.getByRole('combobox',{name:'Testszenario'}).selectOption('costs');await a.getByRole('button',{name:'Test starten',exact:true}).click();
 await a.locator('.forge-hand').waitFor({timeout:65000});await b.locator('.forge-hand').waitFor();
 const cast=async(name)=>a.locator(`.forge-hand .forge-card.playable[aria-label="${name}"]`).click();
 await cast('Tormenting Voice');await a.getByRole('heading',{name:'Zusatzkosten · Karte abwerfen',exact:true}).waitFor();
 assert.equal(await b.locator('.forge-decision').count(),0);
 await a.reload();await a.getByRole('heading',{name:'Zusatzkosten · Karte abwerfen',exact:true}).waitFor();
 await a.getByRole('button',{name:'Wirken abbrechen',exact:true}).click();await a.locator('.forge-decision').waitFor({state:'hidden'});
 await cast('Tormenting Voice');await a.locator('.forge-decision-options').getByRole('button',{name:'Forest wählen',exact:true}).click();
 await a.screenshot({path:'.local/browser/costs-desktop.png'});
 await a.getByRole('button',{name:'Kosten bezahlen und wirken',exact:true}).click();await a.locator('.forge-decision').waitFor({state:'hidden'});
 await b.locator('.forge-hand').getByRole('button',{name:'Counterspell',exact:true}).click();
 await b.locator('.forge-stack').getByRole('button',{name:/Tormenting Voice/}).click();
 await a.getByRole('button',{name:'Passen',exact:true}).click();await b.getByRole('button',{name:'Passen',exact:true}).click();
 await cast('Fling');await a.getByRole('button',{name:'Bela als Ziel wählen',exact:true}).click();
 await a.getByRole('heading',{name:'Zusatzkosten · Kreatur opfern',exact:true}).waitFor();
 await a.setViewportSize({width:390,height:844});await a.locator('.forge-decision-options').getByRole('button',{name:'Colossal Dreadmaw wählen',exact:true}).click();
 await a.screenshot({path:'.local/browser/costs-mobile.png',fullPage:true});
 assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const bounds=await a.locator('.forge-decision').boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
 await a.getByRole('button',{name:'Kosten bezahlen und wirken',exact:true}).click();await a.locator('.forge-decision').waitFor({state:'hidden'});
 await b.getByRole('button',{name:'Passen',exact:true}).click();await a.getByRole('button',{name:'Passen',exact:true}).click();
 await a.waitForFunction(()=>document.querySelector('.forge-mat.opponent .forge-player')?.textContent.includes('34'));
 await a.getByText('Letzte Aktionen',{exact:true}).click();await a.screenshot({path:'.local/browser/table-mobile.png',fullPage:true});
 await a.getByRole('button',{name:'Testtisch verlassen',exact:true}).click();await b.getByRole('button',{name:'Testtisch erstellen',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS two browsers: private cost choices, reload, cancellation, payment, Counterspell, player target, mobile layout, real damage and leave');
}catch(error){if(pages[0]){console.log(await pages[0].locator('body').innerText());await pages[0].screenshot({path:'.local/browser/failure.png',fullPage:true});}throw error;}
finally{await browser.close();await server.close();}
