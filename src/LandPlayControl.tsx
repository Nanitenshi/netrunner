import {useState} from 'react';
import {Trees,Plus,Minus,X} from 'lucide-react';
import {landPlayAllowance} from '../shared/land-plays';
import type {GameAction,GameView} from '../shared/game';
import {useTablePanel} from './useTablePanel';

export default function LandPlayControl({view,seat,dispatch}:{view:GameView;seat:string;dispatch:(a:GameAction)=>void}){
 const [open,setOpen]=useState(false),[value,setValue]=useState('1');
 const lands=landPlayAllowance(view,seat),r=view.rules;
 const enabled=r?.stage==='playing'&&view.activePlayer===seat&&(!r.pending&&!r.resolving||r.pending?.kind==='manual'&&r.pending.ownerId===seat);
 const valid=value.trim()!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=998;
 useTablePanel('lands',open,()=>setOpen(false),'.land-play-control');
 const set=(count:number)=>{const next=Math.max(0,Math.min(998,count));setValue(String(next));dispatch({type:'setLandBonus',count:next});};
 return <div className="land-play-control"><button className="land-play-toggle" aria-label="Landspiele" aria-expanded={open} title={`${lands.played} von ${lands.limit} Ländern gespielt`} onClick={()=>{setValue(String(lands.manual));setOpen(!open);}}><Trees size={16}/><span>Länder</span><b>{lands.played}/{lands.limit}</b></button>
 {open&&<section className="land-play-popover" aria-label="Landspiele für diesen Zug"><header><b>Landspiele</b><button aria-label="Landspiele schließen" onClick={()=>setOpen(false)}><X size={16}/></button></header><div className="land-play-summary"><strong>{lands.remaining}</strong><span>noch frei<small>{lands.played} gespielt · {lands.limit} erlaubt</small></span></div>
 {lands.sources.length>0&&<div className="land-play-sources">{lands.sources.map(s=><span key={s.cardId}>{s.name}<b>+{s.bonus}</b></span>)}</div>}
 <div className="land-play-step"><span>Zusätzlich für diesen Zug</span><button aria-label="Zusätzliches Landspiel entfernen" disabled={!enabled||!lands.manual} onClick={()=>set(lands.manual-1)}><Minus size={17}/></button><output>{lands.manual}</output><button aria-label="Zusätzliches Landspiel hinzufügen" disabled={!enabled||lands.manual>=998} onClick={()=>set(lands.manual+1)}><Plus size={17}/></button></div>
 <form onSubmit={e=>{e.preventDefault();if(enabled&&valid)set(Number(value));}}><label>Anzahl<input aria-label="Zusätzliche Landspiele Anzahl" type="number" min="0" max="998" value={value} onChange={e=>setValue(e.target.value)}/></label><button disabled={!enabled||!valid}>Setzen</button></form><small>Für Effekte nach Absprache. Wird beim Zugwechsel zurückgesetzt. Eindeutige dauerhafte Boni werden automatisch addiert.</small></section>}
 </div>;
}
