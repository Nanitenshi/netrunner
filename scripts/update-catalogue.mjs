import {includeCatalogueCard,isPreviewCard,previewCommander} from '../shared/catalogue-policy.ts';
import {readFile,writeFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createGunzip} from 'node:zlib';
import {createInterface} from 'node:readline';
const headers={'User-Agent':'BatusMTG/0.1 (Commander catalogue)','Accept':'application/json'};
async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw new Error(`Scryfall: ${r.status}`);return r;}
const eligible=new Set();
let url='https://api.scryfall.com/cards/search?q=is%3Acommander%20f%3Acommander&unique=cards';
while(url){const page=await (await get(url)).json();for(const c of page.data)eligible.add(c.oracle_id);url=page.has_more?page.next_page:null;if(url)await new Promise(r=>setTimeout(r,120));}
const bulk=(await (await get('https://api.scryfall.com/bulk-data')).json()).data.find(d=>d.type==='oracle_cards');
const response=await get(bulk.jsonl_download_uri??bulk.download_uri);
const allPrevious=JSON.parse(await readFile('src/cards.json','utf8'));
const previous=allPrevious.slice(0,20);
const priorByOracle=new Map(allPrevious.map(c=>[c.oracleId,c]));
const priorByName=new Map(allPrevious.map(c=>[c.name,c]));
const original=new Map(previous.map(c=>[c.name,c]));
const face=f=>({...(f.image_uris?{image:f.image_uris.large,art:f.image_uris.art_crop??null}:{}),name:f.name,mana:f.mana_cost??'',type:f.type_line??'',text:f.oracle_text??'',colors:[...'WUBRG'].filter(v=>(f.colors??[]).includes(v)),power:f.power??null,toughness:f.toughness??null,loyalty:f.loyalty??null});
const cards=[];
function add(c){
 if(!includeCatalogueCard(c))return;
 const front=c.card_faces?.[0]??c;const images=c.image_uris??front.image_uris;if(!images?.large)return;
 const old=priorByOracle.get(c.oracle_id)??priorByName.get(c.name);
 const d={...face({...front,...c,oracle_text:c.oracle_text??front.oracle_text,mana_cost:c.mana_cost??front.mana_cost,colors:c.colors??front.colors,loyalty:c.loyalty??front.loyalty,power:c.power??front.power,toughness:c.toughness??front.toughness}),id:old?.id??c.id,image:old?.image??images.large,art:images.art_crop??null,artist:c.artist??front.artist??'',source:c.scryfall_uri,colorIdentity:[...'WUBRG'].filter(v=>c.color_identity.includes(v)),manaValue:c.cmc,faces:(c.card_faces??[]).map(face),layout:c.layout,oracleId:c.oracle_id,commanderEligible:eligible.has(c.oracle_id)||isPreviewCard(c)&&previewCommander(c),keywords:c.keywords??[],commanderLegal:c.legalities?.commander==='legal',preview:isPreviewCard(c),releasedAt:c.released_at};cards.push(d);
}
if(bulk.jsonl_download_uri){const lines=createInterface({input:Readable.fromWeb(response.body).pipe(createGunzip()),crlfDelay:Infinity});for await(const line of lines)if(line.trim())add(JSON.parse(line));}
else for(const c of await response.json())add(c);
if(cards.length<20000||eligible.size<1000)throw new Error('UnvollstÃ¤ndiger Katalog; bestehende Datei bleibt erhalten.');
const byName=new Map(cards.map(c=>[c.name,c]));
const ordered=[...previous.map(c=>byName.get(c.name)??c),...cards.filter(c=>!original.has(c.name)).sort((a,b)=>a.name.localeCompare(b.name))];
await writeFile('src/cards.json',JSON.stringify(ordered));
await writeFile('src/catalogue-info.json',JSON.stringify({updated:bulk.updated_at,cards:ordered.length,commanders:ordered.filter(c=>c.commanderEligible).length,previews:ordered.filter(c=>c.preview).length,source:'https://scryfall.com/docs/api/bulk-data'}));
console.log(`${ordered.length} Karten, ${ordered.filter(c=>c.commanderEligible).length} Commander; Stand ${bulk.updated_at}`);
