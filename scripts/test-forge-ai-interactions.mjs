import {ForgeWorker} from '../server/forge-worker.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {catalogue} from '../shared/catalogue.ts';
import assert from 'node:assert/strict';
const id=name=>catalogue.find(c=>c.name===name).id;
const human={id:'human',name:'Human',commanderId:id('Isamaru, Hound of Konda'),quantities:{[id('Plains')]:98,[id('Swords to Plowshares')]:1}};
const opponent={...human,id:'bot',name:'Bot',quantities:{[id('Plains')]:99}};
let state,asynchronousError;
const worker=new ForgeWorker({java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'commander',decks:[toForgeDeck(human,'Human').config,{...toForgeDeck(opponent,'Forge-KI').config,ai:{difficulty:'normal'}}]},()=>{},(s,error)=>{state=s;asynchronousError=error;});
const wait=async check=>{const end=Date.now()+15000;while(!check()){assert(!asynchronousError,asynchronousError);if(Date.now()>end)throw Error('Choice timeout');await new Promise(r=>setTimeout(r,10));}};
const act=async(action,ok=true)=>{const result=await worker.action(0,action);assert.equal(result.ok,ok,result.error);if(result.state)state=result.state;assert(!asynchronousError,asynchronousError);return result;};
const advance=async()=>{if(state.choice){const choice=state.choice;assert.equal(choice.seat,0);const action=choice.kind==='discard'?{type:'discard',choiceId:choice.id,cardIds:choice.options.slice(0,choice.count).map(o=>o.id)}:{type:'choose',choiceId:choice.id,...(choice.kind==='confirm'?{answer:true}:{first:choice.options.slice(0,choice.min??choice.count).map(o=>o.id)})};await act(action);await wait(()=>state.choice?.id!==choice.id);}
else if(state.active===0&&!state.stack.length&&!state.ending&&!state.combatRunning){const land=state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.landPlayable);await act(land?{type:'land',cardId:land.id}:{type:'endTurn'});}else await act({type:'pass'});};
try{
 state=await worker.ready;for(let n=0;!state.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name==='Swords to Plowshares')&&n<300;n++)await act({type:'mulligan'});assert(state.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name==='Swords to Plowshares'));await act({type:'keep'});
 for(let n=0;!(state.turn>=3&&state.active===0&&!state.stack.length&&!state.ending)&&n<150;n++)await advance();
 const commander=state.cards.find(c=>c.owner===1&&c.isCommander&&c.zone==='battlefield');assert(commander);assert.equal(commander.commanderCasts,1);const swords=state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Swords to Plowshares');
 await act({type:'cast',cardId:swords.id,targetId:commander.id});assert.equal(state.priority,0);assert.equal(state.passes,1,'The AI passes automatically without skipping the human resolution window');assert.equal(state.stack.length,1);await act({type:'pass'});
 assert.equal(state.choice,null,'AI answers its own commander return choice');assert.equal(state.cards.find(c=>c.owner===1&&c.isCommander).zone,'command');
 for(let n=0;state.cards.find(c=>c.owner===1&&c.isCommander).commanderCasts!==2&&n<200;n++)await advance();
 assert.equal(state.cards.find(c=>c.owner===1&&c.isCommander).commanderCasts,2);assert.equal(state.stack.length,1);assert.equal(state.priority,0);assert.equal(state.cards.filter(c=>c.owner===1&&c.zone==='battlefield'&&c.type.includes('Land')&&c.tapped).length,3,'Native AI pays the actual tax');
 await act({type:'pass'});assert.equal(state.cards.find(c=>c.owner===1&&c.isCommander).zone,'battlefield');await act({type:'concede'});assert.equal(state.stage,'finished');assert.deepEqual(state.winners,[1]);
 console.log('PASS native AI interactions: automatic response/pass, human instant, AI commander return, actual tax +2, recast, human resolution and concession');
}finally{worker.stop();}
