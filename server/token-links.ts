import {catalogueById} from '../shared/catalogue.ts';
import {allTokenDefinitions} from '../shared/tokens.ts';
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export interface TokenLinks {tokenIds:string[];missing:string[];}
export function createTokenLinkService(fetcher:typeof fetch=fetch){
 const cache=new Map<string,{at:number;data:TokenLinks}>(),pending=new Map<string,Promise<TokenLinks>>();
 let queue=Promise.resolve(),last=0;
 const load=async(id:string)=>{
  if(!uuid.test(id))throw new Error('Ungültige Kartenverknüpfung');
  let release!:()=>void;const previous=queue;queue=new Promise<void>(r=>release=r);await previous;
  try{
   const wait=250-(Date.now()-last);if(wait>0)await new Promise(r=>setTimeout(r,wait));last=Date.now();
   const response=await fetcher(`https://api.scryfall.com/cards/${id}`,{headers:{'User-Agent':'BatusMTG/0.1 (related tokens)','Accept':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
   if(!response.ok)throw new Error('Kartenverknüpfung gerade nicht verfügbar. Nutze die Suche unter „Alle“.');
   const data=await response.json();if(data.id!==id)throw new Error('Ungültige Antwort zur Karte');return data;
  }finally{release();}
 };
 return async(cardId:string):Promise<TokenLinks>=>{
  const card=catalogueById.get(cardId);if(!card||!uuid.test(card.id))throw new Error('Für diese Karte ist keine Scryfall-Verknüpfung vorhanden. Nutze „Alle“.');
  const old=cache.get(cardId);if(old&&Date.now()-old.at<86400000)return old.data;if(pending.has(cardId))return pending.get(cardId)!;
  if(pending.size>=8)throw new Error('Token-Suche ausgelastet. Bitte kurz warten.');
  const request=(async()=>{
   const creator=await load(card.id),parts=creator.all_parts??[];
   if(!Array.isArray(parts)||parts.length>100)throw new Error('Ungültige Token-Verknüpfungen');
   const tokenIds=new Set<string>(),missing:string[]=[];
   for(const part of parts){
    if(part.component!=='token')continue;
    if(!uuid.test(part.id))throw new Error('Ungültige Token-Verknüpfung');
    let matches=allTokenDefinitions.filter(t=>t.scryfallId===part.id);
    if(!matches.length){const token=await load(part.id);matches=allTokenDefinitions.filter(t=>token.oracle_id&&t.oracleId===token.oracle_id);}
    if(matches.length)matches.forEach(t=>tokenIds.add(t.id));else missing.push(String(part.name??'Token').slice(0,120));
   }
   const data={tokenIds:[...tokenIds],missing};cache.delete(cardId);cache.set(cardId,{at:Date.now(),data});while(cache.size>500)cache.delete(cache.keys().next().value!);return data;
  })();pending.set(cardId,request);
  try{return await request;}catch(error){if(error instanceof Error&&['TimeoutError','AbortError'].includes(error.name))throw new Error('Token-Verknüpfung dauert zu lange. Nutze vorerst „Alle“.');throw error;}finally{pending.delete(cardId);}
 };
}
