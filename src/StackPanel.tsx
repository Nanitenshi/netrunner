import {instanceDefinition} from '../shared/card-state';
import {cardImage} from './artworks';
import {useState} from 'react';
import {X,Layers,ArrowDown,ArrowUpRight,Swords,Check} from 'lucide-react';
import type {CardInstance,GameView,GameAction} from '../shared/game';
import type {StackItem} from '../shared/rules-types';
import {definition} from './seed';
export default function StackPanel({view,seat,dispatch,onInspect,onCast,onAbility,onClose}:{view:GameView;seat:string;dispatch:(action:GameAction)=>void;onInspect:(c:CardInstance)=>void;onCast:(id:string)=>void;onAbility:()=>void;onClose:()=>void}){
 const [respond,setRespond]=useState(true),r=view.rules!;
 const canAct=r.stage==='playing'&&r.priority===seat&&!r.pending&&!r.resolving;
 const instantCards=view.cards.filter(c=>{const d=definition(c.cardId),face=d.faces[0]??d;return c.ownerId===seat&&c.zone==='hand'&&(face.type.includes('Instant')||/(^|\n)Flash\b/.test(face.text)||d.layout==='modal_dfc'&&d.faces.some(f=>f.type.includes('Instant')||/(^|\n)Flash\b/.test(f.text)));});
 const person=(id:string)=>view.players.find(p=>p.id===id)?.name??'–';
 const entry=(item:StackItem,index:number,resolving=false)=>{
  const card=view.cards.find(c=>c.id===(item.cardId??item.sourceCardId));
  const targetItem=r.stack.find(i=>i.id===item.targetId),targetCard=view.cards.find(c=>c.id===(targetItem?.cardId??item.targetId));
  return <article className={`stack-object ${index===0?'stack-next':''} ${resolving?'is-resolving':''}`} key={item.id}>
   <span className="stack-position">{resolving?'↻':String(r.stack.length-index).padStart(2,'0')}</span>
   <button className="stack-art" disabled={!card} aria-label={`${item.label} ansehen`} onClick={()=>card&&onInspect(card)}>{card?<img src={cardImage(instanceDefinition(card))} alt=""/>:<Layers size={27}/>}</button>
   <div className="stack-object-copy"><small>{resolving?'IN VERRECHNUNG':index===0?'WIRD ALS NÄCHSTES VERRECHNET':'WARTET DARUNTER'}</small><b>{item.label}</b><span>{person(item.controllerId)} · {item.kind==='spell'?'Spruch':item.abilityType==='triggered'?'Trigger':'Aktivierte Fähigkeit'}{item.manaValue!==undefined?` · MV ${item.manaValue}`:''}</span>{item.targetId&&<button className="stack-target" disabled={!targetCard} onClick={()=>targetCard&&onInspect(targetCard)}><ArrowUpRight size={12}/> Ziel: {targetItem?.label??(targetCard?instanceDefinition(targetCard).name:'nicht mehr vorhanden')}</button>}{item.effect&&<em>{item.effect.kind.toUpperCase()} {item.effect.value}</em>}</div>
  </article>;
 };
 return <aside className="stack-panel" aria-label="Gemeinsamer Stack">
  <header><Layers size={18}/><div><span>GEMEINSAMER STACK</span><b>{r.stack.length} {r.stack.length===1?'Objekt':'Objekte'}</b></div><button onClick={onClose} aria-label="Stack schließen"><X size={17}/></button></header>
  <div className="priority-track" aria-label="Prioritätsfolge">{view.players.filter(p=>!r.lost.includes(p.id)).map(p=><div key={p.id} className={`${r.priority===p.id?'has-priority':''} ${r.passes.includes(p.id)?'has-passed':''}`} title={`${p.name}${r.priority===p.id?' hat Priorität':r.passes.includes(p.id)?' hat gepasst':''}`}><i>{r.passes.includes(p.id)?<Check size={11}/>:p.name[0]}</i><span>{p.id===seat?'Du':p.name}</span></div>)}</div>
  <div className={`stack-priority-callout ${canAct?'your-response':''}`}><i/><div><b>{r.resolving?'Verrechnung läuft':canAct?'Dein Reaktionsfenster':`${person(r.priority)} ist an der Reihe`}</b><span>{r.resolving?'Erst nach dem vollständigen Effekt gibt es wieder Priorität.':`${r.passes.length}/${view.players.length-r.lost.length} Spieler haben nacheinander gepasst.`}</span></div></div>
  <div className="stack-objects">{r.resolving&&entry(r.resolving,-1,true)}{[...r.stack].reverse().map((item,i)=>entry(item,i))}{!r.stack.length&&!r.resolving&&<div className="stack-empty"><Layers size={30}/><b>Der Stack ist leer.</b></div>}</div>
  <div className="stack-panel-footer"><p><ArrowDown size={13}/>{r.pending?'Die laufende Auswahl wird zuerst abgeschlossen.':canAct?'Du kannst reagieren oder Priorität abgeben.':`${person(r.priority)} entscheidet als Nächstes.`}</p><div><button disabled={!canAct} onClick={()=>setRespond(v=>!v)} aria-expanded={respond}><Swords size={14}/> {respond?'Reaktionen ausblenden':'Reaktionen anzeigen'}</button><button disabled={!canAct} onClick={onAbility}>Fähigkeit ansagen</button></div>
  <button className="stack-pass-action" disabled={!canAct} onClick={()=>dispatch({type:'pass'})}>Keine Reaktion <kbd>P</kbd></button><small className="stack-rule-note">Ein Objekt pro Passrunde. Danach erhält der aktive Spieler Priorität.</small>
  {respond&&<div className="stack-responses">{instantCards.length?instantCards.map(c=><button key={c.id} disabled={!canAct} onClick={()=>{onCast(c.id);setRespond(false);}}><img src={cardImage(definition(c.cardId))} alt=""/><span>{definition(c.cardId).name}<small>{definition(c.cardId).mana}</small></span><ArrowUpRight size={13}/></button>):<p>Keine Spontanzauber auf deiner Hand. Weitere Fähigkeiten über „Fähigkeit ansagen“ öffnen.</p>}</div>}</div>
 </aside>;
}
