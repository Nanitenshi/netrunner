import {test} from 'node:test';import assert from 'node:assert/strict';import {createArtworkService,artworkURL} from '../server/artworks.ts';import {catalogue} from '../shared/catalogue.ts';
const card=catalogue[0];const image='https://cards.scryfall.io/large/front/a/a/00000000-0000-4000-8000-000000000001.jpg';
test('artworks are bound to Oracle identity, safely imaged, cached and deduplicated',async()=>{
 let calls=0;const service=createArtworkService((async(url,options)=>{calls++;const u=new URL(String(url));assert.equal(u.hostname,'api.scryfall.com');assert.equal(u.searchParams.get('q'),`oracleid:${card.oracleId}`);assert.equal(options?.redirect,'error');return Response.json({data:[{id:'00000000-0000-4000-8000-000000000001',oracle_id:card.oracleId,image_uris:{large:image},set_name:'Showcase',collector_number:'1',artist:'Artist'},{id:'00000000-0000-4000-8000-000000000002',oracle_id:'foreign',image_uris:{large:image}},{id:'00000000-0000-4000-8000-000000000003',oracle_id:card.oracleId,image_uris:{large:'https://example.org/image.jpg'}}],has_more:true});}) as typeof fetch);
 const [a,b]=await Promise.all([service(card.id),service(card.id)]);assert.deepEqual(a,b);assert.equal(a.artworks.length,1);assert.equal(a.hasMore,true);await service(card.id);assert.equal(calls,1);
 await assert.rejects(service('unknown'));await assert.rejects(service(card.id,0));await assert.rejects(service(card.id,101));assert.equal(calls,1);assert.equal(artworkURL('https://cards.scryfall.io@evil.example/a'),false);
});
test('double-faced printings use front image and provider failure stays recoverable',async()=>{
 const service=createArtworkService((async()=>Response.json({data:[{id:'00000000-0000-4000-8000-000000000001',oracle_id:card.oracleId,card_faces:[{image_uris:{large:image}}]}],has_more:false})) as typeof fetch);assert.equal((await service(card.id)).artworks[0].image,image);
 const failure=createArtworkService((async()=>new Response('',{status:429})) as typeof fetch);await assert.rejects(failure(card.id),/später/);
});
