import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {applyAction,projectGame} from '../shared/game.ts';
import {actionSchema} from '../shared/protocol.ts';
test('random results are shared, bounded and do not mutate the original table',()=>{
 const state=initialGame();const dice=applyAction(state,'you',{type:'rollDice',sides:20,count:20});
 const line=dice.log.at(-1)!;const values=line.split(': ')[1].split(' · ')[0].split(', ').map(Number);
 assert.equal(values.length,20);assert.ok(values.every(v=>v>=1&&v<=20));assert.deepEqual(dice.cards,state.cards);assert.equal(state.log.length+1,dice.log.length);
 for(const p of state.players)assert.equal(projectGame(dice,p.id).log.at(-1),line);
 const coin=applyAction(dice,'north',{type:'flipCoin',count:3});assert.match(coin.log.at(-1)!,/: (Kopf|Zahl), (Kopf|Zahl), (Kopf|Zahl)$/);
 for(const action of [{type:'rollDice',sides:1,count:1},{type:'rollDice',sides:6,count:21},{type:'flipCoin',count:0}]){assert.equal(actionSchema.safeParse(action).success,false);assert.throws(()=>applyAction(state,'you',action as any));}
});
