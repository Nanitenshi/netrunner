// Refresh public metadata only. Stable Oracle IDs keep existing games readable after reprints.
import {readFile,writeFile} from 'node:fs/promises';
// Cyberman has a token layout but the provider omits Token from its type line.
const isToken=(type,name)=>/\bToken\b/.test(type??'')||(name==='Cyberman'&&type?.startsWith('Artifact Creature'));
const path=new URL('../shared/token-catalogue.json',import.meta.url),records=[];
let url='https://api.scryfall.com/cards/search?'+new URLSearchParams({q:'(layout:token or layout:double_faced_token)',unique:'cards',order:'name'});
while(url){
 const next=new URL(url);if(next.origin!=='https://api.scryfall.com'||next.pathname!=='/cards/search')throw new Error('Unexpected catalogue page');
 const response=await fetch(next,{headers:{'User-Agent':'BatusMTG/0.1 (token catalogue)','Accept':'application/json'},signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!response.ok)throw new Error(`Token provider returned ${response.status}`);
 const page=await response.json();if(!Array.isArray(page.data)||page.data.length>175)throw new Error('Invalid token page');
 for(const card of page.data){
  const faces=card.layout==='double_faced_token'?card.card_faces:[card];
  for(const [index,face] of faces.entries()){
   if(!isToken(face.type_line??card.type_line,face.name))continue;
   const images=face.image_uris??card.image_uris;if(!card.oracle_id||!images?.large?.startsWith('https://cards.scryfall.io/'))throw new Error(`Missing token identity/image: ${card.name}`);
   records.push({id:`token-oracle-${card.oracle_id}${faces.length>1?'-face-'+index:''}`,scryfallId:card.id,oracleId:card.oracle_id,name:face.name,type:face.type_line??card.type_line,text:face.oracle_text??'',power:face.power??null,toughness:face.toughness??null,mana:'',manaValue:0,colors:face.colors??card.colors??[],colorIdentity:face.colors??card.color_identity??[],faces:[],image:images.large,art:images.art_crop??null,artist:face.artist??card.artist??'',source:card.scryfall_uri,keywords:card.keywords??[]});
  }
 }
 console.log(`${records.length} token faces loaded`);url=page.has_more?page.next_page:null;if(url)await new Promise(r=>setTimeout(r,250));
}
if(records.length<500||new Set(records.map(t=>t.id)).size!==records.length)throw new Error('Incomplete or duplicate catalogue; existing file preserved');
const old=JSON.parse(await readFile(path,'utf8'));
const known=new Set(records.map(t=>t.id));records.push(...old.filter(t=>isToken(t.type,t.name)&&!known.has(t.id)));
await writeFile(path,JSON.stringify(records),'utf8');
console.log(`Saved ${records.length} token faces. Rebuild client and server together before publishing.`);
