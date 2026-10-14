import {z} from 'zod';
import type {DeckData} from './protocol.ts';
import type {ForgeAiDifficulty} from './forge-decks.ts';
import type {ForgeAutomation,ForgeAutomaticDecision} from './forge-automation.ts';
export type ForgeScenario='standard'|'decisions'|'combat'|'costs'|'commander';
export const forgeActionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('pass')}).strict(),
 z.object({type:z.literal('endTurn')}).strict(),
 z.object({type:z.literal('combat')}).strict(),
 z.object({type:z.literal('land'),cardId:z.string().min(1).max(40)}).strict(),
 z.object({type:z.literal('discard'),choiceId:z.string().uuid(),cardIds:z.array(z.string().min(1).max(40)).max(250)}).strict(),
 z.object({type:z.literal('choose'),choiceId:z.string().uuid(),first:z.array(z.string().min(1).max(60)).max(512).default([]),second:z.array(z.string().min(1).max(60)).max(512).default([]),answer:z.boolean().optional(),value:z.number().int().min(-2147483648).max(2147483647).optional()}).strict(),
 z.object({type:z.literal('cast'),cardId:z.string().max(40),abilityIndex:z.number().int().min(0).max(63).optional(),targetId:z.string().max(40).optional()}).strict(),
 z.object({type:z.literal('activate'),cardId:z.string().min(1).max(40),abilityIndex:z.number().int().min(0).max(63)}).strict(),
 ...(['keep','mulligan','concede'] as const).map(type=>z.object({type:z.literal(type)}).strict()),
]);
export type ForgeAction=z.infer<typeof forgeActionSchema>;
export interface ForgeCard {id:string;name:string;owner:number;controller:number;zone:string;tapped:boolean;token:boolean;type:string;power?:number;toughness?:number;playable?:boolean;landPlayable?:boolean;targetRequired?:boolean;targets?:{id:string;name:string;kind:string}[];isCommander?:boolean;commanderCasts?:number;blockedReason?:string;abilities?:{index:number;name:string;cost?:string;spell:boolean;playable:boolean}[]}
export interface ForgeChoice {automation?:'reveal-land';id:string;seat:number;kind:'cost'|'reveal'|'discard'|'scry'|'surveil'|'confirm'|'select'|'modes'|'targets'|'order'|'attackers'|'blockers'|'damage'|'number';count:number;min?:number;max?:number;repeat?:boolean;title?:string;source?:string;options:{id:string;name:string;kind:string;cardId?:string;targetId?:string}[]}
export interface ForgeReveal {id:string;seat:number;title:string;source:string;cards:{id:string;name:string;kind:string}[]}
export interface ForgeState {reveals?:ForgeReveal[];stage?:'mulligan'|'playing'|'finished';kept?:boolean[];mulligans?:number[];winners?:number[];commanderDamage?:{defender:number;commanderId:string;name:string;amount:number}[];cards:ForgeCard[];stack:{id:string;name:string;controller:number;description:string}[];life:number[];active:number;priority:number;passes:number;turn:number;log:string[];phase?:string;ending?:boolean;combatRunning?:boolean;combat?:{attackerId:string;defenderSeat:number;blockerIds:string[]}[];choice?:ForgeChoice|null}
export interface ForgeView extends ForgeState {handCounts:number[];libraryCounts:number[]}
export interface ForgeRoom {automation:ForgeAutomation;automaticDecisions:ForgeAutomaticDecision[];automationError?:string;code:string;hostId:string;seat:number;players:{id:string;name:string;deckName?:string;commander?:string;cardCount?:number;ready?:boolean;isAi?:boolean;difficulty?:ForgeAiDifficulty}[];aiOpponent?:{deckId:string;difficulty:ForgeAiDifficulty};myDeck?:DeckData;deckErrors?:string[];aiDeckErrors?:string[];revision:number;starting:boolean;scenario?:ForgeScenario;error?:string;game:ForgeView|null}
/** Only the server receives the full snapshot. Hidden identities never leave it. */
export function projectForge(state:ForgeState,seat:number):ForgeView {
 return {...state, ...(state.reveals?{reveals:state.reveals.filter(r=>r.seat===seat)}:{}),choice:state.choice?{...state.choice,title:state.choice.seat===seat?state.choice.title:'Wartet auf Auswahl',source:state.choice.seat===seat?state.choice.source:undefined,automation:state.choice.seat===seat?state.choice.automation:undefined,options:state.choice.seat===seat?state.choice.options:[]}:null,cards:state.cards.filter(c=>c.zone!=='library'&&(c.zone!=='hand'||c.owner===seat)),handCounts:[0,1].map(s=>state.cards.filter(c=>c.zone==='hand'&&c.owner===s).length),libraryCounts:[0,1].map(s=>state.cards.filter(c=>c.zone==='library'&&c.owner===s).length)};
}
