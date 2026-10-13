import {ForgeWorker,ForgeDeckError} from '../server/forge-worker.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {catalogue} from '../shared/catalogue.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const card=name=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c;};
const deck=(id,name)=>({id,name,commanderId:card('Isamaru, Hound of Konda').id,quantities:{[card('Plains').id]:98,[card('Swords to Plowshares').id]:1}});
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'commander',decks:[toForgeDeck(deck('a','Alpha'),'Ada').config,toForgeDeck(deck('b','Beta'),'Bela').config]};
if(!config.java||!config.runtime||!config.classes)throw Error('Set FORGE_JAVA, FORGE_RUNTIME and FORGE_CLASSES.');
let state;const worker=new ForgeWorker(config,()=>{},s=>state=s);
const wait=async check=>{const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw Error('Timeout '+JSON.stringify(state?.choice));await new Promise(r=>setTimeout(r,10));}};
const act=async(seat,action,ok=true)=>{const r=await worker.action(seat,action);assert.equal(r.ok,ok,r.error);if(r.state)state=r.state;return r;};
const choose=async(seat,input)=>{const id=state.choice.id;await act(seat,{type:'choose',choiceId:id,...input});await wait(()=>state.choice?.id!==id);};
const resolve=async()=>{await act(state.priority,{type:'pass'});await act(state.priority,{type:'pass'});};
const land=async seat=>{const c=state.cards.find(c=>c.owner===seat&&c.zone==='hand'&&c.type.includes('Land'));assert(c);await act(seat,{type:'land',cardId:c.id});};
const end=async seat=>{await act(seat,{type:'endTurn'});for(let i=0;state.active===seat&&i<10;i++){if(state.choice){if(state.choice.kind==='discard'){await act(seat,{type:'discard',choiceId:state.choice.id,cardIds:state.choice.options.slice(0,state.choice.count).map(o=>o.id)});}else throw Error('Unexpected choice '+JSON.stringify(state.choice));}else await resolve();}assert.equal(state.active,1-seat);};
try{
 state=await worker.ready;
 assert.equal(state.stage,'mulligan');assert.deepEqual(projectForge(state,0).handCounts,[7,7]);assert.deepEqual(projectForge(state,0).libraryCounts,[92,92]);assert.equal(state.cards.filter(c=>c.isCommander&&c.zone==='command').length,2);assert.deepEqual(state.life,[40,40]);
 assert.equal(projectForge(state,0).cards.filter(c=>c.owner===1&&c.zone==='hand').length,0);
 await act(0,{type:'land',cardId:state.cards.find(c=>c.owner===0&&c.zone==='hand').id},false);await act(0,{type:'mulligan'});assert.equal(state.mulligans[0],1);assert.deepEqual(projectForge(state,0).handCounts,[7,7]);
 for(let i=0;!state.cards.some(c=>c.owner===1&&c.zone==='hand'&&c.name==='Swords to Plowshares')&&i<200;i++)await act(1,{type:'mulligan'});assert(state.cards.some(c=>c.owner===1&&c.zone==='hand'&&c.name==='Swords to Plowshares'));await act(0,{type:'keep'});await act(0,{type:'mulligan'},false);await act(1,{type:'keep'});assert.equal(state.stage,'playing');await land(0);
 let commander=state.cards.find(c=>c.owner===0&&c.isCommander);await act(0,{type:'cast',cardId:commander.id});assert.equal(state.cards.find(c=>c.owner===0&&c.isCommander).commanderCasts,1);await resolve();assert.equal(state.cards.find(c=>c.owner===0&&c.isCommander).zone,'battlefield');
 await end(0);await land(1);console.log('PASS load, privacy, mulligan, commander cast, payment, resolution and real turn draw');

 const swords=state.cards.find(c=>c.owner===1&&c.zone==='hand'&&c.name==='Swords to Plowshares');commander=state.cards.find(c=>c.owner===0&&c.isCommander);
 await act(1,{type:'cast',cardId:swords.id,targetId:commander.id});await resolve();assert.equal(state.choice.kind,'confirm');assert.equal(state.choice.seat,0);assert.equal(projectForge(state,1).choice.source,undefined);
 await act(1,{type:'choose',choiceId:state.choice.id,answer:true},false);await choose(0,{answer:true});assert.equal(state.cards.find(c=>c.owner===0&&c.isCommander).zone,'command');
 await end(1);await land(0);commander=state.cards.find(c=>c.owner===0&&c.isCommander);assert.equal(commander.commanderCasts,1);assert.equal(commander.playable,false);await act(0,{type:'cast',cardId:commander.id},false);
 await end(0);await land(1);await end(1);await land(0);commander=state.cards.find(c=>c.owner===0&&c.isCommander);assert.equal(commander.playable,true);
 await act(0,{type:'cast',cardId:commander.id});assert.equal(state.cards.find(c=>c.owner===0&&c.isCommander).commanderCasts,2);assert.equal(state.cards.filter(c=>c.owner===0&&c.zone==='battlefield'&&c.type.includes('Land')&&c.tapped).length,3);await resolve();
 console.log('PASS human commander return, rejected foreign decision, insufficient tax, and second casting pays three real mana');
 await end(0);await land(1);await end(1);await act(0,{type:'combat'});await resolve();assert.equal(state.choice.kind,'attackers');await choose(0,{first:[state.cards.find(c=>c.owner===0&&c.isCommander).id]});
 for(let i=0;state.phase!=='MAIN2'&&i<20;i++){if(state.choice){assert.equal(state.choice.kind,'blockers');await choose(1,{first:[]});}else await resolve();}
 assert.equal(state.phase,'MAIN2');assert.equal(state.life[1],38);assert.equal(state.commanderDamage.find(d=>d.defender===1).amount,2);console.log('PASS human attack and native commander damage');
 await act(1,{type:'concede'});assert.equal(state.stage,'finished');assert.deepEqual(state.winners,[0]);await act(0,{type:'pass'},false);
 console.log('PASS concession and stable seat projection after the opponent leaves the game');
}finally{worker.stop();}
const missing=structuredClone(config);missing.decks[1].main[0].name='A card Forge cannot possibly contain';delete missing.decks[1].main[0].frontName;
const bad=new ForgeWorker(missing,()=>{});try{await assert.rejects(bad.ready,error=>error instanceof ForgeDeckError&&error.issues[0].seat===1&&error.issues[0].cards.includes('A card Forge cannot possibly contain'));console.log('PASS unavailable cards reported without substitutions');}finally{bad.stop();}

const paired=structuredClone(config);for(const d of paired.decks){d.commanders=['Rograkh, Son of Rohgahh','Ardenn, Intrepid Archaeologist'].map(name=>({name,count:1}));d.main=[{name:'Plains',count:98}];}
const pair=new ForgeWorker(paired,()=>{});try{const state=await pair.ready;assert.equal(state.cards.filter(c=>c.isCommander&&c.zone==='command').length,4);assert.deepEqual(projectForge(state,0).libraryCounts,[91,91]);console.log('PASS real partner decks: both commanders in command and 98-card main decks');}finally{pair.stop();}
