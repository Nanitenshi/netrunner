import {createPortal} from 'react-dom';
import {useEffect,useRef,useState} from 'react';

export default function ConfirmEndTurn({onCancel,onConfirm}:{onCancel:()=>void;onConfirm:()=>boolean|void|Promise<boolean|void>}){
 const cancel=useRef<HTMLButtonElement>(null),lock=useRef(false),[busy,setBusy]=useState(false);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;cancel.current?.focus();return()=>previous?.focus({preventScroll:true});},[]);
 return createPortal(<div className="turn-confirm-scrim" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){if(!lock.current)onCancel();}if(e.key==='Tab'){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const next=e.shiftKey?buttons.at(-1):buttons[0],edge=e.shiftKey?buttons[0]:buttons.at(-1);if(document.activeElement===edge){e.preventDefault();next?.focus();}}}}>
  <section role="dialog" aria-modal="true" aria-labelledby="end-turn-title" className="turn-confirm">
   <h2 id="end-turn-title">Zug wirklich abgeben?</h2><p>Du kannst noch Karten spielen oder Fähigkeiten nutzen, solange die Regeln es erlauben. Mit der Bestätigung gibst du deinen Zug ab.</p>
   <div><button ref={cancel} disabled={busy} onClick={onCancel}>Weiterspielen</button><button className="primary" disabled={busy} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);try{if(await onConfirm()!==false)onCancel();}finally{lock.current=false;setBusy(false);}}}>{busy?'Wird geprüft …':'Zug jetzt abgeben'}</button></div>
  </section>
 </div>,document.body);
}
