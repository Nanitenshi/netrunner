import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {ForgeWorker,ForgeDeckError,ForgeVersionError,type ForgeConfig} from './forge-worker.ts';
import {catalogueById} from '../shared/catalogue.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {forgeActionSchema,projectForge,type ForgeState,type ForgeRoom,type ForgeScenario} from '../shared/forge-protocol.ts';
import type {User,DeckData} from '../shared/protocol.ts';
interface Room {scenario:ForgeScenario;code:string;players:User[];decks:Map<string,DeckData>;ready:Set<string>;deckErrors:Map<string,string[]>;revision:number;starting:boolean;state:ForgeState|null;worker?:ForgeWorker;error?:string;queue:Promise<void>;seen:Set<string>}
export function createForgeRooms(config:ForgeConfig|undefined,emit:(id:string,view:ForgeRoom|null)=>void){
 const rooms=new Map<string,Room>();const find=(id:string)=>[...rooms.values()].find(r=>r.players.some(p=>p.id===id));
 const view=(r:Room,id:string):ForgeRoom=>({scenario:r.scenario,code:r.code,hostId:r.players[0].id,players:r.players.map(p=>{const d=r.decks.get(p.id);return {id:p.id,name:p.name,ready:r.ready.has(p.id),...(d?{deckName:d.name,commander:[d.commanderId,d.secondCommanderId].filter(Boolean).map(id=>catalogueById.get(id!)!.name).join(' + '),cardCount:(d.secondCommanderId?2:1)+Object.values(d.quantities).reduce((a,b)=>a+b,0)}:{})};}),myDeck:r.decks.get(id),deckErrors:r.deckErrors.get(id),seat:r.players.findIndex(p=>p.id===id),revision:r.revision,starting:r.starting,error:r.error,game:r.state?projectForge(r.state,r.players.findIndex(p=>p.id===id)):null});
 const broadcast=(r:Room)=>r.players.forEach(p=>emit(p.id,view(r,p.id)));
 const must=(id:string)=>{const r=find(id);if(!r)throw new Error('Kein Forge-Tisch');return r;};
 const pregame=(r:Room)=>{if(r.starting||r.state||r.worker)throw Error('Deckauswahl nur vor der Partie möglich');};
 return {
  enabled:Boolean(config),has:(id:string)=>Boolean(find(id)),snapshot:(id:string)=>{const r=find(id);return r?view(r,id):null;},
  create(user:User){if(!config)throw new Error('Forge ist auf diesem Server nicht eingerichtet');if(find(user.id))throw new Error('Verlasse zuerst deinen Forge-Tisch');if(rooms.size>=2)throw new Error('Beide Forge-Tische sind belegt');let code:string;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r:Room={code,players:[user],decks:new Map(),ready:new Set(),deckErrors:new Map(),revision:0,starting:false,state:null,queue:Promise.resolve(),seen:new Set(),scenario:'standard'};rooms.set(code,r);broadcast(r);},
  join(user:User,input:unknown){const {code}=z.object({code:z.string().trim().toUpperCase().regex(/^[A-F0-9]{6}$/)}).strict().parse(input);const old=find(user.id);if(old){if(old.code===code){emit(user.id,view(old,user.id));return;}throw new Error('Verlasse zuerst deinen Forge-Tisch');}const r=rooms.get(code);if(!r||r.players.length>=2||r.starting||r.state)throw new Error('Forge-Tisch nicht verfügbar');r.players.push(user);r.revision++;broadcast(r);},
  scenario(user:User,input:unknown){const {scenario}=z.object({scenario:z.enum(['standard','decisions','combat','costs','commander'])}).strict().parse(input);const r=must(user.id);pregame(r);if(r.players[0].id!==user.id)throw Error('Nur der Gastgeber wählt den Modus');r.scenario=scenario;r.ready.clear();r.revision++;broadcast(r);},
  deck(user:User,input:unknown){const r=must(user.id);pregame(r);const {deck}=toForgeDeck(input,user.name);r.decks.set(user.id,deck);r.ready.delete(user.id);r.deckErrors.delete(user.id);r.error=undefined;r.revision++;broadcast(r);},
  ready(user:User,input:unknown){const {ready}=z.object({ready:z.boolean()}).strict().parse(input);const r=must(user.id);pregame(r);if(ready&&!r.decks.has(user.id))throw Error('Zuerst ein vollständiges Commander-Deck auswählen');if(ready)r.ready.add(user.id);else r.ready.delete(user.id);r.revision++;broadcast(r);},
  async start(user:User,input:unknown={}){
   const {scenario}=z.object({scenario:z.enum(['standard','decisions','combat','costs','commander']).default('standard')}).strict().parse(input);const r=must(user.id);pregame(r);
   if(r.players[0].id!==user.id||r.players.length!==2)throw Error('Nur der Gastgeber kann mit zwei Spielern starten');if(!config)throw Error('Forge nicht eingerichtet');
   const decks=scenario==='commander'?r.players.map(p=>{if(!r.ready.has(p.id)||!r.decks.has(p.id))throw Error('Beide Spieler müssen ein Deck wählen und bereit sein');return toForgeDeck(r.decks.get(p.id),p.name).config;}):undefined;
   r.starting=true;r.scenario=scenario;r.error=undefined;r.deckErrors.clear();broadcast(r);
   const worker=new ForgeWorker({...config,scenario,decks},()=>{if(rooms.get(r.code)!==r||r.worker!==worker)return;r.error='Forge-Verbindung beendet. Verlasse den Tisch und erstelle einen neuen.';r.state=null;r.starting=false;r.revision++;broadcast(r);},(state,error)=>{if(rooms.get(r.code)!==r||r.worker!==worker)return;r.state=state;r.error=error;r.revision++;broadcast(r);});r.worker=worker;
   try{const state=await worker.ready;if(rooms.get(r.code)!==r){worker.stop();throw Error('Tisch wurde verlassen');}r.state=state;r.starting=false;r.revision++;broadcast(r);}
   catch(e){worker.stop();if(rooms.get(r.code)!==r)throw e;r.worker=undefined;r.state=null;r.starting=false;r.error=e instanceof ForgeVersionError?e.message:'Die Partie konnte nicht gestartet werden. Decks prüfen und erneut versuchen.';if(e instanceof ForgeDeckError){for(const issue of e.issues){const p=r.players[issue.seat];if(p){r.deckErrors.set(p.id,issue.cards);r.ready.delete(p.id);}}}r.revision++;broadcast(r);throw Error(e instanceof ForgeDeckError||e instanceof ForgeVersionError?e.message:'Forge konnte nicht gestartet werden');}
  },
  async action(user:User,input:unknown){const data=z.object({id:z.string().min(1).max(80),revision:z.number().int().nonnegative(),action:forgeActionSchema}).strict().parse(input);const r=must(user.id);const perform=async()=>{if(rooms.get(r.code)!==r||!r.state||!r.worker)throw new Error('Forge-Tisch nicht aktiv');const key=user.id+':'+data.id;if(r.seen.has(key))return;if(data.revision!==r.revision)throw new Error('Der Spielstand hat sich geändert. Bitte erneut versuchen.');const result=await r.worker.action(r.players.findIndex(p=>p.id===user.id),data.action);if(!result.ok)throw new Error(result.error||'Aktion nicht möglich');if(rooms.get(r.code)!==r)return;if(result.state){r.state=result.state;r.revision++;}r.seen.add(key);if(r.seen.size>256)r.seen.delete(r.seen.values().next().value!);broadcast(r);};const next=r.queue.then(perform);r.queue=next.catch(()=>{});await next;},
  leave(user:User){const r=find(user.id);if(!r)return;rooms.delete(r.code);r.worker?.stop();r.players.forEach(p=>emit(p.id,null));},
  close(){for(const r of rooms.values())r.worker?.stop();rooms.clear();}
 };
}
