import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyForgeRuntime} from '../server/forge-runtime.ts';

const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');

test('Forge runtime lock accepts exactly the reviewed engine and card archive',()=>{
 const dir=mkdtempSync(join(tmpdir(),'batusmtg-forge-lock-'));
 try{
  mkdirSync(join(dir,'res','cardsfolder'),{recursive:true});
  writeFileSync(join(dir,'engine.jar'),'reviewed-engine');
  writeFileSync(join(dir,'res','cardsfolder','cardsfolder.zip'),'reviewed-cards');
  const files={'engine.jar':sha256('reviewed-engine'),'res/cardsfolder/cardsfolder.zip':sha256('reviewed-cards')};
  assert.doesNotThrow(()=>verifyForgeRuntime(dir,files));
  writeFileSync(join(dir,'engine.jar'),'tampered-engine');
  assert.throws(()=>verifyForgeRuntime(dir,files),/Forge engine or card scripts differ/);
  writeFileSync(join(dir,'engine.jar'),'reviewed-engine');
  writeFileSync(join(dir,'res','cardsfolder','cardsfolder.zip'),'tampered-cards');
  assert.throws(()=>verifyForgeRuntime(dir,files),/Forge engine or card scripts differ/);
  assert.throws(()=>verifyForgeRuntime(dir,{'missing.jar':sha256('anything')}),{code:'ENOENT'});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
