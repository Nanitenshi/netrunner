import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allTokenDefinitions,tokenById} from '../shared/tokens.ts';
import {catalogue,catalogueById} from '../shared/catalogue.ts';
import {searchTokens} from '../shared/token-search.ts';
import {createTokenLinkService} from '../server/token-links.ts';
import {initialGame} from '../src/seed.ts';
import {enableRules} from '../shared/engine.ts';
import {applyAction,projectGame} from '../shared/game.ts';

test('all indexed token faces have stable IDs, exact characteristics and valid images',()=>{
 assert.ok(allTokenDefinitions.length>500);assert.equal(new Set(allTokenDefinitions.map(t=>t.id)).size,allTokenDefinitions.length);
 for(const t of allTokenDefinitions){assert.ok(/\bToken\b/.test(t.type)||(t.name==='Cyberman'&&t.type.startsWith('Artifact Creature')));assert.ok(tokenById.has(t.id));assert.ok(catalogueById.has(t.id));assert.ok(t.image.startsWith('https://cards.scryfall.io/'));assert.ok(t.colors.every(c=>['W','U','B','R','G'].includes(c)));assert.ok(t.source.startsWith('https://scryfall.com/card/'));}
 const incubator=allTokenDefinitions.find(t=>t.name==='Incubator')!;assert.ok(incubator);assert.ok(allTokenDefinitions.some(t=>t.scryfallId===incubator.scryfallId&&t.name==='Phyrexian'));
});
test('global token search distinguishes P/T, colors and abilities with German aliases',()=>{
 const hits=searchTokens(allTokenDefinitions,'soldat 1/1','W');assert.ok(hits.length);assert.ok(hits.every(t=>`${t.name} ${t.type} ${t.text}`.toLowerCase().includes('soldier')&&t.power==='1'&&t.toughness==='1'&&t.colors.includes('W')));
 const flying=searchTokens(allTokenDefinitions,'flugfähigkeit','any');assert.ok(flying.length);assert.ok(flying.every(t=>t.text.toLowerCase().includes('flying')));assert.equal(searchTokens(allTokenDefinitions,'unfindabletokenname').length,0);
});
test('catalogue token generation preserves chosen variant and replicates to opponents',()=>{
 const token=allTokenDefinitions.find(t=>t.name==='Angel'&&t.power==='4'&&t.toughness==='4'&&t.text.includes('Flying'))!;assert.ok(token);
 const s=applyAction(enableRules(initialGame()),'you',{type:'createToken',tokenId:token.id,count:2}),instances=s.cards.filter(c=>c.cardId===token.id);assert.equal(instances.length,2);assert.ok(instances.every(c=>c.createdToken&&c.token&&c.zone==='battlefield'));assert.equal(projectGame(s,'north').cards.filter(c=>c.cardId===token.id).length,2);assert.equal(catalogueById.get(instances[0].cardId)!.text,token.text);
});
test('related token lookup follows official component links, matches alternate print oracle IDs and caches',async()=>{
 const creator=catalogue.find(c=>c.name==='Avenger of Zendikar')!,token=allTokenDefinitions.find(t=>t.name==='Plant'&&t.power==='0'&&t.toughness==='1')!;let calls=0;
 const otherPrint='00000000-0000-4000-8000-000000000001';
 const service=createTokenLinkService((async(url)=>{calls++;if(String(url).endsWith(creator.id))return Response.json({id:creator.id,all_parts:[{component:'token',id:otherPrint,name:'Plant'},{component:'combo_piece',id:'not-a-token'}]});assert.ok(String(url).endsWith(otherPrint));return Response.json({id:otherPrint,oracle_id:token.oracleId});}) as typeof fetch);
 const [a,b]=await Promise.all([service(creator.id),service(creator.id)]);assert.deepEqual(a,b);assert.ok(a.tokenIds.includes(token.id));assert.deepEqual(a.missing,[]);await service(creator.id);assert.equal(calls,2);
 await assert.rejects(service('https://example.org/card'));assert.equal(calls,2);
});
test('token link failures never substitute another token with the same name',async()=>{
 const creator=catalogue[0],part='00000000-0000-4000-8000-000000000002';
 const service=createTokenLinkService((async(url)=>Response.json(String(url).endsWith(creator.id)?{id:creator.id,all_parts:[{component:'token',id:part,name:'Goblin'}]}:{id:part,oracle_id:'unknown-oracle'})) as typeof fetch);
 assert.deepEqual(await service(creator.id),{tokenIds:[],missing:['Goblin']});
 const failed=createTokenLinkService((async()=>new Response('',{status:429})) as typeof fetch);await assert.rejects(failed(creator.id),/Alle/);
});

test('land tokens are placed as lands without mistaking Lander artifacts for land',()=>{
 const land=allTokenDefinitions.find(t=>t.name==='Forest Dryad')!,artifact=allTokenDefinitions.find(t=>t.name==='Lander')!;
 let state=applyAction(enableRules(initialGame()),'you',{type:'createToken',tokenId:land.id,count:1});
 state=applyAction(state,'you',{type:'createToken',tokenId:artifact.id,count:1});
 assert.equal(state.cards.find(c=>c.cardId===land.id)!.isLand,true);assert.equal(state.cards.find(c=>c.cardId===artifact.id)!.isLand,false);
});
