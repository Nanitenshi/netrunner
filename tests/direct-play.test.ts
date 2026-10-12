import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../shared/catalogue.ts';
import {basicLandMana,needsCastDialog} from '../src/direct-play.ts';
const card=(name:string)=>catalogue.find(c=>c.name===name)!;
test('direct casting retains target, X and extra cost decisions',()=>{
 assert.equal(needsCastDialog(card('Sol Ring')),false);
 assert.equal(needsCastDialog(card('Cultivate')),false);
 assert.equal(needsCastDialog(card('Counterspell')),true);
 assert.equal(needsCastDialog(card('Swords to Plowshares')),true);
 assert.equal(needsCastDialog({...card('Sol Ring'),mana:'{X}'}),true);
 assert.equal(needsCastDialog({...card('Sol Ring'),text:'As an additional cost to cast this spell, sacrifice a creature.'}),true);
 assert.equal(needsCastDialog({...card('Sol Ring'),text:'Choose one — draw a card or gain 3 life.'}),true);
});
test('mana shortcut only infers unambiguous basic land mana',()=>{
 for(const [name,color] of [['Plains','W'],['Island','U'],['Swamp','B'],['Mountain','R'],['Forest','G'],['Wastes','C'],['Snow-Covered Forest','G']])assert.equal(basicLandMana(card(name)),color);
 assert.equal(basicLandMana(card('Sol Ring')),null);
 assert.equal(basicLandMana(card('Command Tower')),null);
 assert.equal(basicLandMana(card('Breeding Pool')),null);
});
