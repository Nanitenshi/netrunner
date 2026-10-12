import {useEffect,useRef} from 'react';

// Only transient table menus coordinate here. Closing a choice never cancels it.
export function useTablePanel(id:string,open:boolean,close:()=>void,selector:string){
 const latest=useRef(close);latest.current=close;
 useEffect(()=>{
  if(!open)return;
  window.dispatchEvent(new CustomEvent('nexus-table-panel',{detail:id}));
  const other=(event:Event)=>{if((event as CustomEvent<string>).detail!==id)latest.current();};
  const outside=(event:PointerEvent)=>{const target=event.target;if(target instanceof Element&&!target.closest(`${selector},[role=dialog],.scrim`))latest.current();};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!document.querySelector('[role=dialog]'))latest.current();};
  window.addEventListener('nexus-table-panel',other);
  document.addEventListener('pointerdown',outside);
  document.addEventListener('keydown',escape);
  return()=>{window.removeEventListener('nexus-table-panel',other);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[id,open,selector]);
}
