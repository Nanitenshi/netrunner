import {z} from 'zod';
import type {ForgeAction,ForgeChoice} from './forge-protocol.ts';

// Consent is per player and per mechanic. Unknown callbacks stay manual.
export const forgeAutomationSchema=z.object({revealLands:z.boolean()}).strict();
export type ForgeAutomation=z.infer<typeof forgeAutomationSchema>;
export interface ForgeAutomaticDecision {id:string;source:string;cardName:string}
export const manualForgeAutomation=():ForgeAutomation=>({revealLands:false});

/** Only consume options Forge explicitly permits this player to reveal. */
export function automaticRevealLand(choice:ForgeChoice|null|undefined,seat:number):Extract<ForgeAction,{type:'choose'}>|null {
 if(!choice||choice.seat!==seat||choice.automation!=='reveal-land'||choice.kind!=='reveal'||choice.min!==1||choice.max!==1||choice.repeat||!choice.options.length)return null;
 const [first]=choice.options;
 // Different names may expose different information: ask the human instead.
 if(choice.options.some(o=>o.kind!=='card'||!o.name||o.name!==first.name))return null;
 return {type:'choose',choiceId:choice.id,first:[first.id],second:[]};
}
