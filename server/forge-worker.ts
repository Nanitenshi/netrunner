import {verifyForgeRuntime} from './forge-runtime.ts';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {delimiter,resolve} from 'node:path';
import type {ForgeAction,ForgeState,ForgeScenario} from '../shared/forge-protocol.ts';
import type {ForgeDeckConfig} from '../shared/forge-decks.ts';
export class ForgeDeckError extends Error {readonly issues:{seat:number;cards:string[]}[];constructor(issues:{seat:number;cards:string[]}[]){super('Ein Deck enthält Karten, die diese Forge-Version nicht kennt.');this.issues=issues;}}
export class ForgeVersionError extends Error {constructor(message='Der Forge-Server muss für die aktuellen Commander-Funktionen aktualisiert werden.'){super(message);}}
export function checkForgeStartup(reply:{mode?:string;features?:string[];issues?:unknown;error?:unknown},scenario?:ForgeScenario,ai=false){if(!reply.issues&&!reply.error&&(scenario==='commander'&&(reply.mode!=='commander'||(!reply.features?.includes('human-reveals')||!reply.features?.includes('optional-reveal-automation')||!reply.features?.includes('payment-review')||!reply.features?.includes('p0-actions')||!reply.features?.includes('action-preparation')||!reply.features?.includes('combat-decisions')||!reply.features?.includes('rule-effects')))||scenario==='effects'&&!reply.features?.includes('rule-effects')||ai&&!reply.features?.includes('ai')))throw new ForgeVersionError();}
export interface ForgeConfig {java:string;runtime:string;classes:string;scenario?:ForgeScenario;decks?:ForgeDeckConfig[]}
export class ForgeWorker {
 private process:ChildProcessWithoutNullStreams;
 private pending=new Map<string,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 private sequence=0;private closed=false;
 private onFailure:()=>void;
 readonly ready:Promise<ForgeState>;
 constructor(config:ForgeConfig,onFailure:()=>void,onUpdate:(state:ForgeState,error?:string)=>void=()=>{}){
  this.onFailure=onFailure;
  try{verifyForgeRuntime(config.runtime);}catch{throw new ForgeVersionError('Die Forge-Engine oder ihre Kartenskripte stimmen nicht mit der geprüften Version überein. Der Server muss gemeinsam aktualisiert werden.');}
  this.process=spawn(config.java,['-Xmx768m','-Dfile.encoding=UTF-8','-Djava.awt.headless=true','-cp',[resolve(config.runtime,'forge-gui-desktop-2.0.15-jar-with-dependencies.jar'),config.classes].join(delimiter),'BatusForge',...(config.scenario==='commander'?['--commander']:config.scenario==='decisions'?['--decisions']:config.scenario==='combat'?['--combat']:config.scenario==='costs'?['--costs']:config.scenario==='effects'?['--effects']:[])],{cwd:config.runtime,windowsHide:true});
  this.ready=this.wait('ready',60000);
  // Drain Forge diagnostics without exposing card data or Java internals to clients.
  this.process.stderr.on('data',()=>{});
  createInterface({input:this.process.stdout}).on('line',line=>{
   if(!line.startsWith('@@BATUSFORGE@@'))return;
   try{const reply=JSON.parse(line.slice(14));if(reply.update){onUpdate(reply.state,reply.error);return;}const key=reply.ready?'ready':reply.id;const p=this.pending.get(key);if(!p)return;clearTimeout(p.timer);this.pending.delete(key);if(reply.ready){try{checkForgeStartup(reply,config.scenario,config.decks?.some(d=>Boolean(d.ai)));}catch(e){p.reject(e as Error);this.stop();return;}}if(reply.ready&&reply.issues){p.reject(new ForgeDeckError(reply.issues));this.stop();}else if(reply.ready&&reply.error){p.reject(new Error('Forge konnte die Decks nicht starten.'));this.stop();}else p.resolve(reply.ready?reply.state:reply);}catch{this.stop();onFailure();}
  });
  const failed=()=>{if(this.closed)return;this.stop();onFailure();};this.process.on('error',failed);this.process.on('exit',failed);
  if(config.scenario==='commander')this.process.stdin.write(JSON.stringify({decks:config.decks})+String.fromCharCode(10));
 }
 private wait(key:string,ms:number):Promise<any>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(key);reject(new Error('Forge antwortet nicht. Testtisch neu starten.'));this.stop();this.onFailure();},ms);this.pending.set(key,{resolve,reject,timer});});}
 async action(seat:number,action:ForgeAction):Promise<{ok:boolean;error?:string;state?:ForgeState;paused?:boolean;accepted?:boolean}>{if(this.closed)throw new Error('Forge-Testtisch wurde beendet');const id=String(++this.sequence),reply=this.wait(id,15000);this.process.stdin.write(JSON.stringify({id,seat,action})+'\n');return reply;}
 stop(){if(this.closed)return;this.closed=true;this.process.kill();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('Forge-Testtisch wurde beendet'));}this.pending.clear();}
}
