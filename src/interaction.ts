import {faceDefinition} from '../shared/card-state.ts';
import {landPlayAllowance} from '../shared/land-plays.ts';
import type {CardDefinition,CardInstance,GameView} from '../shared/game';
export function playWindow(view:GameView,seat:string,card:CardInstance,data:CardDefinition,faceIndex?:number):{allowed:boolean;reason:string}{
 if(faceIndex===undefined&&data.layout==='modal_dfc'){
  const choices=data.faces.map((_,i)=>playWindow(view,seat,card,data,i));return choices.find(c=>c.allowed)??choices[0];
 }
 const r=view.rules,face=faceDefinition(data,faceIndex??0);
 if(card.ownerId!==seat||card.controllerId!==seat||!['hand','commander'].includes(card.zone))return {allowed:false,reason:'Aus eigener Hand oder Kommandozone spielen.'};
 if(!r||r.stage!=='playing')return {allowed:false,reason:r?.stage==='finished'?'Diese Partie ist beendet.':'Zuerst die Starthände behalten.'};
 if(r.pending||r.resolving)return {allowed:false,reason:'Die laufende Auswahl oder Verrechnung zuerst abschließen.'};
 if(face.type.includes('Land')&&r.priority!==seat)return {allowed:false,reason:'Land spielen benötigt deine Priorität.'};
 if(r.priority!==seat&&!(r.turnOnly&&!r.stack.length))return {allowed:false,reason:'Du benötigst Priorität.'};
 const main=view.activePlayer===seat&&[3,9].includes(view.phase)&&r.stack.length===0;
 if(face.type.includes('Land')){const lands=landPlayAllowance(view,seat);return {allowed:main&&card.zone==='hand'&&lands.remaining>0,reason:!main?'Land nur in deinem Zug bei leerem Stack.':lands.remaining>0?`Land spielen · ${lands.remaining} frei.`:'Alle Landspiele verbraucht. Weitere unter „Landspiele“ freigeben.'};}
 if(data.faces.length&&!face.mana)return {allowed:false,reason:'Diese Vorderseite hat keine bezahlbaren Manakosten.'};
 const allowed=main||face.type.includes('Instant')||/(^|\n)Flash\b/.test(face.text);
 return {allowed,reason:allowed?'Zeitpunkt passt. Kosten, Einschränkungen und Ziele prüfen.':r.turnOnly?'Nur in deinem Zug bei leerem Stack.':'Dieser Spruch benötigt deine Hauptphase und einen leeren Stack.'};
}
