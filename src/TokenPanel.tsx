import {useEffect,useState} from 'react';
import {Plus,X,ChevronLeft,ChevronRight} from 'lucide-react';
import {allTokenDefinitions,tokenDefinitions,tokenById} from '../shared/tokens';
import {searchTokens} from '../shared/token-search';
import type {GameAction,GameView} from '../shared/game';
import {catalogueById} from '../shared/catalogue';
import {useTablePanel} from './useTablePanel';
import {api} from './network';
type Tab='common'|'all'|'source';
export default function TokenPanel({view,seat,active,dispatch}:{view:GameView;seat:string;active:boolean;dispatch:(a:GameAction)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[count,setCount]=useState(1),[tab,setTab]=useState<Tab>('common'),[color,setColor]=useState('any'),[page,setPage]=useState(0);
 const [source,setSource]=useState(''),[linked,setLinked]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[missing,setMissing]=useState<string[]>([]);
 useTablePanel('tokens',active&&open,()=>setOpen(false),'.token-panel,.token-trigger');
 useEffect(()=>{const request=(e:Event)=>{if(!active)return;const id=(e as CustomEvent).detail;if(typeof id!=='string'||!catalogueById.has(id))return;setSource(id);setTab('source');setQuery('');setColor('any');setOpen(true);};window.addEventListener('nexus-token-source',request);return()=>window.removeEventListener('nexus-token-source',request);},[active]);
 useEffect(()=>{setPage(0);},[tab,query,color,source,linked]);
 useEffect(()=>{
  if(!open||tab!=='source'||!source)return;
  let cancelled=false;setBusy(true);setError('');setMissing([]);setLinked([]);
  api<{tokenIds:string[];missing:string[]}>(`/api/card-tokens/${encodeURIComponent(source)}`).then(data=>{if(cancelled)return;setLinked(data.tokenIds);setMissing(data.missing);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setBusy(false);});
  return()=>{cancelled=true;};
 },[open,tab,source]);
 const r=view.rules,enabled=r?.stage==='playing'&&!r.lost.includes(seat)&&(!r.pending&&!r.resolving||r.pending?.kind==='manual'&&r.pending.ownerId===seat);
 const sourceIds=[...new Set([...view.cards.filter(c=>c.ownerId===seat&&c.zone!=='library').map(c=>c.cardId),...(source?[source]:[])])];
 const sources=sourceIds.map(id=>catalogueById.get(id)).filter(d=>d&&d.id!=='hidden-card'&&!tokenById.has(d.id)).sort((a,b)=>a!.name.localeCompare(b!.name));
 const candidates=tab==='common'?tokenDefinitions:tab==='all'?allTokenDefinitions:linked.map(id=>tokenById.get(id)).filter((t):t is NonNullable<typeof t>=>Boolean(t));
 const results=searchTokens(candidates,query,color),pages=Math.max(1,Math.ceil(results.length/24)),current=Math.min(page,pages-1),visible=results.slice(current*24,current*24+24);
 return <><button className="token-trigger" aria-label="Token erzeugen" title="Token erzeugen" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Plus size={22}/></button>{open&&<section className="token-panel effect-popover" aria-label="Token erstellen">
  <header className="mechanics-title"><b>Token</b><button aria-label="Token-Menü schließen" onClick={()=>setOpen(false)}><X size={18}/></button></header>
  <div className="token-tabs" role="group" aria-label="Token-Ansicht">{([['common','Häufig'],['all','Alle'],['source','Von Karte']] as const).map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>{setTab(id);if(id==='source'&&!source)setSource(sources[0]?.id??'');}}>{label}</button>)}</div>
  {tab==='source'&&<label>Quelle<select aria-label="Token-Quelle" value={source} onChange={e=>setSource(e.target.value)}><option value="">Karte auswählen …</option>{sources.map(d=><option key={d!.id} value={d!.id}>{d!.name}</option>)}</select></label>}
  <div className="token-tools"><input aria-label="Token suchen" placeholder="Name, 2/2, Flying, Wachsamkeit …" value={query} onChange={e=>setQuery(e.target.value)}/><label>Anzahl<input aria-label="Token-Anzahl" type="number" min="1" max="30" value={count} onChange={e=>setCount(Number(e.target.value))}/></label></div>
  <div className="token-filters"><label>Farbe<select aria-label="Token-Farbe" value={color} onChange={e=>setColor(e.target.value)}>{[['any','Alle'],['W','Weiß'],['U','Blau'],['B','Schwarz'],['R','Rot'],['G','Grün'],['C','Farblos']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><span>{busy?'Token werden geladen …':`${results.length} Treffer`}</span></div>
  {error&&<p role="alert">{error}</p>}{missing.length>0&&<p role="status">Noch nicht im Katalog: {missing.join(', ')}.</p>}
  {!busy&&!error&&tab==='source'&&!linked.length&&<p>{source?'Keine Token-Verknüpfung hinterlegt. Suche unter „Alle“ oder nutze eine Token-Kopie.':'Wähle eine Karte oder öffne „Passende Token“ über ihren Rechtsklick.'}</p>}
  <div className="token-grid">{visible.map(t=><button key={t.id} title={`${t.type}\n${t.text||'Keine zusätzlichen Fähigkeiten'}`} aria-label={`${t.name} Token erzeugen`} disabled={!enabled||busy||!Number.isInteger(count)||count<1||count>30} onClick={()=>dispatch({type:'createToken',tokenId:t.id,count})}><img src={t.image} alt={t.name} loading="lazy"/><span>{t.name}<small>{t.power!==null?`${t.power}/${t.toughness}`:t.type.replace(/^Token /,'')} · {t.colors.join('')||'C'}</small>{t.text&&<small className="token-ability">{t.text}</small>}</span><Plus size={15}/></button>)}</div>
  {!busy&&results.length===0&&tab!=='source'&&<p>Keine passenden Token. Probiere einen anderen Namen, Wert oder eine Fähigkeit.</p>}
  {pages>1&&<div className="token-pages"><button aria-label="Vorherige Token-Seite" disabled={!current} onClick={()=>setPage(current-1)}><ChevronLeft size={18}/></button><span>{current+1} / {pages}</span><button aria-label="Nächste Token-Seite" disabled={current>=pages-1} onClick={()=>setPage(current+1)}><ChevronRight size={18}/></button></div>}
  <small>Werte und Fähigkeiten gehören zur gewählten Variante. Anzahl eingeben, Token anklicken. Effekte werden manuell ausgeführt.</small>
 </section>}</>;
}
