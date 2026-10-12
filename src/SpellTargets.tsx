import type {CardInstance,GameView} from '../shared/game';
import {instanceDefinition} from '../shared/card-state';
import {definition} from './seed';
export const needsSpellTarget=(card:CardInstance)=>['Counterspell','Swords to Plowshares'].includes(definition(card.cardId).name);
export default function SpellTargets({view,card,value,onChange,onConfirm}:{view:GameView;card:CardInstance;value:string;onChange:(value:string)=>void;onConfirm?:(value:string)=>void}){
 const name=definition(card.cardId).name;
 const options=name==='Counterspell'?view.rules!.stack.filter(i=>i.kind==='spell').map(i=>({id:i.id,label:i.label})):name==='Swords to Plowshares'?view.cards.filter(c=>c.zone==='battlefield'&&instanceDefinition(c).type.includes('Creature')).map(c=>({id:c.id,label:`${definition(c.cardId).name} · ${view.players.find(p=>p.id===c.controllerId)?.name}`})):[];
 if(!needsSpellTarget(card))return null;
 if(onConfirm)return <div className="direct-targets" aria-label="Ziel wählen und wirken"><small>Ziel anklicken</small>{options.length?options.map(o=><button key={o.id} aria-label={`${o.label} als Ziel wählen und wirken`} onClick={()=>onConfirm(o.id)}>{o.label}</button>):<span>Kein gültiges Ziel</span>}</div>;
 return <label>Ziel<select aria-label="Ziel des Spruchs" value={value} onChange={e=>onChange(e.target.value)}><option value="">Ziel auswählen …</option>{options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select></label>;
}
