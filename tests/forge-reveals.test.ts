import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectForge,type ForgeState} from '../shared/forge-protocol.ts';
import {checkForgeStartup,ForgeVersionError} from '../server/forge-worker.ts';
test('reveal callbacks expose cards only to their permitted viewer and do not expose the rest of a hidden zone',()=>{
 const state:ForgeState={cards:[{id:'hidden',name:'Unrevealed card',owner:1,controller:1,zone:'hand',type:'Land',tapped:false,token:false}],stack:[],life:[40,40],active:0,priority:0,passes:0,turn:1,log:[],reveals:[{id:'look',seat:0,title:'Private look',source:'Private source',cards:[{id:'top',name:'Looked-at card',kind:'card'}]},{id:'public',seat:1,title:'Revealed land',source:'Port Town',cards:[{id:'shown',name:'Plains',kind:'card'}]}]};
 const zero=projectForge(state,0),one=projectForge(state,1);
 assert.equal(zero.reveals?.length,1);assert.equal(one.reveals?.length,1);
 assert(!JSON.stringify(one).includes('Private'));assert(!JSON.stringify(one).includes('Looked-at'));assert(!JSON.stringify(one).includes('"top"'));
 assert(!JSON.stringify(zero).includes('Plains'));assert(!JSON.stringify(zero).includes('Unrevealed card'));assert.deepEqual(zero.handCounts,[0,1]);
 assert(!zero.cards.some(c=>c.id==='top'||c.id==='shown'),'Knowledge from a reveal must not turn a hidden card into a playable public card');
});
test('Commander startup rejects old controllers that still choose hand reveals for humans',()=>{
 assert.throws(()=>checkForgeStartup({mode:'commander',features:['ai']},'commander'),ForgeVersionError);
 assert.doesNotThrow(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review']},'commander'));
 assert.throws(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review']},'commander',true),ForgeVersionError);
 assert.doesNotThrow(()=>checkForgeStartup({mode:'commander',features:['ai','human-reveals','optional-reveal-automation','payment-review']},'commander',true));
});
