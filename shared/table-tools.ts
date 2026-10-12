import type {CardInstance,GameState} from './game.ts';
import {instanceDefinition} from './card-state.ts';
import {enterZone} from './placement.ts';
import {recordEffectLink,resolvingSource} from './effect-links.ts';
import {uuid} from './id.ts';
import {settle,castLinkedSpellCopy} from './engine.ts';
export interface CombatMark {kind:'attack'|'block';targetId:string;targetVersion?:number;turn:number}
export interface TimedEffect {id:string;actorId:string;label:string;duration:'turn'|'source'|'manual';turn:number;sourceId?:string;sourceVersion?:number;targets:{id:string;version:number}[];power:number;toughness:number}
export interface TableEdit {id:string;actorId:string;label:string;turn:number;before:CardInstance[];after:CardInstance[];beforeEffects:TimedEffect[];afterEffects:TimedEffect[]}
export type TableToolAction=
 {type:'batchCards';cardIds:string[];operation:'tap'|'untap'|'sacrifice'|'hand'|'exile'}|
 {type:'combat';cardIds:string[];operation:'attack'|'block'|'remove'|'end';targetId?:string}|
 {type:'timedEffect';cardIds:string[];label:string;duration:TimedEffect['duration'];sourceId?:string;power:number;toughness:number}|
 {type:'endEffect';effectId:string}|
 {type:'linkedCards';sourceId:string;operation:'hand'|'battlefield'|'copy'|'spellCopy';targetId?:string;cardIds:string[]}|
 {type:'undoTableEdit';editId:string;reason:string};
export function cleanTableTools(s:GameState){
 const lost=s.rules?.lost??[],byId=new Map(s.cards.map(c=>[c.id,c]));
 const validTarget=(id:string,version:number)=>{const c=byId.get(id);return c?.zone==='battlefield'&&(c.incarnation??0)===version;};
 s.timedEffects=(s.timedEffects??[]).filter(e=>!lost.includes(e.actorId)&&(e.duration!=='turn'||e.turn===s.turn)&&(e.duration!=='source'||validTarget(e.sourceId??'',e.sourceVersion??0))&&e.targets.some(t=>validTarget(t.id,t.version)));
 const bonuses=new Map<string,{power:number;toughness:number}>();
 for(const effect of s.timedEffects)for(const t of effect.targets)if(validTarget(t.id,t.version)){const old=bonuses.get(t.id)??{power:0,toughness:0};bonuses.set(t.id,{power:old.power+effect.power,toughness:old.toughness+effect.toughness});}
 for(const c of s.cards){const b=bonuses.get(c.id);if(b?.power)c.temporaryPower=b.power;else delete c.temporaryPower;if(b?.toughness)c.temporaryToughness=b.toughness;else delete c.temporaryToughness;
  if(c.combat){const target=byId.get(c.combat.targetId);if(c.combat.turn!==s.turn||c.zone!=='battlefield'||lost.includes(c.controllerId)||c.combat.kind==='attack'&&!s.players.some(p=>p.id===c.combat!.targetId&&!lost.includes(p.id))&&(!target||!validTarget(target.id,c.combat.targetVersion??0)))delete c.combat;}
 }
 for(const c of s.cards)if(c.combat?.kind==='block'){const target=byId.get(c.combat.targetId);if(target?.combat?.kind!=='attack'||!validTarget(target.id,c.combat.targetVersion??0))delete c.combat;}

}
export function applyTableTools(state:GameState,actor:string,a:TableToolAction):GameState{
 const s=structuredClone(state),who=s.players.find(p=>p.id===actor)!;
 const ids='cardIds'in a?a.cardIds:[];
 if(ids.length>200||new Set(ids).size!==ids.length)throw Error('1–200 verschiedene Karten wählen');
 const chosen=ids.map(id=>s.cards.find(c=>c.id===id));
 if(chosen.some(c=>!c))throw Error('Eine gewählte Karte ist nicht mehr vorhanden');
 let label='';
 if(a.type==='batchCards'){
  if(!chosen.length||chosen.some(c=>c!.controllerId!==actor||c!.zone!=='battlefield'))throw Error('Nur eigene Spielfeldkarten gemeinsam bearbeiten');
  for(const c of chosen as CardInstance[]){if(a.operation==='tap'||a.operation==='untap')c.tapped=a.operation==='tap';else{enterZone(s,c,a.operation==='sacrifice'?'graveyard':a.operation);if(s.rules?.resolving)recordEffectLink(s,c,actor,s.rules.resolving.label,resolvingSource(s));}}
  label=`${chosen.length} Karten · ${a.operation==='tap'?'getappt':a.operation==='untap'?'enttappt':a.operation==='sacrifice'?'geopfert':a.operation==='hand'?'auf die Hand':'ins Exil'}`;
 }else if(a.type==='combat'){
  if(a.operation==='end'){if(s.activePlayer!==actor)throw Error('Der Spieler am Zug beendet den Kampf');s.cards.forEach(c=>delete c.combat);label='Kampfmarkierungen beendet';}
  else{
   if(!chosen.length||chosen.some(c=>c!.controllerId!==actor||c!.zone!=='battlefield'||!instanceDefinition(c!).type.includes('Creature')))throw Error('Eigene Kreaturen wählen');
   const target=s.cards.find(c=>c.id===a.targetId),player=s.players.find(p=>p.id===a.targetId);
   if(a.operation==='attack'&&(s.activePlayer!==actor||!player&&!target||player&&(player.id===actor||s.rules?.lost.includes(player.id))||target&&(target.zone!=='battlefield'||target.controllerId===actor||!/(Planeswalker|Battle)/.test(instanceDefinition(target).type))))throw Error('Einen Gegner, Planeswalker oder eine Schlacht wählen');
   if(a.operation==='block'&&(!target||target.controllerId===actor||target.combat?.kind!=='attack'))throw Error('Eine gegnerische angreifende Kreatur wählen');
   if(a.operation!=='remove'&&chosen.some(c=>c!.tapped&&c!.combat?.kind!=='attack'))throw Error('Getappte Kreaturen erst enttappen');
   for(const c of chosen as CardInstance[]){if(a.operation==='remove')delete c.combat;else{c.combat={kind:a.operation,targetId:a.targetId!,targetVersion:target?.incarnation??0,turn:s.turn};if(a.operation==='attack'&&!c.addedKeywords?.includes('Vigilance')&&!/\bVigilance\b/.test(instanceDefinition(c).text))c.tapped=true;}}
   label=`${chosen.length} Kreaturen · ${a.operation==='attack'?'greifen an':a.operation==='block'?'blocken':'Kampfmarkierung entfernt'}`;
  }
 }else if(a.type==='timedEffect'){
  if(!chosen.length||chosen.some(c=>c!.zone!=='battlefield'||c!.controllerId!==actor)||!a.label.trim()||a.label.length>80||!Number.isInteger(a.power)||!Number.isInteger(a.toughness)||Math.abs(a.power)>999||Math.abs(a.toughness)>999||(s.timedEffects?.length??0)>=100)throw Error('Eigene Spielfeldkarten und einen gültigen Effekt wählen');
  const source=s.cards.find(c=>c.id===a.sourceId);if(a.duration==='source'&&(!source||source.zone!=='battlefield'||source.faceDown))throw Error('Offene Quelle auf dem Spielfeld wählen');
  s.timedEffects=[...(s.timedEffects??[]),{id:uuid(),actorId:actor,label:a.label.trim(),duration:a.duration,turn:s.turn,sourceId:source?.id,sourceVersion:source?.incarnation??0,targets:chosen.map(c=>({id:c!.id,version:c!.incarnation??0})),power:a.power,toughness:a.toughness}];label=`${a.label.trim()} · ${chosen.length} Karten`;
 }else if(a.type==='endEffect'){
  const effect=s.timedEffects?.find(e=>e.id===a.effectId);if(!effect||effect.actorId!==actor)throw Error('Dieser Effekt gehört nicht dir');s.timedEffects=s.timedEffects!.filter(e=>e.id!==a.effectId);label=`${effect.label} beendet`;
 }else if(a.type==='linkedCards'){
  if((a.operation==='copy'||a.operation==='spellCopy')&&s.cards.length+chosen.length>1200)throw Error('Zu viele Kartenkopien');
  if(!chosen.length||chosen.some(c=>!['exile','graveyard'].includes(c!.zone)||c!.faceDown&&!c!.hiddenFor?.includes(actor)||!c!.effectLinks?.some(l=>l.sourceId===a.sourceId&&(l.actorId===actor||c!.ownerId===actor))))throw Error('Eigene oder durch deine Quelle verknüpfte Karten wählen');
  for(const c of chosen as CardInstance[]){if(a.operation==='spellCopy')castLinkedSpellCopy(s,actor,c,a.targetId);else if(a.operation==='copy'){if(/Instant|Sorcery/.test(instanceDefinition(c).type))throw Error('Spruchkopien manuell auf dem Stack ansagen');const copy={...c,id:uuid(),ownerId:actor,controllerId:actor,token:true,createdToken:false,isCommander:false,zone:'exile' as const};s.cards.push(copy);enterZone(s,copy,'battlefield');}else enterZone(s,c,a.operation);}
  label=`${chosen.length} verknüpfte Karten · ${a.operation==='spellCopy'?'Spruchkopien auf den Stack':a.operation==='copy'?'Kopien aufs Spielfeld':a.operation==='hand'?'zurück auf die Hand':'zurück aufs Spielfeld'}`;
 }else{
  const edit=s.tableEdits?.at(-1);if(!edit||edit.id!==a.editId||edit.actorId!==actor||edit.turn!==s.turn||JSON.stringify(s.timedEffects??[])!==JSON.stringify(edit.afterEffects??[])||!a.reason.trim()||a.reason.trim().length<3||a.reason.length>160||s.rules?.stack.length||s.rules?.pending||s.rules?.resolving)throw Error('Nur die letzte eigene Tischaktion bei leerem Stack korrigieren');
  if(edit.after.some(c=>JSON.stringify(s.cards.find(x=>x.id===c.id))!==JSON.stringify(c))||edit.before.some(c=>!edit.after.some(x=>x.id===c.id)&&s.cards.some(x=>x.id===c.id)))throw Error('Betroffene Karten wurden inzwischen verändert; manuell korrigieren');
  const changed=new Set([...edit.before,...edit.after].map(c=>c.id));s.cards=[...s.cards.filter(c=>!changed.has(c.id)),...structuredClone(edit.before)];s.tableEdits=s.tableEdits!.slice(0,-1);s.timedEffects=structuredClone(edit.beforeEffects??[]);label=`KORREKTUR · ${edit.label} zurückgenommen · ${a.reason.trim()}`;
 }
 cleanTableTools(s);settle(s);
 if(a.type==='batchCards'){
  const before=state.cards.filter(c=>JSON.stringify(s.cards.find(x=>x.id===c.id))!==JSON.stringify(c)),after=s.cards.filter(c=>JSON.stringify(state.cards.find(x=>x.id===c.id))!==JSON.stringify(c));
  s.tableEdits=[...(s.tableEdits??[]),{id:uuid(),actorId:actor,label,turn:s.turn,before:structuredClone(before),after:structuredClone(after),beforeEffects:structuredClone(state.timedEffects??[]),afterEffects:structuredClone(s.timedEffects??[])}].slice(-10);
 }
 s.log=[...s.log,`${who.name}: ${label}.`].slice(-200);return s;
}
