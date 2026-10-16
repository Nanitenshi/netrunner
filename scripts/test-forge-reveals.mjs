import {ForgeWorker} from '../server/forge-worker.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {catalogue} from '../shared/catalogue.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {projectForge} from '../shared/forge-protocol.ts';
import assert from 'node:assert/strict';
const config={java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES,scenario:'commander'};
if(!config.java||!config.runtime||!config.classes)throw Error('Configure Forge paths');
const id=name=>{const card=catalogue.find(c=>c.name===name);assert(card,name);return card.id;};
const other={id:'other',name:'Other',commanderId:id('Isamaru, Hound of Konda'),quantities:{[id('Plains')]:99}};
const pairs=[['Port Town','Plains'],['Choked Estuary','Island'],['Foreboding Ruins','Swamp'],['Game Trail','Mountain'],['Fortified Village','Forest']];
async function run(deck,test){let state;const worker=new ForgeWorker({...config,decks:[deck,other].map((d,i)=>toForgeDeck(d,'Human '+i).config)},()=>{},s=>state=s);
 const wait=async check=>{const end=Date.now()+15000;while(!check()){if(Date.now()>end)throw Error('Decision timeout '+JSON.stringify(state.choice));await new Promise(r=>setTimeout(r,10));}};
 const act=async(seat,action,ok=true)=>{const r=await worker.action(seat,action);assert.equal(r.ok,ok,r.error);if(r.state)state=r.state;return r;};
 const choose=async(input,seat=state.choice.seat)=>{const choiceId=state.choice.id;await act(seat,{type:'choose',choiceId,...input});await wait(()=>state.choice?.id!==choiceId);};
 const opening=async(name,extra=()=>true)=>{const found=()=>state.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name===name)&&extra(state);for(let n=0;!found()&&n<1000;n++)await act(0,{type:'mulligan'});assert(found());await act(0,{type:'keep'});await act(1,{type:'keep'});};
 const resolve=async()=>{await act(state.priority,{type:'pass'});await act(state.priority,{type:'pass'});};
 const end=async seat=>{await act(seat,{type:'endTurn'});assert.equal(state.choice?.purpose,'end-turn');await choose({answer:true},seat);for(let n=0;state.active===seat&&n<40;n++){if(state.choice){assert.equal(state.choice.kind,'discard');await act(state.choice.seat,{type:'discard',choiceId:state.choice.id,cardIds:state.choice.options.slice(0,state.choice.count).map(c=>c.id)});}else await resolve();}assert.equal(state.active,1-seat);};
 try{state=await worker.ready;await test({act,choose,opening,wait,resolve,end,get state(){return state;}});}finally{worker.stop();}
}
for(const [index,[land,basic]] of pairs.entries())for(const accept of [true,false]){
 if(process.env.FORGE_REVEAL_CASE&&process.env.FORGE_REVEAL_CASE!==land)continue;
 const deck={id:'reveal',name:land,commanderId:preparedDecks[index].commanderId,quantities:{[id(basic)]:98,[id(land)]:1}};
 await run(deck,async t=>{
  await t.opening(land);const source=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name===land);await t.act(0,{type:'land',cardId:source.id});
  assert.equal(t.state.choice.kind,'reveal');assert.equal(t.state.choice.seat,0);assert.equal(t.state.choice.source,land);assert(t.state.choice.options.length);assert(t.state.choice.options.every(c=>c.name===basic));
  const choice=structuredClone(t.state.choice);assert.deepEqual(projectForge(t.state,1).choice.options,[]);assert(!projectForge(t.state,1).reveals?.length);
  await t.act(1,{type:'choose',choiceId:choice.id,first:[choice.options[0].id]},false);await t.act(0,{type:'choose',choiceId:choice.id,first:[source.id]},false);await t.act(0,{type:'choose',choiceId:choice.id,first:[choice.options[0].id,choice.options[0].id]},false);await t.act(0,{type:'pass'},false);
  if(accept){const picked=choice.options.at(-1);await t.choose({first:[picked.id]});assert.equal(t.state.cards.find(c=>c.id===source.id).tapped,false);assert.equal(t.state.cards.find(c=>c.id===picked.id).zone,'hand');const shown=projectForge(t.state,1).reveals;assert(shown?.some(r=>r.cards.some(c=>c.id===picked.id&&c.name===basic)));assert(!projectForge(t.state,1).cards.some(c=>c.id===picked.id),'Revealed hand card must stay outside the opponent public card list');}
  else {await t.choose({answer:false});assert.equal(t.state.cards.find(c=>c.id===source.id).tapped,true);assert(!projectForge(t.state,1).reveals?.length);}
  assert.equal(t.state.cards.find(c=>c.id===source.id).zone,'battlefield');assert.deepEqual(projectForge(t.state,0).handCounts,[6,7]);assert.equal(t.state.priority,0);assert.equal(t.state.choice,null);
  await t.act(0,{type:'choose',choiceId:choice.id,answer:false},false);console.log('PASS '+land+' / '+(accept?'chosen hand card revealed; land untapped':'declined; land tapped; no reveal')+'; private options, invalid/stale/foreign actions rejected');
 });
}
if(!process.env.FORGE_REVEAL_CASE||process.env.FORGE_REVEAL_CASE==='No eligible reveal')await run({id:'none',name:'No eligible reveal',commanderId:preparedDecks[0].commanderId,quantities:{[id('Wastes')]:98,[id('Port Town')]:1}},async t=>{await t.opening('Port Town');const c=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Port Town');await t.act(0,{type:'land',cardId:c.id});assert.equal(t.state.choice,null);assert.equal(t.state.cards.find(v=>v.id===c.id).tapped,true);assert(!t.state.reveals?.length);console.log('PASS no matching hand card: land enters tapped without an impossible prompt');});
// With no Mountain in the opening hand, three copies leave at least one in the
// library after the two real draw steps before this turn-three search.
if(!process.env.FORGE_REVEAL_CASE||process.env.FORGE_REVEAL_CASE==='Cultivate')await run({id:'ramp',name:'Cultivate',commanderId:preparedDecks[3].commanderId,quantities:{[id('Forest')]:95,[id('Mountain')]:3,[id('Cultivate')]:1}},async t=>{
 await t.opening('Cultivate',s=>s.cards.filter(c=>c.owner===0&&c.zone==='hand'&&c.name==='Forest').length>=3&&!s.cards.some(c=>c.owner===0&&c.zone==='hand'&&c.name==='Mountain'));
 for(let n=0;n<3;n++){const land=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Forest');await t.act(0,{type:'land',cardId:land.id});if(n<2){await t.end(0);await t.end(1);}}
 const spell=t.state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Cultivate');await t.act(0,{type:'cast',cardId:spell.id});await t.resolve();assert.equal(t.state.choice.seat,0);const options=t.state.choice.options,forest=options.find(c=>c.name==='Forest'),mountain=options.find(c=>c.name==='Mountain');assert(forest&&mountain);
 assert.deepEqual(projectForge(t.state,1).choice.options,[]);assert(!projectForge(t.state,1).reveals?.some(r=>r.cards.some(c=>c.id===mountain.id)));
 if(t.state.choice.max===1){await t.choose({first:[forest.id]});await t.choose({first:[mountain.id]});}else await t.choose({first:[forest.id,mountain.id]});assert.equal(t.state.choice.seat,0);assert(projectForge(t.state,1).reveals.some(r=>r.cards.some(c=>c.id===mountain.id)),'Only selected search results are publicly revealed');
 await t.choose({first:[mountain.id]});while(t.state.choice){assert(t.state.choice.options.every(c=>c.id===forest.id));await t.choose({first:[forest.id]});}
 assert.equal(t.state.cards.find(c=>c.id===mountain.id).zone,'battlefield');assert.equal(t.state.cards.find(c=>c.id===mountain.id).tapped,true);assert.equal(t.state.cards.find(c=>c.id===forest.id).zone,'hand');assert.equal(t.state.stack.length,0);console.log('PASS Cultivate: private search, selected results revealed, human land assignment, tapped entry and hand return');
});
if(!process.env.FORGE_REVEAL_CASE||process.env.FORGE_REVEAL_CASE==='Impulse'){let state;const worker=new ForgeWorker({...config,scenario:'decisions',decks:undefined},()=>{},s=>state=s);try{
 state=await worker.ready;const act=async seat=>{const r=await worker.action(seat,{type:'pass'});assert(r.ok,r.error);if(r.state)state=r.state;};const impulse=state.cards.find(c=>c.owner===0&&c.zone==='hand'&&c.name==='Impulse');const r=await worker.action(0,{type:'cast',cardId:impulse.id});assert(r.ok,r.error);state=r.state;await act(state.priority);await act(state.priority);assert.equal(state.choice.kind,'select');
 assert(projectForge(state,0).reveals?.some(r=>r.cards.length===4),'All looked-at cards are readable before picking');assert.deepEqual(projectForge(state,1).reveals,[]);assert.deepEqual(projectForge(state,1).choice.options,[]);console.log('PASS Impulse: looked-at cards visible only to chooser, including during the pending selection');
}finally{worker.stop();}}
