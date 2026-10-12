import type {CardInstance,GameState} from './game.ts';
import {enterZone,freePosition} from './placement.ts';
import {catalogueById} from './catalogue.ts';
export interface DeckAccess {viewer:string;playerId:string;cardIds:string[];public:boolean;order:string[]}
export type DeckAction={type:'deckAction';operation:'look'|'reveal'|'search'|'mill'|'exile'|'stealExile'|'take'|'hand'|'bottom'|'close'|'clash';playerId:string;count?:number;cardIds?:string[]};
export function projectDeckAccess(s:GameState,viewer:string):CardInstance[]{
 const ids=new Set((s.deckAccess??[]).filter(a=>(a.public||a.viewer===viewer)&&a.order?.join('|')===s.cards.filter(c=>c.ownerId===a.playerId&&c.zone==='library').map(c=>c.id).join('|')).flatMap(a=>a.cardIds));
 return s.cards.filter(c=>c.zone==='library'&&ids.has(c.id));
}
export function applyDeckAction(state:GameState,actor:string,a:DeckAction):GameState{
 const s=structuredClone(state),player=s.players.find(p=>p.id===a.playerId),who=s.players.find(p=>p.id===actor);
 if(!player||!who)throw Error('Unbekannter Spieler');
 if(a.operation==='close'){s.deckAccess=(s.deckAccess??[]).filter(g=>g.viewer!==actor);return s;}
 if(s.rules&&(s.rules.stage!=='playing'||s.rules.lost.includes(actor)||(s.rules.pending||s.rules.resolving)&&!(s.rules.pending?.kind==='manual'&&s.rules.pending.ownerId===actor)))throw Error('Laufende Auswahl zuerst abschließen');
 const deck=s.cards.filter(c=>c.ownerId===a.playerId&&c.zone==='library'),n=a.count??1;
 if(!Number.isInteger(n)||n<1||n>100)throw Error('1–100 Karten wählen');
 s.deckAccess??=[];
 const grant=(id:string,cards:CardInstance[],publicly=false)=>{s.deckAccess=s.deckAccess!.filter(g=>g.viewer!==actor||g.playerId!==id);s.deckAccess.push({viewer:actor,playerId:id,cardIds:cards.map(c=>c.id),public:publicly,order:s.cards.filter(c=>c.ownerId===id&&c.zone==='library').map(c=>c.id)});};
 let message='';
 
 if(a.operation==='look'||a.operation==='reveal'||a.operation==='search'){
  const cards=a.operation==='search'?deck:deck.slice(0,n);grant(a.playerId,cards,a.operation==='reveal');
  message=`${who.name}: ${player.name}s Bibliothek · ${a.operation==='search'?'durchsuchen':a.operation==='look'?`${cards.length} oben ansehen`:`${cards.length} oben aufdecken`}.`;
 }else if(a.operation==='clash'){
  if(actor===a.playerId)throw Error('Einen Gegner für Clash wählen');
  const own=s.cards.find(c=>c.ownerId===actor&&c.zone==='library'),other=deck[0];
  if(!own||!other)throw Error('Für Clash brauchen beide Bibliotheken eine Karte');
  grant(actor,[own],true);grant(a.playerId,[other],true);
  const x=catalogueById.get(own.cardId)!,y=catalogueById.get(other.cardId)!;
  message=`Clash · ${who.name}: ${x.name} (${x.manaValue}) · ${player.name}: ${y.name} (${y.manaValue}) · ${x.manaValue===y.manaValue?'Gleichstand':`${x.manaValue>y.manaValue?who.name:player.name} gewinnt`}. Beide können ihre aufgedeckte Karte unter die eigene Bibliothek legen.`;
 }else{
  const ids=a.cardIds;
  const chosen=ids?deck.filter(c=>ids.includes(c.id)):deck.slice(0,n);
  if(ids&&(new Set(ids).size!==ids.length||chosen.length!==ids.length||!ids.length||!ids.every(id=>projectDeckAccess(s,actor).some(c=>c.id===id))))throw Error('Nur zuvor angesehene oder aufgedeckte Karten auswählen');
  if(['stealExile','take','hand','bottom'].includes(a.operation)&&!ids)throw Error('Karten zuerst ansehen oder aufdecken');
  if(a.operation==='hand'&&a.playerId!==actor)throw Error('Fremde Karten bleiben beim Besitzer; zum Stehlen unter eigener Kontrolle aufs Feld legen');
  if(a.operation==='bottom'){
   if(!chosen.every(c=>deck.slice(0,chosen.length).includes(c)))throw Error('Nur die obersten Karten unter das Deck legen');
   const selected=new Set(chosen.map(c=>c.id));s.cards=[...s.cards.filter(c=>!selected.has(c.id)),...chosen];
  }else for(const c of chosen){enterZone(s,c,a.operation==='take'?'battlefield':a.operation==='hand'?'hand':a.operation==='mill'?'graveyard':'exile');if(a.operation==='take'){c.controllerId=actor;c.baseControllerId=actor;c.position=freePosition(s,c);}if(a.operation==='stealExile'){c.exilePlayer=actor;c.faceDown=true;c.hiddenFor=[actor];}}
  s.deckAccess=s.deckAccess.filter(g=>g.playerId!==a.playerId);
  message=`${who.name}: ${chosen.length} Karte(n) aus ${player.name}s Bibliothek · ${a.operation==='stealExile'?'verdeckt ins Exil mit Spielberechtigung':a.operation==='take'?'unter eigener Kontrolle aufs Spielfeld':a.operation==='hand'?'auf die Hand':a.operation==='mill'?'gemillt':a.operation==='bottom'?'nach unten gelegt':'ins Exil'}.`;
 }
 s.log=[...s.log,message].slice(-200);return s;
}
