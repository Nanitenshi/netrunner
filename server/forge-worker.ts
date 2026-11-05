import {verifyForgeRuntime} from './forge-runtime.ts';
import {spawn} from 'node:child_process';
import {ForgeTransport} from './forge-transport.ts';
import {delimiter,resolve} from 'node:path';
import type {ForgeAction,ForgeState,ForgeScenario} from '../shared/forge-protocol.ts';
import type {ForgeDeckConfig} from '../shared/forge-decks.ts';
export class ForgeDeckError extends Error {readonly issues:{seat:number;cards:string[]}[];constructor(issues:{seat:number;cards:string[]}[]){super('Ein Deck enthält Karten, die diese Forge-Version nicht kennt.');this.issues=issues;}}
export class ForgeVersionError extends Error {constructor(message='Der Forge-Server muss für die aktuellen Commander-Funktionen aktualisiert werden.'){super(message);}}
export function checkForgeStartup(reply:{mode?:string;features?:string[];issues?:unknown;error?:unknown},scenario?:ForgeScenario,ai=false){if(!reply.issues&&!reply.error&&(scenario==='commander'&&(reply.mode!=='commander'||(!reply.features?.includes('human-reveals')||!reply.features?.includes('optional-reveal-automation')||!reply.features?.includes('payment-review')||!reply.features?.includes('p0-actions')||!reply.features?.includes('action-preparation')||!reply.features?.includes('combat-decisions')||!reply.features?.includes('rule-effects')||!reply.features?.includes('human-effect-payments')))||(scenario==='effects'||scenario==='taxes')&&(!reply.features?.includes('rule-effects')||!reply.features?.includes('human-effect-payments'))||ai&&!reply.features?.includes('ai')))throw new ForgeVersionError();}
export interface ForgeConfig {java:string;runtime:string;classes:string;scenario?:ForgeScenario;decks?:ForgeDeckConfig[]}
export class ForgeWorker {
 private readonly transport:ForgeTransport;
 readonly ready:Promise<ForgeState>;
 constructor(config:ForgeConfig,onFailure:()=>void,onUpdate:(state:ForgeState,error?:string)=>void=()=>{}){
  try{verifyForgeRuntime(config.runtime);}catch{throw new ForgeVersionError('Die Forge-Engine oder ihre Kartenskripte stimmen nicht mit der geprüften Version überein. Der Server muss gemeinsam aktualisiert werden.');}
  const process=spawn(config.java,['-Xmx768m','-Dfile.encoding=UTF-8','-Djava.awt.headless=true','-cp',[resolve(config.runtime,'forge-gui-desktop-2.0.15-jar-with-dependencies.jar'),config.classes].join(delimiter),'BatusForge',...(config.scenario==='commander'?['--commander']:config.scenario==='decisions'?['--decisions']:config.scenario==='combat'?['--combat']:config.scenario==='costs'?['--costs']:config.scenario==='effects'?['--effects']:config.scenario==='taxes'?['--taxes']:[])],{cwd:config.runtime,windowsHide:true});
  this.transport=new ForgeTransport(process,{
   onFailure,
   onUpdate,
   onReady:reply=>{
    checkForgeStartup(reply,config.scenario,config.decks?.some(d=>Boolean(d.ai)));
    if(reply.issues)throw new ForgeDeckError(reply.issues);
    if(reply.error)throw new Error('Forge konnte die Decks nicht starten.');
   },
  });
  this.ready=this.transport.ready;
  if(config.scenario==='commander')this.transport.initialize({decks:config.decks});
 }
 async action(seat:number,action:ForgeAction):Promise<{ok:boolean;error?:string;state?:ForgeState;paused?:boolean;accepted?:boolean}>{
  const reply=await this.transport.request(seat,action);
  return {...reply,ok:reply.ok===true};
 }
 stop(){this.transport.stop();}
}
