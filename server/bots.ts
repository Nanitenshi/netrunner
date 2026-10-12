import {landPlayAllowance} from '../shared/land-plays.ts';
import {catalogue,catalogueById} from '../shared/catalogue.ts';
import {commanderTax,type GameAction,type GameState,type CardInstance} from '../shared/game.ts';
import {instanceDefinition} from '../shared/card-state.ts';
import {enterZone} from '../shared/placement.ts';
import {settle} from '../shared/engine.ts';
import {markedStats} from '../shared/counters.ts';
import type {DeckData} from '../shared/protocol.ts';
export interface BotMemory {entered:Record<string,{turn:number;incarnation:number}>;attackTurn?:number}
export interface TrainingCombat {id:string;attackerId:string;defenderId:string;cardIds:string[]}
export function trainingDeck():DeckData{
 const commander=catalogue.find(c=>c.name==='Isamaru, Hound of Konda')!;
 const creatures=catalogue.filter(c=>c.commanderLegal&&c.id!==commander.id&&!c.faces.length&&c.type.includes('Creature')&&!c.type.includes('Legendary')&&!c.text.trim()&&c.colorIdentity.every(v=>v==='W')&&/^\d+$/.test(c.power??'')&&/^\d+$/.test(c.toughness??'')&&c.manaValue<=5&&c.manaValue>=1).sort((a,b)=>a.manaValue-b.manaValue).slice(0,60);
 const quantities=Object.fromEntries(creatures.map(c=>[c.id,1]));quantities[catalogue.find(c=>c.name==='Plains')!.id]=99-creatures.length;
 return {id:'training-bot-white',name:'Bot · einfache Kreaturen',commanderId:commander.id,quantities};
}
const definition=instanceDefinition;
export function observeBot(state:GameState,id:string,memory:BotMemory){for(const c of state.cards.filter(c=>c.controllerId===id&&c.zone==='battlefield')){const seen=memory.entered[c.id];if(!seen||seen.incarnation!==(c.incarnation??0))memory.entered[c.id]={turn:state.turn,incarnation:c.incarnation??0};}}
export function nextBotAction(state:GameState,id:string):GameAction|null{
 const r=state.rules;if(!r||r.stage==='finished'||r.lost.includes(id))return null;
 if(r.stage==='mulligan'){if(r.kept.includes(id))return null;const lands=state.cards.filter(c=>c.ownerId===id&&c.zone==='hand'&&definition(c).type.includes('Land')).length;return (lands<2||lands>5)&&(r.mulligans[id]??0)<3?{type:'mulligan'}:{type:'keep'};}
 if(r.pending){if(r.pending.ownerId!==id)return null;const p=r.pending;if(p.kind==='discard')return {type:'choose',choiceId:p.id,first:p.cardIds.slice(0,p.value),second:p.cardIds.slice(p.value)};if(p.kind==='manual')return null;if(p.kind==='hideaway')return {type:'choose',choiceId:p.id,first:p.cardIds.slice(0,1),second:[],decision:'done'};if(p.kind==='search'){const eligible=p.cardIds.filter(cardId=>{const c=state.cards.find(c=>c.id===cardId);if(!c)return false;const type=definition(c).type,f=p.effect?.filter;return !f||f==='any'||(f==='basic'?/\bBasic\b.*\bLand\b/.test(type):type.includes(f==='land'?'Land':'Creature'));});return {type:'choose',choiceId:p.id,first:eligible.slice(0,p.value),second:[]};}return {type:'choose',choiceId:p.id,first:p.cardIds,second:[],decision:p.kind==='discover'?'hand':p.kind==='cascade'?'decline':'done'};}
 if(r.resolving||r.priority!==id)return null;
 if(state.activePlayer===id&&[3,9].includes(state.phase)&&!r.stack.length){
  const land=state.cards.find(c=>c.ownerId===id&&c.zone==='hand'&&definition(c).type.includes('Basic Land'));if(land&&landPlayAllowance(state,id).remaining>0)return {type:'move',cardId:land.id,zone:'battlefield'};
  const sources=state.cards.filter(c=>c.controllerId===id&&c.zone==='battlefield'&&!c.tapped&&definition(c).name==='Plains');const mana=state.players.find(p=>p.id===id)?.mana?.W??0;
  const creature=state.cards.filter(c=>c.ownerId===id&&c.controllerId===id&&['hand','commander'].includes(c.zone)&&definition(c).type.includes('Creature')&&!definition(c).text.trim()&&definition(c).manaValue+commanderTax(c)<=sources.length+mana).sort((a,b)=>(definition(a).manaValue+commanderTax(a))-(definition(b).manaValue+commanderTax(b)))[0];
  if(creature){const cost=definition(creature).manaValue+commanderTax(creature);if(mana<cost)return {type:'mana',color:'W',amount:1,sourceCardId:sources[0].id};if(cost)return {type:'mana',color:'W',amount:-cost};return {type:'cast',cardId:creature.id,costsPaid:true};}
 }
 return r.turnOnly&&state.activePlayer===id&&!r.stack.length?{type:'endTurn'}:{type:'pass'};
}
// Casting has an explicit reservation, so spending mana cannot make the selected spell disappear.
export function botCastStep(state:GameState,id:string,reserved?:string):{action:GameAction|null;reserve?:string}{
 if(reserved){const c=state.cards.find(c=>c.id===reserved);if(c&&['hand','commander'].includes(c.zone)&&state.rules?.priority===id&&!state.rules.pending&&!state.rules.stack.length&&state.activePlayer===id&&[3,9].includes(state.phase))return {action:{type:'cast',cardId:c.id,costsPaid:true}};}
 const action=nextBotAction(state,id);if(action?.type==='mana'&&action.amount<0){const c=state.cards.filter(c=>c.ownerId===id&&['hand','commander'].includes(c.zone)&&definition(c).type.includes('Creature')&&!definition(c).text.trim()&&definition(c).manaValue+commanderTax(c)===-action.amount).sort((a,b)=>a.id.localeCompare(b.id))[0];return {action,reserve:c?.id};}return {action};
}
export function botAttack(state:GameState,id:string,memory:BotMemory):{attackerId:string;defenderId:string;cardIds:string[]}|null{
 const r=state.rules;if(!r||r.stage!=='playing'||r.pending||r.resolving||r.priority!==id||r.stack.length||state.activePlayer!==id||state.phase!==(r.turnOnly?3:5)||memory.attackTurn===state.turn)return null;
 memory.attackTurn=state.turn;const defender=state.players.find(p=>p.id!==id&&!r.lost.includes(p.id));if(!defender)return null;
 const attackers=state.cards.filter(c=>c.controllerId===id&&c.zone==='battlefield'&&!c.tapped&&definition(c).type.includes('Creature')&&!definition(c).text.trim()&&(memory.entered[c.id]?.turn??state.turn)<state.turn&&Number(markedStats(c,definition(c).power,definition(c).toughness).power)>0);
 return attackers.length?{attackerId:id,defenderId:defender.id,cardIds:attackers.map(c=>c.id)}:null;
}
export function resolveTrainingCombat(state:GameState,combat:TrainingCombat,blocks:{attackerId:string;blockerId:string}[],manual=false):GameState{
 const s=structuredClone(state),r=s.rules!;if(r.pending||r.resolving||r.stack.length||s.activePlayer!==combat.attackerId||s.phase!==(r.turnOnly?3:5))throw new Error('Zuerst die laufende Reaktion abschließen');
 const attackers=combat.cardIds.map(id=>s.cards.find(c=>c.id===id&&c.zone==='battlefield'&&c.controllerId===combat.attackerId)).filter((c):c is CardInstance=>!!c);const allowed=new Set(attackers.map(c=>c.id)),used=new Set<string>(),assigned=new Set<string>();
 for(const b of blocks){const c=s.cards.find(c=>c.id===b.blockerId);if(!allowed.has(b.attackerId)||assigned.has(b.attackerId)||used.has(b.blockerId)||!c||c.controllerId!==combat.defenderId||c.zone!=='battlefield'||c.tapped||!definition(c).type.includes('Creature'))throw new Error('Ungültige Blockerzuordnung');if(/deathtouch|first strike|double strike|lifelink|infect|wither|protection|prevent|indestructible/i.test(definition(c).text))throw new Error('Sonderfähigkeiten: Kampf manuell klären');used.add(b.blockerId);assigned.add(b.attackerId);}
 if(!manual&&[...attackers,...blocks.map(b=>s.cards.find(c=>c.id===b.blockerId)!)].some(c=>c.addedKeywords?.length))throw new Error('Zusätzliche Fähigkeiten: Kampf manuell klären');
 const stats=(c:CardInstance)=>{const p=markedStats(c,definition(c).power,definition(c).toughness);if(!/^\d+$/.test(p.power??'')||!/^\d+$/.test(p.toughness??''))throw new Error('Variable Werte: Kampf manuell klären');return {power:Number(p.power),toughness:Number(p.toughness)};};
 const die=(c:CardInstance)=>enterZone(s,c,c.isCommander?'commander':'graveyard');let damage=0;
 if(!manual)for(const a of attackers){const av=stats(a),b=blocks.find(b=>b.attackerId===a.id),blocker=b?s.cards.find(c=>c.id===b.blockerId):undefined;if(blocker){const bv=stats(blocker);if(av.power>=bv.toughness)die(blocker);if(bv.power>=av.toughness)die(a);}else{damage+=av.power;if(a.isCommander){const target=s.players.find(p=>p.id===combat.defenderId)!;target.commanderDamage??=[];let entry=target.commanderDamage.find(d=>d.commanderId===a.id);if(!entry){entry={commanderId:a.id,ownerId:a.ownerId,name:definition(a).name,amount:0};target.commanderDamage.push(entry);}entry.amount+=av.power;}}}
 if(!manual)s.players.find(p=>p.id===combat.defenderId)!.life-=damage;
 s.log=[...s.log,manual?'TRAINING · Kampf wird manuell ausgeführt.':`TRAINING · ${s.players.find(p=>p.id===combat.attackerId)!.name}: ${damage} ungeblockter Kampfschaden.`].slice(-60);r.passes=[];r.priority=s.activePlayer;settle(s);return s;
}
