import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogue,isCommander,commanderPair} from '../shared/catalogue.ts';
import {checkDeck} from '../shared/deck-rules.ts';
const card=(name:string)=>{const c=catalogue.find(c=>c.name===name);assert.ok(c,`${name} fehlt`);return c;};
test('full catalogue includes commanders outside the demo and special commander permissions',()=>{
 assert.ok(catalogue.length>30000);
 for(const name of ['Yuriko, the Tiger\u2019s Shadow'.replace('’',"'"),'Grist, the Hunger Tide','Urza, Lord High Artificer','Daretti, Scrap Savant'])assert.ok(isCommander(card(name)));
 assert.equal(isCommander(card('Sol Ring')),false);
 assert.equal(isCommander(card('Acolyte of Bahamut')),false);
});
test('partner, named partner, background and Doctor pairs reject incompatible commanders',()=>{
 assert.ok(commanderPair(card('Tymna the Weaver'),card('Thrasios, Triton Hero')));
 assert.ok(commanderPair(card('Haldan, Avid Arcanist'),card('Pako, Arcane Retriever')));
 assert.equal(commanderPair(card('Haldan, Avid Arcanist'),card('Tymna the Weaver')),false);
 assert.ok(commanderPair(card('Faceless One'),card('Acolyte of Bahamut')));
 assert.ok(commanderPair(card('Rose Tyler'),card('The Tenth Doctor')));
 assert.equal(commanderPair(card('Rose Tyler'),card('Grist, the Hunger Tide')),false);
});
test('two commanders count toward 100, combine identity, and cannot be in the library',()=>{
 const a=card('Tymna the Weaver'),b=card('Thrasios, Triton Hero'),forest=card('Forest');
 const deck={id:'pair',name:'Pair',commanderId:a.id,secondCommanderId:b.id,quantities:{[forest.id]:98}};
 assert.doesNotThrow(()=>checkDeck(deck,true));
 assert.doesNotThrow(()=>checkDeck({...deck,quantities:{[forest.id]:99}},true));
 assert.throws(()=>checkDeck({...deck,quantities:{[forest.id]:97}},true),/100/);
 assert.throws(()=>checkDeck({...deck,secondCommanderId:card('Grist, the Hunger Tide').id}),/gemeinsam/);
 assert.throws(()=>checkDeck({...deck,quantities:{[b.id]:1}}),/doppelt/);
});
test('chosen commander color and Oracle copy exceptions are validated',()=>{
 const piper=card('The Prismatic Piper'),rats=card('Relentless Rats');
 const deck={id:'color',name:'Color',commanderId:piper.id,commanderColors:{[piper.id]:'B'},quantities:{[rats.id]:99}};
 assert.doesNotThrow(()=>checkDeck(deck,true));
 assert.throws(()=>checkDeck({...deck,commanderColors:{}},true),/Farbe/);
 assert.throws(()=>checkDeck({...deck,commanderColors:{[piper.id]:'G'}},true),/Farbidentität/);
});

test('double-faced cards retain combined identity and oversized house-rule decks stay bounded',()=>{
 assert.deepEqual(card('Esika, God of the Tree // The Prismatic Bridge').colorIdentity,['W','U','B','R','G']);
 assert.deepEqual(card('Archangel Avacyn // Avacyn, the Purifier').colorIdentity,['W','R']);
 assert.deepEqual(card('Valki, God of Lies // Tibalt, Cosmic Impostor').colorIdentity,['B','R']);
 const a=card("Atraxa, Praetors' Voice");const d={id:'large',name:'Large',commanderId:a.id,quantities:{[card('Forest').id]:99,[card('Island').id]:99}};assert.doesNotThrow(()=>checkDeck(d,true));
 assert.throws(()=>checkDeck({...d,quantities:{...d.quantities,[card('Plains').id]:99}},true),/250/);
});

test('all 22 explicit planeswalker commanders and Grist are eligible; ordinary walkers are rejected',()=>{
 const explicit=catalogue.filter(c=>!c.preview&&(c.faces[0]?.type??c.type).includes('Planeswalker')&&c.text.includes('can be your commander'));
 assert.equal(explicit.length,22,'Catalogue snapshot: explicitly permitted planeswalkers');
 const basic:Record<string,string>={W:'Plains',U:'Island',B:'Swamp',R:'Mountain',G:'Forest'};
 for(const c of [...explicit,card('Grist, the Hunger Tide')]){
  assert.ok(isCommander(c),c.name);const land=card(basic[c.colorIdentity[0]]);
  assert.doesNotThrow(()=>checkDeck({id:'pw',name:c.name,commanderId:c.id,quantities:{[land.id]:99}},true),c.name);
 }
 for(const name of ['Teferi, Hero of Dominaria','Oko, Thief of Crowns','Narset, Parter of Veils']){
  const c=card(name);assert.equal(isCommander(c),false,name);
  assert.throws(()=>checkDeck({id:'invalid-pw',name,commanderId:c.id,quantities:{[card('Island').id]:99}},true),/legalen Commander/);
 }
});
test('planeswalker partners and creature-front walkers preserve commander rules',()=>{
 const will=card('Will Kenrith'),rowan=card('Rowan Kenrith'),jeska=card('Jeska, Thrice Reborn'),tevesh=card('Tevesh Szat, Doom of Fools');
 assert.ok(commanderPair(will,rowan));assert.ok(commanderPair(jeska,tevesh));assert.equal(commanderPair(will,jeska),false);
 for(const [a,b,land] of [[will,rowan,'Island'],[jeska,tevesh,'Swamp']] as const)assert.doesNotThrow(()=>checkDeck({id:'pw-pair',name:'PW pair',commanderId:a.id,secondCommanderId:b.id,quantities:{[card(land).id]:98}},true));
 for(const name of ["Jace, Vryn's Prodigy // Jace, Telepath Unbound",'Valki, God of Lies // Tibalt, Cosmic Impostor'])assert.ok(isCommander(card(name)),name);
});
