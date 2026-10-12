import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {GameView} from '../shared/game';
export default function GameActivity({view,active}:{view:GameView;active:boolean}){
 const previous=useRef(view.log),[event,setEvent]=useState<{text:string;id:number}|null>(null);
 useEffect(()=>{
  const changed=previous.current!==view.log&&JSON.stringify(previous.current)!==JSON.stringify(view.log);previous.current=view.log;
  if(!active){setEvent(null);return;}
  if(changed&&view.log.at(-1))setEvent({text:view.log.at(-1)!,id:Date.now()});
 },[view.log,active]);
 useEffect(()=>{if(!event)return;const timer=setTimeout(()=>setEvent(null),3300);return()=>clearTimeout(timer);},[event]);
 return event?<div key={event.id} className="game-activity" role="status"><Sparkles size={16}/><div><small>AM TISCH</small><span>{event.text}</span></div></div>:null;
}
