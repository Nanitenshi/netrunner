import {createPortal} from 'react-dom';
import {useState,useEffect} from 'react';
import type {GameState} from '../shared/game';
export default function MatchMenu({game,seat,onHome,onConcede,online,onVisibilityChange}:{onVisibilityChange?:(open:boolean)=>void;game:GameState;seat:string;onHome:()=>void;onConcede:()=>void;online?:{isHost:boolean;leave:()=>Promise<unknown>;finish:()=>Promise<unknown>}}){
 const [open,setOpen]=useState(false),[confirm,setConfirm]=useState<null|'concede'|'leave'|'finish'>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{onVisibilityChange?.(open);return()=>onVisibilityChange?.(false);},[open,onVisibilityChange]);
 const lost=game.rules?.lost.includes(seat),finished=game.rules?.stage==='finished';
 async function run(){setBusy(true);try{if(confirm==='concede')onConcede();if(confirm==='leave'){if(online){const result=await online.leave();if(result===false)return;}else if(!lost&&!finished)onConcede();onHome();}if(confirm==='finish'&&online)await online.finish();setConfirm(null);setOpen(false);}finally{setBusy(false);}}
 return <><button className="arena-exit" onClick={()=>setOpen(true)}>Partie</button>{open&&createPortal(<div className="match-backdrop" onClick={()=>{if(!busy){setOpen(false);setConfirm(null);}}}><section className="match-menu" role="dialog" aria-modal="true" aria-label="Partiemenü" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'&&!busy){setOpen(false);setConfirm(null);}}}>
 <button className="match-close" autoFocus aria-label="Partiemenü schließen" disabled={busy} onClick={()=>{setOpen(false);setConfirm(null);}}>×</button><h2>{finished?'Partie beendet':lost?'Du bist ausgeschieden':'Partie'}</h2>
 {confirm?<><p>{confirm==='concede'?'Aufgeben? Du kannst anschließend weiter zusehen.':confirm==='leave'?(lost||finished?'Partie verlassen?':'Aufgeben und die Partie verlassen? Dein Platz wird freigegeben.'):'Die Partie für alle beenden und zur Lobby zurückkehren?'}</p><button disabled={busy} onClick={()=>void run()}>{busy?'Bitte warten …':'Bestätigen'}</button><button disabled={busy} onClick={()=>setConfirm(null)}>Zurück</button></>:<><button onClick={()=>{setOpen(false);onHome();}}>Hauptmenü</button><small>Dein Platz bleibt reserviert.</small>{!lost&&!finished&&<button onClick={()=>setConfirm('concede')}>Aufgeben</button>}<button onClick={()=>setConfirm('leave')}>{lost||finished?'Partie verlassen':'Aufgeben & verlassen'}</button>{online?.isHost&&<button onClick={()=>setConfirm('finish')}>Partie für alle beenden</button>}</>}
 </section></div>,document.body)}</>;
}
