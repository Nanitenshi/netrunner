import {ForgeWorker} from '../server/forge-worker.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'commander'};
if(!config.java||!config.runtime||!config.classes)throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES.');
const card=name=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c;};
const deck=(name,commander,main)=>({id:name,name,commanderId:card(commander).id,quantities:Object.fromEntries(Object.entries(main).map(([name,count])=>[card(name).id,count]))});
const other=deck('White','Isamaru, Hound of Konda',{Plains:99});
async function run(decks,test){
 if(process.env.FORGE_MECHANIC&&decks[0].name!==process.env.FORGE_MECHANIC)return;
 let state;const worker=new ForgeWorker({...config,decks:decks.map((d,i)=>toForgeDeck(d,'Player '+i).config)},()=>{},s=>state=s);
 const wait=async check=>{const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw Error('Timeout '+JSON.stringify(state.choice));await new Promise(r=>setTimeout(r,10));}};
 const act=async(seat,action)=>{const r=await worker.action(seat,action);assert(r.ok,r.error);if(r.state)state=r.state;return r;};
 const choose=async(seat,input)=>{const id=state.choice.id;await act(seat,{type:'choose',choiceId:id,...input});await wait(()=>state.choice?.id!==id);};
 const resolve=async()=>{await act(state.priority,{type:'pass'});await act(state.priority,{type:'pass'});};
 const opening=async(...names)=>{const contains=()=>names.every(name=>state.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name===name));for(let i=0;!contains()&&i<5000;i++)await act(0,{type:'mulligan'});assert(contains(),names.join(', '));await act(0,{type:'keep'});await act(1,{type:'keep'});};
 const land=async(seat,name)=>{const c=state.cards.find(c=>c.owner===seat&&c.zone==='hand'&&c.name===name);assert(c,name);await act(seat,{type:'land',cardId:c.id});};
 const end=async seat=>{await act(seat,{type:'endTurn'});for(let i=0;state.active===seat&&i<20;i++){if(state.choice){assert.equal(state.choice.kind,'discard');await act(state.choice.seat,{type:'discard',choiceId:state.choice.id,cardIds:state.choice.options.slice(0,state.choice.count).map(o=>o.id)});}else await resolve();}assert.equal(state.active,1-seat);};
 try{state=await worker.ready;await test({act,choose,resolve,opening,land,end,get state(){return state;}});}finally{worker.stop();}
}
await run([deck('Fetch','Ruxa, Patient Professor',{Forest:97,'Windswept Heath':1,Regrowth:1}),other],async t=>{
 await t.opening('Windswept Heath','Regrowth');await t.land(0,'Windswept Heath');const source=t.state.cards.find(c=>c.owner===0&&c.zone==='battlefield'&&c.name==='Windswept Heath');const ability=source.abilities.find(a=>!a.spell&&a.playable);assert(ability,'Fetch activation');
 await t.act(0,{type:'activate',cardId:source.id,abilityIndex:ability.index});assert.equal(t.state.life[0],39);assert.equal(t.state.cards.find(c=>c.id===source.id).zone,'graveyard');assert.equal(t.state.stack.length,1);
 await t.resolve();assert.equal(t.state.choice.kind,'select');assert.equal(t.state.choice.seat,0);assert.deepEqual(projectForge(t.state,1).choice.options,[]);const found=t.state.choice.options.find(o=>o.name==='Forest');assert(found);
 await t.choose(0,{first:[found.id]});assert.equal(t.state.cards.find(c=>c.id===found.id).zone,'battlefield');assert.equal(t.state.cards.find(c=>c.id===found.id).tapped,false);assert.equal(t.state.stack.length,0);
 console.log('PASS general fetch ability: life payment, tap/sacrifice source, human private search and actual land entry');
 await t.end(0);await t.land(1,'Plains');await t.end(1);await t.land(0,'Forest');const regrowth=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Regrowth');assert(regrowth.playable);await t.act(0,{type:'cast',cardId:regrowth.id});assert.equal(t.state.choice.kind,'targets');assert(t.state.choice.options.some(o=>o.id===source.id));await t.choose(0,{first:[source.id]});await t.resolve();assert(t.state.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name==='Windswept Heath'));console.log('PASS native graveyard targets: Regrowth returns the sacrificed fetch land to its owner');
});
await run([deck('Cycling','Isamaru, Hound of Konda',{Plains:98,'Secluded Steppe':1}),other],async t=>{
 await t.opening('Secluded Steppe');await t.land(0,'Plains');const source=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Secluded Steppe');const ability=source.abilities.find(a=>!a.spell&&a.playable);assert(ability,'Cycling activation');const hand=projectForge(t.state,0).handCounts[0];
 await t.act(0,{type:'activate',cardId:source.id,abilityIndex:ability.index});assert.equal(t.state.cards.find(c=>c.id===source.id).zone,'graveyard');assert.equal(projectForge(t.state,0).handCounts[0],hand-1);await t.resolve();assert.equal(projectForge(t.state,0).handCounts[0],hand);
 await t.end(0);await t.land(1,'Plains');await t.end(1);const mana=t.state.cards.find(c=>c.owner===0&&c.zone==='battlefield'&&c.name==='Plains');const tap=mana.abilities.find(a=>a.playable&&!a.spell);assert(tap);
 await t.act(0,{type:'activate',cardId:mana.id,abilityIndex:tap.index});assert.equal(t.state.priority,0);assert.equal(t.state.stack.length,0);assert.equal(t.state.cards.find(c=>c.id===mana.id).tapped,true);
 const commander=t.state.cards.find(c=>c.owner===0&&c.isCommander);assert(commander.playable);await t.act(0,{type:'cast',cardId:commander.id});await t.resolve();assert.equal(t.state.cards.find(c=>c.owner===0&&c.isCommander).zone,'battlefield');
 console.log('PASS general hand ability: cycling pays/discards its source and draws; mana activation keeps priority and floating mana pays a commander');
});
await run([deck('Filter','Adeliz, the Cinder Wind',{Mountain:98,'Ferrous Lake':1}),other],async t=>{
 await t.opening('Ferrous Lake');await t.land(0,'Ferrous Lake');assert.equal(t.state.cards.find(c=>c.owner===0&&c.isCommander).playable,false);
 await t.end(0);await t.land(1,'Plains');await t.end(1);await t.land(0,'Mountain');assert.equal(t.state.cards.find(c=>c.owner===0&&c.isCommander).playable,false);
 await t.end(0);await t.land(1,'Plains');await t.end(1);await t.land(0,'Mountain');const commander=t.state.cards.find(c=>c.owner===0&&c.isCommander);assert(commander.playable);await t.act(0,{type:'cast',cardId:commander.id});assert.equal(t.state.cards.filter(c=>c.owner===0&&c.zone==='battlefield'&&c.tapped).length,3);await t.resolve();assert.equal(t.state.cards.find(c=>c.owner===0&&c.isCommander).zone,'battlefield');
 console.log('PASS Ferrous Lake pays actual activation mana and both colors for a commander outside the fixture whitelist');
});
for(const [a,b] of [[0,1],[2,3],[4,0]])await run([preparedDecks[a],preparedDecks[b]],async t=>{
 assert.deepEqual(projectForge(t.state,0).handCounts,[7,7]);assert.deepEqual(projectForge(t.state,0).libraryCounts,[92,92]);assert.equal(t.state.cards.length,200);assert.equal(t.state.cards.filter(c=>c.zone==='command'&&c.isCommander).length,2);
 console.log('PASS complete prepared deck scripts and real libraries: '+preparedDecks[a].name+' / '+preparedDecks[b].name);
});
