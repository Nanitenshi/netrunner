import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectForge,forgeActionSchema,type ForgeState} from '../shared/forge-protocol.ts';
test('Forge projections never disclose opponent hands or either library',()=>{
 const state:ForgeState={cards:[{id:'secret',name:'Hidden opponent card',owner:1,controller:1,zone:'hand',tapped:false,token:false,type:'Instant'},{id:'deck',name:'Hidden library card',owner:0,controller:0,zone:'library',tapped:false,token:false,type:'Land'},{id:'own',name:'Own card',owner:0,controller:0,zone:'hand',tapped:false,token:false,type:'Instant'}],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[]};
 const view=projectForge(state,0);assert.deepEqual(view.cards.map(c=>c.id),['own']);assert.deepEqual(view.handCounts,[1,1]);assert.deepEqual(view.libraryCounts,[1,0]);assert(!JSON.stringify(view).includes('Hidden'));assert.equal(state.cards.length,3);
});
test('Forge actions reject client-supplied seats, state and arbitrary commands',()=>{
 assert(forgeActionSchema.safeParse({type:'cast',cardId:'1',targetId:'stack:2'}).success);
 assert(forgeActionSchema.safeParse({type:'cast',cardId:'1',reviewPayment:true}).success);
 assert(forgeActionSchema.safeParse({type:'cast',cardId:'1',reviewPayment:false}).success);
 assert(!forgeActionSchema.safeParse({type:'cast',cardId:'1',reviewPayment:'false'}).success);
 for(const action of [{type:'cast',cardId:'1',seat:1},{type:'pass',state:{}},{type:'eval',command:'anything'}])assert(!forgeActionSchema.safeParse(action).success);
});
test('discard options remain private while the public decision count is shared',()=>{
 const state:ForgeState={cards:[],stack:[],life:[40,40],active:1,priority:1,passes:0,turn:4,log:[],choice:{id:'choice',seat:1,kind:'discard',count:1,options:[{id:'private',name:'Secret card',kind:'card'}]}};
 assert.deepEqual(projectForge(state,0).choice?.options,[]);
 assert.equal(projectForge(state,0).choice?.count,1);
 assert.equal(projectForge(state,1).choice?.options[0].name,'Secret card');
 assert.equal(state.choice?.options.length,1);
});

test('native payment details and source preferences stay private until the spell is committed',()=>{
 const state:ForgeState={cards:[],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[],choice:{id:'payment',seat:0,kind:'payment',source:'Secret spell',title:'Mana-Zahlung prüfen',count:0,min:0,max:1,options:[{id:'source',name:'Plains',kind:'card'}],payment:{cost:'{W}',commanderTax:0,selectable:true,selectedIds:['source'],steps:[{sourceId:'source',name:'Plains',cost:0,produces:{W:1}}],pool:{},error:''}}};
 assert.equal(projectForge(state,0).choice?.payment?.cost,'{W}');assert.equal(projectForge(state,1).choice?.payment,undefined);assert(!JSON.stringify(projectForge(state,1)).includes('Secret spell'));assert.deepEqual(projectForge(state,1).choice?.options,[]);assert(state.choice?.payment);
 for(const extra of [{mana:{W:99}},{cost:'{0}'},{sourceIds:['foreign']}])assert(!forgeActionSchema.safeParse({type:'choose',choiceId:'00000000-0000-4000-8000-000000000000',first:[],...extra}).success);
});
