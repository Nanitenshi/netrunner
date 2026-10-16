import {automaticRevealLand,forgeAutomationSchema,manualForgeAutomation,type ForgeAutomation,type ForgeAutomaticDecision} from '../shared/forge-automation.ts';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {ForgeWorker,ForgeDeckError,ForgeVersionError,type ForgeConfig} from './forge-worker.ts';
import {catalogueById} from '../shared/catalogue.ts';
import {toForgeDeck} from '../shared/forge-decks.ts';
import {forgeActionSchema,projectForge,type ForgeState,type ForgeRoom,type ForgeScenario} from '../shared/forge-protocol.ts';
import type {User,DeckData} from '../shared/protocol.ts';
interface Room {automation:Map<string,ForgeAutomation>;automaticDecisions:Map<string,ForgeAutomaticDecision[]>;automationErrors:Map<string,string>;autoScheduled:boolean;autoAttempted:Set<string>;autoFailed:Map<string,string>;ai?:{id:string;difficulty:'easy'|'normal'|'hard'};scenario:ForgeScenario;code:string;players:User[];decks:Map<string,DeckData>;ready:Set<string>;deckErrors:Map<string,string[]>;revision:number;starting:boolean;state:ForgeState|null;worker?:ForgeWorker;error?:string;queue:Promise<void>;seen:Set<string>}
export function createForgeRooms(config:ForgeConfig|undefined,emit:(id:string,view:ForgeRoom|null)=>void){
 const rooms=new Map<string,Room>();const find=(id:string)=>[...rooms.values()].find(r=>r.players.some(p=>p.id===id&&p.id!==r.ai?.id));
 const view=(r:Room,id:string):ForgeRoom=>({automation:r.automation.get(id)??manualForgeAutomation(),automaticDecisions:r.automaticDecisions.get(id)??[],automationError:r.automationErrors.get(id),scenario:r.scenario,code:r.code,hostId:r.players[0].id,players:r.players.map(p=>{const d=r.decks.get(p.id);return {id:p.id,name:p.name,...(p.id===r.ai?.id?{isAi:true,difficulty:r.ai.difficulty}:{}),ready:r.ready.has(p.id),...(d?{deckName:d.name,commander:[d.commanderId,d.secondCommanderId].filter(Boolean).map(id=>catalogueById.get(id!)!.name).join(' + '),cardCount:(d.secondCommanderId?2:1)+Object.values(d.quantities).reduce((a,b)=>a+b,0)}:{})};}),aiOpponent:r.ai?{deckId:r.decks.get(r.ai.id)!.id,difficulty:r.ai.difficulty}:undefined,myDeck:r.decks.get(id),deckErrors:r.deckErrors.get(id),aiDeckErrors:r.ai&&id===r.players[0].id?r.deckErrors.get(r.ai.id):undefined,seat:r.players.findIndex(p=>p.id===id),revision:r.revision,starting:r.starting,error:r.error,game:r.state?projectForge(r.state,r.players.findIndex(p=>p.id===id)):null});
 const broadcast=(r:Room)=>r.players.filter(p=>p.id!==r.ai?.id).forEach(p=>emit(p.id,view(r,p.id)));
 // Use the same queue as human actions; re-read consent and the pending choice there.
 const scheduleAutomatic=(r:Room)=>{
  const choice=r.state?.choice;if(r.autoScheduled||!choice||!r.worker||r.autoAttempted.has(choice.id))return;
  const player=r.players[choice.seat];if(!player||player.id===r.ai?.id||!r.automation.get(player.id)?.revealLands||!automaticRevealLand(projectForge(r.state!,choice.seat).choice,choice.seat))return;
  r.autoScheduled=true;
  const perform=async()=>{
   if(rooms.get(r.code)!==r||!r.worker||!r.state||!r.automation.get(player.id)?.revealLands)return;
   const current=r.state.choice;if(!current||current.id!==choice.id||r.autoAttempted.has(current.id))return;
   const action=automaticRevealLand(projectForge(r.state,current.seat).choice,r.players.indexOf(player));if(!action)return;
   r.autoAttempted.add(current.id);if(r.autoAttempted.size>256)r.autoAttempted.delete(r.autoAttempted.values().next().value!);
   try{
    const result=await r.worker.action(current.seat,action);if(!result.ok)throw Error('Automatic choice rejected');
    if(rooms.get(r.code)!==r)return;
    const history=r.automaticDecisions.get(player.id)??[];
    history.push({id:current.id,source:current.source??'Aufdeck-Land',cardName:current.options[0].name});
    r.automaticDecisions.set(player.id,history.slice(-8));r.automationErrors.delete(player.id);
    if(result.state)r.state=result.state;
   }catch{
    if(rooms.get(r.code)!==r)return;
    // A rejected choice remains available for the human. Never retry it blindly.
    r.automation.set(player.id,manualForgeAutomation());r.autoFailed.set(player.id,current.id);
    r.automationErrors.set(player.id,'Automatik angehalten. Bitte selbst entscheiden.');
   }
   r.revision++;broadcast(r);
  };
  const next=r.queue.then(perform).finally(()=>{r.autoScheduled=false;scheduleAutomatic(r);});
  r.queue=next.catch(()=>{});
 };
 const must=(id:string)=>{const r=find(id);if(!r)throw new Error('Kein Forge-Tisch');return r;};
 const pregame=(r:Room)=>{if(r.starting||r.state||r.worker)throw Error('Deckauswahl nur vor der Partie möglich');};
 return {
  enabled:Boolean(config),has:(id:string)=>Boolean(find(id)),snapshot:(id:string)=>{const r=find(id);return r?view(r,id):null;},
  create(user:User){if(!config)throw new Error('Forge ist auf diesem Server nicht eingerichtet');if(find(user.id))throw new Error('Verlasse zuerst deinen Forge-Tisch');if(rooms.size>=2)throw new Error('Beide Forge-Tische sind belegt');let code:string;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r:Room={automation:new Map(),automaticDecisions:new Map(),automationErrors:new Map(),autoScheduled:false,autoAttempted:new Set(),autoFailed:new Map(),code,players:[user],decks:new Map(),ready:new Set(),deckErrors:new Map(),revision:0,starting:false,state:null,queue:Promise.resolve(),seen:new Set(),scenario:'standard'};rooms.set(code,r);broadcast(r);},
  join(user:User,input:unknown){const {code}=z.object({code:z.string().trim().toUpperCase().regex(/^[A-F0-9]{6}$/)}).strict().parse(input);const old=find(user.id);if(old){if(old.code===code){emit(user.id,view(old,user.id));return;}throw new Error('Verlasse zuerst deinen Forge-Tisch');}const r=rooms.get(code);if(!r||r.players.length>=2||r.starting||r.state)throw new Error('Forge-Tisch nicht verfügbar');r.players.push(user);r.revision++;broadcast(r);},
  scenario(user:User,input:unknown){const {scenario}=z.object({scenario:z.enum(['standard','decisions','combat','costs','effects','commander'])}).strict().parse(input);const r=must(user.id);pregame(r);if(r.players[0].id!==user.id)throw Error('Nur der Gastgeber wählt den Modus');if(scenario!=='commander'&&r.ai){r.decks.delete(r.ai.id);r.deckErrors.delete(r.ai.id);r.players=r.players.filter(p=>p.id!==r.ai!.id);r.ai=undefined;}r.scenario=scenario;r.ready.clear();if(r.ai)r.ready.add(r.ai.id);r.revision++;broadcast(r);},
  deck(user:User,input:unknown){const r=must(user.id);pregame(r);const {deck}=toForgeDeck(input,user.name);r.decks.set(user.id,deck);r.ready.delete(user.id);r.deckErrors.delete(user.id);r.error=undefined;r.revision++;broadcast(r);},
  automation(user:User,input:unknown){const settings=forgeAutomationSchema.parse(input);const r=must(user.id);if(settings.revealLands&&r.state?.choice&&r.autoFailed.get(user.id)===r.state.choice.id)throw Error('Beantworte diese Auswahl zuerst manuell. Danach kannst du die Automatik wieder einschalten.');r.automation.set(user.id,settings);if(settings.revealLands)r.autoFailed.delete(user.id);r.automationErrors.delete(user.id);r.revision++;broadcast(r);scheduleAutomatic(r);},
  ready(user:User,input:unknown){const {ready}=z.object({ready:z.boolean()}).strict().parse(input);const r=must(user.id);pregame(r);if(ready&&!r.decks.has(user.id))throw Error('Zuerst ein vollständiges Commander-Deck auswählen');if(ready)r.ready.add(user.id);else r.ready.delete(user.id);r.revision++;broadcast(r);},
  opponent(user:User,input:unknown){
   const data=z.union([z.object({remove:z.literal(true)}).strict(),z.object({deck:z.unknown(),difficulty:z.enum(['easy','normal','hard'])}).strict()]).parse(input);
   const r=must(user.id);pregame(r);if(r.players[0].id!==user.id)throw Error('Nur der Gastgeber wählt KI-Gegner');if(r.scenario!=='commander')throw Error('KI-Gegner sind im Commander-Modus verfügbar');
   if('remove' in data){if(!r.ai)return;r.decks.delete(r.ai.id);r.ready.delete(r.ai.id);r.deckErrors.delete(r.ai.id);r.players=r.players.filter(p=>p.id!==r.ai!.id);r.ai=undefined;}
   else {const {deck}=toForgeDeck(data.deck,'KI');if(r.players.some(p=>p.id!==user.id&&p.id!==r.ai?.id))throw Error('Der zweite Platz ist bereits von einem Menschen belegt');const id=r.ai?.id??('forge-ai:'+randomBytes(12).toString('hex'));r.ai={id,difficulty:data.difficulty};if(!r.players.some(p=>p.id===id))r.players.push({id,name:'Forge-KI',provider:'guest'});r.decks.set(id,deck);r.ready.add(id);r.deckErrors.delete(id);}
   r.ready.delete(user.id);r.error=undefined;r.revision++;broadcast(r);
  },
  async start(user:User,input:unknown={}){
   const {scenario}=z.object({scenario:z.enum(['standard','decisions','combat','costs','effects','commander']).default('standard')}).strict().parse(input);const r=must(user.id);pregame(r);
   if(r.players[0].id!==user.id||r.players.length!==2)throw Error('Nur der Gastgeber kann mit zwei Spielern starten');if(r.ai&&scenario!=='commander')throw Error('KI-Gegner benötigen den Commander-Modus');if(!config)throw Error('Forge nicht eingerichtet');
   const decks=scenario==='commander'?r.players.map(p=>{if(!r.ready.has(p.id)||!r.decks.has(p.id))throw Error('Beide Spieler müssen ein Deck wählen und bereit sein');const deck=toForgeDeck(r.decks.get(p.id),p.name).config;return p.id===r.ai?.id?{...deck,ai:{difficulty:r.ai.difficulty}}:deck;}):undefined;
   r.starting=true;r.scenario=scenario;r.error=undefined;r.deckErrors.clear();broadcast(r);
   let worker:ForgeWorker|undefined;try{worker=new ForgeWorker({...config,scenario,decks},()=>{if(rooms.get(r.code)!==r||r.worker!==worker)return;r.error='Forge-Verbindung beendet. Verlasse den Tisch und erstelle einen neuen.';r.state=null;r.starting=false;r.revision++;broadcast(r);},(state,error)=>{if(rooms.get(r.code)!==r||r.worker!==worker)return;r.state=state;r.error=error;r.revision++;broadcast(r);scheduleAutomatic(r);});r.worker=worker;
   const state=await worker.ready;if(rooms.get(r.code)!==r){worker.stop();throw Error('Tisch wurde verlassen');}r.state=state;r.starting=false;r.revision++;broadcast(r);scheduleAutomatic(r);}
   catch(e){worker?.stop();if(rooms.get(r.code)!==r)throw e;r.worker=undefined;r.state=null;r.starting=false;r.error=e instanceof ForgeVersionError?e.message:'Die Partie konnte nicht gestartet werden. Decks prüfen und erneut versuchen.';if(e instanceof ForgeDeckError){for(const issue of e.issues){const p=r.players[issue.seat];if(p){r.deckErrors.set(p.id,issue.cards);r.ready.delete(p.id);}}}r.revision++;broadcast(r);throw Error(e instanceof ForgeDeckError||e instanceof ForgeVersionError?e.message:'Forge konnte nicht gestartet werden');}
  },
  async action(user:User,input:unknown){const data=z.object({id:z.string().min(1).max(80),revision:z.number().int().nonnegative(),action:forgeActionSchema}).strict().parse(input);const r=must(user.id);const perform=async()=>{if(rooms.get(r.code)!==r||!r.state||!r.worker)throw new Error('Forge-Tisch nicht aktiv');const key=user.id+':'+data.id;if(r.seen.has(key))return;if(data.revision!==r.revision)throw new Error('Der Spielstand hat sich geändert. Bitte erneut versuchen.');const result=await r.worker.action(r.players.findIndex(p=>p.id===user.id),data.action);if(rooms.get(r.code)!==r)return;if(result.state){r.state=result.state;r.revision++;}if(!result.ok){broadcast(r);scheduleAutomatic(r);throw new Error(result.error||'Aktion nicht möglich');}r.seen.add(key);if(r.seen.size>256)r.seen.delete(r.seen.values().next().value!);broadcast(r);scheduleAutomatic(r);};const next=r.queue.then(perform);r.queue=next.catch(()=>{});await next;},
  leave(user:User){const r=find(user.id);if(!r)return;rooms.delete(r.code);r.worker?.stop();r.players.filter(p=>p.id!==r.ai?.id).forEach(p=>emit(p.id,null));},
  close(){for(const r of rooms.values())r.worker?.stop();rooms.clear();}
 };
}
