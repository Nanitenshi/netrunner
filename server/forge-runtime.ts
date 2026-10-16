import {openSync,readSync,closeSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {forgeRuntimeLock} from '../shared/forge-runtime-lock.ts';
/** Startup only. Stream both files, never trust their filenames or a stale cache. */
export function verifyForgeRuntime(runtime:string,files:Record<string,string>=forgeRuntimeLock.files):void{
 for(const [file,expected] of Object.entries(files)){
  const fd=openSync(resolve(runtime,file),'r'),hash=createHash('sha256'),buffer=Buffer.alloc(128*1024);
  try{let count;while((count=readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,count));}finally{closeSync(fd);}
  if(hash.digest('hex')!==expected)throw Error('Forge engine or card scripts differ from the reviewed runtime.');
 }
}
