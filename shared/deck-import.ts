import {catalogue,catalogueById,isCommander,commanderPair} from './catalogue.ts';
import {checkDeck} from './deck-rules.ts';
import type {DeckData} from './protocol.ts';
const key=(s:string)=>s.normalize('NFKC').replace(/[‘’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const names=new Map(catalogue.map(c=>[key(c.name),c.id]));
for(const c of catalogue)for(const f of c.faces)if(!names.has(key(f.name)))names.set(key(f.name),c.id);
export interface ImportPreview {name:string;quantities:Record<string,number>;commanderIds:string[];candidates:string[];issues:string[];warnings:string[];total:number;}
export function parseDeckList(text:string):ImportPreview {
 if(text.length>100_000)throw new Error('Deckliste zu lang (maximal 100 KB).');
 const result:ImportPreview={name:'Importiertes Deck',quantities:{},commanderIds:[],candidates:[],issues:[],warnings:[],total:0};
 let section='main',ignored=0;
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
  let line=raw.trim();if(!line)continue;
  const heading=line.replace(/^\/\/\s*|^#\s*/,'').replace(/[:\[\]]/g,'').trim().toLowerCase();
  if(/^(commander|commanders|kommandeur|command zone)$/.test(heading)){section='commander';continue;}
  if(/^(deck|main|mainboard|main deck|decklist)$/.test(heading)){section='main';continue;}
  if(/^(sideboard|maybeboard|maybe|considering|tokens|companion|acquireboard)$/.test(heading)){section='ignore';continue;}
  if(/^\/\/|^#/.test(line)){if(section==='commander')section='main';continue;}
  if(/^SB:\s*/i.test(line)){ignored++;continue;}
  const title=line.match(/^name\s*[:=]\s*(.+)$/i);if(title){result.name=title[1].slice(0,60);continue;}
  const match=line.match(/^(\d+)\s*x?\s+(.+)$/i);if(!match){result.issues.push(`Zeile nicht erkannt: ${line.slice(0,120)}`);continue;}
  if(section==='ignore'){ignored++;continue;}
  const count=Number(match[1]);let name=match[2];
  const commander=section==='commander'||/!Commander|\*CMDR\*|\[Commander\]/i.test(name);
  name=name.replace(/\s+(?:!Commander|\*CMDR\*|\[Commander\]).*$/i,'').replace(/\s+#.*$/,'').replace(/\s+\([A-Za-z0-9]{2,8}\)\s+[\w★-]+(?:\s+\*F\*)?$/,'').replace(/^\[[^\]]+\]\s*/, '').trim();
  const id=names.get(key(name));if(!id){result.issues.push(`Karte fehlt im Commander-Katalog: ${name}`);continue;}
  if(!Number.isInteger(count)||count<1||count>99){result.issues.push(`${name}: Menge muss zwischen 1 und 99 liegen`);continue;}
  if(commander){if(count!==1||result.commanderIds.includes(id))result.issues.push(`${name}: Commander muss genau einmal enthalten sein`);else result.commanderIds.push(id);}
  else{result.quantities[id]=(result.quantities[id]??0)+count;if(result.quantities[id]>99)result.issues.push(`${name}: mehr als 99 Exemplare`);}
 }
 if(ignored)result.warnings.push(`${ignored} Einträge aus Sideboard, Tokens oder weiteren Zusatzlisten ignoriert.`);
 result.candidates=Object.keys(result.quantities).filter(id=>isCommander(catalogueById.get(id)!));
 if(!result.commanderIds.length&&result.candidates.length===1&&result.quantities[result.candidates[0]]===1){const id=result.candidates[0];result.commanderIds=[id];delete result.quantities[id];result.warnings.push('Commander anhand des einzigen passenden Kandidaten erkannt.');}
 if(result.commanderIds.length>2)result.issues.push('Höchstens zwei Commander sind möglich.');
 result.total=Object.values(result.quantities).reduce((a,b)=>a+b,0)+result.commanderIds.filter(id=>!result.quantities[id]).length;
 if(!result.total&&!result.issues.length)result.issues.push('Keine Karten in der Liste gefunden.');
 return result;
}
export function importedDeck(preview:ImportPreview,id:string,commanderId:string,secondCommanderId?:string):DeckData {
 if(preview.issues.length)throw new Error('Fehlende Karten und nicht erkannte Zeilen zuerst korrigieren.');
 if(preview.commanderIds.some(id=>preview.quantities[id]))throw new Error('Commander ist zusätzlich im Hauptdeck enthalten. Doppelten Eintrag entfernen.');
 const commander=catalogueById.get(commanderId);if(!commander||!isCommander(commander))throw new Error('Bitte Commander auswählen.');
 if(!preview.quantities[commanderId]&&!preview.commanderIds.includes(commanderId))throw new Error('Commander muss in der importierten Liste enthalten sein.');
 if((preview.quantities[commanderId]??1)!==1)throw new Error('Commander muss genau einmal in der Liste stehen.');
 const quantities={...preview.quantities};delete quantities[commanderId];
 if(secondCommanderId){const second=catalogueById.get(secondCommanderId);if(!second||!commanderPair(commander,second))throw new Error('Unzulässige Commander-Kombination.');if(!quantities[secondCommanderId]&&!preview.commanderIds.includes(secondCommanderId))throw new Error('Zweiter Commander fehlt in der Liste.');if((quantities[secondCommanderId]??1)!==1)throw new Error('Zweiter Commander muss genau einmal enthalten sein.');delete quantities[secondCommanderId];}
 for(const other of preview.commanderIds)if(other!==commanderId&&other!==secondCommanderId)quantities[other]=(quantities[other]??0)+1;
 return checkDeck({id,name:preview.name.trim().slice(0,60)||'Importiertes Deck',commanderId,...(secondCommanderId?{secondCommanderId}:{}),quantities});
}
