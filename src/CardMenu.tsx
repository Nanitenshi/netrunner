import {useLayoutEffect,useRef,useState} from 'react';
import {instanceDefinition} from '../shared/card-state';
import {tokenById} from '../shared/tokens';
import LoyaltyControls from './LoyaltyControls';
import {quickCounter} from './direct-play';
import {cardCounters,markerCount} from '../shared/counters';
import {Expand,Layers,RotateCcw,Copy,Plus,Minus,Swords,ArrowRight,ArrowRightLeft,Undo2,SlidersHorizontal} from 'lucide-react';
import type {CardInstance,GameAction,Zone} from '../shared/game';
import {commanderCost,commanderTax} from '../shared/game';
import {cardImage} from './artworks';
import {uuid} from '../shared/id';
const labels:Record<string,string>={hand:'Hand',graveyard:'Friedhof',exile:'Exil',commander:'Kommandozone'};
export default function CardMenu({card,own,playAllowed,playHint,x,y,dispatch,onInspect,onCounter,onPlay,onEdit,onDamage,onClose}:{card:CardInstance;own:boolean;playAllowed:boolean;playHint:string;x:number;y:number;dispatch:(action:GameAction)=>void;onInspect:()=>void;onCounter:()=>void;onPlay:()=>void;onEdit:()=>void;onDamage:()=>void;onClose:()=>void}){
 const data=instanceDefinition(card),field=card.zone==='battlefield',counter=quickCounter(data),count=markerCount(card,counter);
 const root=useRef<HTMLDivElement>(null),[position,setPosition]=useState({x,y}),[step,setStep]=useState('1');
 const valid=step.trim()!==''&&Number.isInteger(Number(step))&&Number(step)>=1&&Number(step)<=999;
 useLayoutEffect(()=>{const fit=()=>{const el=root.current;if(!el)return;const b=el.getBoundingClientRect();setPosition({x:Math.max(8,Math.min(x,innerWidth-b.width-8)),y:Math.max(8,Math.min(y,innerHeight-b.height-8))});};fit();const resize=new ResizeObserver(fit);if(root.current)resize.observe(root.current);window.addEventListener('resize',fit);return()=>{resize.disconnect();window.removeEventListener('resize',fit);};},[x,y,card.id,own]);
 const send=(action:GameAction)=>{dispatch(action);onClose();};
 return <div ref={root} className="context-menu card-action-menu compact-card-menu" role="menu" aria-label={`Aktionen: ${data.name}`} style={{left:position.x,top:position.y}} onClick={e=>e.stopPropagation()}><header><img src={cardImage(data)} alt=""/><div><b>{data.name}</b><small>{data.type}</small></div></header>
 <div className="card-menu-grid"><button aria-label="Ansehen" onClick={onInspect}><Expand size={18}/><span>Ansehen</span><kbd>Space</kbd></button>
 {!tokenById.has(data.id)&&<button onClick={()=>{window.dispatchEvent(new CustomEvent('nexus-token-source',{detail:card.cardId}));onClose();}}><Plus size={18}/><span>Passende Token</span></button>}
 {field&&<>{!own&&<button aria-label="Kontrolle übernehmen" className="card-primary-action" onClick={()=>send({type:'control',cardId:card.id,mode:'take'})}><ArrowRightLeft size={18}/><span>Übernehmen</span></button>}{own&&card.ownerId!==card.controllerId&&<button aria-label="An Besitzer zurückgeben" onClick={()=>send({type:'control',cardId:card.id,mode:'return'})}><Undo2 size={18}/><span>Zurückgeben</span></button>}<button aria-label="Token-Kopie erzeugen" disabled={card.faceDown} title={card.faceDown?'Verdeckte Karten zuerst aufdecken':''} onClick={()=>send({type:'copy',cardId:card.id,newId:uuid()})}><Copy size={18}/><span>Kopie</span>{own&&<kbd>C</kbd>}</button></>}
 {card.isCommander&&<button className="card-damage-action" onClick={onDamage}><Swords size={18}/><span>Schaden erfassen</span></button>}
 {own&&<>{(card.zone==='hand'||card.zone==='commander')&&<button className="card-primary-action" disabled={!playAllowed} title={playHint} onClick={onPlay}><Swords size={18}/><span>{data.type.includes('Land')?'Land spielen':card.isCommander&&card.zone==='commander'?`Wirken · ${commanderCost(data.mana,commanderTax(card))}`:'Wirken'}</span></button>}{field&&<>{data.type.includes('Creature')&&<button aria-label="Kampf markieren" onClick={()=>{window.dispatchEvent(new CustomEvent('nexus-table-tools',{detail:{ids:[card.id],tab:'combat'}}));onClose();}}><Swords size={18}/><span>Kampf</span></button>}<button aria-label="Zeitlichen Effekt hinzufügen" onClick={()=>{window.dispatchEvent(new CustomEvent('nexus-table-tools',{detail:{ids:[card.id],tab:'effects'}}));onClose();}}><Plus size={18}/><span>Effekt</span></button><button aria-label="Karte bearbeiten" onClick={onEdit}><SlidersHorizontal size={18}/><span>Bearbeiten</span></button><button aria-label={card.tapped?'Enttappen':'Tappen'} onClick={()=>send({type:'tap',cardId:card.id})}><RotateCcw size={18}/><span>{card.tapped?'Enttappen':'Tappen'}</span><kbd>T</kbd></button></>}<button aria-label="Counter" onClick={onCounter}><Layers size={18}/><span>Counter</span><kbd>M</kbd></button></>}
 </div>
 {own&&field&&<LoyaltyControls card={card} dispatch={dispatch}/>}
 {own&&field&&<div className="card-quick-counters"><label>{cardCounters[counter].name}<input aria-label="Schnellcounter Menge" type="number" min="1" max="999" value={step} onChange={e=>setStep(e.target.value)}/></label><button aria-label="Schnellcounter entfernen" disabled={!count||!valid} onClick={()=>dispatch({type:'cardCounter',cardId:card.id,counter,amount:-Math.min(count,Number(step))})}><Minus size={16}/></button><b>{count}</b><button aria-label="Schnellcounter hinzufügen" disabled={!valid||count>=999} onClick={()=>dispatch({type:'cardCounter',cardId:card.id,counter,amount:Math.min(999-count,Number(step))})}><Plus size={16}/></button></div>}
 {own&&<label className="card-zone-action"><ArrowRight size={16}/> Verschieben<select aria-label="Kartenmenü: Zielzone" value="" onChange={e=>send({type:'move',cardId:card.id,zone:e.target.value as Zone})}><option value="" disabled>Zone wählen</option>{Object.entries(labels).filter(([zone])=>zone!==card.zone&&(zone!=='commander'||card.isCommander)).map(([zone,name])=><option key={zone} value={zone}>{name}</option>)}</select></label>}
 </div>;
}
