import {createContext,useContext,useState,type ReactNode} from 'react';
import type {CardDefinition} from '../shared/cards';
export interface ArtworkChoice {id:string;image:string;art:string|null;label:string;artist:string;faces?:{image:string;art:string|null}[]}
export const safeArtworkURL=(value:unknown):value is string=>{if(typeof value!=='string')return false;try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['cards.scryfall.io','images.scryfall.io'].includes(u.hostname);}catch{return false;}};
let selections:Record<string,ArtworkChoice>={};
try{const data=JSON.parse(localStorage.getItem('batusmtg.artworks')??'{}');if(data&&typeof data==='object'&&!Array.isArray(data))for(const [key,value] of Object.entries(data).slice(0,2000)){const a=value as ArtworkChoice;if(typeof a?.id==='string'&&safeArtworkURL(a.image)&&(a.art===null||safeArtworkURL(a.art))&&typeof a.label==='string'&&typeof a.artist==='string'){if(a.faces&&(!Array.isArray(a.faces)||!a.faces.every(f=>f&&safeArtworkURL(f.image)&&(f.art===null||safeArtworkURL(f.art)))))delete a.faces;selections[key]=a;}}}catch{}
export const cardImage=(card:CardDefinition)=>card.displayFace?selections[card.id]?.faces?.[card.displayFace]?.image??card.image:selections[card.id]?.image??card.image;
export const cardArt=(card:CardDefinition)=>card.displayFace?selections[card.id]?.faces?.[card.displayFace]?.art??card.art??cardImage(card):selections[card.id]?.art??card.art??cardImage(card);
const ArtContext=createContext({version:0,choose:(_cardId:string,_choice:ArtworkChoice|null)=>{},error:''});
export function ArtworkProvider({children}:{children:ReactNode}){
 const [version,setVersion]=useState(0),[error,setError]=useState('');
 const choose=(cardId:string,choice:ArtworkChoice|null)=>{if(choice&&!safeArtworkURL(choice.image))return;const next={...selections};if(choice)next[cardId]=choice;else delete next[cardId];try{localStorage.setItem('batusmtg.artworks',JSON.stringify(next));setError('');}catch{setError('Artwork bleibt für diese Sitzung aktiv; Speichern auf diesem Gerät ist fehlgeschlagen.');}selections=next;setVersion(v=>v+1);};
 return <ArtContext.Provider value={{version,choose,error}}>{children}</ArtContext.Provider>;
}
export const useArtwork=()=>useContext(ArtContext);
