import {useRef,useState} from 'react';
import type {ForgeAction,ForgeCard,ForgeChoice} from '../shared/forge-protocol';
export default function ForgeCombatPanel({choice,cards,ids,busy,onToggle,onSet,onChoose}:{choice:ForgeChoice;cards:ForgeCard[];ids:string[];busy:boolean;onToggle:(id:string)=>void;onSet:(ids:string[])=>void;onChoose:(a:ForgeAction)=>Promise<unknown>}){
 const inFlight=useRef(false),[submitted,setSubmitted]=useState(false);
 const locked=busy||submitted,attack=choice.kind==='attackers';
 const details=(id?:string)=>{const c=cards.find(c=>c.id===id);return c?`${c.name}${c.power!==undefined?` · ${c.power}/${c.toughness}`:''}`:'Kreatur';};
 const groups=[...new Set(choice.options.map(o=>o.cardId))];
 async function submit(){if(locked||inFlight.current)return;inFlight.current=true;setSubmitted(true);try{const result=await onChoose({type:'choose',choiceId:choice.id,first:ids,second:[]});if(result===false)setSubmitted(false);}catch{setSubmitted(false);}finally{inFlight.current=false;}}
 return <section className="forge-combat-controls forge-combat-panel" aria-label={attack?'Angreifer wählen':'Blocker zuweisen'}>
  <header><div><h2>{attack?'Angreifer wählen':'Blocker zuweisen'}</h2><p>{attack?'Kreaturen hier oder auf dem Tisch anklicken. Erst die Bestätigung erklärt den Angriff.':'Wähle für jeden Blocker einen Angreifer. Bei einem normalen Blocker ersetzt ein neues Ziel die bisherige Zuordnung.'}</p></div><button disabled={locked} onClick={()=>void submit()}>{submitted?'Wird bestätigt …':attack?(ids.length?`Angriff bestätigen (${ids.length})`:'Nicht angreifen'):(ids.length?`Blocken bestätigen (${ids.length})`:'Nicht blocken')}</button></header>
  {choice.error&&<p className="forge-combat-error" role="alert">{choice.error}</p>}
  {!choice.options.length&&<p>{attack?'Keine Kreatur kann jetzt angreifen.':'Keine legale Blockzuordnung vorhanden.'}</p>}
  <div className="forge-combat-options">{attack?choice.options.map(o=><button key={o.id} disabled={locked} aria-pressed={ids.includes(o.id)} onClick={()=>onToggle(o.id)}>{details(o.id)}</button>):groups.map(cardId=>{const options=choice.options.filter(o=>o.cardId===cardId),used=options.filter(o=>ids.includes(o.id)).length,capacity=options[0]?.maxBlocks;return <div className="forge-blocker-row" key={cardId}><strong>{details(cardId)} <small>{used}{capacity!==undefined?`/${capacity}`:''} zugewiesen</small></strong><div>{options.map(o=><button key={o.id} disabled={locked||capacity!==undefined&&capacity>1&&used>=capacity&&!ids.includes(o.id)} aria-label={o.name} aria-pressed={ids.includes(o.id)} onClick={()=>onToggle(o.id)}>→ {details(o.targetId)}</button>)}</div></div>;})}</div>
  {choice.options.length>0&&<footer><span>{ids.length} {attack?'Angreifer':'Zuordnungen'} vorgemerkt · noch nicht bestätigt</span>{attack&&<button disabled={locked} onClick={()=>onSet(choice.options.map(o=>o.id))}>Alle angreifen lassen</button>}<button disabled={locked||!ids.length} onClick={()=>onSet([])}>Auswahl leeren</button></footer>}
 </section>;
}
