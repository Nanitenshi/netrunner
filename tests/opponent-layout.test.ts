import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupBattlefield} from '../src/opponent-layout.ts';
import {initialGame} from '../src/seed.ts';
test('large fields group identical lands without merging different tap states or counters',()=>{
 const forest=initialGame().cards.find(c=>c.ownerId==='north'&&c.isLand)!;
 const cards=Array.from({length:30},(_,i)=>({...forest,id:`land-${i}`,tapped:i>=20,markers:i>=25?{plusOne:1}:{}}));
 const groups=groupBattlefield(cards);assert.deepEqual(groups.map(g=>g.cards.length),[20,5,5]);
 assert.equal(groups.flatMap(g=>g.cards).length,30);assert.equal(groupBattlefield(cards,false).length,30);
 assert.equal(cards[0].id,'land-0');
});
test('token groups preserve controller, markers and commander designation; normal creatures stay separate',()=>{
 const creature=initialGame().cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield'&&!c.isLand)!;
 const cards=Array.from({length:12},(_,i)=>({...creature,id:`creature-${i}`,token:true}));
 assert.equal(groupBattlefield(cards).length,1);
 cards[1]={...cards[1],isCommander:true};cards[2]={...cards[2],controllerId:'north'};cards[3]={...cards[3],markers:{shield:1}};
 assert.equal(groupBattlefield(cards).length,4);
 assert.equal(groupBattlefield(cards.map(c=>({...c,token:false}))).length,12);
});
