import {catalogueById} from '../shared/catalogue.ts';
export interface Artwork {id:string;image:string;art:string|null;label:string;artist:string;faces?:{image:string;art:string|null}[]}
const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export function artworkURL(value:unknown):value is string{if(typeof value!=='string')return false;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['cards.scryfall.io','images.scryfall.io'].includes(u.hostname);}catch{return false;}}
export function createArtworkService(fetcher:typeof fetch=fetch){
 const cache=new Map<string,{at:number;data:{artworks:Artwork[];hasMore:boolean}}>();const pending=new Map<string,Promise<{artworks:Artwork[];hasMore:boolean}>>();let queue=Promise.resolve(),last=0;
 return async(cardId:string,page=1)=>{
  const card=catalogueById.get(cardId);if(!card||!uuid.test(card.oracleId??'')||!Number.isInteger(page)||page<1||page>100)throw new Error('Unbekannte Karte oder ungültige Seite');
  const key=`${cardId}:${page}`,old=cache.get(key);if(old&&Date.now()-old.at<86400000)return old.data;if(pending.has(key))return pending.get(key)!;if(pending.size>=12)throw new Error('Artwork-Suche ausgelastet. Bitte kurz warten.');
  const request=(async()=>{
   const previous=queue;let release!:()=>void;queue=new Promise<void>(r=>release=r);await previous;
   try{const wait=600-(Date.now()-last);if(wait>0)await new Promise(r=>setTimeout(r,wait));last=Date.now();
    const url=new URL('https://api.scryfall.com/cards/search');url.search=new URLSearchParams({q:`oracleid:${card.oracleId}`,unique:'prints',order:'released',dir:'desc',page:String(page)}).toString();
    const res=await fetcher(url.toString(),{headers:{'User-Agent':'BatusMTG/0.1 (optional card artworks)','Accept':'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
    if(!res.ok)throw new Error(res.status===429?'Scryfall ist ausgelastet. Bitte später erneut versuchen.':'Artworks konnten nicht geladen werden. Deine Standardbilder bleiben verfügbar.');
    const payload=await res.json();if(!Array.isArray(payload.data)||payload.data.length>175)throw new Error('Ungültige Artwork-Antwort');
    const artworks:Artwork[]=payload.data.filter((p:any)=>p.oracle_id===card.oracleId&&uuid.test(p.id)&&artworkURL((p.image_uris??p.card_faces?.[0]?.image_uris)?.large)).map((p:any)=>{const images=p.image_uris??p.card_faces[0].image_uris;return {faces:p.card_faces?.every((f:any)=>artworkURL(f.image_uris?.large))?p.card_faces.map((f:any)=>({image:f.image_uris.large,art:artworkURL(f.image_uris.art_crop)?f.image_uris.art_crop:null})):undefined,id:p.id,image:images.large,art:artworkURL(images.art_crop)?images.art_crop:null,label:`${String(p.set_name??p.set??'Edition').slice(0,90)} · ${String(p.collector_number??'').slice(0,20)}`,artist:String(p.artist??p.card_faces?.[0]?.artist??'').slice(0,100)};});
    const data={artworks,hasMore:payload.has_more===true};cache.delete(key);cache.set(key,{at:Date.now(),data});while(cache.size>500)cache.delete(cache.keys().next().value!);return data;
   }finally{release();}
  })();pending.set(key,request);try{return await request;}catch(e){if(e instanceof Error&&(e.name==='TimeoutError'||e.name==='AbortError'))throw new Error('Die Artwork-Suche dauert zu lange. Bitte erneut versuchen.');throw e;}finally{pending.delete(key);}
 };
}
