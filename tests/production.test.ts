import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import type {IncomingMessage} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {serverConfig,clientAddress} from '../server/config.ts';
import {createNexusServer} from '../server/server.ts';

test('production rejects incomplete or insecure setup and normalizes Discord redirect origin',()=>{
 const configured={production:true,clientId:'123',clientSecret:'test-secret'};
 assert.throws(()=>serverConfig(configured,{}),/PUBLIC_URL/);
 assert.throws(()=>serverConfig({...configured,publicURL:'http://game.test'},{}),/HTTPS/);
 assert.throws(()=>serverConfig({production:true,publicURL:'https://game.test'},{}),/Discord/);
 for(const url of ['https://game.test/path','https://user:pass@game.test','https://game.test/?x=1','ftp://game.test'])assert.throws(()=>serverConfig({...configured,publicURL:url},{}));
 const config=serverConfig({...configured,publicURL:'https://game.test/'},{});
 assert.equal(config.publicURL,'https://game.test');assert.equal(config.guest,false);
 assert.equal(serverConfig({},{}).guest,true);
 assert.equal(serverConfig({},{ENABLE_GUEST:'false'}).guest,false);
 assert.throws(()=>serverConfig({},{TRUST_PROXY:'yes'}));
});

test('proxy addresses are ignored by default and only valid overwritten IP addresses are accepted',()=>{
 const req={headers:{'x-nexus-client-ip':'203.0.113.4'},socket:{remoteAddress:'127.0.0.1'}} as unknown as IncomingMessage;
 assert.equal(clientAddress(req,false),'127.0.0.1');assert.equal(clientAddress(req,true),'203.0.113.4');
 req.headers['x-nexus-client-ip']='fake, 1.2.3.4';assert.equal(clientAddress(req,true),'127.0.0.1');
});

test('production OAuth uses secure cookies, clears temporary binding and handles provider failure without secrets',async()=>{
 let fail=false;
 const fetcher=(async(url:string|URL|Request)=>{
  if(fail)throw new Error('sensitive-provider-detail');
  return String(url).endsWith('/token')?Response.json({access_token:'private-token'}):Response.json({id:'123',username:'Player'});
 }) as typeof fetch;
 const server=createNexusServer({database:':memory:',production:true,publicURL:'https://game.test/',clientId:'123',clientSecret:'private-secret',fetcher,proxy:true});
 server.http.listen(0,'127.0.0.1');await once(server.http,'listening');
 const base=`http://127.0.0.1:${(server.http.address() as {port:number}).port}`;
 try{
  const health=await fetch(`${base}/healthz`);assert.deepEqual(await health.json(),{ok:true});
  assert.equal((await fetch(`${base}/api/guest`,{method:'POST',headers:{Origin:'https://game.test'},body:'{}'})).status,403);
  const begin=async()=>{const res=await fetch(`${base}/auth/discord`,{redirect:'manual'});const url=new URL(res.headers.get('location')!);assert.equal(url.searchParams.get('redirect_uri'),'https://game.test/auth/discord/callback');assert.match(res.headers.get('set-cookie')!,/Secure/);return {cookie:res.headers.get('set-cookie')!.split(';')[0],url:`${base}/auth/discord/callback?state=${url.searchParams.get('state')}&code=code`};};
  const first=await begin();const res=await fetch(first.url,{headers:{Cookie:first.cookie},redirect:'manual'});
  assert.equal(res.status,302);const cookies=res.headers.getSetCookie();
  assert.ok(cookies.some(c=>c.startsWith('nexus_oauth=;')&&c.includes('Max-Age=0')));
  const session=cookies.find(c=>c.startsWith('nexus_session='))!;assert.match(session,/Secure/);assert.match(session,/HttpOnly/);
  const info=await(await fetch(`${base}/api/session`,{headers:{Cookie:session.split(';')[0]}})).json();assert.equal(info.user.provider,'discord');assert.equal(info.publicServer,true);assert.equal(info.guestEnabled,false);
  fail=true;const next=await begin();const failed=await fetch(next.url,{headers:{Cookie:next.cookie},redirect:'manual'});const body=await failed.text();assert.equal(failed.status,400);assert.match(body,/#account/);assert.ok(!body.includes('sensitive-provider-detail'));assert.ok(!body.includes('private-secret'));
  const cancelled=await begin();const denied=await fetch(cancelled.url.replace('code=code','error=access_denied'),{headers:{Cookie:cancelled.cookie}});assert.equal(denied.status,400);assert.match(await denied.text(),/abgebrochen/);
 }finally{await server.close();}
});

test('live SQLite backup includes committed WAL data and refuses to overwrite a backup',()=>{
 const directory=mkdtempSync(join(tmpdir(),'nexus-backup-'));const source=join(directory,'source.sqlite');const target=join(directory,'copy.sqlite');
 const db=new DatabaseSync(source);db.exec("PRAGMA journal_mode=WAL;CREATE TABLE records(key TEXT,value TEXT);INSERT INTO records VALUES('room:test','saved')");
 try{
  const run=()=>spawnSync(process.execPath,['scripts/backup.mjs',target],{env:{...process.env,DATABASE_PATH:source},encoding:'utf8'});
  const result=run();assert.equal(result.status,0,result.stderr);
  const copy=new DatabaseSync(target,{readOnly:true});try{assert.equal(copy.prepare('SELECT value FROM records').get()!.value,'saved');}finally{copy.close();}
  assert.notEqual(run().status,0);
 }finally{db.close();rmSync(directory,{recursive:true,force:true});}
});
