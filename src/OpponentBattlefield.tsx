import {useState,type ReactNode} from 'react';
import {ChevronDown,ChevronUp,Layers,Search,RotateCcw} from 'lucide-react';
import type {CardInstance} from '../shared/game';
import {cardCounterTypes,cardCounters,markerCount,markedStats} from '../shared/counters';
import {instanceDefinition} from '../shared/card-state';
import {groupBattlefield} from './opponent-layout';
export default function OpponentBattlefield({cards,expanded=false,grouped,onInspect,renderCard}:{cards:CardInstance[];expanded?:boolean;grouped:boolean;onInspect:(card:CardInstance)=>void;renderCard:(card:CardInstance)=>ReactNode}){
 const [openGroups,setOpenGroups]=useState<Set<string>>(()=>new Set());
 const [query,setQuery]=useState('');
 const [mode,setMode]=useState<'cards'|'list'>('cards');
 const all=groupBattlefield(cards,grouped);
 const filtered=all.filter(g=>{const data=instanceDefinition(g.cards[0]);return `${data.name} ${data.type}`.toLowerCase().includes(query.toLowerCase());});
 const totalUntapped=cards.filter(c=>!c.tapped).length;
 return <div className={`battlefield-reader ${expanded?'reader-expanded':'reader-compact'} ${expanded&&mode==='cards'?'reader-cards':'reader-list'}`}>
  <div className="field-summary"><span><b>{cards.length}</b> Karten</span><span>{totalUntapped} ungetappt</span>{all.length<cards.length&&<span><Layers size={11}/>{all.length} Gruppen</span>}</div>
  {expanded&&<div className="reader-controls"><label><Search size={15}/><input aria-label="Gegnerkarten suchen" placeholder="Kartenname oder Typ …" value={query} onChange={e=>setQuery(e.target.value)}/></label><div><button aria-pressed={mode==='cards'} onClick={()=>setMode('cards')}>Karten</button><button aria-pressed={mode==='list'} onClick={()=>setMode('list')}>Liste</button></div><span>{filtered.reduce((sum,g)=>sum+g.cards.length,0)} / {cards.length} Karten</span></div>}
  <div className="reader-scroll" onWheel={e=>e.stopPropagation()} tabIndex={0} aria-label={expanded?'Gegnerfeld durchsuchen':'Gegnerkarten – zum Durchsehen scrollen'}>
   {(['creatures','permanents','lands'] as const).map(section=>{
    const groups=filtered.filter(g=>g.section===section);if(!groups.length)return null;
    return <section className={`battlefield-lane lane-${section}`} key={section}><h3>{section==='creatures'?'KREATUREN':section==='lands'?'LÄNDER':'ARTEFAKTE & WEITERE'}<span>{groups.reduce((sum,g)=>sum+g.cards.length,0)}</span></h3><div className="reader-grid">{groups.map(group=>{
     const open=openGroups.has(group.key);const entries=open?group.cards:[group.cards[0]];
     return <div className={`permanent-group ${open?'group-expanded':''}`} key={group.key}>{entries.map(card=>{
      const data=instanceDefinition(card),stats=markedStats(card,data.power,data.toughness);const markers=cardCounterTypes.filter(type=>markerCount(card,type)>0);
      return <div className={`permanent-tile ${card.tapped?'tile-tapped':''}`} key={card.id} data-instance={card.id}><div className="reader-art">{renderCard(card)}{!open&&group.cards.length>1&&<span className="group-count">×{group.cards.length}</span>}</div><div className="permanent-caption"><button className="permanent-name" onClick={()=>onInspect(card)} title={data.name}>{data.name}</button><div className="permanent-meta">{stats.power!==null&&stats.toughness!==null&&<b>{stats.power}/{stats.toughness}</b>}<span>{card.tapped?<><RotateCcw size={10}/> getappt</>:'ungetappt'}</span>{card.token&&<span>Token</span>}</div>{(card.customCounters??[]).map(c=><span className="reader-custom-counter" key={c.name}>{c.name} {c.value}</span>)}{markers.length>0&&<div className="reader-markers">{markers.map(type=><span key={type} title={cardCounters[type].name}>{cardCounters[type].short} {markerCount(card,type)}</span>)}</div>}</div></div>;
     })}{group.cards.length>1&&<button className="group-expand" aria-expanded={open} onClick={()=>setOpenGroups(current=>{const next=new Set(current);if(open)next.delete(group.key);else next.add(group.key);return next;})}>{open?<ChevronUp size={12}/>:<ChevronDown size={12}/>} {open?'Zusammenfassen':`${group.cards.length} einzeln ansehen`}</button>}</div>;
    })}</div></section>;
   })}
   {!filtered.length&&<p className="reader-empty">{cards.length?'Keine passende Karte.':'Noch keine Karten auf dem Spielfeld.'}</p>}
  </div>
  {!expanded&&cards.length>10&&<div className="reader-hint">Scrollen zum Durchsehen · Fokus für große Karten</div>}
 </div>;
}
