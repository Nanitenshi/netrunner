import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forgeRuleBadges,forgeRuleText} from '../src/forge-card-rules.ts';
import {forgeActionSchema,projectForge,type ForgeCard,type ForgeState} from '../shared/forge-protocol.ts';
import {checkForgeStartup,ForgeVersionError} from '../server/forge-worker.ts';
const card:ForgeCard={id:'land',name:'Forest',owner:0,controller:0,zone:'battlefield',type:'Land Creature — Forest',tapped:false,token:false,power:2,toughness:2,rules:{instance:'land:42',counters:{'+1/+1':2},keywords:['Haste'],damage:1,regenerationShields:1,summoningSick:false,text:'<b>Haste</b><br>Current ability',attachedTo:'secret',attachments:['aura','secret']}};
test('card status uses only current native counters, damage and shields and clears after a new instance',()=>{
 assert.deepEqual(forgeRuleBadges(card),['+1/+1 ×2','Regeneration ×1','Schaden 1','Angelegt 2']);
 assert.equal(forgeRuleText(card),'Haste\nCurrent ability');
 const blinked={...card,type:'Land — Forest',power:undefined,toughness:undefined,rules:{...card.rules!,instance:'land:99',counters:{},damage:0,regenerationShields:0,keywords:[],attachments:[]}};
 assert.deepEqual(forgeRuleBadges(blinked),[]);assert.equal(forgeRuleBadges({...card,rules:undefined}).length,0);
});
test('attachment metadata cannot disclose a hidden hand or library identity',()=>{
 const secret={...card,id:'secret',name:'Private card',oracleText:'Private Oracle rule',owner:1,controller:1,zone:'hand',rules:undefined};
 const aura={...card,id:'aura',name:'Rancor',rules:undefined};
 const state:ForgeState={cards:[card,aura,secret],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[]};
 const view=projectForge(state,0);assert.deepEqual(view.cards[0].rules?.attachments,['aura']);assert.equal(view.cards[0].rules?.attachedTo,undefined);assert(!JSON.stringify(view).includes('secret'));assert(!JSON.stringify(view).includes('Private card'));assert(!JSON.stringify(view).includes('Private Oracle'));
 assert.deepEqual(state.cards[0].rules?.attachments,['aura','secret']);assert.equal(projectForge(state,1).cards[0].rules?.attachedTo,'secret');
});
test('rule modifiers and instance metadata are never accepted as client authority',()=>{
 for(const fields of [{rules:card.rules},{counters:{'+1/+1':99}},{keywords:['Indestructible']},{instance:'land:42'},{ruleError:null}])assert(!forgeActionSchema.safeParse({type:'land',cardId:'land',...fields}).success);
 assert.throws(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review','p0-actions','action-preparation','combat-decisions']},'commander'),ForgeVersionError);
});
