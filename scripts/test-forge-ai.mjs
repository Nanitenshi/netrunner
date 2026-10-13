import {ForgeWorker} from '../server/forge-worker.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'commander'};
if(!config.java||!config.runtime||!config.classes)throw Error('Configure Forge paths');
const card=name=>catalogue.find(c=>c.name===name);
const human={id:'human',name:'Human',commanderId:card('Isamaru, Hound of Konda').id,quantities:{[card('Plains').id]:99}};
const modes=process.env.FORGE_AI_LEVEL?[process.env.FORGE_AI_LEVEL]:['easy','normal','hard'];
const decks=process.env.FORGE_AI_DECK?[preparedDecks[Number(process.env.FORGE_AI_DECK)]]:[human,...preparedDecks];
for(const difficulty of modes)for(const deck of decks){
 let state,asynchronousError;
 const worker=new ForgeWorker({...config,decks:[toForgeDeck(human,'Human').config,{...toForgeDeck(deck,'Forge-KI').config,ai:{difficulty}}]},()=>{},(s,error)=>{state=s;asynchronousError=error;});
 const wait=async check=>{const until=Date.now()+15000;while(!check()){if(asynchronousError)throw Error(asynchronousError);if(Date.now()>until)throw Error('Pending choice timeout');await new Promise(r=>setTimeout(r,10));}};
 const act=async action=>{const result=await worker.action(0,action);assert(result.ok,result.error);if(result.state)state=result.state;assert(!asynchronousError,asynchronousError);};
 const observed=new Set(),casts=new Map();let actions=0,attacked=false;
 try{
  state=await worker.ready;assert.deepEqual(state.kept,[false,true]);assert.equal(projectForge(state,0).cards.filter(c=>c.zone==='hand'&&c.owner===1).length,0);assert.deepEqual(projectForge(state,0).handCounts,[7,7]);
  const forbidden=await worker.action(1,{type:'keep'});assert(!forbidden.ok);await act({type:'keep'});
  for(let step=0;state.stage!=='finished'&&state.turn<18&&step<1500;step++){
   if(!state.choice)assert.equal(state.priority,0,'The engine must return to the human or a human decision');
   for(const item of state.stack)if(item.controller===1&&!observed.has(item.id)){observed.add(item.id);actions++;}
   if(state.active===1)for(const c of state.cards.filter(c=>c.owner===1&&c.zone==='stack')){const ids=casts.get(state.turn)??new Set();ids.add(c.id);casts.set(state.turn,ids);assert(ids.size<=(difficulty==='easy'?1:difficulty==='normal'?3:Infinity),'Difficulty must constrain voluntary casting');}
   attacked||=state.combat?.some(a=>state.cards.find(c=>c.id===a.attackerId)?.controller===1)??false;
   if(state.choice){assert.equal(state.choice.seat,0,'AI must answer its own choices');const choice=state.choice;
    if(choice.kind==='discard')await act({type:'discard',choiceId:choice.id,cardIds:choice.options.slice(0,choice.count).map(o=>o.id)});
    else {const answer=choice.kind==='confirm'?{answer:true}:choice.kind==='number'?{value:choice.min}:choice.kind==='scry'||choice.kind==='surveil'?{first:choice.options.map(o=>o.id),second:[]}:['attackers','blockers'].includes(choice.kind)?{first:[]}:{first:choice.options.slice(0,choice.min??choice.count).map(o=>o.id)};await act({type:'choose',choiceId:choice.id,...answer});await wait(()=>state.choice?.id!==choice.id);}
   }else if(state.active===0&&!state.stack.length&&!state.ending&&!state.combatRunning){const land=state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.landPlayable);if(land)await act({type:'land',cardId:land.id});else await act({type:'endTurn'});}
   else await act({type:'pass'});
  }
  assert(actions>0,'AI must cast actual spells');assert(state.cards.some(c=>c.owner===1&&c.zone==='battlefield'&&c.type.includes('Land')));if(deck===human)assert(attacked,'The Isamaru control deck must use native commander combat');assert(state.turn>=16||state.stage==='finished');
  if(state.stage!=='finished'){await act({type:'concede'});assert.equal(state.stage,'finished');assert.deepEqual(state.winners,[1]);}
  console.log('PASS '+difficulty+' / '+deck.name+': real lands, spells, responses, '+(attacked?'combat, ':'')+'private hand and '+state.turn+' turns');
 }finally{worker.stop();}
}
