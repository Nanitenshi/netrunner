import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {delimiter,resolve} from 'node:path';
import type {ForgeAction,ForgeState} from '../shared/forge-protocol.ts';
export interface ForgeConfig {java:string;runtime:string;classes:string;scenario?:'standard'|'decisions'|'combat'}
export class ForgeWorker {
 private process:ChildProcessWithoutNullStreams;
 private pending=new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private sequence=0;private closed=false;
 private onFailure:()=>void;
 readonly ready:Promise<ForgeState>;
 constructor(config:ForgeConfig,onFailure:()=>void,onUpdate:(state:ForgeState,error?:string)=>void=()=>{}){
  this.onFailure=onFailure;
  this.process=spawn(config.java,['-Xmx768m','-Dfile.encoding=UTF-8','-Djava.awt.headless=true','-cp',[resolve(config.runtime,'forge-gui-desktop-2.0.15-jar-with-dependencies.jar'),config.classes].join(delimiter),'BatusForge',...(config.scenario==='decisions'?['--decisions']:config.scenario==='combat'?['--combat']:[])],{cwd:config.runtime,windowsHide:true});
  this.ready=this.wait('ready',60000);
  // Drain Forge diagnostics without exposing card data or Java internals to clients.
  this.process.stderr.on('data',()=>{});
  createInterface({input:this.process.stdout}).on('line',line=>{
   if(!line.startsWith('@@BATUSFORGE@@'))return;
   try{const reply=JSON.parse(line.slice(14));if(reply.update){onUpdate(reply.state,reply.error);return;}const key=reply.ready?'ready':reply.id;const p=this.pending.get(key);if(!p)return;clearTimeout(p.timer);this.pending.delete(key);p.resolve(reply.ready?reply.state:reply);}catch{this.stop();onFailure();}
  });
  const failed=()=>{if(this.closed)return;this.stop();onFailure();};this.process.on('error',failed);this.process.on('exit',failed);
 }
 private wait(key:string,ms:number):Promise<any>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(key);reject(new Error('Forge antwortet nicht. Testtisch neu starten.'));this.stop();this.onFailure();},ms);this.pending.set(key,{resolve,reject,timer});});}
 async action(seat:number,action:ForgeAction):Promise<{ok:boolean;error?:string;state?:ForgeState;paused?:boolean;accepted?:boolean}>{if(this.closed)throw new Error('Forge-Testtisch wurde beendet');const id=String(++this.sequence),reply=this.wait(id,15000);this.process.stdin.write(JSON.stringify({id,seat,action})+'\n');return reply;}
 stop(){if(this.closed)return;this.closed=true;this.process.kill();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Forge-Testtisch wurde beendet'));}this.pending.clear();}
}
