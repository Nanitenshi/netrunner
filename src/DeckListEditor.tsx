import {useState,useMemo,useEffect} from 'react';
import type {Deck} from './decks';
import {changeQuantity,countDeck} from './decks';
import {definition} from './seed';
import {cardImage} from './artworks';
import type {CardDefinition} from '../shared/cards';
import {groupDeck,roleGroups,suggestedRole,analyzeDeck,sampleOpeningHand,cardTypeGroup,type GroupMode} from '../shared/deck-analysis';

export default function DeckListEditor({deck,update,onPeek}:{deck:Deck;update:(deck:Deck)=>void;onPeek:(card:CardDefinition)=>void}){
 const [query,setQuery]=useState(''),[mode,setMode]=useState<GroupMode>('role'),[sort,setSort]=useState<'name'|'mana'>('name'),[hand,setHand]=useState<CardDefinition[]>([]);
 useEffect(()=>setHand([]),[deck.quantities]);
 const groups=useMemo(()=>groupDeck(deck,mode,query,sort),[deck,mode,query,sort]);
 const stats=useMemo(()=>analyzeDeck(deck),[deck]);
 const commanders=[deck.commanderId,deck.secondCommanderId].filter((id):id is string=>Boolean(id)).map(definition);
 const identity=[...new Set(commanders.flatMap(c=>[...c.colorIdentity,...(deck.commanderColors?.[c.id]?[deck.commanderColors[c.id]]:[])]))];
 const categoryOptions=[...new Set([...roleGroups,...Object.values(deck.cardGroups??{})])];
 function assign(id:string,value:string){if((deck.cardGroups?.[id]??'')===value.trim())return;const cardGroups={...deck.cardGroups};if(value.trim())cardGroups[id]=value.trim().slice(0,40);else delete cardGroups[id];update({...deck,cardGroups});}
 return <section id="deck-panel" role="tabpanel" aria-labelledby="deck-tab" className="own-deck-list grouped-deck" aria-label="Eigene Deckliste">
  <header><h2>Deine Deckliste <small>{countDeck(deck)} Karten</small></h2><span>Identität: {identity.join(' / ')||'Farblos'}</span></header>
  <div className="own-commanders">{commanders.map(c=><button key={c.id} onClick={()=>onPeek(c)}><img src={cardImage(c)} alt=""/><span><b>{c.name}</b><small>Commander · {c.colorIdentity.join(' / ')||'Farblos'}</small></span></button>)}</div>
  <div className="deck-analysis-summary"><span><b>{stats.lands}</b> Länder</span><span><b>{stats.spells}</b> weitere Karten</span><span><b>{stats.average.toLocaleString('de-DE',{maximumFractionDigits:2})}</b> Ø Manawert</span></div>
  <details className="deck-analysis"><summary>Analyse & Testhand</summary><p className="analysis-note">Bibliothek ohne Commander. Die Manakurve zählt Nichtlandkarten; X zählt als 0. Farben zeigen Farbidentität, nicht verfügbare Manaquellen.</p>
   <div className="deck-analysis-charts"><section><h3>Manakurve</h3><div className="mana-curve" role="img" aria-label={`Manakurve: ${stats.curve.map((n,i)=>`${i===7?'7+':i}: ${n}`).join(', ')}`}>{stats.curve.map((n,i)=><div key={i}><b>{n}</b><i style={{height:`${8+78*n/Math.max(1,...stats.curve)}px`}}/><small>{i===7?'7+':i}</small></div>)}</div></section><section><h3>Kartentypen</h3><div className="analysis-types">{Object.entries(stats.types).map(([name,n])=><span key={name}>{name}<b>{n}</b></span>)}</div></section></div>
   <div className="analysis-colors">{Object.entries(stats.colors).map(([color,n])=><span key={color} data-color={color}><b>{color==='C'?'Farblos':color}</b> {n}</span>)}</div>
   <div className="sample-hand-heading"><button disabled={stats.total===0} onClick={()=>setHand(sampleOpeningHand(deck))}>{hand.length?'Neue Testhand':'7 Karten testen'}</button><span>{hand.length?`${hand.filter(c=>cardTypeGroup(c)==='Länder').length} Länder · ohne Einfluss auf eine Partie`:'Aus deiner aktuellen Bibliothek'}</span></div>
   {hand.length>0&&<div className="deck-sample-hand" aria-label="Test-Starthand">{hand.map((c,i)=><button key={i} onClick={()=>onPeek(c)} onMouseEnter={()=>onPeek(c)}><img loading="lazy" src={cardImage(c)} alt={c.name}/><span>{c.name}</span></button>)}</div>}
  </details>
  <div className="deck-group-toolbar"><input className="own-deck-search" aria-label="Eigene Deckliste durchsuchen" placeholder="Name, Typ oder Kartentext …" value={query} onChange={e=>setQuery(e.target.value)}/><label>Gruppieren<select aria-label="Deckliste gruppieren" value={mode} onChange={e=>setMode(e.target.value as GroupMode)}><option value="role">Aufgabe im Deck</option><option value="type">Kartentyp</option><option value="mana">Manawert</option><option value="none">Keine Gruppen</option></select></label><label>Sortieren<select aria-label="Deckliste sortieren" value={sort} onChange={e=>setSort(e.target.value as 'name'|'mana')}><option value="name">Name</option><option value="mana">Manawert</option></select></label></div>
  <p className="group-note">Automatisch vorgeschlagene Aufgaben. Über „Gruppe“ anders zuordnen oder einen eigenen Namen eingeben. Ein leeres Feld setzt die Zuordnung zurück.</p>
  <datalist id="deck-group-options">{categoryOptions.map(name=><option key={name} value={name}/>)}</datalist>
  <div className="deck-group-grid">{groups.map(group=><details key={group.name} className="deck-role-group" open><summary><span>{group.name}</span><b>{group.count}</b></summary><div className="own-deck-rows">{group.rows.map(({id,n,card:c})=><div key={id} className="deck-group-row"><img className="own-deck-thumbnail" loading="lazy" src={cardImage(c)} alt=""/><button className="own-card-name" title="Linksklick: −1 · Rechtsklick: +1" onMouseEnter={()=>onPeek(c)} onFocus={()=>onPeek(c)} onClick={()=>update(changeQuantity(deck,id,-1))} onContextMenu={e=>{e.preventDefault();update(changeQuantity(deck,id,1));}}>{n} × {c.name}</button><button aria-label={`${c.name} aus Deck entfernen`} onClick={()=>update(changeQuantity(deck,id,-1))}>−</button><button aria-label={`${c.name} im Deck erhöhen`} onClick={()=>update(changeQuantity(deck,id,1))}>+</button>{mode==='role'&&<label className="deck-card-group">Gruppe<input aria-label={`${c.name} Gruppe`} list="deck-group-options" key={`${deck.id}-${id}-${deck.cardGroups?.[id]??''}`} defaultValue={deck.cardGroups?.[id]??''} placeholder={suggestedRole(c)} maxLength={40} onBlur={e=>assign(id,e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></label>}</div>)}</div></details>)}</div>
  {!groups.length&&<p>{stats.total?'Keine Karten für diese Suche.':'Noch keine Karten hinzugefügt.'}</p>}
  <details className="deck-notes"><summary>Decknotizen</summary><textarea aria-label="Decknotizen" placeholder="Spielplan, Synergien oder Änderungen …" maxLength={5000} value={deck.notes??''} onChange={e=>update({...deck,notes:e.target.value})}/><small>{deck.notes?.length??0} / 5000</small></details>
 </section>;
}
