import {readFile,writeFile} from 'node:fs/promises';
// Enrich existing IDs only; keep decks, catalogue ordering and preview cards intact.
const cards=JSON.parse(await readFile('src/cards.json','utf8'));
const wanted=cards.filter(c=>c.faces?.length>1), byId=new Map(cards.map(c=>[c.id,c]));
let updated=0;
for(let start=0;start<wanted.length;start+=75){
 const response=await fetch('https://api.scryfall.com/cards/collection',{method:'POST',headers:{'User-Agent':'BatusMTG/0.1 (card face metadata)','Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({identifiers:wanted.slice(start,start+75).map(c=>({id:c.id}))}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`Scryfall ${response.status}; catalogue not written`);
 const result=await response.json();
 if(result.not_found?.length)throw new Error('Missing printing; catalogue not written');
 for(const source of result.data){
  const card=byId.get(source.id);if(!card||source.oracle_id!==card.oracleId||source.card_faces?.length!==card.faces.length)throw new Error('Unexpected face identity');
  card.layout=source.layout;
  card.faces.forEach((face,i)=>{const images=source.card_faces[i].image_uris;if(images?.large)face.image=images.large;if(images?.art_crop)face.art=images.art_crop;});
  updated++;
 }
 await new Promise(r=>setTimeout(r,150));
}
if(updated!==wanted.length)throw new Error('Incomplete metadata; catalogue not written');
await writeFile('src/cards.json',JSON.stringify(cards));
console.log(`Face metadata: ${updated} cards enriched.`);
