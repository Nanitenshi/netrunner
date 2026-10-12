import {tokenById,hiddenDefinition} from './tokens.ts';
import definitions from '../src/cards.json' with {type:'json'};
import type {CardDefinition} from './cards.ts';
export const catalogue=definitions as CardDefinition[];
export const catalogueById=new Map(catalogue.map(c=>[c.id,c]));
for(const card of [...tokenById.values(),hiddenDefinition])catalogueById.set(card.id,card);
export const isCommander=(c:CardDefinition)=>c.commanderEligible===true&&!(c.type.includes('Background')&&!c.type.includes('Creature'));
const has=(c:CardDefinition,keyword:string)=>(c.keywords??[]).some(k=>k.toLowerCase()===keyword.toLowerCase());
const frontText=(c:CardDefinition)=>c.faces[0]?.text??c.text;
export function commanderPair(a:CardDefinition,b:CardDefinition):boolean {
 if(a.id===b.id)return false;
 if(has(a,'Choose a Background')&&b.type.includes('Legendary Enchantment')&&b.type.includes('Background'))return true;
 if(has(b,'Choose a Background')&&a.type.includes('Legendary Enchantment')&&a.type.includes('Background'))return true;
 if(!isCommander(a)||!isCommander(b))return false;
 if(has(a,'Partner')&&has(b,'Partner')&&!has(a,'Partner with')&&!has(b,'Partner with'))return true;
 if(has(a,'Friends forever')&&has(b,'Friends forever'))return true;
 const doctor=(c:CardDefinition)=>c.type.split('—')[1]?.trim()==='Time Lord Doctor';
 if(has(a,"Doctor's companion")&&doctor(b)||has(b,"Doctor's companion")&&doctor(a))return true;
 const named=(x:CardDefinition,y:CardDefinition)=>frontText(x).includes(`Partner with ${y.name} (`)||frontText(x).split('\n').some(line=>line===`Partner with ${y.name}`);
 return named(a,b)&&named(b,a);
}
