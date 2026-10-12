import {test} from 'node:test';import assert from 'node:assert/strict';
import {isPreviewCard,includeCatalogueCard,previewCommander} from '../shared/catalogue-policy.ts';
import {catalogue,isCommander} from '../shared/catalogue.ts';
import {checkDeck} from '../shared/deck-rules.ts';
import {matchesCard} from '../shared/card-search.ts';
test('preview policy includes unreleased paper cards but excludes banned, digital, tokens and acorn',()=>{
 const c={legalities:{commander:'not_legal'},released_at:'2026-11-09',games:['paper'],layout:'normal',type_line:'Legendary Creature — Cat Wizard'};
 assert.ok(isPreviewCard(c,'2026-10-05'));assert.ok(includeCatalogueCard(c,'2026-10-05'));assert.ok(previewCommander(c));
 assert.equal(isPreviewCard({...c,released_at:'2026-01-01'},'2026-10-05'),false);assert.equal(isPreviewCard({...c,legalities:{commander:'banned'}},'2026-10-05'),false);assert.equal(isPreviewCard({...c,games:['arena']},'2026-10-05'),false);assert.equal(isPreviewCard({...c,layout:'token'},'2026-10-05'),false);assert.equal(isPreviewCard({...c,security_stamp:'acorn'},'2026-10-05'),false);
 assert.equal(previewCommander({...c,type_line:'Legendary Planeswalker'}),false);assert.ok(previewCommander({...c,type_line:'Legendary Planeswalker',oracle_text:'This card can be your commander.'}));assert.equal(previewCommander({...c,card_faces:[{type_line:'Creature'},{type_line:'Legendary Creature'}]}),false);
});
test('Massimo is searchable, has Jeskai identity and forms a playable casual Commander deck',()=>{
 const c=catalogue.find(c=>c.name==='Massimo, the Magician')!;assert.ok(c);assert.ok(c.preview);assert.equal(c.commanderLegal,false);assert.ok(isCommander(c));assert.deepEqual(c.colorIdentity,['W','U','R']);assert.equal(c.manaValue,3);assert.equal(c.power,'3');assert.equal(c.toughness,'2');
 const f={query:'Massimo',color:'',effects:[],keywords:[],text:'',type:'',maxMana:''};assert.ok(matchesCard(c,f));assert.equal(matchesCard(c,{...f,includePreviews:false}),false);
 const plains=catalogue.find(c=>c.name==='Plains')!;assert.ok(checkDeck({id:'massimo-test',name:'Massimo',commanderId:c.id,quantities:{[plains.id]:99}},true));
});
