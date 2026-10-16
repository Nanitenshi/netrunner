import {useEffect,useRef,useState} from 'react';
import type {ForgeAction,ForgeChoice} from '../shared/forge-protocol';
import './forge-payment.css';

export default function ForgePaymentPanel({choice,busy,onChoose}:{choice:ForgeChoice;busy:boolean;onChoose:(action:ForgeAction)=>Promise<unknown>}){
 const payment=choice.payment,[selected,setSelected]=useState<string[]>([]),[submitted,setSubmitted]=useState(false),inFlight=useRef(false);
 useEffect(()=>{setSelected(payment?.selectedIds??[]);setSubmitted(false);},[choice.id]);
 const same=JSON.stringify(selected)===JSON.stringify(payment?.selectedIds??[]),disabled=busy||submitted;
 async function send(cancel=false){if(disabled||inFlight.current)return;inFlight.current=true;setSubmitted(true);try{if(await onChoose({type:'choose',choiceId:choice.id,first:cancel?[]:selected,second:[],...(cancel?{answer:false}:{})})===false)setSubmitted(false);}catch{setSubmitted(false);}finally{inFlight.current=false;}}
 return <section className="forge-decision forge-payment" aria-label="Mana-Zahlung"><header><div><small>{choice.source}</small><h2>Mana-Zahlung prüfen</h2></div><button disabled={disabled} onClick={()=>void send(true)}>Wirken abbrechen</button></header>
  {payment?<><p className="forge-payment-cost">Gesamtkosten <strong>{payment.cost||'{0}'}</strong>{payment.commanderTax>0&&<span> · enthält Commander-Tax +{payment.commanderTax}</span>}</p>
   <p>Mana-Pool: {Object.entries(payment.pool).map(([c,n])=>`${c} ×${n}`).join(' · ')||'leer'}</p>
   {payment.error&&<p role="status" className="forge-payment-message">{payment.error}</p>}
   {payment.selectable?<><ol aria-label="Forge-Mana-Vorschlag">{payment.steps.map(step=><li key={step.sourceId}><b>{step.name}</b>{step.cost>0&&<> · benötigt zuerst {step.cost} Mana</>} → {Object.entries(step.produces).map(([c,n])=>`${c} ×${n}`).join(' + ')}</li>)}</ol>{!payment.steps.length&&<p>Die Zahlung verwendet ausschließlich den vorhandenen Mana-Pool.</p>}
    <details><summary>Manaquellen selbst wählen</summary><p>Wähle Quellen für einen neuen Vorschlag. Forge prüft die Auswahl vor der Bezahlung.</p><fieldset disabled={disabled} aria-label="Manaquellen"><legend>Verfügbare Quellen</legend>{choice.options.map(option=><label key={option.id}><input type="checkbox" checked={selected.includes(option.id)} disabled={!selected.includes(option.id)&&selected.length>=(choice.max??64)} onChange={e=>setSelected(ids=>e.target.checked?[...ids,option.id]:ids.filter(id=>id!==option.id))}/>{option.name}</label>)}</fieldset></details>
   </>:<p>Für diese Kosten übernimmt Forge die Quellenwahl nach deiner Bestätigung. Eine eigene Quellenwahl ist für diesen Sonderfall noch nicht verfügbar.</p>}
   <p>Bis zur Bestätigung bleiben Karten, Commander-Tax und Mana unverändert. {payment.selectable?(same?'Nur der angezeigte Vorschlag wird bezahlt.':'Zuerst den geänderten Vorschlag prüfen; dabei wird noch kein Mana bezahlt.'):'Du erlaubst Forge damit die native automatische Quellenwahl.'}</p>
   <button className="primary" disabled={disabled} onClick={()=>void send()}>{submitted?'Forge prüft …':!same?'Geänderte Quellen prüfen':payment.error.startsWith('Diese Quellen')?'Quellen erneut prüfen':'Zahlung bestätigen und wirken'}</button>
  </>:<p role="alert">Zahlungsvorschau fehlt. Brich das Wirken ab und versuche es erneut.</p>}
 </section>;
}
