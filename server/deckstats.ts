export function deckstatsURL(input:string):URL {
 let url:URL;try{url=new URL(input);}catch{throw new Error('Bitte einen vollständigen Deckstats-Link einfügen.');}
 if(url.protocol!=='https:'||!['deckstats.net','www.deckstats.net'].includes(url.hostname)||url.username||url.password||url.port)throw new Error('Nur öffentliche HTTPS-Links von deckstats.net sind erlaubt.');
 if(!/^\/decks\/(?:\d+\/)?\d+(?:-[a-zA-Z0-9_%.-]+)?\/?$/.test(url.pathname))throw new Error('Bitte den Link zu einem Deck verwenden.');
 return new URL(url.pathname,'https://deckstats.net');
}
const entities=(s:string)=>s.replace(/&quot;/g,'"').replace(/&#039;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
export function deckstatsDocument(text:string):{text:string;name?:string} {
 if(!text.trim().startsWith('<'))return {text};
 const textarea=text.match(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/i);if(textarea&&/^\s*(?:\/\/|Commander|\d+\s)/i.test(entities(textarea[1])))return {text:entities(textarea[1])};
 const page=text.match(/\bdata-page=(?:"([^"]+)"|'([^']+)')/i);
 if(page){
  const value=JSON.parse(entities(page[1]??page[2]));const deck=value.props?.deck;
  const cards=deck?.cards??deck?.deck_cards??deck?.entries;
  if(Array.isArray(cards)){
   const main:string[]=[],commander:string[]=[];
   for(const entry of cards){
    const card=entry.card??entry;const meta=entry.pivot??entry;const name=card.name??card.card_name;
    const count=Number(meta.quantity??meta.amount??meta.count??entry.quantity);
    const zone=String(meta.board??meta.zone??meta.section??'main').toLowerCase();
    if(/side|maybe|token|companion/.test(zone))continue;
    if(typeof name!=='string'||!Number.isInteger(count)||count<1||count>99)throw new Error('Deckstats liefert ein nicht unterstütztes Kartenformat. Bitte Textliste verwenden.');
    const isCommander=meta.is_commander===true||meta.is_commander===1||zone==='commander';
    (isCommander?commander:main).push(`${count} ${name}`);
   }
   if(main.length||commander.length)return {text:`${commander.length?'Commander\n'+commander.join('\n')+'\n\n':''}Deck\n${main.join('\n')}`,name:typeof deck.name==='string'?deck.name.slice(0,60):undefined};
  }
 }
 throw new Error('Deckstats liefert keine lesbare Exportliste. Nutze dort „Export → Copy Plain Text“ und füge die Liste hier ein.');
}
export async function fetchDeckstats(input:string,fetcher:typeof fetch=fetch){
 let url=deckstatsURL(input);url.searchParams.set('export_txt','1');
 const signal=AbortSignal.timeout(12_000);
 for(let hop=0;hop<4;hop++){
  const response=await fetcher(url,{redirect:'manual',signal,headers:{'User-Agent':'BatusMTG/0.1 (public deck import)','Accept':'text/plain, text/html;q=0.8'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');if(!location)throw new Error('Ungültige Weiterleitung von Deckstats.');url=deckstatsURL(new URL(location,url).href);url.searchParams.set('export_txt','1');continue;}
  if(!response.ok)throw new Error(response.status===403?'Deckstats blockiert den automatischen Abruf oder das Deck ist privat. Bitte die exportierte Deckliste einfügen.':'Deckstats-Deck nicht erreichbar. Prüfe den Link oder füge die Deckliste ein.');
  if(Number(response.headers.get('content-length'))>2_000_000)throw new Error('Deckstats-Antwort zu groß.');
  if(!response.body)throw new Error('Deckstats liefert keine Daten.');
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new Error('Deckstats-Antwort zu groß.');chunks.push(value);}}finally{await reader.cancel();}
  return deckstatsDocument(new TextDecoder().decode(Buffer.concat(chunks)));
 }
 throw new Error('Zu viele Weiterleitungen. Bitte die Textliste verwenden.');
}
