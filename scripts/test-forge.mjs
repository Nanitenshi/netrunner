import {ForgeWorker} from '../server/forge-worker.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES};
if(!Object.values(config).every(Boolean))throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES before running this integration test.');
const worker=new ForgeWorker(config,()=>{});
let state;const act=async(seat,action,ok=true)=>{const r=await worker.action(seat,action);assert.equal(r.ok,ok,r.error);state=r.state;return r;};
const end=async()=>{const who=state.active;await act(who,{type:'endTurn'});assert.equal(state.phase,'END_OF_TURN');await act(who,{type:'pass'});await act(1-who,{type:'pass'});};
try{
 state=await worker.ready;await act(1,{type:'endTurn'},false);
 await end();assert.equal(state.turn,2);assert.equal(state.active,1);assert.equal(state.cards.filter(c=>c.owner===1&&c.zone==='hand').length,7);
 await end();assert.equal(state.turn,3);await end();assert.equal(state.turn,4);await end();
 assert.equal(state.choice?.seat,1);assert.equal(state.choice?.count,1);assert.equal(state.turn,4);assert.equal(state.phase,'END_OF_TURN');
 const choice=structuredClone(state.choice);assert.equal(projectForge(state,0).choice.options.length,0);assert.equal(projectForge(state,1).choice.options.length,8);
 await act(0,{type:'discard',choiceId:choice.id,cardIds:[choice.options[0].id]},false);
 await act(1,{type:'pass'},false);await act(1,{type:'discard',choiceId:choice.id,cardIds:[]},false);
 await act(1,{type:'discard',choiceId:choice.id,cardIds:[choice.options[0].id,choice.options[0].id]},false);
 assert.equal(state.choice.id,choice.id);await act(1,{type:'discard',choiceId:choice.id,cardIds:[choice.options[0].id]});
 assert.equal(state.turn,5);assert.equal(state.active,0);assert.equal(state.phase,'MAIN1');assert.equal(state.choice,null);assert.equal(state.cards.filter(c=>c.owner===1&&c.zone==='hand').length,7);assert(state.cards.some(c=>c.id===choice.options[0].id&&c.zone==='graveyard'));
 console.log('PASS: genuine Forge turn transitions and human cleanup decision');
}finally{worker.stop();}
