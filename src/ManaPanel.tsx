import {useTablePanel} from './useTablePanel';
import {useEffect,useRef,useState} from 'react';
import {Sparkles,X,Minus,Plus,Flame} from 'lucide-react';
import type {GameAction,GameView} from '../shared/game';
import {manaColors,manaNames,manaTotal,type ManaColor} from '../shared/mana';
import {definition} from './seed';

export default function ManaPanel({view,seat,dispatch,request}:{request?:{id:number;cardId:string};view:GameView;seat:string;dispatch:(action:GameAction)=>void}){
 const [open,setOpen]=useState(false),[amount,setAmount]=useState('1'),[source,setSource]=useState('');
 const container=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useTablePanel('mana',open,()=>setOpen(false),'.mana-tool');
 const me=view.players.find(p=>p.id===seat)!,r=view.rules;
 const enabled=r?.stage==='playing'&&(r.pending?.kind==='manual'&&r.pending.ownerId===seat||!r.pending&&!r.resolving&&(r.priority===seat||r.turnOnly&&!r.stack.length));
 const valid=Number.isInteger(Number(amount))&&Number(amount)>=1&&Number(amount)<=100;
 const sources=view.cards.filter(c=>c.controllerId===seat&&c.zone==='battlefield'&&!c.tapped);
 useEffect(()=>{if(request&&view.cards.some(c=>c.id===request.cardId&&c.controllerId===seat&&c.zone==='battlefield'&&!c.tapped)){setOpen(true);setSource(request.cardId);setAmount('1');}},[request?.id]);
 useEffect(()=>{if(source&&!sources.some(c=>c.id===source))setSource('');},[view.cards,source]);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(!container.current?.contains(e.target as Node))setOpen(false);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 const change=(color:ManaColor,sign:1|-1)=>{if(enabled&&valid){dispatch({type:'mana',color,amount:Number(amount)*sign,...(sign===1&&source?{sourceCardId:source}:{})});}};
 return <div className="mana-tool" ref={container}><div className="mana-quick" aria-label="Mana direkt anpassen">{manaColors.map(color=><button key={color} className={`mana-${color}`} title={`${manaNames[color]}: Klick +1, Rechtsklick −1`} aria-label={`${manaNames[color]} Mana direkt hinzufügen`} disabled={!enabled} onClick={()=>dispatch({type:'mana',color,amount:1})} onContextMenu={e=>{e.preventDefault();if(enabled&&(me.mana?.[color]??0)>0)dispatch({type:'mana',color,amount:-1});}}>{color==='C'?'◇':color}<b>{me.mana?.[color]??0}</b></button>)}</div>
  <button aria-label="Mana-Menü" title="Mana verwalten" className={`mana-toggle ${manaTotal(me.mana)?'mana-charged':''}`} ref={trigger} aria-expanded={open} aria-controls="mana-popover" onClick={()=>setOpen(!open)}><Sparkles size={22}/><span className="dock-label">Mana</span><b>{manaTotal(me.mana)}</b><span className="mana-mini">{manaColors.filter(c=>me.mana?.[c]).map(c=><i className={`mana-${c}`} key={c}>{c} {me.mana![c]}</i>)}</span></button>
  {open&&<section className="mana-popover" id="mana-popover" aria-label="Floating Mana"><header><span><small>DEIN MANA-POOL</small><b>Mana</b></span><button aria-label="Mana-Menü schließen" onClick={()=>setOpen(false)}><X size={17}/></button></header>
   
   <div className="mana-orbs">{manaColors.map(color=><div className={`mana-orb mana-${color}`} key={color}><span title={manaNames[color]}>{color==='C'?'◇':color}</span><b aria-label={`${manaNames[color]} Mana`}>{me.mana?.[color]??0}</b><small>{manaNames[color]}</small><div><button aria-label={`${manaNames[color]} Mana verbrauchen`} disabled={!enabled||!valid||(me.mana?.[color]??0)<Number(amount)} onClick={()=>change(color,-1)}><Minus size={14}/></button><button aria-label={`${manaNames[color]} Mana erzeugen`} disabled={!enabled||!valid} onClick={()=>change(color,1)}><Plus size={14}/></button></div></div>)}</div>
   <div className="mana-options"><label>Menge<input aria-label="Mana-Menge" type="number" min="1" max="100" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Quelle optional tappen<select aria-label="Manaquelle" value={source} onChange={e=>setSource(e.target.value)}><option value="">Nur Mana eintragen</option>{sources.map(c=><option key={c.id} value={c.id}>{definition(c.cardId).name}</option>)}</select></label></div>
   <label className="mana-retain"><input type="checkbox" checked={me.retainMana===true} disabled={!enabled} onChange={e=>dispatch({type:'retainMana',enabled:e.target.checked})}/> {r?.turnOnly?'Mana beim Zugwechsel behalten':'Mana beim Schrittwechsel behalten'}</label>
   <details className="action-help"><summary>Mana-Regeln</summary><p className="mana-rule">{me.retainMana?'Manuelle Kartenausnahme aktiv: Dein gesamter Pool bleibt erhalten. Einschränkungen und Farbänderungen selbst beachten.':r?.turnOnly?'Im Zugmodus wird der Pool beim Zugwechsel geleert. Weitere Leerungen mit der Runde absprechen oder „Pool leeren“ nutzen. Beim Passen und Verrechnen bleibt Mana erhalten.':'Ungenutztes Mana verfällt am Ende jedes Schritts und jeder Phase. Beim Passen und Verrechnen bleibt es erhalten.'}</p></details>
   <footer><span><Flame size={13}/> Manafähigkeit: direkt, ohne Stack.</span><button disabled={!enabled||!manaTotal(me.mana)} onClick={()=>dispatch({type:'clearMana'})}>Pool leeren</button></footer>
   {!enabled&&<p role="status">Du kannst Mana mit Priorität oder während deiner manuellen Effektverrechnung ändern.</p>}
   <div className="opponent-mana"><small>MANA AM TISCH</small>{view.players.filter(p=>p.id!==seat&&!r?.lost.includes(p.id)).map(p=><div key={p.id}><span>{p.name}</span><b>{manaColors.filter(c=>p.mana?.[c]).map(c=>`${c} ${p.mana![c]}`).join(' · ')||'Leer'}</b></div>)}</div>
  </section>}
 </div>;
}
