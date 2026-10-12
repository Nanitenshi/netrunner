import {ForgeWorker} from '../server/forge-worker.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'decisions'};
if(!config.java||!config.runtime||!config.classes)throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES first.');
const results=[];
async function run(test){let state,updates=0;const worker=new ForgeWorker(config,()=>{},s=>{state=s;updates++;});
 const wait=async(fn)=>{const limit=Date.now()+10000;while(!fn()){if(Date.now()>limit)throw Error('Timeout '+JSON.stringify(state?.choice));await new Promise(r=>setTimeout(r,10));}};
 const act=async(who,action,ok=true)=>{const r=await worker.action(who,action);assert.equal(r.ok,ok,r.error);if(r.state)state=r.state;return r;};
 const choose=async(who,a)=>{const id=state.choice.id;await act(who,{type:'choose',choiceId:id,...a});await wait(()=>state.choice?.id!==id);};
 const cast=async name=>{const card=state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name===name);assert(card);return act(0,{type:'cast',cardId:card.id});};
 const resolveTop=async()=>{await act(state.priority,{type:'pass'});return act(state.priority,{type:'pass'});};
 try{state=await worker.ready;await test({act,choose,cast,resolveTop,wait,get state(){return state;},get updates(){return updates;}});}finally{worker.stop();}
}
await run(async t=>{
 await t.cast('Preordain');await t.resolveTop();assert.equal(t.state.choice.kind,'scry');const c=structuredClone(t.state.choice);
 assert.equal(projectForge(t.state,1).choice.options.length,0);assert(!JSON.stringify(projectForge(t.state,1)).includes(c.options[0].id+'"'));
 await t.act(1,{type:'choose',choiceId:c.id,first:[c.options[0].id],second:[c.options[1].id]},false);
 await t.act(0,{type:'choose',choiceId:c.id,first:[c.options[0].id],second:[c.options[0].id]},false);
 await t.act(0,{type:'pass'},false);await t.act(0,{type:'choose',choiceId:c.id,first:['999999'],second:[]},false);
 await t.choose(0,{first:[c.options[1].id],second:[c.options[0].id]});assert(t.state.cards.some(v=>v.id===c.options[1].id&&v.zone==='hand'));assert.equal(t.state.stack.length,0);
 await t.cast('Impulse');await t.resolveTop();assert.equal(t.state.choice.kind,'select');const pick=t.state.choice.options.at(-1).id;await t.choose(0,{first:[pick]});assert(t.state.choice);const order=t.state.choice.options.map(o=>o.id).reverse();await t.choose(0,{first:order});assert(t.state.cards.some(v=>v.id===pick&&v.zone==='hand'));
 await t.cast('Innocent Blood');await t.resolveTop();const sacrifices=[];while(t.state.choice){const chooser=t.state.choice.seat,card=t.state.choice.options[0];sacrifices.push(card.id);await t.choose(chooser,{first:[card.id]});}assert.equal(sacrifices.length,2);for(const id of sacrifices)assert(t.state.cards.some(c=>c.id===id&&c.zone==='graveyard'));results.push('scry private ordering/draw, Impulse selection and order, sacrifice by each human');
});
await run(async t=>{
 await t.cast('You Meet in a Tavern');assert.equal(t.state.choice.kind,'modes');assert(t.state.cards.filter(c=>c.zone==='battlefield').every(c=>!c.tapped));const mode=t.state.choice.options[1];await t.choose(0,{first:[mode.id]});assert.equal(t.state.stack.length,1);await t.resolveTop();assert(t.state.cards.some(c=>c.owner===0&&c.name==='Grizzly Bears'&&c.power===4));results.push('human mode before mana payment, real +2/+2 resolution');
});
await run(async t=>{
 await t.cast('Raise the Alarm');await t.resolveTop();let prompts=0;while(t.state.choice||t.state.stack.length){if(!t.state.choice){await t.resolveTop();continue;}assert.equal(t.state.choice.kind,'confirm');const chooser=t.state.choice.seat;await t.choose(chooser,{answer:prompts<2});prompts++;assert(prompts<=4);}assert.equal(prompts,4);assert.equal(t.state.life.reduce((a,b)=>a+b,0),82);assert.equal(t.state.cards.filter(c=>c.token&&c.zone==='battlefield').length,2);results.push('four optional triggers, accept/decline, tokens');
});
await run(async t=>{
 await t.cast("Man-o'-War");await t.resolveTop();assert.equal(t.state.choice.kind,'order');await t.choose(0,{first:t.state.choice.options.map(o=>o.id)});assert.equal(t.state.choice.kind,'targets');const target=t.state.cards.find(c=>c.owner===1&&c.name==='Grizzly Bears'&&c.zone==='battlefield');await t.choose(0,{first:[target.id]});assert(t.state.stack.some(s=>s.name==="Man-o'-War"));
 while(t.state.stack.length||t.state.choice){if(t.state.choice){assert.equal(t.state.choice.kind,'confirm');await t.choose(t.state.choice.seat,{answer:false});}else await t.resolveTop();}
 assert(t.state.cards.some(c=>c.id===target.id&&c.zone==='hand'));assert(t.state.cards.some(c=>c.owner===0&&c.name==='Grizzly Bears'&&c.zone==='battlefield'));results.push('human trigger order and legal target before trigger enters stack');
});
console.log('PASS:',results.join('; '));
