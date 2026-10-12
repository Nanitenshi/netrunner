import {useTablePanel} from './useTablePanel';
import {useEffect,useRef,useState} from 'react';
import {Dices,Coins,X,History} from 'lucide-react';
import type {GameAction,GameView} from '../shared/game';
export default function RandomTools({view,active,dispatch}:{view:GameView;active:boolean;dispatch:(action:GameAction)=>void}){
 const [open,setOpen]=useState(false),[mode,setMode]=useState<'dice'|'coin'>('dice'),[sides,setSides]=useState('6'),[count,setCount]=useState('1');
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useTablePanel('random',active&&open,()=>setOpen(false),'.random-tools');
 const validCount=Number.isInteger(Number(count))&&Number(count)>=1&&Number(count)<=20,validSides=Number.isInteger(Number(sides))&&Number(sides)>=2&&Number(sides)<=1000;
 const enabled=view.rules?.stage==='playing';
 const history=[...view.log].reverse().filter(line=>line.includes(' würfelt ')||line.includes(' wirft ')).slice(0,5);
 useEffect(()=>{if(!active){setOpen(false);return;}const keys=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);return;}if(e.key.toLowerCase()==='r'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')&&!document.querySelector('[role=dialog]')){e.preventDefault();setOpen(v=>!v);}};window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[active]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 return <div className="tt-random-tools random-tools" ref={root} onWheel={e=>e.stopPropagation()}>
  <button ref={button} title="Würfel & Münze · R" aria-label="Würfel & Münze" aria-controls="random-tools-panel" aria-expanded={open} onClick={()=>setOpen(!open)}><Dices size={24}/></button>
  {open&&<section id="random-tools-panel" className="random-panel" aria-label="Würfel und Münzen"><header><Dices size={20}/><div><small>GEMEINSAMES ERGEBNIS</small><b>Würfel und Münzen</b></div><button aria-label="Würfel-Menü schließen" onClick={()=>{setOpen(false);button.current?.focus();}}><X size={17}/></button></header>
   <div className="random-tabs"><button aria-pressed={mode==='dice'} onClick={()=>setMode('dice')}><Dices size={15}/> Würfel</button><button aria-pressed={mode==='coin'} onClick={()=>setMode('coin')}><Coins size={15}/> Münze</button></div>
   {mode==='dice'&&<div className="dice-presets">{[4,6,8,10,12,20,100].map(n=><button key={n} aria-label={`W${n}`} aria-pressed={Number(sides)===n} onClick={()=>setSides(String(n))}><span>{n}</span>W{n}</button>)}</div>}
   <div className="random-inputs"><label>Anzahl Würfe<input aria-label="Anzahl Würfe" type="number" min="1" max="20" value={count} onChange={e=>setCount(e.target.value)}/></label>{mode==='dice'&&<label>Seiten<input aria-label="Würfelseiten" type="number" min="2" max="1000" value={sides} onChange={e=>setSides(e.target.value)}/></label>}</div>
   <div className="roll-count-presets" aria-label="Anzahl schnell wählen">{[1,2,3,5,10].map(n=><button key={n} aria-pressed={Number(count)===n} onClick={()=>setCount(String(n))}>{n}×</button>)}</div>
   <button className="random-roll" aria-label={mode==='dice'?'Würfeln':'Münze werfen'} disabled={!enabled||!validCount||mode==='dice'&&!validSides} onClick={()=>dispatch(mode==='dice'?{type:'rollDice',sides:Number(sides),count:Number(count)}:{type:'flipCoin',count:Number(count)})}>{mode==='dice'?<Dices size={18}/>:<Coins size={18}/>} {mode==='dice'?`${count}W${sides} würfeln`:'Münze werfen'}</button>
   {!enabled&&<p>Zuerst die Starthände behalten. Würfe sind während der laufenden Partie verfügbar.</p>}
   <div className="random-result" role="status" aria-live="polite"><small>LETZTER WURF</small><b>{history[0]??'Noch kein Wurf.'}</b></div>
   {history.length>1&&<details className="random-history"><summary><History size={13}/> Letzte Würfe</summary>{history.slice(1).map((line,i)=><p key={i}>{line}</p>)}</details>}
   <p className="random-note">Würfel, Münzen und Ergebnisse sind für alle sichtbar. Online würfelt der Server. Counter verwaltest du direkt an Karte oder Spieler.</p>
  </section>}
 </div>;
}
