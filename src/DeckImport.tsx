import {useState} from 'react';
import {parseDeckList,importedDeck,type ImportPreview} from '../shared/deck-import';
import {catalogueById,commanderPair} from '../shared/catalogue';
import {checkDeck} from '../shared/deck-rules';
import {uuid} from '../shared/id';
import {api} from './network';
import type {Deck} from './decks';
export default function DeckImport({onImport}:{onImport:(deck:Deck)=>void}){
 const [mode,setMode]=useState<'link'|'text'>('link'),[input,setInput]=useState(''),[url,setURL]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [preview,setPreview]=useState<ImportPreview|null>(null),[commander,setCommander]=useState(''),[partner,setPartner]=useState(''),[name,setName]=useState('');
 async function inspect(){setError('');setPreview(null);setBusy(true);try{
  const data=mode==='link'?await api<{text:string;name?:string}>('/api/deck-import',{url}):{text:input};
  const next=parseDeckList(data.text);if(data.name)next.name=data.name;setPreview(next);setName(next.name);setCommander(next.commanderIds[0]??'');setPartner(next.commanderIds[1]??'');
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 let draft:Deck|undefined;let validity='';if(preview)try{draft=importedDeck({...preview,name},'preview',commander,partner||undefined);try{checkDeck(draft,true);validity=`${preview.total} Karten · Farbidentität und Mengen geprüft`;}catch(e){validity=(e as Error).message;}}catch(e){validity=(e as Error).message;}
 const options=preview?[...new Set([...preview.commanderIds,...preview.candidates])]:[];
 const partners=preview&&commander?[...new Set([...preview.commanderIds,...Object.keys(preview.quantities)])].filter(id=>commanderPair(catalogueById.get(commander)!,catalogueById.get(id)!)):[];
 return <details className="deck-import"><summary>Deck importieren · Deckstats-Link oder Deckliste</summary><div className="import-tabs"><button aria-pressed={mode==='link'} onClick={()=>{setMode('link');setPreview(null);}}>Deckstats-Link</button><button aria-pressed={mode==='text'} onClick={()=>{setMode('text');setPreview(null);}}>Deckliste einfügen</button></div>
 {mode==='link'?<label>Öffentlicher Deckstats-Link<input aria-label="Deckstats-Link" type="url" value={url} onChange={e=>{setURL(e.target.value);setPreview(null);}} placeholder="https://deckstats.net/decks/…"/></label>:<label>Deckliste<textarea aria-label="Deckliste einfügen" value={input} onChange={e=>{setInput(e.target.value);setPreview(null);}} placeholder={'Commander\n1 Atraxa, Praetors\' Voice\n\nDeck\n1 Sol Ring\n…'} maxLength={100000}/></label>}
 <button disabled={busy||!(mode==='link'?url.trim():input.trim())} onClick={()=>void inspect()}>{busy?'Lade Deck …':'Import prüfen'}</button><p className="subtle">Erstellt ein neues Deck. Englische Kartennamen, Mengen und Commander werden übernommen; Sideboard und Tokens bleiben draußen. Bei privaten oder blockierten Links bitte die Textliste verwenden.</p>
 {error&&<p role="alert">{error}</p>}{preview&&<div className="import-preview"><label>Deckname<input aria-label="Importierter Deckname" value={name} maxLength={60} onChange={e=>setName(e.target.value)}/></label><p>{preview.total} erkannte Karten</p><label>Commander<select aria-label="Import Commander" value={commander} onChange={e=>{setCommander(e.target.value);setPartner('');}}><option value="">Bitte auswählen</option>{options.map(id=><option key={id} value={id}>{catalogueById.get(id)!.name}</option>)}</select></label>{partners.length>0&&<label>Zweiter Commander<select aria-label="Import zweiter Commander" value={partner} onChange={e=>setPartner(e.target.value)}><option value="">Kein zweiter Commander</option>{partners.map(id=><option key={id} value={id}>{catalogueById.get(id)!.name}</option>)}</select></label>}
 {[...preview.issues,...preview.warnings].map((issue,i)=><p key={i}>{issue}</p>)}<p role="status">{validity}</p><button disabled={!draft} onClick={()=>{if(draft){onImport({...draft,id:uuid()});setPreview(null);setInput('');setURL('');}}}>Als neues Deck erstellen</button><small>Unvollständige Decks können gespeichert und anschließend im Deckersteller ergänzt werden.</small></div>}
 </details>;
}
