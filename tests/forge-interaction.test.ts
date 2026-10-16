import {test} from 'node:test';
import assert from 'node:assert/strict';
import {primaryForgeAction,forgeActionLabel} from '../src/forge-interaction.ts';
import {forgeActionSchema,type ForgeCard} from '../shared/forge-protocol.ts';
const land:ForgeCard={id:'land',name:'Secluded Steppe',owner:0,controller:0,zone:'hand',type:'Land',tapped:false,token:false,playable:true,landPlayable:true,abilities:[{index:1,name:'Cycling',cost:'{W}',spell:false,playable:true}]};
test('land drop is the primary action even when a hand ability is available',()=>{
 assert.deepEqual(primaryForgeAction(land),{type:'land',cardId:'land'});assert.equal(forgeActionLabel(land),'Land spielen');
 const cycling={...land,landPlayable:false};assert.equal(primaryForgeAction(cycling),null);assert.equal(forgeActionLabel(cycling),'Fähigkeit wählen · {W}');
 assert.equal(primaryForgeAction({...land,playable:false}),null);
});
test('spell action uses its exact card and ability; alternatives require selection',()=>{
 const commander={...land,id:'commander',zone:'command',type:'Creature',landPlayable:undefined,abilities:[{index:2,name:'Commander',cost:'{2}{W}',spell:true,playable:true}]};
 assert.deepEqual(primaryForgeAction(commander),{type:'cast',cardId:'commander',abilityIndex:2});assert.equal(forgeActionLabel(commander),'Wirken · {2}{W}');
 assert.equal(primaryForgeAction({...commander,abilities:[...commander.abilities,{...commander.abilities[0],index:3}]}),null);
 assert.equal(forgeActionLabel({...commander,playable:false,blockedReason:'Du hast keine Priorität'}),'Kosten {2}{W} · Du hast keine Priorität');
});
test('priority hold is a boolean preference on native casts and activations only',()=>{
 for(const type of ['cast','activate']){
  assert(forgeActionSchema.safeParse({type,cardId:'card',abilityIndex:0,holdPriority:true}).success);
  assert(!forgeActionSchema.safeParse({type,cardId:'card',abilityIndex:0,holdPriority:'yes'}).success);
 }
 assert(!forgeActionSchema.safeParse({type:'endTurn',confirmed:true}).success);
 assert(!forgeActionSchema.safeParse({type:'land',cardId:'card',holdPriority:true}).success);
});
