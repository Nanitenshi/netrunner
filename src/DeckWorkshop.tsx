import CardSearchFilters from './CardSearchFilters';
import {matchesCard,keywordLabels,type SearchFilters} from '../shared/card-search';
import DeckListEditor from './DeckListEditor';
import ArtworkPicker from './ArtworkPicker';
import {cardImage,cardArt} from './artworks';
import {uuid} from '../shared/id.ts';
import {useState,useMemo} from 'react';
import {isCommander,commanderPair} from '../shared/catalogue';
import catalogueInfo from './catalogue-info.json';
import DeckImport from './DeckImport';
import {Plus, Minus, Search, Copy, Trash2, Crown, ArrowRight} from 'lucide-react';
import {cards,definition} from './seed';
import {changeQuantity,countDeck,createDeck,readDecks,type Deck} from './decks';
import {CardCharacteristics} from './CardCharacteristics';
import {api} from './network';
import type {User} from '../shared/protocol';
import {preparedDecks} from '../shared/preconstructed';
import {checkDeck} from '../shared/deck-rules';

export default function DeckWorkshop({user}:{user?:User|null}){
  const [decks,setDecks]=useState(readDecks);
  const [activeId,setActiveId]=useState<string|null>(decks[0]?.id??null);
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState<'catalogue'|'deck'>('catalogue');
  const [commanderQuery,setCommanderQuery]=useState('');
  const [page,setPage]=useState(0);
  const [color,setColor]=useState('');
  const [extra,setExtra]=useState({effects:[] as string[],keywords:[] as string[],text:'',type:'',maxMana:'',includePreviews:true});
  const keywords=useMemo(()=>[...new Set(cards.flatMap(c=>c.keywords??[]))].sort((a,b)=>Number(!keywordLabels[a])-Number(!keywordLabels[b])||a.localeCompare(b)),[]);
  const [peek,setPeek]=useState(cards[0]);
  const [error,setError]=useState('');
  const [sync,setSync]=useState('');
  const deck=decks.find(d=>d.id===activeId);
  function save(next:Deck[]){
    try{localStorage.setItem('nexus.decks',JSON.stringify(next));setError('');}catch{setError('Dein Browser konnte die Decks nicht speichern. Bitte exportiere dein Deck.');}
    setDecks(next);
  }
  function update(next:Deck){save(decks.map(d=>d.id===next.id?next:d));}
  function addDeck(){const next=createDeck();save([...decks,next]);setActiveId(next.id);setTab('catalogue');}
  function exportDeck(){
    if(!deck)return;
    const text=`Commander\n1 ${definition(deck.commanderId).name}${deck.secondCommanderId?'\n1 '+definition(deck.secondCommanderId).name:''}\n\nDeck\n${Object.entries(deck.quantities).map(([id,n])=>`${n} ${definition(id).name}`).join('\n')}`;
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`${deck.name.replace(/[^\p{L}\p{N} _-]/gu,'')||'deck'}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const filters:SearchFilters={query,color,...extra};
  const results=useMemo(()=>cards.filter(c=>matchesCard(c,{query,color,...extra})),[query,color,extra]);
  const commanders=useMemo(()=>cards.filter(isCommander),[]);
  const choices=commanders.filter(c=>c.id===deck?.commanderId||c.name.toLowerCase().includes(commanderQuery.toLowerCase())).slice(0,120);
  if(deck&&!choices.some(c=>c.id===deck.commanderId))choices.unshift(definition(deck.commanderId));
  const partners=deck?cards.filter(c=>commanderPair(definition(deck.commanderId),c)):[];
  const pageCount=Math.max(1,Math.ceil(results.length/24));
  const currentPage=Math.min(page,pageCount-1);
  return <div className="workshop">
    <aside className="deck-library"><div className="workshop-book" aria-hidden="true"><Crown size={28}/></div><span className="micro-label">GESPEICHERTE DECKS</span><h2>Deine Decks <small>{decks.length}</small></h2><button className="nexus-button" onClick={addDeck}><Plus size={16}/> Neues Deck</button>
      {decks.length===0&&<p className="subtle">Erstelle ein Deck oder importiere eine Deckliste.</p>}
      {decks.map(d=><button key={d.id} className={`deck-item ${d.id===activeId?'chosen':''}`} onClick={()=>setActiveId(d.id)}><img src={cardImage(definition(d.commanderId))} alt=""/><span><b>{d.name}</b><small>{countDeck(d)} Karten</small></span><ArrowRight size={14}/></button>)}
      <label className="prepared-deck-import">Vorbereitetes Deck<select aria-label="Vorbereitetes Deck übernehmen" value="" onChange={e=>{const source=preparedDecks.find(d=>d.id===e.target.value);if(!source)return;const next={...structuredClone(source),id:uuid()};save([...decks,next]);setActiveId(next.id);setPeek(definition(next.commanderId));setTab('deck');}}><option value="" disabled>Deck auswählen …</option>{preparedDecks.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <p className="storage-note">Lokal automatisch gespeichert. {user?.provider==='discord'?'Mit deinem Discord-Konto auf diesem Server synchronisierbar.':'Ohne Discord bleiben deine Decks in diesem Browser. Exportiere sie für andere Geräte.'}</p>
      {user?.provider==='discord'&&<div className="deck-sync"><button className="nexus-button" onClick={async()=>{try{const remote=await api<{decks:Deck[]}>('/api/decks');const merged=[...remote.decks.filter(d=>!decks.some(local=>local.id===d.id)),...decks];await api('/api/decks',{decks:merged},'PUT');save(merged);setSync('Decks im Konto gespeichert.');}catch(e){setError((e as Error).message);}}}>Im Konto speichern</button><button onClick={async()=>{try{const remote=await api<{decks:Deck[]}>('/api/decks');save([...decks.filter(d=>!remote.decks.some(r=>r.id===d.id)),...remote.decks]);setSync('Decks aus dem Konto geladen.');}catch(e){setError((e as Error).message);}}}>Aus Konto laden</button><p role="status">{sync}</p></div>}
    </aside>
    <section className="workshop-main">
      <div className="workshop-heading"><div className="workshop-hero-art" aria-hidden="true"><img src={cardArt(deck?definition(deck.commanderId):peek)} alt=""/></div><div className="workshop-hero-copy"><h1>Deckersteller</h1></div><span className="catalogue-badge">{catalogueInfo.cards.toLocaleString('de-DE')} Karten · {commanders.length.toLocaleString('de-DE')} Commander</span></div>
      {error&&<p role="alert" className="validation">{error}</p>}
      <DeckImport onImport={next=>{save([...decks,next]);setActiveId(next.id);setCommanderQuery('');setPeek(definition(next.commanderId));setTab('deck');}}/>
      {deck?<><div className="deck-editor-bar"><input aria-label="Deckname" value={deck.name} maxLength={60} onChange={e=>update({...deck,name:e.target.value})}/><b>{countDeck(deck)}<small> Karten</small></b><button title="Deck duplizieren" aria-label="Deck duplizieren" onClick={()=>{const clone={...structuredClone(deck),id:uuid(),name:`${deck.name} · Kopie`};save([...decks,clone]);setActiveId(clone.id);}}><Copy size={17}/></button><button className="export-deck" onClick={exportDeck}>Exportieren</button><button aria-label="Leeres Deck löschen" title="Zum Löschen zuerst die Karten entfernen" disabled={Object.keys(deck.quantities).length>0} onClick={()=>{save(decks.filter(d=>d.id!==deck.id));setActiveId(null);}}><Trash2 size={16}/></button></div>
      <div className="commander-search"><label>Commander suchen<input aria-label="Commander suchen" placeholder="z. B. Yuriko, Grist oder Urza …" value={commanderQuery} onChange={e=>setCommanderQuery(e.target.value)}/></label><label className="commander-picker"><Crown size={16}/> Commander<select aria-label="Commander auswählen" value={deck.commanderId} onChange={e=>{const quantities={...deck.quantities};delete quantities[e.target.value];update({...deck,commanderId:e.target.value,secondCommanderId:undefined,commanderColors:{},quantities});setPeek(definition(e.target.value));}}>{choices.map(c=><option key={c.id} value={c.id}>{c.name}{c.preview?' [Preview]':''}</option>)}</select></label>{partners.length>0&&<label className="commander-picker">Partner / Hintergrund<select aria-label="Zweiten Commander auswählen" value={deck.secondCommanderId??''} onChange={e=>{const quantities={...deck.quantities};delete quantities[e.target.value];update({...deck,secondCommanderId:e.target.value||undefined,quantities});}}><option value="">Kein zweiter Commander</option>{partners.map(c=><option key={c.id} value={c.id}>{c.name}{c.preview?' [Preview]':''}</option>)}</select></label>}{[deck.commanderId,deck.secondCommanderId].filter((id):id is string=>Boolean(id)).map(id=>definition(id)).filter(c=>/choose a color before/i.test(c.text)).map(c=><label key={c.id}>{c.name} · gewählte Farbe<select aria-label={`${c.name} Farbe wählen`} value={deck.commanderColors?.[c.id]??''} onChange={e=>update({...deck,commanderColors:{...deck.commanderColors,[c.id]:e.target.value as 'W'}})}><option value="" disabled>Farbe wählen</option>{[['W','Weiß'],['U','Blau'],['B','Schwarz'],['R','Rot'],['G','Grün']].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>)}<small>{commanderQuery?'Bis zu 120 Treffer – Namen genauer eingeben.':'Commander über den Namen suchen.'}</small></div><p className="deck-validity">{(()=>{try{checkDeck(deck,true);return `✓ ${countDeck(deck)} Karten · ${countDeck(deck)>100?'Hausregel · ':''}Farbidentität und Singleton geprüft`;}catch(e){return (e as Error).message;}})()}</p></>:<div className="deck-empty"><p>Erstelle ein Deck, um Karten aus dem Katalog hinzuzufügen.</p><button onClick={addDeck}>Erstes Deck erstellen <ArrowRight size={15}/></button></div>}
      <div className="workshop-tabs" role="tablist" aria-label="Deckersteller-Ansicht"><button role="tab" id="catalogue-tab" aria-controls="catalogue-panel" aria-selected={tab==='catalogue'} onClick={()=>setTab('catalogue')}>Karten finden <small>{results.length.toLocaleString('de-DE')}</small></button><button role="tab" id="deck-tab" aria-controls="deck-panel" aria-selected={tab==='deck'} disabled={!deck} onClick={()=>setTab('deck')}>Deine Deckliste <small>{deck?countDeck(deck):0}</small></button></div>
      {deck&&tab==='deck'&&<DeckListEditor key={deck.id} deck={deck} update={update} onPeek={setPeek}/>}
      {tab==='catalogue'&&<section id="catalogue-panel" role="tabpanel" aria-labelledby="catalogue-tab"><div className="catalogue-search"><Search size={17}/><input aria-label="Karten suchen" placeholder="Name, Kartentext oder Keyword suchen …" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}}/><select aria-label="Farbidentität filtern" value={color} onChange={e=>{setColor(e.target.value);setPage(0);}}><option value="">Alle Farben</option>{[['W','Weiß'],['U','Blau'],['B','Schwarz'],['R','Rot'],['G','Grün'],['C','Farblos']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
      <CardSearchFilters filters={filters} keywords={keywords} onChange={next=>{setExtra({effects:next.effects,keywords:next.keywords,text:next.text,type:next.type,maxMana:next.maxMana,includePreviews:next.includePreviews!==false});setPage(0);}}/>
      <p className="deck-click-hint">Rechtsklick: hinzufügen · Linksklick: entfernen · Menge über − / +</p><div className="catalogue-grid">{results.slice(currentPage*24,(currentPage+1)*24).map(c=><article key={c.id} className="catalogue-card"><button title="Linksklick: −1 · Rechtsklick: +1" onClick={()=>{setPeek(c);if(deck)update(changeQuantity(deck,c.id,-1));}} onContextMenu={e=>{e.preventDefault();setPeek(c);if(deck)update(changeQuantity(deck,c.id,1));}} onMouseEnter={()=>setPeek(c)} onFocus={()=>setPeek(c)} aria-label={`${c.name}: Linksklick entfernen, Rechtsklick hinzufügen`}><img loading="lazy" src={cardImage(c)} alt={c.name}/><span className="catalogue-card-name">{c.name}{c.preview&&<small className="preview-card-badge">Preview</small>}</span></button><div><button aria-label={`${c.name} entfernen`} disabled={!deck?.quantities[c.id]} onClick={()=>deck&&update(changeQuantity(deck,c.id,-1))}><Minus size={14}/></button><output aria-label={`${c.name} im Deck`}>{(deck?.commanderId===c.id||deck?.secondCommanderId===c.id)?<Crown size={13}/>:deck?.quantities[c.id]||0}</output><button aria-label={`${c.name} hinzufügen`} disabled={!deck||deck.commanderId===c.id||deck.secondCommanderId===c.id} onClick={()=>deck&&update(changeQuantity(deck,c.id,1))}><Plus size={14}/></button></div></article>)}</div>
      <div className="catalogue-pages"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Zurück</button><span>{results.length.toLocaleString('de-DE')} Treffer · Seite {currentPage+1} / {pageCount}</span><button disabled={currentPage+1>=pageCount} onClick={()=>setPage(currentPage+1)}>Weiter</button></div>
      <p className="subtle">Katalogstand: {new Date(catalogueInfo.updated).toLocaleDateString('de-DE')}. Neue Bilder werden online geladen. Kartentexte und Kosten werden bei Bedarf manuell abgewickelt.</p>
      {results.length===0&&<p className="subtle">Keine passende Karte im Commander-Katalog.</p>}</section>}
    </section>
    <aside className="workshop-preview"><span className="preview-kicker">KARTENVORSCHAU</span><div className="workshop-card-stage"><div className="workshop-mana-halo" aria-hidden="true"/><img key={peek.id} src={cardImage(peek)} alt={peek.name}/></div><h3>{peek.name}</h3><CardCharacteristics card={peek}/><ArtworkPicker card={peek}/><p>{peek.text}</p></aside>
  </div>;
}

