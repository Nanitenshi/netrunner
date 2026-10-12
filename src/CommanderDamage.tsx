import {useState} from 'react';
import {Swords,Plus,Minus} from 'lucide-react';
import type {GameAction,GameView,Player} from '../shared/game';
import {definition} from './seed';
import {cardImage} from './artworks';

export default function CommanderDamage({player,view,dispatch,initialSource}:{player:Player;view:GameView;dispatch:(a:GameAction)=>void;initialSource?:string}){
 const entries=new Map((player.commanderDamage??[]).map(d=>[d.commanderId,d]));
 view.cards.filter(c=>c.isCommander).forEach(c=>{if(!entries.has(c.id))entries.set(c.id,{commanderId:c.id,ownerId:c.ownerId,name:definition(c.cardId).name,amount:0});});
 const sources=[...entries.values()], [selected,setSelected]=useState(initialSource??''),[amount,setAmount]=useState('1'),[adjustLife,setAdjustLife]=useState(false),[lethal,setLethal]=useState<number|null>(null);
 const source=sources.find(s=>s.commanderId===selected)??sources.find(s=>s.ownerId!==player.id)??sources[0];
 const valid=amount.trim()!==''&&Number.isInteger(Number(amount))&&Number(amount)>=1&&Number(amount)<=100;
 const change=(delta:number)=>{if(!source||!valid)return;if(source.amount+delta>=21&&delta>0){setLethal(delta);return;}dispatch({type:'commanderDamage',commanderId:source.commanderId,amount:delta,adjustLife});setLethal(null);};
 return <section className="commander-damage" aria-label="Commander-Schaden"><header><Swords size={19}/><div><h3>Commander-Schaden</h3><p>Erhaltener Kampfschaden · jeder Commander zählt getrennt.</p></div></header>
  <div className="damage-source-grid">{sources.map(s=>{const c=view.cards.find(c=>c.id===s.commanderId),d=c?definition(c.cardId):null;return <button key={s.commanderId} aria-label={`Schaden von ${s.name}`} aria-pressed={source?.commanderId===s.commanderId} onClick={()=>{setSelected(s.commanderId);setLethal(null);}}>{d&&<img src={cardImage(d)} alt=""/>}<span><b>{s.name}</b><small>{view.players.find(p=>p.id===s.ownerId)?.name}</small></span><strong>{s.amount}<small>/21</small></strong></button>;})}</div>
  <div className="damage-amount"><label>Menge<input aria-label="Commander-Schadensänderung" type="number" min="1" max="100" value={amount} onChange={e=>{setAmount(e.target.value);setLethal(null);}}/></label><div className="tracking-presets">{[1,5,10].map(n=><button key={n} aria-pressed={Number(amount)===n} onClick={()=>{setAmount(String(n));setLethal(null);}}>{n}</button>)}</div></div>
  <label className="damage-life"><input type="checkbox" checked={adjustLife} onChange={e=>{setAdjustLife(e.target.checked);setLethal(null);}}/> Leben entsprechend mitändern</label>
  <div className="damage-adjust"><button aria-label="Commander-Schaden entfernen" disabled={!source?.amount||!valid} onClick={()=>change(-Math.min(source?.amount??0,Number(amount)))}><Minus size={17}/> Entfernen</button><output>{source?.amount??0}<small>/21</small></output><button aria-label="Commander-Schaden hinzufügen" disabled={!source||!valid} onClick={()=>change(Number(amount))}><Plus size={17}/> Schaden</button></div>
  {lethal!==null&&source&&<div className="damage-lethal-confirm" role="status"><p>{source.amount+lethal}/21 durch {source.name}: Diese Eintragung beendet deine Teilnahme.</p><button onClick={()=>{dispatch({type:'commanderDamage',commanderId:source.commanderId,amount:lethal,adjustLife});setLethal(null);}}>Eintragen und ausscheiden</button><button onClick={()=>setLethal(null)}>Abbrechen</button></div>}
  <p className="counter-manual">Kampfschaden am Tisch eintragen. Lebensgewinn entfernt ihn nicht. Eine Kopie ist kein Commander; ein übernommener Commander bleibt dieselbe Schadensquelle.</p>
 </section>;
}
