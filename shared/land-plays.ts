import {instanceDefinition} from './card-state.ts';
import type {CardInstance} from './game.ts';
import type {RulesState} from './rules-types.ts';

type LandState={cards:CardInstance[];rules?:RulesState};
const numbers:Record<string,number>={an:1,one:1,two:2,three:3,four:4,five:5};
/** Only unconditional, continuous permissions. Conditional/activated effects are granted manually. */
export function landPlayAllowance(state:LandState,player:string){
 const sources=state.cards.filter(c=>c.controllerId===player&&c.zone==='battlefield'&&!c.faceDown).flatMap(c=>{
  const d=instanceDefinition(c);
  const bonus=d.text.split('\n').reduce((sum,line)=>{
   const match=line.trim().match(/^You may play (an|one|two|three|four|five|\d+) additional lands? (?:on|during) each of your turns\.(?:\s*\([^)]*\))?$/i);
   return sum+(match?(numbers[match[1].toLowerCase()]??Number(match[1])):0);
  },0);
  return bonus>0?[{cardId:c.id,name:d.name,bonus}]:[];
 });
 const automatic=sources.reduce((sum,s)=>sum+s.bonus,0),manual=state.rules?.landBonus?.[player]??0;
 const limit=Math.min(999,1+automatic+manual),played=state.rules?.landPlays[player]??0;
 return {limit,played,remaining:Math.max(0,limit-played),automatic,manual,sources};
}
