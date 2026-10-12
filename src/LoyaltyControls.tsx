import {useState} from 'react';
import {instanceDefinition} from '../shared/card-state';
import {loyaltyCosts,loyaltyDelta} from '../shared/loyalty';
import {markerCount} from '../shared/counters';
import type {CardInstance,GameAction} from '../shared/game';
import './loyalty.css';
export default function LoyaltyControls({card,dispatch}:{card:CardInstance;dispatch:(a:GameAction)=>void}){
 const [x,setX]=useState('0'),d=instanceDefinition(card),costs=loyaltyCosts(d),count=markerCount(card,'loyalty');
 if(card.zone!=='battlefield'||card.faceDown||!d.type.includes('Planeswalker'))return null;
 const valid=/^\d{1,3}$/.test(x);
 return <div className="loyalty-controls" aria-label="Loyalität"><b>◆ {count}</b>{costs.some(c=>c.cost.includes('X'))&&<label>X <input aria-label="Loyalität X" type="number" min="0" max="999" value={x} onChange={e=>setX(e.target.value)}/></label>}{costs.map((c,index)=>{const delta=loyaltyDelta(c.cost,valid?Number(x):0);return <button key={index} title={`${c.text}\nNur Loyalität ändern`} aria-label={`Loyalitätskosten ${c.cost}`} disabled={!valid||count+delta<0||count+delta>999} onClick={()=>dispatch({type:'loyaltyCost',cardId:card.id,index,x:Number(x)})}>{c.cost.replace('-','−')}</button>;})}<small>Nur Marken</small></div>;
}
