import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,projectGame,type GameState,type CardInstance} from '../shared/game.ts';
import {landPlayAllowance} from '../shared/land-plays.ts';
import {catalogue} from '../shared/catalogue.ts';
import {actionSchema} from '../shared/protocol.ts';
import {playWindow} from '../src/interaction.ts';
const fixture=()=>{const s=enableRules(initialGame());s.rules!.turnOnly=true;s.phase=3;return s;};
function add(s:GameState,name:string,owner='you',zone:CardInstance['zone']='battlefield'){
 const d=catalogue.find(d=>d.name===name);assert.ok(d,name);
 const c:CardInstance={id:`extra-${s.cards.length}`,cardId:d.id,ownerId:owner,controllerId:owner,zone,counters:0,tapped:false,position:{x:.4,y:.4}};s.cards.push(c);return c;
}
test('manual extra land grants unlock client and server, persist through reload projection and expire on turn change',()=>{
 let s=fixture();const a=add(s,'Forest','you','hand'),b=add(s,'Forest','you','hand'),c=add(s,'Forest','you','hand');
 s=applyAction(s,'you',{type:'move',cardId:a.id,zone:'battlefield'});
 assert.throws(()=>applyAction(s,'you',{type:'move',cardId:b.id,zone:'battlefield'}),/Landspiele/);
 s=applyAction(s,'you',{type:'setLandBonus',count:2});
 assert.equal(playWindow(projectGame(s,'you'),'you',b,catalogue.find(d=>d.name==='Forest')!).allowed,true);
 assert.equal(landPlayAllowance(projectGame(s,'north'),'you').remaining,2);
 s=applyAction(s,'you',{type:'move',cardId:b.id,zone:'battlefield'});s=applyAction(s,'you',{type:'move',cardId:c.id,zone:'battlefield'});
 assert.equal(landPlayAllowance(s,'you').played,3);assert.equal(landPlayAllowance(s,'you').remaining,0);
 s=applyAction(s,'you',{type:'endTurn'});assert.deepEqual(s.rules!.landBonus,{});assert.equal(landPlayAllowance(s,'you').limit,1);
});
test('unconditional permanent bonuses stack and follow control, physical face and departure',()=>{
 let s=fixture();const e=add(s,'Exploration'),a=add(s,'Azusa, Lost but Seeking'),dryad=add(s,'Dryad of the Ilysian Grove');
 assert.equal(landPlayAllowance(s,'you').limit,5);
 assert.equal(landPlayAllowance(s,'you').automatic,4);
 s=applyAction(s,'north',{type:'control',cardId:a.id,mode:'take'});
 assert.equal(landPlayAllowance(s,'you').limit,3);assert.equal(landPlayAllowance(s,'north').limit,3);
 s=applyAction(s,'you',{type:'move',cardId:e.id,zone:'graveyard'});assert.equal(landPlayAllowance(s,'you').limit,2);
 s.cards.find(c=>c.id===dryad.id)!.faceDown=true;assert.equal(landPlayAllowance(s,'you').limit,1);
});
test('conditional and activated permissions are not guessed as continuous effects',()=>{
 const s=fixture();add(s,'Explore','you','hand');add(s,'Mina and Denn, Wildborn','north');
 assert.equal(landPlayAllowance(s,'you').limit,1);
 const oracle=add(s,'Oracle of Mul Daya');assert.equal(landPlayAllowance(s,'you').limit,2);
 s.cards.find(c=>c.id===oracle.id)!.zone='graveyard';assert.equal(landPlayAllowance(s,'you').limit,1);
});
test('reducing an allowance never refunds played lands, and search-to-battlefield does not consume a land play',()=>{
 let s=fixture();s=applyAction(s,'you',{type:'setLandBonus',count:3});s.rules!.landPlays.you=3;
 s=applyAction(s,'you',{type:'setLandBonus',count:0});assert.equal(landPlayAllowance(s,'you').remaining,0);assert.equal(s.rules!.landPlays.you,3);
 const land=add(s,'Forest','you','library');s=applyAction(s,'you',{type:'browseLibrary',open:true});
 s=applyAction(s,'you',{type:'libraryPick',cardIds:[land.id],destination:'battlefield',shuffle:false,tapped:true});
 assert.equal(s.rules!.landPlays.you,3);assert.equal(s.cards.find(c=>c.id===land.id)!.tapped,true);
});
test('grant validation rejects foreign turns, malformed counts and private-choice interruptions',()=>{
 const s=fixture();assert.throws(()=>applyAction(s,'north',{type:'setLandBonus',count:1}));
 for(const count of [-1,999,1.5,NaN]){assert.throws(()=>applyAction(s,'you',{type:'setLandBonus',count}));assert.equal(actionSchema.safeParse({type:'setLandBonus',count}).success,false);}
 assert.equal(actionSchema.safeParse({type:'setLandBonus',count:1,playerId:'north'}).success,false);
 s.rules!.pending={id:'private',kind:'scry',ownerId:'you',cardIds:[],value:0,public:false};assert.throws(()=>applyAction(s,'you',{type:'setLandBonus',count:1}));
 s.rules!.pending.kind='manual';assert.equal(applyAction(s,'you',{type:'setLandBonus',count:1}).rules!.landBonus?.you,1);
});
