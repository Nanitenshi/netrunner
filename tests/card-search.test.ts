import {test} from 'node:test';import assert from 'node:assert/strict';
import {catalogue} from '../shared/catalogue.ts';
import {matchesCard,type SearchFilters} from '../shared/card-search.ts';
const f:SearchFilters={query:'',color:'',effects:[],keywords:[],text:'',type:'',maxMana:''};
const card=(name:string)=>catalogue.find(c=>c.name===name)!;
test('search finds English rules text and German keyword aliases, while keeping name phrases',()=>{
 assert.ok(matchesCard(card('Rhystic Study'),{...f,query:'draw a card'}));assert.ok(matchesCard(card('Birds of Paradise'),{...f,query:'Flugfähigkeit'}));assert.ok(matchesCard(card('Birds of Paradise'),{...f,query:'Flugfahigkeit'}));assert.ok(matchesCard(card('Sol Ring'),{...f,query:'Sol Ring'}));assert.equal(matchesCard(card('Sol Ring'),{...f,query:'Flying'}),false);
});
test('effect, authoritative keyword, identity, type and mana filters intersect',()=>{
 const bird=card('Birds of Paradise');assert.ok(matchesCard(bird,{...f,effects:['mana'],keywords:['Flying'],color:'G',type:'Creature',maxMana:'1'}));assert.equal(matchesCard(bird,{...f,effects:['draw']}),false);assert.equal(matchesCard(bird,{...f,keywords:['Flying','Deathtouch']}),false);assert.equal(matchesCard(bird,{...f,maxMana:'0'}),false);assert.ok(matchesCard(card('Counterspell'),{...f,effects:['counter'],text:'target spell'}));assert.ok(matchesCard(card('Cultivate'),{...f,effects:['ramp','tutor']}));
});
test('back-face text is searchable and text mentions cannot falsely satisfy a keyword filter',()=>{
 const base=card('Sol Ring'),c={...base,keywords:[],text:'Creatures you control have flying.',faces:[{...base,name:'Back',text:'Draw two cards.',type:'Sorcery'}]};assert.ok(matchesCard(c,{...f,text:'draw two',effects:['draw']}));assert.equal(matchesCard(c,{...f,keywords:['Flying']}),false);
});
