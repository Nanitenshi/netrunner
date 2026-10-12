import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialGame} from '../src/seed.ts';
import {catalogue} from '../shared/catalogue.ts';
import {applyAction,projectGame} from '../shared/game.ts';
import {enterZone} from '../shared/placement.ts';
import {loyaltyCosts,loyaltyDelta} from '../shared/loyalty.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {checkDeck} from '../shared/deck-rules.ts';
import {faceDefinition} from '../shared/card-state.ts';
import {normalizeScryfallCard} from '../shared/cards.ts';
function fixture(){const s=initialGame(),c=s.cards.find(c=>c.ownerId==='you'&&c.zone==='battlefield')!;c.cardId=catalogue.find(c=>c.name==='Gideon Jura')!.id;c.zone='hand';enterZone(s,c,'battlefield');return {s,c};}
test('planeswalkers enter with printed loyalty and copies start fresh',()=>{const {s,c}=fixture();assert.equal(c.markers?.loyalty,6);c.markers!.loyalty=2;const copy=applyAction(s,'you',{type:'copy',cardId:c.id,newId:'walker-copy'});assert.equal(copy.cards.find(c=>c.id==='walker-copy')!.markers?.loyalty,6);enterZone(s,c,'hand');assert.equal(c.markers?.loyalty,undefined);enterZone(s,c,'battlefield');assert.equal(c.markers?.loyalty,6);});
test('printed costs only update shared loyalty, including zero; no ability or zone change',()=>{const {s,c}=fixture();const changed=applyAction(s,'you',{type:'loyaltyCost',cardId:c.id,index:1,x:0});assert.equal(changed.cards.find(x=>x.id===c.id)!.markers!.loyalty,4);assert.equal(changed.cards.find(x=>x.id===c.id)!.zone,'battlefield');assert.equal(changed.rules,s.rules);assert.equal(s.cards.find(x=>x.id===c.id)!.markers!.loyalty,6);assert.equal(projectGame(changed,'north').cards.find(x=>x.id===c.id)!.markers!.loyalty,4);const zero=applyAction(changed,'you',{type:'loyaltyCost',cardId:c.id,index:2,x:0});assert.equal(zero.cards.find(x=>x.id===c.id)!.markers!.loyalty,4);});
test('costs reject insufficient loyalty, hidden cards and another controller',()=>{const {s,c}=fixture();c.markers!.loyalty=1;assert.throws(()=>applyAction(s,'you',{type:'loyaltyCost',cardId:c.id,index:1,x:0}));assert.throws(()=>applyAction(s,'north',{type:'loyaltyCost',cardId:c.id,index:0,x:0}));c.faceDown=true;assert.throws(()=>applyAction(s,'you',{type:'loyaltyCost',cardId:c.id,index:0,x:0}));});
test('unicode minus and variable loyalty costs are parsed without passive text',()=>{const costs=loyaltyCosts({type:'Planeswalker',text:'Passive ability.\n+1: Draw.\n−X: Exile.\n0: Scry.'});assert.deepEqual(costs.map(c=>c.cost),['+1','-X','0']);assert.equal(loyaltyDelta('-X',4),-4);assert.throws(()=>loyaltyDelta('-X',-1));assert.equal(loyaltyCosts({type:'Creature',text:'+1: Draw.'}).length,0);});
test('loyalty follows the printed physical face',()=>{const d=catalogue.find(c=>c.name.startsWith('Jace, Vryn'))!;assert.equal(faceDefinition(d,0).loyalty,null);assert.equal(faceDefinition(d,1).loyalty,'5');const normalized=normalizeScryfallCard({id:'walker',name:'Walker',cmc:3,color_identity:[],scryfall_uri:'source',type_line:'Planeswalker',loyalty:'4',image_uris:{large:'image'}});assert.equal(normalized.loyalty,'4');});
test('all five prepared decks are complete, legal and independent editable copies',()=>{assert.equal(preparedDecks.length,5);for(const d of preparedDecks){assert.deepEqual(checkDeck(d,true),d);assert.equal(1+Object.values(d.quantities).reduce((a,b)=>a+b,0),100);}const copy=structuredClone(preparedDecks[0]);copy.quantities={};assert.ok(Object.keys(preparedDecks[0].quantities).length>0);});
