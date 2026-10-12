import {createRequire} from 'node:module';
import {mkdir,copyFile,cp,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const require=createRequire(import.meta.url);
const {serverURL}=require('../desktop/url.cjs');
if(process.env.NEXUS_SERVER_URL)await writeFile('desktop/server-config.json',JSON.stringify({server:serverURL(process.env.NEXUS_SERVER_URL)}));
const viteRequire=createRequire(require.resolve('vite'));
const {build}=viteRequire('esbuild');
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Den Windows-x64-Build auf Windows x64 mit Node 24 erzeugen.');
if(Number(process.versions.node.split('.')[0])<24)throw new Error('Für die enthaltene Laufzeit wird Node 24 oder neuer benötigt.');
const output=resolve('desktop-runtime');
await mkdir(resolve(output,'server'),{recursive:true});
const bundle=await build({absWorkingDir:process.cwd(),tsconfig:resolve('tsconfig.json'),entryPoints:[resolve('desktop/server-entry.ts')],outfile:resolve(output,'server/desktop-server.mjs'),bundle:true,metafile:true,platform:'node',format:'esm',target:'node24',banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"}});
const packages=new Set();const notices=[];
for(const input of Object.keys(bundle.metafile.inputs)){
 if(!input.includes('node_modules'))continue;
 let dir=dirname(resolve(input));
 while(dir!==dirname(dir)){
  try{
   const pkg=JSON.parse(await readFile(resolve(dir,'package.json'),'utf8'));
   if(!pkg.name||!pkg.version){dir=dirname(dir);continue;}
   const id=`${pkg.name}@${pkg.version}`;
   if(!packages.has(id)){
    packages.add(id);let notice='';
    for(const filename of ['LICENSE','LICENSE.txt','LICENSE.md','license','license.txt'])try{notice=await readFile(resolve(dir,filename),'utf8');break;}catch{}
    if(!notice)throw new Error(`Lizenzdatei fehlt: ${id}`);
    notices.push(`${id}\n${notice}`);
   }
   break;
  }catch(error){if(error.message.startsWith('Lizenzdatei'))throw error;dir=dirname(dir);}
 }
}
await writeFile(resolve(output,'SERVER-NOTICES.txt'),notices.join('\n\n--------------------\n\n'));
await cp('dist',resolve(output,'dist'),{recursive:true});
await copyFile(process.execPath,resolve(output,'node.exe'));
// Node's distribution license includes its bundled third-party notices.
const version=process.version;
const response=await fetch(`https://nodejs.org/dist/${version}/SHASUMS256.txt`);
if(!response.ok)throw new Error('Offizielle Node-Prüfsummen konnten nicht geladen werden.');
const sums=await response.text();
const expected=sums.split('\n').find(line=>line.endsWith('win-x64/node.exe'))?.split(/\s+/)[0];
const {createHash}=await import('node:crypto');
const actual=createHash('sha256').update(await readFile(resolve(output,'node.exe'))).digest('hex');
if(actual!==expected)throw new Error('Node-Laufzeit stimmt nicht mit dem offiziellen Windows-x64-Download überein.');
const license=await fetch(`https://raw.githubusercontent.com/nodejs/node/${version}/LICENSE`);
if(!license.ok)throw new Error('Node-Lizenz konnte nicht geladen werden.');
await writeFile(resolve(output,'NODE-LICENSE.txt'),await license.text());
await writeFile(resolve(output,'runtime.json'),JSON.stringify({node:version,platform:'win32',arch:'x64',sha256:actual},null,2));
console.log('Windows-Laufzeit vorbereitet; offizielle Node-Prüfsumme stimmt überein.');
