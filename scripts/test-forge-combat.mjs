import {ForgeWorker} from '../server/forge-worker.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'combat'};
if(!config.java||!config.runtime||!config.classes)throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES first.');
let caseIndex=0;
async function run(test){if(process.env.FORGE_TEST_CASE&&Number(process.env.FORGE_TEST_CASE)!==++caseIndex)return;let state;const worker=new ForgeWorker(config,()=>{},s=>state=s);
 const wait=async fn=>{const limit=Date.now()+10000;while(!fn()){if(Date.now()>limit)throw Error('Timeout '+JSON.stringify(state));await new Promise(r=>setTimeout(r,10));}};
 const act=async(who,a,ok=true)=>{const r=await worker.action(who,a);assert.equal(r.ok,ok,r.error);if(r.state)state=r.state;return r;};
 const choose=async(who,a)=>{const id=state.choice.id;await act(who,{type:'choose',choiceId:id,...a});await wait(()=>state.choice?.id!==id);};
 const both=async()=>{await act(state.priority,{type:'pass'});await act(state.priority,{type:'pass'});};
 const card=(who,name)=>state.cards.find(c=>c.controller===who&&c.zone==='battlefield'&&c.name===name);
 const begin=async names=>{await act(0,{type:'combat'});assert.equal(state.phase,'COMBAT_BEGIN');await both();assert.equal(state.choice.kind,'attackers');const ids=names.map(name=>card(0,name).id);await choose(0,{first:ids});assert.equal(state.phase,'COMBAT_DECLARE_ATTACKERS');return ids;};
 try{state=await worker.ready;await test({act,choose,both,card,begin,wait,get state(){return state;}});}catch(e){console.log(JSON.stringify(state,null,2));throw e;}finally{worker.stop();}
}
await run(async t=>{
 await t.act(1,{type:'combat'},false);const [attacker]=await t.begin(['Grizzly Bears']);assert(t.card(0,'Grizzly Bears').tapped);
 await t.act(0,{type:'endTurn'},false);await t.both();assert.equal(t.state.choice.kind,'blockers');await t.act(0,{type:'choose',choiceId:t.state.choice.id,first:[]},false);await t.choose(1,{first:[]});await t.both();assert.equal(t.state.life[1],38);assert.equal(t.state.phase,'COMBAT_DAMAGE');await t.both();assert.equal(t.state.phase,'MAIN2');assert(!t.state.combatRunning);assert(t.state.combat.length===0);console.log('PASS unblocked damage, priority windows, no early end-turn');
});
await run(async t=>{
 await t.begin(['Air Elemental']);await t.both();const ground=t.card(1,'Grizzly Bears'),fly=t.card(0,'Air Elemental');assert(!t.state.choice.options.some(o=>o.cardId===ground.id));await t.act(1,{type:'choose',choiceId:t.state.choice.id,first:[ground.id+':'+fly.id]},false);await t.choose(1,{first:[]});await t.both();assert.equal(t.state.life[1],36);console.log('PASS flying restrictions enforced by Forge');
});
await run(async t=>{
 await t.begin(['Fencing Ace']);await t.both();const ace=t.card(0,'Fencing Ace'),bear=t.card(1,'Grizzly Bears');await t.choose(1,{first:[bear.id+':'+ace.id]});await t.both();assert.equal(t.state.phase,'COMBAT_FIRST_STRIKE_DAMAGE');assert(t.card(1,'Grizzly Bears'));await t.both();assert(!t.card(1,'Grizzly Bears'));assert(!t.card(0,'Fencing Ace'));assert.equal(t.state.life[1],40);console.log('PASS double strike, first-strike window, simultaneous regular damage and deaths');
});
await run(async t=>{
 await t.begin(['Colossal Dreadmaw']);await t.both();const attacker=t.card(0,'Colossal Dreadmaw'),bear=t.card(1,'Grizzly Bears'),lion=t.card(1,'Silvercoat Lion');await t.choose(1,{first:[bear.id+':'+attacker.id,lion.id+':'+attacker.id]});await t.both();assert.equal(t.state.choice.kind,'damage');await t.choose(0,{first:Array(6).fill('defender')});assert.equal(t.state.choice.kind,'damage');assert.deepEqual(t.state.life,[40,40]);await t.choose(0,{first:[bear.id,bear.id,lion.id,lion.id,'defender','defender']});assert.equal(t.state.choice.kind,'select');await t.choose(1,{first:t.state.choice.options.map(o=>o.id)});assert.equal(t.state.life[1],38);assert(!t.card(1,'Grizzly Bears'));assert(!t.card(1,'Silvercoat Lion'));assert(t.card(0,'Colossal Dreadmaw'));console.log('PASS multi-block, human allocation, lethal requirement before trample');
});
await run(async t=>{
 await t.begin(['Vampire Nighthawk']);await t.both();const source=t.card(0,'Vampire Nighthawk'),blocker=t.card(1,'Air Elemental');await t.choose(1,{first:[blocker.id+':'+source.id]});await t.both();assert(!t.card(1,'Air Elemental'));assert(!t.card(0,'Vampire Nighthawk'));assert.equal(t.state.life[0],42);console.log('PASS deathtouch and lifelink handled by Forge');
});
await run(async t=>{
 const attacker=t.card(0,'Grizzly Bears');await t.begin(['Grizzly Bears']);await t.act(0,{type:'pass'});const swords=t.state.cards.find(c=>c.owner===1&&c.zone==='hand'&&c.name==='Swords to Plowshares');await t.act(1,{type:'cast',cardId:swords.id,targetId:attacker.id});assert.equal(t.state.stack.length,1);await t.both();assert(t.state.cards.some(c=>c.id===attacker.id&&c.zone==='exile'));for(let i=0;i<6&&t.state.phase!=='MAIN2';i++){if(t.state.choice)await t.choose(t.state.choice.seat,{first:[]});else await t.both();}assert.equal(t.state.phase,'MAIN2');assert.equal(t.state.life[1],40);console.log('PASS instant response removes attacker before damage');
});
await run(async t=>{
 const fresh=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Grizzly Bears');await t.act(0,{type:'cast',cardId:fresh.id});await t.act(1,{type:'pass'});await t.act(0,{type:'pass'});await t.act(0,{type:'combat'});await t.both();assert.equal(t.state.choice.kind,'attackers');assert(!t.state.choice.options.some(o=>o.id===fresh.id));await t.choose(0,{first:[]});for(let i=0;i<8&&t.state.phase!=='MAIN2';i++){assert(!t.state.choice);await t.both();}assert.equal(t.state.phase,'MAIN2');assert.deepEqual(t.state.life,[40,40]);console.log('PASS summoning sickness excludes newly cast creatures and empty attack completes safely');
});
