import {useState} from 'react';
import {Plus,Minus,Tag,Trash2} from 'lucide-react';
import {normalizeCounterName,type CustomCounter} from '../shared/counters';
import type {GameAction} from '../shared/game';

export default function CustomCounters({counters=[],cardId,dispatch,step=1}:{counters?:CustomCounter[];cardId?:string;dispatch:(a:GameAction)=>void;step?:number}){
 const [name,setName]=useState(''),[value,setValue]=useState('1');
 const valid=normalizeCounterName(name).length>0&&normalizeCounterName(name).length<=28&&!/[\p{C}]/u.test(name)&&Number.isInteger(Number(value))&&Number(value)>0&&Number(value)<=999;
 const change=(label:string,amount:number)=>dispatch({type:'customCounter',...(cardId?{cardId}:{}),name:label,amount});
 return <section className="custom-counters" aria-label="Eigene Counter">
  <header><Tag size={16}/><div><h3>Eigene Counter</h3><p>Seltene Marken, frei benannt. Für alle sichtbar.</p></div><span>{counters.length}/16</span></header>
  <div className="custom-counter-list">{counters.map(c=><div className="custom-counter-row" key={c.name}><span className="custom-dot"/><b>{c.name}</b><button aria-label={`${c.name} verringern`} disabled={!Number.isInteger(step)||step<1||step>999} onClick={()=>change(c.name,-Math.min(c.value,step))}><Minus size={14}/></button><output aria-label={`${c.name} Anzahl`}>{c.value}</output><button disabled={c.value>=999||!Number.isInteger(step)||step<1||step>999} aria-label={`${c.name} erhöhen`} onClick={()=>change(c.name,Math.min(999-c.value,step))}><Plus size={14}/></button><button aria-label={`${c.name} löschen`} onClick={()=>change(c.name,-c.value)}><Trash2 size={14}/></button></div>)}</div>
  <form className="custom-counter-form" onSubmit={e=>{e.preventDefault();if(valid){change(name,Number(value));setName('');setValue('1');}}}>
   <label>Name<input aria-label="Eigener Counter-Name" maxLength={28} value={name} onChange={e=>setName(e.target.value)} placeholder="z. B. Flut, Brut, Schicksal …"/></label>
   <label>Anzahl<input aria-label="Eigener Counter Anzahl" type="number" min="1" max="999" value={value} onChange={e=>setValue(e.target.value)}/></label>
   <button type="submit" className="nexus-button" disabled={!valid||counters.length>=16&&!counters.some(c=>c.name.toLowerCase()===normalizeCounterName(name).toLowerCase())}><Plus size={15}/> Hinzufügen</button>
  </form>
 </section>;
}
