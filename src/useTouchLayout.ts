import {useEffect,useState} from 'react';
/** Coarse-pointer layout survives rotating a phone into a wide landscape viewport. */
export function useTouchLayout(){
 const [touch,setTouch]=useState(()=>window.matchMedia('(pointer: coarse)').matches);
 const [height,setHeight]=useState(()=>window.visualViewport?.height??window.innerHeight);
 useEffect(()=>{const media=window.matchMedia('(pointer: coarse)'),update=()=>{setTouch(media.matches);setHeight(window.visualViewport?.height??window.innerHeight);};media.addEventListener('change',update);window.addEventListener('resize',update);window.visualViewport?.addEventListener('resize',update);return()=>{media.removeEventListener('change',update);window.removeEventListener('resize',update);window.visualViewport?.removeEventListener('resize',update);};},[]);
 return {touch,height};
}
