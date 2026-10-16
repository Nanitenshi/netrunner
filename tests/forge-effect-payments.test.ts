import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forgeActionSchema,projectForge,type ForgeState} from '../shared/forge-protocol.ts';
import {checkForgeStartup,ForgeVersionError} from '../server/forge-worker.ts';

test('effect costs, private source plans and discard choices stay with the native payer',()=>{
 const state:ForgeState={cards:[],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[],choice:{id:'effect',seat:1,kind:'payment',count:0,purpose:'effect-payment',source:'Rhystic Study',options:[{id:'private-source',name:'Secret option',kind:'card'}],effectPayment:{cost:'{1}',canPay:true,alreadyPaid:false,description:'Native effect description'},payment:{action:'effect',cost:'{1}',commanderTax:0,selectable:true,selectedIds:['private-source'],steps:[],pool:{U:1},error:''}}};
 const own=projectForge(state,1).choice!,other=projectForge(state,0).choice!;
 assert.equal(own.effectPayment?.cost,'{1}');assert.equal(own.payment?.action,'effect');assert.equal(own.purpose,'effect-payment');
 assert.equal(other.effectPayment,undefined);assert.equal(other.payment,undefined);assert.equal(other.purpose,undefined);assert.deepEqual(other.options,[]);assert(!JSON.stringify(other).includes('private-source'));assert(!JSON.stringify(other).includes('Native effect description'));
});
test('clients cannot submit effect cost, affordability or a mana plan as authoritative state',()=>{
 const valid={type:'choose',choiceId:'00000000-0000-4000-8000-000000000024',first:['native-source']};assert(forgeActionSchema.safeParse(valid).success);
 for(const field of [{effectPayment:{canPay:true}},{purpose:'effect-payment'},{payment:{cost:'{0}'}},{alreadyPaid:true}])assert(!forgeActionSchema.safeParse({...valid,...field}).success);
});
test('Commander refuses an adapter that still delegates effect payments to AI',()=>{
 const features=['human-reveals','optional-reveal-automation','payment-review','p0-actions','action-preparation','combat-decisions','rule-effects'];
 assert.throws(()=>checkForgeStartup({mode:'commander',features},'commander'),ForgeVersionError);
 assert.doesNotThrow(()=>checkForgeStartup({mode:'commander',features:[...features,'human-effect-payments']},'commander'));
});
