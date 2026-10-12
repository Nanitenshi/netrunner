import {Link2,Unlink} from 'lucide-react';
import type {CardInstance,GameAction,GameView} from '../shared/game';
export default function EffectSourceTags({card,view,seat,dispatch,onInspect}:{card:CardInstance;view:GameView;seat:string;dispatch:(a:GameAction)=>void;onInspect?:(c:CardInstance)=>void}){
 if(!card.effectLinks?.length)return null;
 return <div className="effect-source-tags">{card.effectLinks.map(link=>{
  const source=view.cards.find(c=>c.id===link.sourceId&&c.cardId!=='hidden-card'&&(c.incarnation??0)===link.sourceIncarnation),actor=view.players.find(p=>p.id===(link.causedById??link.actorId));
  return <span key={link.id} className="effect-source-tag" title={`${link.label} · ${link.sourceName} · ${actor?.name??'Spieler'} · Zug ${link.turn}${link.sourceId&&!source?' · ursprüngliche Quelle nicht mehr vorhanden':''}`}><button className="effect-source-inspect" disabled={!source||!onInspect} onClick={()=>source&&onInspect?.(source)}><Link2 size={12}/><span><b>{link.sourceName==='Manueller Effekt'?link.label:link.sourceName}</b><small>{link.sourceName==='Manueller Effekt'?'':`${link.label} · `}{actor?.name??'Spieler'}{link.sourceId&&!source?' · frühere Quelle':''}</small></span></button>{(link.actorId===seat||card.ownerId===seat||card.controllerId===seat)&&<button aria-label={`Verknüpfung ${link.sourceName} lösen`} onClick={()=>dispatch({type:'effectLink',cardIds:[card.id],removeId:link.id})}><Unlink size={12}/></button>}</span>;
 })}</div>;
}
