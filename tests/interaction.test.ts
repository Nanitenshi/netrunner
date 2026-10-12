import {test} from 'node:test';import assert from 'node:assert/strict';
import {initialGame,definition} from '../src/seed.ts';import {enableRules} from '../shared/engine.ts';import {projectGame} from '../shared/game.ts';import {playWindow} from '../src/interaction.ts';
test('play hint distinguishes priority, instant responses, main-phase cards and land limit',()=>{
 const state=enableRules(initialGame());const view=projectGame(state,'you');const hand=(name:string)=>view.cards.find(c=>c.ownerId==='you'&&c.zone==='hand'&&definition(c.cardId).name===name)!;
 assert.equal(playWindow(view,'you',hand('Rhystic Study'),definition(hand('Rhystic Study').cardId)).allowed,true);
 const response={...view,rules:{...view.rules!,stack:[{} as never]}};
 assert.equal(playWindow(response,'you',hand('Rhystic Study'),definition(hand('Rhystic Study').cardId)).allowed,false);
 assert.equal(playWindow(response,'you',hand('Counterspell'),definition(hand('Counterspell').cardId)).allowed,true);
 const other={...view,rules:{...view.rules!,priority:'north'}};assert.equal(playWindow(other,'you',hand('Counterspell'),definition(hand('Counterspell').cardId)).allowed,false);
 const land=view.cards.find(c=>c.ownerId==='you'&&definition(c.cardId).name==='Forest')!;const inHand={...land,zone:'hand' as const};assert.equal(playWindow(view,'you',inHand,definition(land.cardId)).allowed,true);
 assert.equal(playWindow({...view,rules:{...view.rules!,landPlays:{you:1}}},'you',inHand,definition(land.cardId)).allowed,false);
 assert.equal(playWindow(view,'you',land,definition(land.cardId)).allowed,false);
});
