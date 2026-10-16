import type {ForgeChoice,ForgeState} from '../shared/forge-protocol.ts';

/** A normal blocker moves to its new assignment in one click. Native multi-block
 * capacity is preserved; unknown/older descriptors are never guessed. */
export function toggleForgeBlock(choice:ForgeChoice,ids:string[],id:string):string[]{
 const pair=choice.options.find(o=>o.id===id);
 if(!pair?.cardId||choice.kind!=='blockers')return ids;
 if(ids.includes(id))return ids.filter(key=>key!==id);
 const same=choice.options.filter(o=>o.cardId===pair.cardId).map(o=>o.id);
 const count=ids.filter(key=>same.includes(key)).length;
 if(pair.maxBlocks===1)return [...ids.filter(key=>!same.includes(key)),id];
 if(pair.maxBlocks!==undefined&&count>=pair.maxBlocks)return ids;
 return [...ids,id];
}

export function forgeDamageError(choice:ForgeChoice,values:Record<string,number>):string{
 if(choice.options.some(o=>!Number.isInteger(values[o.id]??0)||(values[o.id]??0)<0))return 'Nur ganze, nicht negative Schadenswerte sind erlaubt.';
 const total=choice.options.reduce((sum,o)=>sum+(values[o.id]??0),0);
 if(total!==choice.count)return `${choice.count-total} Schaden noch zu verteilen.`;
 if(!choice.damage)return '';
 let earlierLethal=true;
 for(const o of choice.options){
  if(o.id==='defender')continue;
  const dealt=values[o.id]??0,needed=choice.damage.lethal[o.id]??0;
  if(choice.damage.ordered&&dealt>0&&!earlierLethal)return 'Zuerst tödlichen Schaden auf die vorherigen Kreaturen zuweisen.';
  if(dealt<needed){earlierLethal=false;if((values.defender??0)>0)return 'Trampelschaden erst nach tödlicher Zuweisung an alle Blocker.';}
 }
 return '';
}

export function forgePassLabel(game:Pick<ForgeState,'stack'|'combatRunning'|'phase'|'ending'>):string{
 if(game.stack.length)return 'Beide passen: Das oberste Stack-Objekt wird verrechnet.';
 if(game.combatRunning){
  if(game.phase==='COMBAT_BEGIN')return 'Beide passen: Der aktive Spieler wählt Angreifer.';
  if(game.phase==='COMBAT_DECLARE_ATTACKERS')return 'Beide passen: Der Verteidiger wählt Blocker.';
  if(game.phase==='COMBAT_DECLARE_BLOCKERS')return 'Beide passen: Kampfschaden wird zugewiesen und verrechnet. Jetzt ist das Reaktionsfenster vor dem Schaden.';
  if(game.phase==='COMBAT_FIRST_STRIKE_DAMAGE')return 'Beide passen: Der reguläre Kampfschaden folgt. Du kannst nach Erstschlagschaden noch reagieren.';
  return 'Beide passen: Der Kampf wird fortgesetzt; danach folgt die zweite Hauptphase.';
 }
 return game.ending?'Beide passen: Das Zugende wird fortgesetzt.':'Passen gibt einmal Priorität ab. Dein Zug endet erst mit „Zug beenden“.';
}
