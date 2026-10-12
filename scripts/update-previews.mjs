import {readFile,writeFile} from 'node:fs/promises';
import {isPreviewCard,previewCommander} from '../shared/catalogue-policy.ts';
const today=new Date().toISOString().slice(0,10),headers={'User-Agent':'BatusMTG/0.1 (Commander catalogue)','Accept':'application/json'};
const previous=JSON.parse(await readFile('src/cards.json','utf8')),knownOracle=new Set(previous.map(c=>c.oracleId)),knownNames=new Set(previous.map(c=>c.name));
const added=[];let url='https://api.scryfall.com/cards/search?unique=cards&q='+encodeURIComponent(`game:paper date>${today}`),pages=0;
const face=f=>({name:f.name,mana:f.mana_cost??'',type:f.type_line??'',text:f.oracle_text??'',colors:[...'WUBRG'].filter(v=>(f.colors??[]).includes(v)),power:f.power??null,toughness:f.toughness??null,loyalty:f.loyalty??null});
while(url){
 if(++pages>100)throw Error('Preview search exceeded safety bound; existing catalogue unchanged');
 const response=await fetch(url,{headers});if(response.status===404&&pages===1)break;if(!response.ok)throw Error(`Scryfall: ${response.status}`);const page=await response.json();
 for(const c of page.data){
  if(!isPreviewCard(c,today)||knownOracle.has(c.oracle_id)||knownNames.has(c.name))continue;
  const front=c.card_faces?.[0]??c,images=c.image_uris??front.image_uris;if(!images?.large||!Number.isFinite(c.cmc))continue;
  added.push({...face({...front,...c,oracle_text:c.oracle_text??front.oracle_text,mana_cost:c.mana_cost??front.mana_cost,colors:c.colors??front.colors,loyalty:c.loyalty??front.loyalty,power:c.power??front.power,toughness:c.toughness??front.toughness}),id:c.id,image:images.large,art:images.art_crop??null,artist:c.artist??front.artist??'',source:c.scryfall_uri,colorIdentity:[...'WUBRG'].filter(v=>c.color_identity.includes(v)),manaValue:c.cmc,faces:(c.card_faces??[]).map(face),oracleId:c.oracle_id,commanderEligible:previewCommander(c),keywords:c.keywords??[],commanderLegal:false,preview:true,releasedAt:c.released_at});knownOracle.add(c.oracle_id);knownNames.add(c.name);
 }
 url=page.has_more?page.next_page:null;if(url)await new Promise(r=>setTimeout(r,120));
}
const cards=[...previous,...added.sort((a,b)=>a.name.localeCompare(b.name))];
const info=JSON.parse(await readFile('src/catalogue-info.json','utf8'));
await writeFile('src/cards.json',JSON.stringify(cards));await writeFile('src/catalogue-info.json',JSON.stringify({...info,cards:cards.length,commanders:cards.filter(c=>c.commanderEligible).length,previews:cards.filter(c=>c.preview).length,previewsUpdated:new Date().toISOString()}));
console.log(JSON.stringify({added:added.length,previews:cards.filter(c=>c.preview).length,massimo:cards.find(c=>c.name==='Massimo, the Magician')?.id??null}));
