import {createPortal} from 'react-dom';
import {useEffect,useState} from 'react';
import {Minus,Plus,X} from 'lucide-react';
import type {GameAction} from '../shared/game';
import {useTablePanel} from './useTablePanel';
export default function LifeControl({life,active,dispatch}:{life:number;active:boolean;dispatch:(a:GameAction)=>void}){
 const [open,setOpen]=useState(false),[amount,setAmount]=useState('10');
 useTablePanel('life',active&&open,()=>setOpen(false),'.life-control,.life-popover');
 const change=(n:number)=>dispatch({type:'life',amount:n});
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!active||e.repeat||e.altKey||e.metaKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')||document.querySelector('[role=dialog],.scrim'))return;
  if(e.key.toLowerCase()==='l'){e.preventDefault();setOpen(v=>!v);}
  if(e.key==='PageUp'||e.key==='PageDown'){e.preventDefault();change((e.key==='PageUp'?1:-1)*(e.ctrlKey?10:e.shiftKey?5:1));}
 };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[active,dispatch]);
 const valid=Number.isInteger(Number(amount))&&Number(amount)>0&&Number(amount)<=100;
 return <div className="tt-mat-life life-control"><button aria-label="Ein Leben verlieren" title="−1 · Umschalt: −5 · Strg: −10" onClick={e=>change(-(e.ctrlKey?10:e.shiftKey?5:1))}><Minus size={17}/></button><button className="life-total" aria-label="Leben ändern" title="Leben ändern · L" onClick={()=>setOpen(v=>!v)}><strong>{life}</strong></button><button aria-label="Ein Leben erhalten" title="+1 · Umschalt: +5 · Strg: +10" onClick={e=>change(e.ctrlKey?10:e.shiftKey?5:1)}><Plus size={17}/></button>{open&&createPortal(<section className="life-popover" aria-label="Lebenspunkte ändern"><header><b>Leben · {life}</b><button aria-label="Lebensmenü schließen" onClick={()=>setOpen(false)}><X size={16}/></button></header><div className="life-presets">{[-20,-10,-5,5,10,20].map(n=><button key={n} onClick={()=>change(n)}>{n>0?'+':''}{n}</button>)}</div><form onSubmit={e=>{e.preventDefault();if(valid)change(Number(amount));}}><label>Menge<input aria-label="Lebensänderung" type="number" min="1" max="100" value={amount} onChange={e=>setAmount(e.target.value)}/></label><button type="button" disabled={!valid} onClick={()=>change(-Number(amount))}>Abziehen</button><button disabled={!valid} type="submit">Hinzufügen</button></form><small>Bild ↑ / ↓ · Umschalt: 5 · Strg: 10</small></section>,document.body)}</div>;
}
