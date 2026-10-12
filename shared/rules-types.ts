import type {CardInstance} from './game.ts';

export const effectKinds = ['draw','scry','surveil','mill','look','reveal','search','discover','cascade','hideaway'] as const;
export type EffectKind = typeof effectKinds[number];
export interface LibraryEffect {
  kind:EffectKind; value:number; sourceCardId?:string; playerId?:string;
  destination?:'hand'|'battlefield'|'library';
  filter?:'any'|'land'|'basic'|'creature';
  reveal?:boolean; shuffle?:boolean; tapped?:boolean;
}
export interface StackItem {
  id:string; controllerId:string; kind:'spell'|'ability'; label:string;
  cardId?:string; sourceCardId?:string; manaValue?:number; targetId?:string; targetVersion?:number;
  effect?:LibraryEffect; free?:boolean; continuation?:boolean;
  abilityType?:'activated'|'triggered';
}
export interface PendingChoice {
  id:string; ownerId:string; kind:EffectKind|'manual'|'discard';
  cardIds:string[]; public:boolean; value:number;
  hitId?:string; effect?:LibraryEffect;
}
export interface RulesState {
  turnOnly?:boolean;version:1; stage:'mulligan'|'playing'|'finished'; priority:string; passes:string[];
  kept:string[]; mulligans:Record<string,number>; landPlays:Record<string,number>; landBonus?:Record<string,number>;
  stack:StackItem[]; pending:PendingChoice|null; resolving:StackItem|null;
  sequence:number; lost:string[]; failedDraw:string[];
}
export type RulesAction =
  | {type:'setLandBonus';count:number}
  | {type:'castHidden';cardId:string;conditionsMet:boolean;costsPaid:boolean;targetId?:string}
  | {type:'endTurn'} | {type:'concede'} | {type:'mulligan'} | {type:'keep'} | {type:'pass'} | {type:'shuffle'}
  | {type:'cast';faceIndex?:number;cardId:string;targetId?:string;costsPaid:boolean;passPriority?:boolean;payFromPool?:boolean;autoTapSources?:string[]}
  | {type:'effect';effect:LibraryEffect;sourceId?:string}
  | {type:'ability';label:string;sourceCardId?:string;abilityType?:'activated'|'triggered'}
  | {type:'counterStack';choiceId:string;stackId:string}
  | {type:'lateCast';cardId:string;targetId?:string;costsPaid:boolean;reason:string}
  | {type:'lateAbility';label:string;sourceCardId?:string;abilityType?:'activated'|'triggered';reason:string}
  | {type:'withdrawStack';stackId:string;reason:string}
  | {type:'resolveSwords';choiceId:string;power:number}
  | {type:'choose';choiceId:string;first:string[];second:string[];decision?:'cast'|'hand'|'decline'|'done';targetId?:string;costsPaid?:boolean}
  | {type:'resolveEffect';choiceId:string;effect:LibraryEffect};
export interface PrivateChoiceView {cards:CardInstance[]}
