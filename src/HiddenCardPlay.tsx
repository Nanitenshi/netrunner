import {useState} from 'react';
import SpellTargets,{needsSpellTarget} from './SpellTargets';
import type {CardInstance,GameAction,GameView} from '../shared/game';
export default function HiddenCardPlay({card,view,dispatch}:{card:CardInstance;view:GameView;dispatch:(a:GameAction)=>void}){
 const [confirmed,setConfirmed]=useState(false),[target,setTarget]=useState('');
 const r=view.rules,allowed=r?.stage==='playing'&&!r.pending&&!r.resolving&&(r.priority===(card.exilePlayer??card.controllerId)||r.turnOnly&&!r.stack.length);
 return <div className="hidden-card-play"><label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> {card.exilePlayer?'Spielberechtigung gilt; Kosten bezahlt.':'Hideaway-Bedingung erfüllt; Aktivierung und Zusatzkosten bezahlt.'}</label><SpellTargets card={card} view={view} value={target} onChange={setTarget}/><button disabled={!allowed||!confirmed||needsSpellTarget(card)&&!target} onClick={()=>dispatch({type:'castHidden',cardId:card.id,conditionsMet:true,costsPaid:true,...(target?{targetId:target}:{})})}>{card.exilePlayer?'Aus dem Exil spielen':'Hideaway-Karte spielen'}</button></div>;
}
