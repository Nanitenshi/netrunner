import {useState} from 'react';
import {catalogueById} from '../shared/catalogue';
import {checkDeck} from '../shared/deck-rules';
import {preparedDecks} from '../shared/preconstructed';
import type {DeckData} from '../shared/protocol';
import {cardImage} from './artworks';
import './pregame-decks.css';
export default function PregameDecks({decks,selectedId,disabled,onChoose}:{decks:DeckData[];selectedId:string;disabled:boolean;onChoose:(deck:DeckData)=>Promise<void>}){
 const [tab,setTab]=useState<'prepared'|'own'>(preparedDecks.some(d=>d.id===selectedId)?'prepared':'own'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false);
 const list=tab==='prepared'?preparedDecks:decks;
 return <section className="pregame-decks" aria-label="Deckauswahl"><header><div><h2>Dein Deck</h2><p>Wähle deinen Commander für diesen Tisch.</p></div><div role="tablist"><button role="tab" aria-selected={tab==='prepared'} onClick={()=>setTab('prepared')}>Vorbereitete Decks</button><button role="tab" aria-selected={tab==='own'} onClick={()=>setTab('own')}>Meine Decks <small>{decks.length}</small></button></div><input aria-label="Decks durchsuchen" placeholder="Deck oder Commander suchen" value={query} onChange={e=>setQuery(e.target.value)}/></header><div className="pregame-deck-grid">{list.filter(d=>`${d.name} ${catalogueById.get(d.commanderId)?.name}`.toLowerCase().includes(query.toLowerCase())).map(d=>{
 const c=catalogueById.get(d.commanderId);if(!c)return null;let error='';try{checkDeck(d,true);}catch(e){error=e instanceof Error?e.message:'Deck unvollständig';}
 const count=Object.values(d.quantities).reduce((a,b)=>a+b,0)+1+(d.secondCommanderId?1:0),selected=d.id===selectedId;
 return <button key={d.id} className={`pregame-deck ${selected?'chosen':''}`} aria-pressed={selected} disabled={disabled||busy||Boolean(error)} title={error||'Für diesen Tisch auswählen'} onClick={async()=>{setBusy(true);try{await onChoose(d);}finally{setBusy(false);}}}><div className="pregame-deck-art" style={{backgroundImage:`url("${c.art??cardImage(c)}")`}}><img src={cardImage(c)} alt={c.name}/>{d.secondCommanderId&&<img className="partner" src={cardImage(catalogueById.get(d.secondCommanderId)!)} alt="Partner"/>}<span>{selected?'✓ Ausgewählt':`${count} Karten`}</span></div><div className="pregame-deck-caption"><h3>{d.name}</h3><p>{c.name}</p><div>{[...new Set([...c.colorIdentity,...(catalogueById.get(d.secondCommanderId??'')?.colorIdentity??[])])].map(color=><i key={color} className={`deck-color color-${color}`}>{color}</i>)}<small>{error||d.notes?.split('. ').at(-1)||'Eigenes Deck'}</small></div></div></button>;
 })}</div>{!list.length&&<p className="pregame-empty">Deine gespeicherten Decks erscheinen hier. Erstelle ein Deck im Deckersteller.</p>}</section>;
}
