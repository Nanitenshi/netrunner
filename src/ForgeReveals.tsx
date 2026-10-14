import {useEffect,useRef} from 'react';
import {catalogue} from '../shared/catalogue';
import type {ForgeReveal} from '../shared/forge-protocol';
import './forge-reveals.css';
const images=new Map(catalogue.flatMap(c=>[[c.name,c.image] as const,...c.faces.map(f=>[f.name,f.image??c.image] as const)]));
export default function ForgeReveals({reveals,onClose}:{reveals:ForgeReveal[];onClose:()=>void}){
 const dialog=useRef<HTMLElement>(null),restoreFocus=useRef(document.activeElement as HTMLElement|null),closeAction=useRef(onClose);closeAction.current=onClose;
 useEffect(()=>{const close=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();closeAction.current();}if(e.key==='Tab'){const buttons=dialog.current?.querySelectorAll<HTMLElement>('button,summary');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};document.addEventListener('keydown',close);return()=>{document.removeEventListener('keydown',close);restoreFocus.current?.focus({preventScroll:true});};},[]);
 return <div className="forge-reveals-scrim" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} role="dialog" aria-modal="true" aria-label="Aufgedeckte Karten" className="forge-reveals"><header><h2>Aufgedeckte Karten</h2><button autoFocus aria-label="Aufgedeckte Karten schließen" onClick={onClose}>Schließen</button></header><p>Die letzten Aufdeckungen, die du sehen darfst. Deine laufende Auswahl bleibt erhalten.</p>{[...reveals].reverse().map((r,i)=><details key={r.id} open={i===0}><summary>{r.source&&`${r.source} · `}{r.title} · {r.cards.length} {r.cards.length===1?'Karte':'Karten'}</summary><div>{r.cards.map(c=><figure key={c.id}>{images.get(c.name)&&<img src={images.get(c.name)} alt={c.name}/>}<figcaption>{c.name}</figcaption></figure>)}</div></details>)}</section></div>;
}
