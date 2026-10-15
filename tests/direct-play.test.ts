import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../shared/catalogue.ts';
import {basicLandMana} from '../src/direct-play.ts';
const card=(name:string)=>catalogue.find(c=>c.name===name)!;
test('mana shortcut only infers unambiguous basic land mana',()=>{
 for(const [name,color] of [['Plains','W'],['Island','U'],['Swamp','B'],['Mountain','R'],['Forest','G'],['Wastes','C'],['Snow-Covered Forest','G']])assert.equal(basicLandMana(card(name)),color);
 assert.equal(basicLandMana(card('Sol Ring')),null);
 assert.equal(basicLandMana(card('Command Tower')),null);
 assert.equal(basicLandMana(card('Breeding Pool')),null);
});
