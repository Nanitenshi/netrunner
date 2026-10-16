import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyForgeRuntime} from '../server/forge-runtime.ts';
import {createForgeRooms} from '../server/forge-rooms.ts';
test('runtime verification rejects changed scripts even after a prior successful check',()=>{
 const path=mkdtempSync(join(tmpdir(),'forge-runtime-'));
 try{writeFileSync(join(path,'scripts.zip'),'reviewed');const files={'scripts.zip':createHash('sha256').update('reviewed').digest('hex')};verifyForgeRuntime(path,files);writeFileSync(join(path,'scripts.zip'),'changed');assert.throws(()=>verifyForgeRuntime(path,files),/differ/);assert.throws(()=>verifyForgeRuntime(path,{'missing.jar':files['scripts.zip']}));}finally{unlinkSync(join(path,'scripts.zip'));rmdirSync(path);}
});
test('unreviewed runtime fails before engine startup and leaves the lobby available for retry',async()=>{
 const rooms=createForgeRooms({java:'unstarted',runtime:'missing-runtime',classes:'unstarted'},()=>{}),host={id:'host',name:'Host',provider:'guest' as const},guest={id:'guest',name:'Guest',provider:'guest' as const};
 try{rooms.create(host);rooms.join(guest,{code:rooms.snapshot(host.id)!.code});for(let i=0;i<2;i++){await assert.rejects(rooms.start(host,{scenario:'standard'}),/geprüften Version/);assert.equal(rooms.snapshot(host.id)!.starting,false);assert.equal(rooms.snapshot(host.id)!.game,null);}}finally{rooms.close();}
});
