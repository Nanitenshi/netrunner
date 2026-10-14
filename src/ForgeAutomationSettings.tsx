import {useEffect,useRef} from 'react';
import type {ForgeRoom} from '../shared/forge-protocol';
import './forge-reveals.css';
import './forge-automation.css';

export default function ForgeAutomationSettings({room,disabled,onChange,onClose}:{room:ForgeRoom;disabled:boolean;onChange:(revealLands:boolean)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLElement>(null),restoreFocus=useRef(document.activeElement as HTMLElement|null),closeAction=useRef(onClose);closeAction.current=onClose;
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();closeAction.current();}
   if(e.key==='Tab'){
    const items=dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)');if(!items?.length)return;
    const first=items[0],last=items[items.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
   }
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);restoreFocus.current?.focus({preventScroll:true});};
 },[]);
 return <div className="forge-reveals-scrim forge-automation-scrim" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><section className="forge-reveals forge-automation-settings" ref={dialog} role="dialog" aria-modal="true" aria-label="Deine Entscheidungen"><header><h2>Deine Entscheidungen</h2><button autoFocus aria-label="Entscheidungseinstellungen schließen" onClick={onClose}>Schließen</button></header>
  <p>Du wählst für jede ergänzte Automatisierung selbst. Diese Einstellung gilt nur für dich an diesem Tisch, bleibt beim Neuladen erhalten und startet an einem neuen Tisch wieder manuell.</p>
  <fieldset disabled={disabled}><legend>Aufdeck-Länder</legend>
   <label><input type="radio" name="reveal-lands" checked={!room.automation.revealLands} onChange={()=>onChange(false)}/> Selbst entscheiden</label>
   <label><input type="radio" name="reveal-lands" checked={room.automation.revealLands} onChange={()=>onChange(true)}/> Automatisch, wenn eindeutig</label>
  </fieldset>
  <p>Port Town, Choked Estuary, Foreboding Ruins, Game Trail und Fortified Village: Die Automatik deckt eine passende Handkarte auf, damit das Land ungetappt ins Spiel kommt. Sie wählt nur, wenn alle erlaubten Karten denselben Namen haben. Bei verschiedenen Namen entscheidest du weiter selbst; ohne passende Karte kommt das Land getappt.</p>
  <p>Du kannst jederzeit auf „Selbst entscheiden“ zurückstellen. Bereits ausgeführte Entscheidungen bleiben bestehen. Weitere Automatisierungen ergänzen wir schrittweise mit eigenen Einstellungen.</p>
  {room.automationError&&<p role="alert">{room.automationError}</p>}
  {room.automaticDecisions.length>0&&<><h3>Für dich automatisch entschieden</h3><ol>{[...room.automaticDecisions].reverse().map(d=><li key={d.id}>{d.source}: {d.cardName} aufgedeckt</li>)}</ol></>}
 </section></div>;
}
