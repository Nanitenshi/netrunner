import {useEffect,useState} from 'react';
import type {ForgeAction,ForgeChoice} from '../shared/forge-protocol';
export default function ForgeDamagePanel({choice,busy,onChoose}:{choice:ForgeChoice;busy:boolean;onChoose:(a:ForgeAction)=>Promise<unknown>}){
 const [values,setValues]=useState<Record<string,number>>({}),[submitted,setSubmitted]=useState(false);
 useEffect(()=>{setValues({});setSubmitted(false);},[choice.id]);
 const total=Object.values(values).reduce((a,b)=>a+b,0),damage=choice.count;
 const change=(id:string,value:number)=>setValues(v=>({...v,[id]:Math.max(0,Math.min(damage-total+(v[id]??0),Math.trunc(value)||0))}));
 async function submit(){setSubmitted(true);const first=choice.options.flatMap(o=>Array(values[o.id]??0).fill(o.id) as string[]);const ok=await onChoose({type:'choose',choiceId:choice.id,first,second:[]});if(ok===false)setSubmitted(false);}
 return <section className="forge-decision forge-damage"><header><div><small>{choice.source}</small><h2>Schaden verteilen</h2><p>{total} / {damage}</p></div><button disabled={busy||submitted||total!==damage} onClick={()=>void submit()}>Schaden bestätigen</button></header>{choice.options.map(o=><label className="forge-damage-row" key={o.id}><span>{o.name}</span><button disabled={busy||submitted} aria-label={`${o.name} Schaden reduzieren`} onClick={()=>change(o.id,(values[o.id]??0)-1)}>−</button><input type="number" min={0} max={damage} aria-label={`${o.name} Schaden`} value={values[o.id]??0} disabled={busy||submitted} onChange={e=>change(o.id,Number(e.target.value))}/><button disabled={busy||submitted} aria-label={`${o.name} Schaden erhöhen`} onClick={()=>change(o.id,(values[o.id]??0)+1)}>+</button></label>)}</section>;
}
