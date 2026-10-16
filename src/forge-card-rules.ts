import type {ForgeCard} from '../shared/forge-protocol.ts';
export function forgeRuleBadges(card:ForgeCard):string[]{
 const r=card.rules;if(!r)return [];
 return [...Object.entries(r.counters).filter(([,n])=>n>0).map(([name,n])=>`${name} ×${n}`),...(r.regenerationShields>0?[`Regeneration ×${r.regenerationShields}`]:[]),...(r.damage>0?[`Schaden ${r.damage}`]:[]),...(r.attachments.length?[`Angelegt ${r.attachments.length}`]:[])];
}
export function forgeRuleText(card:ForgeCard):string{
 return (card.rules?.text??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/?[a-z][^>]*>/gi,'').trim();
}
