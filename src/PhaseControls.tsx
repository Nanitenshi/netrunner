import ConfirmEndTurn from './ConfirmEndTurn';
import {ArrowRight} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import type {GameView,GameAction} from '../shared/game';
import {canAutoPass,type AutoPriorityPolicy} from '../shared/auto-priority';
import type {Settings} from './settings';
type Props={view:GameView;seat:string;active:boolean;blocked:boolean;settings:Settings;setSettings:React.Dispatch<React.SetStateAction<Settings>>;dispatch:(action:GameAction)=>void|Promise<boolean>;online?:{connected:boolean;revision:number;combat:boolean;autoPass:(revision:number,policy:AutoPriorityPolicy)=>Promise<boolean>}};
export default function PhaseControls({view,seat,active,blocked,settings,setSettings,dispatch,online}:Props){
 const [confirmEnd,setConfirmEnd]=useState(false);
 useEffect(()=>{setConfirmEnd(false);},[view.turn,view.activePlayer,view.phase,view.rules?.stage]);
 const passInFlight=useRef(false),mode=settings.reactionMode??'always';
 const policy:AutoPriorityPolicy={enabled:true,ownStops:[],opponentStops:[],reactionMode:mode};
 useEffect(()=>{if(!active||blocked||confirmEnd||online&&!online.connected||online?.combat||passInFlight.current||!canAutoPass(view,seat,policy))return;const timer=setTimeout(async()=>{passInFlight.current=true;try{if(online)await online.autoPass(online.revision,policy);else dispatch({type:'pass'});}finally{passInFlight.current=false;}},650);return()=>clearTimeout(timer);},[active,blocked,confirmEnd,view,seat,mode,online?.revision,online?.connected,online?.combat]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!active||blocked||confirmEnd||e.repeat||(e.target as HTMLElement).closest('input,textarea,select')||e.key!=='F8')return;e.preventDefault();const modes=['always','auto','off'] as const;setSettings(s=>({...s,reactionMode:modes[(modes.indexOf(s.reactionMode??'always')+1)%3]}));};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[active,blocked,confirmEnd,setSettings]);
 const r=view.rules,own=view.activePlayer===seat;
 const canEnd=Boolean(r?.stage==='playing'&&own&&!r.lost.includes(seat)&&!r.pending&&!r.resolving&&!r.stack.length&&!online?.combat&&(!online||online.connected));
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!active||blocked||confirmEnd||e.repeat||e.ctrlKey||e.altKey||e.metaKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]'))return;if(e.key==='F6'&&canEnd){e.preventDefault();setConfirmEnd(true);}else if(e.key==='F2'&&r?.priority===seat&&r.stack.length&&!r.pending&&!r.resolving){e.preventDefault();dispatch({type:'pass'});}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[active,blocked,confirmEnd,canEnd,r?.priority,r?.stack.length,r?.pending,r?.resolving,dispatch]);
 const reason=!own?'Du bist nicht am Zug':r?.pending||r?.resolving?'Laufenden Effekt zuerst abschließen':r?.stack.length?'Stack zuerst verrechnen':blocked?'Offenes Fenster zuerst schließen':online&&!online.connected?'Verbindung unterbrochen':'Zug abgeben · F6';
 return <>{confirmEnd&&<ConfirmEndTurn onCancel={()=>setConfirmEnd(false)} onConfirm={()=>canEnd&&!blocked?dispatch({type:'endTurn'}):false}/>}<div className="phase-controls" aria-label="Zugsteuerung"><button title={reason} aria-label="Zug abgeben" disabled={!canEnd||blocked} onClick={()=>setConfirmEnd(true)}><span>Zug abgeben</span><ArrowRight size={24}/></button><div className="reaction-modes" role="group" aria-label="Reaktionen"><span>Reagieren</span>{(['off','always','auto'] as const).map(value=><button key={value} aria-pressed={mode===value} title={value==='off'?'Automatisch passen · F8 wechselt den Modus':value==='always'?'Bei jedem Stack-Objekt auf dich warten':'Bei möglichen Antworten warten. Sonderkosten und Bedingungen manuell prüfen.'} onClick={()=>setSettings(s=>({...s,reactionMode:value}))}>{value==='off'?'Aus':value==='always'?'Immer':'Auto'}</button>)}</div></div></>;
}
