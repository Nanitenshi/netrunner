import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {denseBoard} from '../src/dense-board.ts';
import {groupBattlefield} from '../src/opponent-layout.ts';
import type {CardInstance} from '../shared/game.ts';
const creature=initialGame().cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;
const copies=(count:number,token=false)=>Array.from({length:count},(_,i)=>({...creature,id:'creature-'+i,token}));
test('twenty distinct creatures have separate visible cells without overlapping or a scroll viewport',()=>{
 const cards=copies(20),layout=denseBoard(cards,800,430);
 assert.equal(layout.slots.length,20);assert.ok(layout.cardWidth>=60);assert.equal(layout.headers[0].count,20);
 for(const s of layout.slots){assert.ok(s.position.x>0&&s.position.x<1&&s.position.y>0&&s.position.y<1);for(const t of layout.slots){if(t===s)continue;assert.ok(Math.abs(s.position.x-t.position.x)*800>=layout.cardWidth||Math.abs(s.position.y-t.position.y)*430>=layout.cardWidth*1.395-1);}}
});
test('identical tokens collapse but different tap states, marks and attachment hosts retain distinct groups',()=>{
 const cards=copies(20,true);cards[0].tapped=true;cards[1].counters=3;const equipment={...creature,id:'equipment',attachedTo:cards[2].id};
 const groups=groupBattlefield([...cards,equipment]);assert.equal(groups.find(g=>g.cards.some(c=>c.id===cards[2].id))!.cards.length,1);
 const grouped=denseBoard(cards,800,430);assert.equal(grouped.slots.length,3);assert.equal(grouped.slots.find(s=>s.collapsed)!.group.cards.length,18);
 const expanded=denseBoard(cards,800,430,new Set(grouped.groups.map(g=>g.key)));assert.equal(expanded.slots.length,20);
});
test('mixed boards keep creatures, other permanents and lands in their own ordered bands',()=>{
 const s=initialGame(),cards=[...copies(20),...s.cards.filter(c=>c.ownerId==='you'&&c.zone==='battlefield'&&c.id!==creature.id)],layout=denseBoard(cards,800,430);
 assert.deepEqual(layout.headers.map(h=>h.section),['creatures','permanents','lands']);assert.ok(layout.headers[0].y<layout.headers[1].y&&layout.headers[1].y<layout.headers[2].y);assert.equal(layout.slots.length,25);
});
test('a tapped army retains enough horizontal space for rotated cards',()=>{
 const cards=copies(20).map(c=>({...c,tapped:true})),layout=denseBoard(cards,800,430);
 for(const s of layout.slots)for(const t of layout.slots){if(s===t)continue;assert.ok(Math.abs(s.position.x-t.position.x)*800>=layout.cardWidth*1.395-1||Math.abs(s.position.y-t.position.y)*430>=layout.cardWidth-1);}
});
test('a manually placed group member stays at its chosen position and remains individually represented',()=>{
 const cards=copies(20,true);cards[0].position={x:.8,y:.65};const layout=denseBoard(cards,800,430,new Set(),new Set([cards[0].id]));assert.equal(layout.slots.length,2);assert.deepEqual(layout.slots.find(s=>s.card.id===cards[0].id)!.position,{x:.8,y:.65});assert.equal(layout.slots.find(s=>s.collapsed)!.group.cards.length,19);
});
