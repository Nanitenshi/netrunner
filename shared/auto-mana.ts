import {manaColors,manaTotal,type ManaColor,type ManaPool} from './mana.ts';
import {poolPayment} from './mana-payment.ts';
import {instanceDefinition} from './card-state.ts';
import {catalogue} from './catalogue.ts';
import type {CardDefinition} from './cards.ts';
import type {GameState,GameView} from './game.ts';

export interface ManaAbility {cost:string;produces:ManaPool}
export interface ManaActivation extends ManaAbility {sourceId:string;spent:ManaPool}
export interface ManaPlan {activations:ManaActivation[];payment:ManaPool;remaining:ManaPool}
const add=(pool:ManaPool,amount:ManaPool,sign=1):ManaPool=>Object.fromEntries(manaColors.map(c=>[c,(pool[c]??0)+sign*(amount[c]??0)]).filter(([,n])=>n!==0));

/** Only unconditional printed tap abilities. Never guess from color identity or card names. */
export function printedManaAbilities(card:Pick<CardDefinition,'type'|'text'>,identity:ManaColor[]=[]):ManaAbility[]{
 if(!/\b(?:Land|Artifact)\b/.test(card.type)||/\bCreature\b/.test(card.type)||/spend this mana|activate only|\bdamage\b|\blose\b.*\blife\b/i.test(card.text))return [];
 const result:ManaAbility[]=[];
 for(const original of card.text.split('\n')){
  const line=original.trim().replace(/^\((.*)\)$/,'$1');
  const match=line.match(/^((?:\{(?:\d+|[WUBRGC](?:\/[WUBRGC])?)\},?\s*)*)\{T\}: Add (.+)\.$/);
  if(!match)continue;
  const cost=match[1].replace(/[,\s]/g,''),effect=match[2];
  if((cost.match(/\{[^}]+\}/g)??[]).length>6||/\{\d{3,}\}/.test(cost))continue;
  let options:string[];
  if(effect==='one mana of any color')options=manaColors.filter(c=>c!=='C').map(c=>`{${c}}`);
  else if(effect==="one mana of any color in your commander's color identity")options=identity.filter(c=>c!=='C').map(c=>`{${c}}`);
  else options=effect.split(/,\s*(?:or\s+)?|\s+or\s+/);
  if(!options.length||options.some(o=>! /^(?:\{[WUBRGC]\}){1,12}$/.test(o)))continue;
  for(const output of options){const produces:ManaPool={};for(const symbol of output.match(/\{[WUBRGC]\}/g)!){const c=symbol[1] as ManaColor;produces[c]=(produces[c]??0)+1;}result.push({cost,produces});}
 }
 return result;
}

/** Bounded breadth-first search: fewer taps first, identical sources grouped to avoid permutations.
 * Activation costs are paid from the current pool BEFORE generating mana. Generic payments branch
 * by color, so paying for a filter cannot consume a color needed by the final spell by accident.
 */
export function automaticManaPlan(state:Pick<GameState|GameView,'cards'|'players'>,actor:string,cost:string,tax=0):ManaPlan|null{
 const player=state.players.find(p=>p.id===actor);if(!player)return null;
 if(poolPayment(cost,Object.fromEntries(manaColors.map(c=>[c,1000])),tax)===null||cost.length>120||tax>100)return null;
 // Commander names are public even if a commander is shuffled into a private library.
 const commanderNames=player.commander.split(' + ');
 const identity=[...new Set(catalogue.filter(c=>commanderNames.includes(c.name)).flatMap(c=>c.colorIdentity))];
 const groups:{ids:string[];abilities:ManaAbility[]}[]=[],byAbilities=new Map<string,number>();
 for(const card of state.cards){
  if(card.controllerId!==actor||card.zone!=='battlefield'||card.tapped||card.faceDown)continue;
  const abilities=printedManaAbilities(instanceDefinition(card),identity);if(!abilities.length)continue;
  const key=JSON.stringify(abilities),index=byAbilities.get(key);
  if(index!==undefined)groups[index].ids.push(card.id);else{byAbilities.set(key,groups.length);groups.push({ids:[card.id],abilities});}
 }
 type Node={pool:ManaPool;used:number[];previous:number;activation?:ManaActivation};
 const queue:Node[]=[{pool:{...player.mana},used:groups.map(()=>0),previous:-1}],seen=new Set<string>();
 const key=(node:Node)=>node.used.join(',')+'|'+manaColors.map(c=>node.pool[c]??0).join(',');seen.add(key(queue[0]));
 for(let i=0;i<queue.length&&i<12000;i++){
  const node=queue[i],payment=poolPayment(cost,node.pool,tax);
  if(payment){const activations:ManaActivation[]=[];for(let n=i;queue[n].activation;n=queue[n].previous)activations.push(queue[n].activation!);return {activations:activations.reverse(),payment,remaining:add(node.pool,payment,-1)};}
  if(node.used.reduce((a,b)=>a+b,0)>=64)continue;
  for(let g=0;g<groups.length;g++){
   const group=groups[g],count=node.used[g];if(count>=group.ids.length)continue;
   for(const ability of group.abilities)for(const spent of activationPayments(ability.cost,node.pool)){
    const next:Node={pool:add(add(node.pool,spent,-1),ability.produces),used:node.used.map((n,j)=>n+(j===g?1:0)),previous:i,activation:{...ability,sourceId:group.ids[count],spent}};
    const signature=key(next);if(seen.has(signature))continue;seen.add(signature);queue.push(next);
    // Memory bound as well as work bound; exhaustion leaves the table unchanged.
    if(queue.length>=12000)return null;
   }
  }
 }
 return null;
}

function activationPayments(cost:string,pool:ManaPool):ManaPool[]{
 const symbols=cost.match(/\{[^}]+\}/g)??[],hybrid=symbols.find(s=>s.includes('/'));
 if(hybrid)return hybrid.slice(1,-1).split('/').flatMap(c=>activationPayments(cost.replace(hybrid,`{${c}}`),pool));
 const colored=cost.replace(/\{\d+\}/g,''),reserved=poolPayment(colored,pool);if(!reserved)return [];
 const generic=(cost.match(/\{\d+\}/g)??[]).reduce((n,s)=>n+Number(s.slice(1,-1)),0);
 if(generic>12)return [];
 const left=add(pool,reserved,-1),result:ManaPool[]=[];
 const baseSpent:ManaPool=reserved;
 if(manaTotal(left)<generic)return [];
 function distribute(index:number,need:number,spent:ManaPool){
  if(!need){result.push({...spent});return;}if(index===manaColors.length)return;
  const color=manaColors[index];for(let n=Math.min(need,left[color]??0);n>=0;n--)distribute(index+1,need-n,{...spent,...(n?{[color]:(baseSpent[color]??0)+n}:{})});
 }
 distribute(0,generic,reserved);return result;
}
