import {manaColors,type ManaPool} from './mana.ts';
/** Only ordinary fixed printed costs; choices, discounts and extra costs remain manual. */
export function poolPayment(cost:string,pool:ManaPool={},tax=0):ManaPool|null{
 if(!Number.isInteger(tax)||tax<0)return null;
 const symbols=cost.match(/\{[^}]+\}/g)??[];
 if(symbols.join('')!==cost||symbols.some(s=>!/^\{(?:\d+|[WUBRGC])\}$/.test(s)))return null;
 const remaining={...pool},spent:ManaPool={};let generic=tax;
 for(const symbol of symbols){const value=symbol.slice(1,-1);if(/^\d+$/.test(value)){generic+=Number(value);continue;}const color=value as typeof manaColors[number];if((remaining[color]??0)<1)return null;remaining[color]=(remaining[color]??0)-1;spent[color]=(spent[color]??0)+1;}
 // Spend colorless first, then colors with the largest remaining amount.
 const order=[...manaColors].sort((a,b)=>a==='C'?-1:b==='C'?1:(remaining[b]??0)-(remaining[a]??0));
 for(const color of order){const n=Math.min(generic,remaining[color]??0);if(n){spent[color]=(spent[color]??0)+n;generic-=n;}}
 return generic===0?spent:null;
}
