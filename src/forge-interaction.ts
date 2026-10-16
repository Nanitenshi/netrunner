import type {ForgeAction,ForgeCard} from '../shared/forge-protocol';

// The native projection decides legality; a land drop takes precedence over
// optional hand abilities such as cycling. Multiple spell modes remain explicit.
export function primaryForgeAction(card:ForgeCard):ForgeAction|null {
 if(!card.playable)return null;
 if(card.zone==='hand'&&card.landPlayable)return {type:'land',cardId:card.id};
 const abilities=card.abilities?.filter(a=>a.playable)??[];
 if(abilities.length!==1||!abilities[0].spell&&!abilities[0].simpleMana)return null;
 const ability=abilities[0];
 return {type:ability.spell?'cast':'activate',cardId:card.id,abilityIndex:ability.index};
}

export function forgeActionLabel(card:ForgeCard):string {
 if(card.zone==='battlefield'&&card.playable&&card.abilities?.filter(a=>a.playable).length===1&&card.abilities.find(a=>a.playable)?.simpleMana)return 'Für Mana tappen';
 if(card.zone!=='hand'&&card.zone!=='command')return '';
 if(!card.playable){const cost=card.abilities?.find(a=>a.spell)?.cost;return [cost?'Kosten '+cost:'',card.blockedReason??'Gerade nicht spielbar'].filter(Boolean).join(' · ');}
 if(card.landPlayable)return 'Land spielen';
 const abilities=card.abilities?.filter(a=>a.playable)??[];
 if(abilities.length===1)return `${abilities[0].spell?'Wirken':'Fähigkeit wählen'}${abilities[0].cost?' · '+abilities[0].cost:''}`;
 return abilities.length?'Aktion wählen':card.type.includes('Land')?'Land spielen':'Wirken';
}
