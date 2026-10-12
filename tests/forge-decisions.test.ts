import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forgeActionSchema,projectForge,type ForgeState} from '../shared/forge-protocol.ts';
test('Scry snapshots hide options, private prompts and their source from the other seat',()=>{
 const state:ForgeState={cards:[],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[],choice:{id:'x',seat:0,kind:'scry',count:0,min:0,max:2,title:'Secret prompt',source:'Hidden source',options:[{id:'library-id',name:'Private card',kind:'card'}]}};
 assert(!JSON.stringify(projectForge(state,1)).includes('Private card'));
 assert(!JSON.stringify(projectForge(state,1)).includes('library-id'));
 assert(!JSON.stringify(projectForge(state,1)).includes('Secret prompt'));
 assert(!JSON.stringify(projectForge(state,1)).includes('Hidden source'));
 assert.equal(projectForge(state,0).choice?.options[0].name,'Private card');
});

test('discard cost candidates and prompts remain private while a spell is being announced',()=>{
 const state:ForgeState={cards:[],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[],choice:{id:'cost',seat:0,kind:'cost',count:1,min:1,max:1,title:'Private cost prompt',source:'Tormenting Voice',options:[{id:'hand-secret',name:'Private hand card',kind:'card'}]}};
 const opponent=projectForge(state,1);
 assert(!JSON.stringify(opponent).includes('hand-secret'));
 assert(!JSON.stringify(opponent).includes('Private'));
 assert.equal(projectForge(state,0).choice?.options[0].id,'hand-secret');
 assert(forgeActionSchema.safeParse({type:'choose',choiceId:'b40d1f76-c75b-44a3-920f-1026c9ff095f',answer:false}).success);
});
test('decision answers have strict bounded inputs without a client-provided player or game state',()=>{
 const id='b40d1f76-c75b-44a3-920f-1026c9ff095f';
 assert(forgeActionSchema.safeParse({type:'choose',choiceId:id,answer:false}).success);
 assert(forgeActionSchema.safeParse({type:'choose',choiceId:id,first:['a'],second:['b']}).success);
 for(const extra of [{seat:1},{state:{}},{command:'eval'}])assert(!forgeActionSchema.safeParse({type:'choose',choiceId:id,...extra}).success);
 assert(!forgeActionSchema.safeParse({type:'choose',choiceId:id,first:Array(129).fill('a')}).success);
 assert(!forgeActionSchema.safeParse({type:'choose',choiceId:'old'}).success);
});
