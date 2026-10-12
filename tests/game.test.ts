import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {applyAction,projectGame} from '../shared/game.ts';
import {boardPoint} from '../src/geometry.ts';
import {discordURL} from '../src/settings.ts';

test('four seats and separate definitions/instances',()=>{
  const state=initialGame();assert.equal(state.players.length,4);
  assert.equal(new Set(state.cards.map(c=>c.id)).size,state.cards.length);
  assert.equal(state.cards.filter(c=>c.zone==='commander').length,4);
});
test('life, draw and tap are immutable and affect only the actor',()=>{
  const state=initialGame();let next=applyAction(state,'you',{type:'life',amount:-3});
  assert.equal(next.players[0].life,37);assert.equal(state.players[0].life,40);assert.equal(next.players[1].life,40);
  const originalHand=state.cards.filter(c=>c.ownerId==='you'&&c.zone==='hand').length;
  next=applyAction(next,'you',{type:'draw'});
  assert.equal(next.cards.filter(c=>c.ownerId==='you'&&c.zone==='hand').length,originalHand+1);
  const card=state.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
  next=applyAction(next,'you',{type:'tap',cardId:card.id});
  assert.equal(next.cards.find(c=>c.id===card.id)!.tapped,true);assert.equal(card.tapped,false);
});
test('opponent hands and every library identity are excluded from player projections',()=>{
  const state=initialGame();
  for(const player of state.players){const view=projectGame(state,player.id);
    assert.ok(view.cards.every(c=>c.zone!=='library'&&(c.zone!=='hand'||c.ownerId===player.id)));
    const raw=JSON.stringify(view);
    state.cards.filter(c=>c.zone==='library'||(c.zone==='hand'&&c.ownerId!==player.id)).forEach(c=>assert.ok(!raw.includes(`"${c.id}"`)));
    assert.equal(view.hiddenCounts[player.id].library,7);
  }
});
test('foreign cards and unknown actors cannot be manipulated',()=>{
  const s=initialGame();const card=s.cards.find(c=>c.ownerId==='north'&&c.zone==='battlefield')!;
  assert.throws(()=>applyAction(s,'you',{type:'tap',cardId:card.id}));
  assert.throws(()=>applyAction(s,'you',{type:'move',cardId:card.id,zone:'hand'}));
  assert.throws(()=>applyAction(s,'intruder',{type:'draw'}));
});
test('copy, counters and zone changes preserve the source and keep IDs unique',()=>{
  const s=initialGame();const card=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
  let next=applyAction(s,'you',{type:'copy',cardId:card.id,newId:'copy-1'});
  assert.equal(next.cards.at(-1)!.token,true);assert.equal(next.cards.at(-1)!.cardId,card.cardId);
  assert.throws(()=>applyAction(next,'you',{type:'copy',cardId:card.id,newId:'copy-1'}));
  next=applyAction(next,'you',{type:'counter',cardId:'copy-1',amount:2});
  assert.equal(next.cards.at(-1)!.counters,2);assert.equal(card.counters,0);
  next=applyAction(next,'you',{type:'move',cardId:'copy-1',zone:'exile'});assert.equal(next.cards.at(-1)!.zone,'exile');
});
test('invalid numeric actions are rejected; positions are bounded',()=>{
  const s=initialGame();const card=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
  assert.throws(()=>applyAction(s,'you',{type:'life',amount:NaN}));
  assert.throws(()=>applyAction(s,'you',{type:'position',cardId:card.id,x:Infinity,y:0}));
  const n=applyAction(s,'you',{type:'position',cardId:card.id,x:9,y:-9});
  assert.deepEqual(n.cards.find(c=>c.id===card.id)!.position,{x:.94,y:.1});
});
test('camera projection maps a perspective quadrilateral back into board coordinates',()=>{
  const corners=[{x:200,y:100},{x:700,y:150},{x:900,y:600},{x:100,y:650}];
  corners.forEach((p,i)=>{const r=boardPoint(corners,p);const targets=[[0,0],[1,0],[1,1],[0,1]];assert.ok(Math.abs(r.x-targets[i][0])<1e-7);assert.ok(Math.abs(r.y-targets[i][1])<1e-7);});
  assert.deepEqual(boardPoint([{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}],{x:25,y:75}),{x:.25,y:.75});
});
test('Discord links allow channels/invites and reject other destinations',()=>{
  assert.ok(discordURL('https://discord.com/channels/123/456'));assert.ok(discordURL('https://discord.gg/example'));
  assert.equal(discordURL('javascript:alert(1)'),null);assert.equal(discordURL('https://discord.com.evil.test/channels/123/456'),null);
});

