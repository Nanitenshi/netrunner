import {z} from 'zod';
export const forgeActionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('pass')}).strict(),
 z.object({type:z.literal('endTurn')}).strict(),
 z.object({type:z.literal('combat')}).strict(),
 z.object({type:z.literal('land'),cardId:z.string().min(1).max(40)}).strict(),
 z.object({type:z.literal('discard'),choiceId:z.string().uuid(),cardIds:z.array(z.string().min(1).max(40)).max(100)}).strict(),
 z.object({type:z.literal('choose'),choiceId:z.string().uuid(),first:z.array(z.string().min(1).max(60)).max(128).default([]),second:z.array(z.string().min(1).max(60)).max(128).default([]),answer:z.boolean().optional()}).strict(),
 z.object({type:z.literal('cast'),cardId:z.string().max(40),targetId:z.string().max(40).optional()}).strict(),
]);
export type ForgeAction=z.infer<typeof forgeActionSchema>;
export interface ForgeCard {id:string;name:string;owner:number;controller:number;zone:string;tapped:boolean;token:boolean;type:string;power?:number;toughness?:number;playable?:boolean;targetRequired?:boolean;targets?:{id:string;name:string;kind:string}[]}
export interface ForgeChoice {id:string;seat:number;kind:'discard'|'scry'|'surveil'|'confirm'|'select'|'modes'|'targets'|'order'|'attackers'|'blockers'|'damage';count:number;min?:number;max?:number;repeat?:boolean;title?:string;source?:string;options:{id:string;name:string;kind:string;cardId?:string;targetId?:string}[]}
export interface ForgeState {cards:ForgeCard[];stack:{id:string;name:string;controller:number;description:string}[];life:number[];active:number;priority:number;passes:number;turn:number;log:string[];phase?:string;ending?:boolean;combatRunning?:boolean;combat?:{attackerId:string;defenderSeat:number;blockerIds:string[]}[];choice?:ForgeChoice|null}
export interface ForgeView extends ForgeState {handCounts:number[];libraryCounts:number[]}
export interface ForgeRoom {code:string;hostId:string;seat:number;players:{id:string;name:string}[];revision:number;starting:boolean;scenario?:'standard'|'decisions'|'combat';error?:string;game:ForgeView|null}
/** Only the server receives the full snapshot. Hidden identities never leave it. */
export function projectForge(state:ForgeState,seat:number):ForgeView {
 return {...state,choice:state.choice?{...state.choice,title:state.choice.seat===seat?state.choice.title:'Wartet auf Auswahl',source:state.choice.seat===seat?state.choice.source:undefined,options:state.choice.seat===seat?state.choice.options:[]}:null,cards:state.cards.filter(c=>c.zone!=='library'&&(c.zone!=='hand'||c.owner===seat)),handCounts:[0,1].map(s=>state.cards.filter(c=>c.zone==='hand'&&c.owner===s).length),libraryCounts:[0,1].map(s=>state.cards.filter(c=>c.zone==='library'&&c.owner===s).length)};
}
