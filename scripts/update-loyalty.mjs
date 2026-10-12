import {readFile,writeFile} from 'node:fs/promises';
const cards=JSON.parse(await readFile('src/cards.json','utf8')),known=new Map(cards.map(c=>[c.oracleId,c]));
let url='https://api.scryfall.com/cards/search?q='+encodeURIComponent('type:planeswalker')+'&unique=cards',updated=0;
while(url){
 const r=await fetch(url,{headers:{'User-Agent':'BatusMTG/0.1 (loyalty metadata)','Accept':'application/json'}});if(!r.ok)throw Error(`Scryfall ${r.status}`);const page=await r.json();
 for(const raw of page.data){const c=known.get(raw.oracle_id);if(!c)continue;const front=raw.card_faces?.[0];c.loyalty=raw.loyalty??front?.loyalty??null;for(let i=0;i<c.faces.length;i++)c.faces[i].loyalty=raw.card_faces?.[i]?.loyalty??null;updated++;}
 url=page.has_more?page.next_page:null;if(url)await new Promise(resolve=>setTimeout(resolve,150));
}
if(updated<250)throw Error('Unvollständige Loyalitätsdaten; Katalog unverändert');
await writeFile('src/cards.json',JSON.stringify(cards));console.log(`Loyalität: ${updated} Karten aktualisiert`);
