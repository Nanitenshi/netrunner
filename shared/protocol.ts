import {z} from 'zod';
import {cardKeywords} from './card-state.ts';
const stat=z.string().regex(/^(?:-?\d{1,3}|\*|\d{1,2}\+\*)$/).nullable();
import type {GameView} from './game.ts';
import {cardCounterTypes,playerCounterTypes} from './counters.ts';
import {effectKinds} from './rules-types.ts';
import {manaColors} from './mana.ts';
export const deckSchema=z.object({id:z.string().min(1).max(100),name:z.string().trim().min(1).max(60),commanderId:z.string().max(100),secondCommanderId:z.string().max(100).optional(),commanderColors:z.record(z.string().max(100),z.enum(['W','U','B','R','G'])).optional(),cardGroups:z.record(z.string().max(100),z.string().trim().min(1).max(40)).refine(groups=>Object.keys(groups).length<=500).optional(),notes:z.string().max(5000).optional(),quantities:z.record(z.string().max(100),z.number().int().min(1).max(99))}).strict();
export type DeckData=z.infer<typeof deckSchema>;
const cardId=z.string().min(1).max(100);
const amount=z.number().int().min(-100).max(100);
const reason=z.string().trim().min(3).max(160);
const effectSchema=z.object({playerId:cardId.optional(),kind:z.enum(effectKinds),value:z.number().int().min(0).max(999),sourceCardId:cardId.optional(),destination:z.enum(['hand','battlefield','library']).optional(),filter:z.enum(['any','land','basic','creature']).optional(),reveal:z.boolean().optional(),shuffle:z.boolean().optional(),tapped:z.boolean().optional()}).strict();
export const actionSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('loyaltyCost'),cardId,index:z.number().int().min(0).max(30),x:z.number().int().min(0).max(999)}).strict(),
 z.object({type:z.literal('batchCards'),cardIds:z.array(cardId).min(1).max(200),operation:z.enum(['tap','untap','sacrifice','hand','exile'])}).strict(),
 z.object({type:z.literal('combat'),cardIds:z.array(cardId).max(200),operation:z.enum(['attack','block','remove','end']),targetId:cardId.optional()}).strict(),
 z.object({type:z.literal('timedEffect'),cardIds:z.array(cardId).min(1).max(200),label:z.string().trim().min(1).max(80),duration:z.enum(['turn','source','manual']),sourceId:cardId.optional(),power:z.number().int().min(-999).max(999),toughness:z.number().int().min(-999).max(999)}).strict(),
 z.object({type:z.literal('endEffect'),effectId:cardId}).strict(),
 z.object({type:z.literal('linkedCards'),sourceId:cardId,cardIds:z.array(cardId).min(1).max(200),operation:z.enum(['hand','battlefield','copy','spellCopy']),targetId:cardId.optional()}).strict(),
 z.object({type:z.literal('undoTableEdit'),editId:cardId,reason}).strict(),
 z.object({type:z.literal('deckAction'),operation:z.enum(['look','reveal','search','mill','exile','stealExile','take','hand','bottom','close','clash']),playerId:cardId,count:z.number().int().min(1).max(100).optional(),cardIds:z.array(cardId).max(100).optional()}).strict(),
 z.object({type:z.literal('batchCardCounters'),cardIds:z.array(cardId).min(1).max(200),counter:z.enum([...cardCounterTypes,'custom']),name:z.string().min(1).max(28).optional(),amount:z.number().int().min(-999).max(999)}).strict(),
 z.object({type:z.literal('effectLink'),cardIds:z.array(cardId).min(1).max(100),sourceId:cardId.optional(),label:z.string().trim().min(1).max(80).optional(),removeId:cardId.optional()}).strict(),
 z.object({type:z.literal('tableTracker'),operation:z.enum(['create','move','change','remove','drop']),id:cardId.optional(),kind:z.enum(['card','player','custom','damage']).optional(),key:z.string().min(1).max(100).optional(),value:z.number().int().min(-999).max(999).optional(),x:z.number().min(0).max(1).optional(),y:z.number().min(0).max(1).optional(),cardId:cardId.optional()}).strict(),
 z.object({type:z.literal('setLandBonus'),count:z.number().int().min(0).max(998)}).strict(),
 z.object({type:z.literal('editCard'),cardId,patch:z.object({power:stat.optional(),toughness:stat.optional(),keywords:z.array(z.enum(cardKeywords)).max(12).optional(),note:z.string().max(160).optional(),faceIndex:z.number().int().min(0).max(1).optional()}).strict().refine(v=>Object.keys(v).length>0)}).strict(),
 z.object({type:z.literal('attach'),cardId,targetId:cardId.nullable()}).strict(),
 z.object({type:z.literal('browseLibrary'),open:z.boolean()}).strict(),
 z.object({type:z.literal('libraryPick'),cardIds:z.array(cardId).max(100),destination:z.enum(['hand','battlefield','graveyard','exile','library']),shuffle:z.boolean(),tapped:z.boolean()}).strict(),
 z.object({type:z.literal('createToken'),tokenId:cardId,count:z.number().int().min(1).max(30)}).strict(),
 z.object({type:z.literal('castHidden'),cardId,conditionsMet:z.boolean(),costsPaid:z.boolean(),targetId:cardId.optional()}).strict(),
 z.object({type:z.literal('lateCast'),cardId,targetId:cardId.optional(),costsPaid:z.boolean(),reason}).strict(),
 z.object({type:z.literal('lateAbility'),label:z.string().trim().min(1).max(100),sourceCardId:cardId.optional(),abilityType:z.enum(['activated','triggered']).optional(),reason}).strict(),
 z.object({type:z.literal('withdrawStack'),stackId:cardId,reason}).strict(),
 z.object({type:z.literal('resolveSwords'),choiceId:cardId,power:z.number().int().min(-999).max(999)}).strict(),
 z.object({type:z.literal('correctCard'),cardId,zone:z.enum(['library','hand','battlefield','graveyard','exile','commander']),tapped:z.boolean(),commanderCasts:z.number().int().min(0).max(100).optional(),libraryPosition:z.enum(['top','bottom']).optional(),reason}).strict(),
 z.object({type:z.literal('correctDraw'),count:z.number().int().min(1).max(20),reason}).strict(),
 z.object({type:z.literal('mana'),color:z.enum(manaColors),amount,sourceCardId:cardId.optional()}).strict(),
 z.object({type:z.literal('clearMana')}).strict(),
 z.object({type:z.literal('retainMana'),enabled:z.boolean()}).strict(),
 z.object({type:z.literal('rollDice'),sides:z.number().int().min(2).max(1000),count:z.number().int().min(1).max(20)}).strict(),
 z.object({type:z.literal('flipCoin'),count:z.number().int().min(1).max(20)}).strict(),
 z.object({type:z.literal('cast'),faceIndex:z.number().int().min(0).max(1).optional(),cardId,targetId:cardId.optional(),costsPaid:z.boolean(),passPriority:z.boolean().optional(),payFromPool:z.boolean().optional()}).strict(),
 ...(['endTurn','concede','mulligan','keep','pass','shuffle'] as const).map(type=>z.object({type:z.literal(type)}).strict()),
 z.object({type:z.literal('effect'),effect:effectSchema,sourceId:cardId.optional()}).strict(),
 z.object({type:z.literal('ability'),label:z.string().trim().min(1).max(100),sourceCardId:cardId.optional(),abilityType:z.enum(['activated','triggered']).optional()}).strict(),
 z.object({type:z.literal('counterStack'),choiceId:cardId,stackId:cardId}).strict(),
 z.object({type:z.literal('resolveEffect'),choiceId:cardId,effect:effectSchema}).strict(),
 z.object({type:z.literal('choose'),choiceId:cardId,first:z.array(cardId).max(1200),second:z.array(cardId).max(1200),decision:z.enum(['cast','hand','decline','done']).optional(),targetId:cardId.optional(),costsPaid:z.boolean().optional()}).strict(),
 z.object({type:z.literal('cardCounter'),cardId,counter:z.enum(cardCounterTypes),amount:z.number().int().min(-999).max(999)}).strict(),
 z.object({type:z.literal('playerCounter'),counter:z.enum(playerCounterTypes),amount:z.number().int().min(-999).max(999)}).strict(),
 z.object({type:z.literal('customCounter'),cardId:cardId.optional(),name:z.string().min(1).max(56),amount:z.number().int().min(-999).max(999)}).strict(),
 z.object({type:z.literal('commanderDamage'),commanderId:cardId,amount,adjustLife:z.boolean()}).strict(),
 z.object({type:z.literal('life'),amount}).strict(),
 ...(['draw','nextPhase','arrange','untapAll'] as const).map(type=>z.object({type:z.literal(type)}).strict()),
 ...(['tap','castCommander'] as const).map(type=>z.object({type:z.literal(type),cardId}).strict()),
 z.object({type:z.literal('move'),faceIndex:z.number().int().min(0).max(1).optional(),cardId,zone:z.enum(['library','hand','battlefield','graveyard','exile','commander'])}).strict(),
 z.object({type:z.literal('counter'),cardId,amount}).strict(),
 z.object({type:z.literal('position'),cardId,x:z.number().min(-5).max(5),y:z.number().min(-5).max(5)}).strict(),
 z.object({type:z.literal('copy'),cardId,newId:z.string().max(100).optional()}).strict(),
 z.object({type:z.literal('control'),cardId,mode:z.enum(['take','return'])}).strict()
]);
export interface User {id:string;name:string;provider:'guest'|'discord'}
export interface RoomView {code:string;hostId:string;seat:string;started:boolean;revision:number;botsPaused?:boolean;combat?:{id:string;attackerId:string;defenderId:string;cardIds:string[]}|null;players:{id:string;deckId?:string;name:string;ready:boolean;connected:boolean;bot?:boolean;commander:string}[];game:GameView|null}
export interface Reply {ok:boolean;error?:string}
