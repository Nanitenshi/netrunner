import {useEffect,useRef,useState} from 'react';
import type {ForgeAction,ForgeChoice} from '../shared/forge-protocol';
import {forgeDamageError} from './forge-combat';
export default function ForgeDamagePanel({choice,busy,onChoose}:{choice:ForgeChoice;busy:boolean;onChoose:(a:ForgeAction)=>Promise<unknown>}){
 const [values,setValues]=useState<Record<string,number>>(()=>choice.damage?.suggested??{}),[submitted,setSubmitted]=useState(false);
 const inFlight=useRef(false);
 useEffect(()=>{setValues(choice.damage?.suggested??{});setSubmitted(false);},[choice.id]);
 const total=Object.values(values).reduce((a,b)=>a+b,0),damage=choice.count;
 const change=(id:string,value:number)=>setValues(v=>({...v,[id]:Math.max(0,Math.min(damage-total+(v[id]??0),Math.trunc(value)||0))}));
 const error=forgeDamageError(choice,values);
 async function submit(){if(busy||submitted||inFlight.current||error)return;inFlight.current=true;setSubmitted(true);try{const first=choice.options.flatMap(o=>Array(values[o.id]??0).fill(o.id) as string[]);const ok=await onChoose({type:'choose',choiceId:choice.id,first,second:[]});if(ok===false)setSubmitted(false);}catch{setSubmitted(false);}finally{inFlight.current=false;}}
 return <section className="forge-decision forge-damage" aria-label="Kampfschaden"><header><div><small>{choice.source}</small><h2>Schaden verteilen</h2><p>{total} / {damage} zugewiesen</p></div><button disabled={busy||submitted||Boolean(error)} onClick={()=>void submit()}>{submitted?'Wird bestätigt …':'Schaden bestätigen'}</button></header>
 {choice.damage&&<><p>Forge schlägt tödliche Zuweisungen an die Kreaturen vor{choice.damage.trample?' und weist den Rest als Trampelschaden zu':''}. Übernimm den Vorschlag oder ändere die Werte. Schadensverhinderung und Ersatzeffekte folgen erst bei der Verrechnung.</p><button disabled={busy||submitted} onClick={()=>setValues({...choice.damage!.suggested})}>Vorschlag wiederherstellen</button></>}
 {choice.error&&<p className="forge-combat-error" role="alert">{choice.error}</p>}{error&&<p role="status">{error}</p>}
 {choice.options.map(o=><label className="forge-damage-row" key={o.id}><span>{o.name}{choice.damage?.lethal[o.id]!==undefined&&<small>Für tödliche Zuweisung: {choice.damage.lethal[o.id]}</small>}</span><button disabled={busy||submitted||(values[o.id]??0)===0} aria-label={`${o.name} Schaden reduzieren`} onClick={()=>change(o.id,(values[o.id]??0)-1)}>−</button><input type="number" min={0} max={damage} aria-label={`${o.name} Schaden`} value={values[o.id]??0} disabled={busy||submitted} onChange={e=>change(o.id,Number(e.target.value))}/><button disabled={busy||submitted||total===damage} aria-label={`${o.name} Schaden erhöhen`} onClick={()=>change(o.id,(values[o.id]??0)+1)}>+</button></label>)}</section>;
}
