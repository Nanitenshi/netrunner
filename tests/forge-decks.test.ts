
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {catalogue} from '../shared/catalogue.ts';
import {createForgeRooms} from '../server/forge-rooms.ts';
import {forgeActionSchema,type ForgeRoom} from '../shared/forge-protocol.ts';
import type {User} from '../shared/protocol.ts';
import {checkForgeStartup,ForgeVersionError} from '../server/forge-worker.ts';
const card=(name:string)=>{const c=catalogue.find(c=>c.name===name);assert(c,name);return c;};
const deck=(id='mine')=>({id,name:'Eigenes Deck',commanderId:card('Isamaru, Hound of Konda').id,quantities:{[card('Plains').id]:98,[card('Swords to Plowshares').id]:1},notes:'Private Strategie'});
const users:User[]=[{id:'ada',name:'Ada',provider:'guest'},{id:'bela',name:'Bela',provider:'guest'}];
const rooms=()=>{const views=new Map<string,ForgeRoom|null>();const forge=createForgeRooms({java:'unused',runtime:'unused',classes:'unused'},(id,v)=>views.set(id,v));forge.create(users[0]);forge.join(users[1],{code:views.get('ada')!.code});return {forge,views};};
test('Forge deck transport validates a complete Commander deck and sends only catalog-derived names/counts',()=>{
 const {config}=toForgeDeck(deck(),'Ada');assert.equal(config.commanders[0].name,'Isamaru, Hound of Konda');assert.equal(config.main.reduce((n,c)=>n+c.count,0),99);assert(!JSON.stringify(config).includes('Private Strategie'));
 for(const input of [{...deck(),quantities:{}},{...deck(),commanderId:card('Forest').id},{...deck(),quantities:{[card('Island').id]:99}},{...deck(),quantities:{[card('Swords to Plowshares').id]:99}},{...deck(),script:'eval'}])assert.throws(()=>toForgeDeck(input,'Ada'));
});
test('partner commanders stay outside the main deck and active face names accompany multi-face cards',()=>{
 const partner={id:'pair',name:'Partner',commanderId:card('Rograkh, Son of Rohgahh').id,secondCommanderId:card('Ardenn, Intrepid Archaeologist').id,quantities:{[card('Plains').id]:98}};assert.equal(toForgeDeck(partner,'Ada').config.commanders.length,2);
 const modal={id:'modal',name:'Modal',commanderId:card('Ruxa, Patient Professor').id,quantities:{[card('Forest').id]:98,[card('Bala Ged Recovery // Bala Ged Sanctuary').id]:1}};assert.equal(toForgeDeck(modal,'Ada').config.main.find(c=>c.frontName)?.frontName,'Bala Ged Recovery');
});
test('only the owner receives their deck list; readiness requires a deck and resets after changing it',()=>{
 const {forge,views}=rooms();assert.throws(()=>forge.ready(users[0],{ready:true}));forge.deck(users[0],deck());const own=views.get('ada')!,other=views.get('bela')!;assert.equal(own.myDeck?.notes,'Private Strategie');assert.equal(other.myDeck,undefined);assert(!JSON.stringify(other).includes(card('Swords to Plowshares').id));assert(!JSON.stringify(other).includes('Private Strategie'));
 forge.ready(users[0],{ready:true});assert.equal(views.get('ada')!.players[0].ready,true);forge.deck(users[0],{...deck(),name:'Neue Auswahl'});assert.equal(views.get('bela')!.players[0].ready,false);
 const revision=views.get('ada')!.revision;assert.throws(()=>forge.deck(users[0],{...deck(),quantities:{}}));assert.equal(views.get('ada')!.revision,revision);forge.close();
});
test('host selects the shared mode, both users must be ready and foreign users cannot edit the table',async()=>{
 const {forge,views}=rooms();assert.throws(()=>forge.scenario(users[1],{scenario:'commander'}));forge.scenario(users[0],{scenario:'commander'});assert.equal(views.get('bela')!.scenario,'commander');assert.throws(()=>forge.deck({id:'outsider',name:'Outsider',provider:'guest'},deck()));
 forge.deck(users[0],deck());forge.ready(users[0],{ready:true});await assert.rejects(forge.start(users[0],{scenario:'commander'}),/Beide Spieler/);assert.equal(views.get('ada')!.starting,false);assert.equal(views.get('ada')!.game,null);forge.close();
});
test('new Forge inputs reject forged seats, ability indexes, and noninteger numeric choices',()=>{
 assert(forgeActionSchema.safeParse({type:'cast',cardId:'1',abilityIndex:1}).success);assert(forgeActionSchema.safeParse({type:'activate',cardId:'1',abilityIndex:2}).success);assert(forgeActionSchema.safeParse({type:'keep'}).success);
 for(const a of [{type:'mulligan',seat:1},{type:'keep',cards:['fake']},{type:'activate',cardId:'1',abilityIndex:-1},{type:'cast',cardId:'1',abilityIndex:64},{type:'choose',choiceId:'b40d1f76-c75b-44a3-920f-1026c9ff095f',value:1.2}])assert(!forgeActionSchema.safeParse(a).success);
});
test('an old bridge cannot silently substitute its fixture for the selected Commander decks',()=>{
 assert.throws(()=>checkForgeStartup({},'commander'),ForgeVersionError);assert.throws(()=>checkForgeStartup({mode:'fixture'},'commander'),ForgeVersionError);
 assert.doesNotThrow(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review','p0-actions','action-preparation','combat-decisions','rule-effects','human-effect-payments']},'commander'));assert.doesNotThrow(()=>checkForgeStartup({issues:[{seat:0,cards:['Missing']} ]},'commander'));assert.doesNotThrow(()=>checkForgeStartup({},'combat'));
 assert.throws(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation']},'commander'),ForgeVersionError);
});

test('Commander startup rejects payment-only adapters without safe P0 actions',()=>{assert.throws(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review']},'commander'),ForgeVersionError);});

test('Commander startup requires transactional preparation and activated payment support',()=>{assert.throws(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review','p0-actions']},'commander'),ForgeVersionError);});

test('Commander startup rejects adapters without native block capacity validation and damage proposals',()=>{assert.throws(()=>checkForgeStartup({mode:'commander',features:['human-reveals','optional-reveal-automation','payment-review','p0-actions','action-preparation']},'commander'),ForgeVersionError);});
