import type {GameState} from './game.ts';
import {enterZone,freePosition} from './placement.ts';
export function removePlayerObjects(s:GameState,actor:string){
 const lost=new Set(s.rules?.lost??[actor]);lost.add(actor);
 s.cards=s.cards.filter(c=>c.ownerId!==actor);
 for(const c of s.cards){
  if(c.controllerId===actor){const previous=[...(c.controlHistory??[])].reverse().find(id=>!lost.has(id)),base=c.baseControllerId??c.ownerId;
   const controller=previous??(!lost.has(base)?base:undefined);
   if(controller){c.controllerId=controller;if(c.zone==='battlefield')c.position=freePosition(s,c);}else enterZone(s,c,'exile');
   delete c.combat;
  }
  c.controlHistory=c.controlHistory?.filter(id=>!lost.has(id));
  if(c.exilePlayer===actor)delete c.exilePlayer;
  c.hiddenFor=c.hiddenFor?.filter(id=>!lost.has(id));
 }
 s.deckAccess=s.deckAccess?.filter(g=>!lost.has(g.viewer)&&!lost.has(g.playerId));
 s.libraryReaders=s.libraryReaders?.filter(id=>!lost.has(id));
 s.tableTrackers=s.tableTrackers?.filter(t=>!lost.has(t.ownerId));
 s.tableEdits=[];
 const r=s.rules;if(!r)return;
 r.stack=r.stack.filter(i=>!lost.has(i.controllerId)&&(!i.cardId||s.cards.some(c=>c.id===i.cardId)));
 if(r.resolving?.kind==='spell'&&r.resolving.cardId&&!s.cards.some(c=>c.id===r.resolving!.cardId)){r.resolving=null;r.pending=null;r.priority=s.activePlayer;}
 if(r.pending)r.pending.cardIds=r.pending.cardIds.filter(id=>s.cards.some(c=>c.id===id));
}
