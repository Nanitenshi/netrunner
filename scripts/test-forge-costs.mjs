import {ForgeWorker} from '../server/forge-worker.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'costs'};
if(!config.java||!config.runtime||!config.classes)throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES first.');
async function run(test){
 let state;const worker=new ForgeWorker(config,()=>{},s=>state=s);
 const wait=async fn=>{const end=Date.now()+10000;while(!fn()){if(Date.now()>end)throw Error('Timeout '+JSON.stringify(state?.choice));await new Promise(r=>setTimeout(r,10));}};
 const act=async(who,action,ok=true)=>{const reply=await worker.action(who,action);assert.equal(reply.ok,ok,reply.error);if(reply.state)state=reply.state;return reply;};
 const choose=async(who,answer)=>{const id=state.choice.id;await act(who,{type:'choose',choiceId:id,...answer});await wait(()=>state.choice?.id!==id);};
 const cast=async(name,targetId)=>{const card=state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name===name);assert(card,name);await act(0,{type:'cast',cardId:card.id,...(targetId?{targetId}:{})});return card;};
 const resolve=async()=>{await act(state.priority,{type:'pass'});await act(state.priority,{type:'pass'});};
 try{state=await worker.ready;await test({act,choose,cast,resolve,wait,get state(){return state;}});}finally{worker.stop();}
}
await run(async t=>{
 const original=structuredClone(t.state);const spell=await t.cast('Tormenting Voice');const choice=t.state.choice;
 assert.equal(choice.kind,'cost');assert(!choice.options.some(o=>o.id===spell.id));
 for(const seat of [0,1])assert.equal(t.state.cards.filter(c=>c.owner===seat&&c.tapped).length,0);
 assert.equal(projectForge(t.state,1).choice.options.length,0);
 assert(!JSON.stringify(projectForge(t.state,1)).includes(choice.options[0].id+'"'));
 await t.act(1,{type:'choose',choiceId:choice.id,first:[choice.options[0].id]},false);
 await t.act(0,{type:'choose',choiceId:choice.id,first:[spell.id]},false);
 await t.act(0,{type:'choose',choiceId:choice.id,first:[]},false);
 await t.act(0,{type:'choose',choiceId:choice.id,first:[choice.options[0].id,choice.options[0].id]},false);
 await t.act(0,{type:'choose',choiceId:choice.id,answer:true},false);
 await t.act(0,{type:'choose',choiceId:choice.id,answer:false,first:[choice.options[0].id]},false);
 await t.choose(0,{answer:false});assert.equal(t.state.stack.length,0);assert.equal(t.state.priority,0);
 assert.deepEqual(t.state.cards.map(c=>[c.id,c.zone,c.tapped]),original.cards.map(c=>[c.id,c.zone,c.tapped]));
 await t.act(0,{type:'choose',choiceId:choice.id,answer:false},false);
 await t.cast('Tormenting Voice');const discard=t.state.choice.options.find(o=>o.name==='Forest');assert(discard);
 await t.choose(0,{first:[discard.id]});assert.equal(t.state.stack.length,1);assert(t.state.cards.some(c=>c.id===discard.id&&c.zone==='graveyard'));
 assert.equal(t.state.cards.filter(c=>c.owner===0&&c.tapped).length,2);
 const before=t.state.cards.filter(c=>c.zone==='hand'&&c.owner===0).length;await t.resolve();assert.equal(t.state.cards.filter(c=>c.zone==='hand'&&c.owner===0).length,before+2);
 console.log('PASS private discard choice, invalid answers, cancellation with no payment, explicit discard and draw');
});
await run(async t=>{
 await t.cast('Village Rites');assert.equal(t.state.choice.kind,'cost');const sacrifice=t.state.choice.options.find(o=>o.name==='Colossal Dreadmaw');assert(sacrifice);
 await t.choose(0,{first:[sacrifice.id]});assert(t.state.cards.some(c=>c.id===sacrifice.id&&c.zone==='graveyard'));
 const other=t.state.cards.find(c=>c.owner===0&&c.name==='Grizzly Bears'&&c.zone==='battlefield');assert(other);
 // Costs are already paid when the opponent responds, and are not refunded by a counterspell.
 const counter=t.state.cards.find(c=>c.owner===1&&c.zone==='hand'&&c.name==='Counterspell');
 await t.act(1,{type:'cast',cardId:counter.id,targetId:t.state.stack[0].id});await t.resolve();
 assert.equal(t.state.stack.length,0);assert(t.state.cards.some(c=>c.id===sacrifice.id&&c.zone==='graveyard'));assert(t.state.cards.some(c=>c.id===other.id&&c.zone==='battlefield'));
 console.log('PASS human sacrifice choice, costs precede opponent reactions and remain paid after Counterspell');
});
await run(async t=>{
 const fling=t.state.cards.find(c=>c.owner===0&&c.name==='Fling'&&c.zone==='hand');assert(fling.targets.some(o=>o.id==='player:1'));
 await t.act(0,{type:'cast',cardId:fling.id,targetId:'player:2'},false);assert.equal(t.state.choice,null);
 await t.cast('Fling','player:1');const sacrifice=t.state.choice.options.find(o=>o.name==='Colossal Dreadmaw');
 await t.choose(0,{first:[sacrifice.id]});await t.resolve();assert.deepEqual(t.state.life,[40,34]);
 assert(t.state.cards.some(c=>c.id===sacrifice.id&&c.zone==='graveyard'));
 console.log('PASS player targets and real sacrificed creature last-known power for Fling');
});
