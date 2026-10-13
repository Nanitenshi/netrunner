import {createForgeRooms} from './forge-rooms.ts';
import type {ForgeConfig} from './forge-worker.ts';
import {canAutoPass} from '../shared/auto-priority.ts';
import {trainingDeck,observeBot,botCastStep,botAttack,resolveTrainingCombat,type BotMemory,type TrainingCombat} from './bots.ts';
import {serverConfig,clientAddress,type ServerConfig} from './config.ts';
import {createTokenLinkService} from './token-links.ts';
import {createArtworkService} from './artworks.ts';
import {fetchDeckstats} from './deckstats.ts';
import {enableRules,settle} from '../shared/engine.ts';
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {randomBytes,randomUUID,randomInt,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,readFileSync,statSync} from 'node:fs';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Server} from 'socket.io';
import {z} from 'zod';
import {actionSchema,deckSchema,type User,type RoomView,type DeckData} from '../shared/protocol.ts';
import {preparedDecks} from '../shared/preconstructed.ts';
import {catalogue,checkDeck,starterDeck} from '../shared/deck-rules.ts';
import {applyAction,projectGame,type GameState,type CardInstance} from '../shared/game.ts';

interface Session {user:User;expires:number}
interface Seat {user:User;deck:DeckData;ready:boolean;bot?:boolean;memory?:BotMemory;reserved?:string}
interface Room {code:string;hostId:string;seats:Seat[];game:GameState|null;revision:number;seen:string[];updated:number;botsPaused?:boolean;combat?:TrainingCombat}
type Config=ServerConfig & {botDelayMs?:number;forge?:ForgeConfig};
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
const cookie=(req:IncomingMessage,name:string)=>req.headers.cookie?.split(';').map(c=>c.trim()).find(c=>c.startsWith(`${name}=`))?.slice(name.length+1);
const TTL=7*24*3600_000;

export function createNexusServer(config:Config={}){
 let importRequests=0;
 const {publicURL,guest,clientId,clientSecret,discordReady,production,proxy}=serverConfig(config);
 const fetcher=config.fetcher??fetch;
 const artworkService=createArtworkService(fetcher);
 const tokenLinkService=createTokenLinkService(fetcher);
 const filename=config.database??process.env.DATABASE_PATH??resolve(root,'data/nexus.sqlite');
 if(filename!==':memory:')mkdirSync(dirname(filename),{recursive:true});
 const db=new DatabaseSync(filename);
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
 const put=db.prepare('INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
 const get=db.prepare('SELECT value FROM records WHERE key=?');
 const del=db.prepare('DELETE FROM records WHERE key=?');
 const save=(key:string,value:unknown)=>put.run(key,JSON.stringify(value));
 const read=<T>(key:string):T|undefined=>{const row=get.get(key);return row?JSON.parse(row.value as string):undefined;};
 const sessions=new Map<string,Session>();
 const rooms=new Map<string,Room>();
 for(const record of db.prepare('SELECT key,value FROM records').all()){
   const key=record.key as string,value=JSON.parse(record.value as string);
   if(key.startsWith('session:')&&value.expires>Date.now())sessions.set(key.slice(8),value);
   else if(key.startsWith('room:')&&value.updated>Date.now()-TTL){if(value.game&&!value.game.rules){value.game.phase=({5:9,6:10} as Record<number,number>)[value.game.phase]??value.game.phase;value.game=enableRules(value.game);}if(value.game?.rules){value.game.rules.turnOnly=true;if(value.game.rules.stage==='playing'){value.game.phase=3;if(!value.game.rules.stack.length&&!value.game.rules.pending&&!value.game.rules.resolving){value.game.rules.priority=value.game.activePlayer;value.game.rules.passes=[];}}}rooms.set(key.slice(5),value);}
   else if(key.startsWith('session:')||key.startsWith('room:'))del.run(key);
 }
 const auth=(req:IncomingMessage)=>{const raw=cookie(req,'nexus_session');const s=raw?sessions.get(hash(raw)):undefined;return s&&s.expires>Date.now()?s.user:undefined;};
 const sameOrigin=(req:IncomingMessage)=>{
   const origin=req.headers.origin;
   if(!origin)return false;
   try{return publicURL?origin===new URL(publicURL).origin:new URL(origin).host===req.headers.host;}catch{return false;}
 };
 const secure=publicURL.startsWith('https:');
 const setCookie=(res:ServerResponse,name:string,value:string,age:number)=>res.appendHeader('Set-Cookie',`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`);
 const oauthFailure=(res:ServerResponse,message:string)=>{setCookie(res,'nexus_oauth','',0);res.writeHead(400,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});res.end(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nexus · Anmeldung</title><style>body{margin:0;background:#0c1522;color:#e7eff7;font:18px system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:36rem;padding:2rem}a{color:#7bf4d9}h1{font-size:2rem}</style><main><p>NEXUS / COMMANDER</p><h1>Zurück zu deinem Tisch.</h1><p>${message}</p><a href="/#account">Zur Anmeldung →</a></main></html>`);};
 const login=(res:ServerResponse,user:User)=>{const raw=token(),key=hash(raw),s={user,expires:Date.now()+TTL};sessions.set(key,s);save(`session:${key}`,s);setCookie(res,'nexus_session',raw,TTL/1000);};
 const send=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const json=async(req:IncomingMessage)=>{let input='';for await(const chunk of req){input+=chunk;if(Buffer.byteLength(input)>100_000)throw new Error('Anfrage zu groß');}return JSON.parse(input||'{}');};
 const httpRates=new Map<string,{at:number;n:number}>();
 const withinRate=(key:string,map:Map<string,{at:number;n:number}>,limit:number,window=60_000)=>{
   let counter=map.get(key);if(!counter||Date.now()-counter.at>window){counter={at:Date.now(),n:0};map.set(key,counter);}return ++counter.n<=limit;
 };
 const oauthStates=new Map<string,{state:string;expires:number}>();
 const http=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  if(secure)res.setHeader('Strict-Transport-Security','max-age=31536000');
  let path='';
  try{
   path=new URL(req.url||'/', 'http://nexus.local').pathname;
   if(path==='/healthz'&&req.method==='GET'){db.prepare('SELECT 1').get();send(res,200,{ok:true});return;}
   if(path.startsWith('/api/')||path.startsWith('/auth/')){
    if(!withinRate(clientAddress(req,proxy),httpRates,200)){send(res,429,{error:'Zu viele Anfragen. Bitte kurz warten.'});return;}
    if(req.method!=='GET'&&!sameOrigin(req)){send(res,403,{error:'Ungültiger Ursprung'});return;}
   }
   if(path.startsWith('/api/card-tokens/')&&req.method==='GET'){try{send(res,200,await tokenLinkService(decodeURIComponent(path.slice('/api/card-tokens/'.length))));}catch(error){send(res,400,{error:error instanceof Error?error.message:'Token-Verknüpfung fehlgeschlagen'});}return;}
   if(path.startsWith('/api/artworks/')&&req.method==='GET'){try{const id=decodeURIComponent(path.slice('/api/artworks/'.length));const params=new URL(req.url!,'http://nexus.local').searchParams;const page=Number(params.get('page')??1);const data=await artworkService(id,page);send(res,200,data);}catch(error){send(res,400,{error:error instanceof Error?error.message:'Artwork-Suche fehlgeschlagen'});}return;}
   if(path==='/api/session'&&req.method==='GET'){send(res,200,{user:auth(req)??null,discordReady,guestEnabled:guest,publicServer:production,forgeReady:Boolean(config.forge)});return;}
   if(path==='/api/deck-import'&&req.method==='POST'){
    if(importRequests>=3){send(res,429,{error:'Import gerade ausgelastet. Bitte kurz warten.'});return;}
    const {url}=z.object({url:z.string().trim().min(1).max(1000)}).strict().parse(await json(req));
    importRequests++;
    try{send(res,200,await fetchDeckstats(url));}catch(e){send(res,400,{error:e instanceof Error?e.message:'Deckstats nicht erreichbar. Bitte die Textliste verwenden.'});}finally{importRequests--;}
    return;
   }
   if(path==='/api/guest'&&req.method==='POST'){
    if(!guest){send(res,403,{error:'Testkonten sind deaktiviert'});return;}
    if(auth(req)){send(res,409,{error:'Bereits angemeldet'});return;}
    const {name}=z.object({name:z.string().trim().min(1).max(30)}).strict().parse(await json(req));
    const user:User={id:randomUUID(),name,provider:'guest'};login(res,user);send(res,200,{user});return;
   }
   if(path==='/api/logout'&&req.method==='POST'){
    const raw=cookie(req,'nexus_session');if(raw){const key=hash(raw);sessions.delete(key);del.run(`session:${key}`);for(const s of io.sockets.sockets.values())if(cookie(s.request,'nexus_session')===raw)s.disconnect(true);}
    setCookie(res,'nexus_session','',0);send(res,200,{ok:true});return;
   }
   if(path==='/auth/discord'&&req.method==='GET'){
    if(!discordReady){send(res,503,{error:'Discord-Anwendung ist noch nicht eingerichtet'});return;}
    const binding=token(),state=token();oauthStates.set(hash(binding),{state,expires:Date.now()+600_000});
    setCookie(res,'nexus_oauth',binding,600);
    const url=new URL('https://discord.com/oauth2/authorize');url.search=new URLSearchParams({client_id:clientId!,response_type:'code',scope:'identify',state,redirect_uri:`${publicURL}/auth/discord/callback`}).toString();
    res.writeHead(302,{Location:url.href,'Cache-Control':'no-store'});res.end();return;
   }
   if(path==='/auth/discord/callback'&&req.method==='GET'){
    const url=new URL(req.url!,'http://nexus.local');const binding=cookie(req,'nexus_oauth');const key=binding?hash(binding):'';const stored=oauthStates.get(key);oauthStates.delete(key);
    if(!discordReady||!stored||stored.expires<Date.now()||url.searchParams.get('state')!==stored.state||!url.searchParams.get('code')){oauthFailure(res,'Die Anmeldung wurde abgebrochen oder ist abgelaufen. Bitte starte sie erneut.');return;}
    const response=await fetcher('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId!,client_secret:clientSecret!,grant_type:'authorization_code',code:url.searchParams.get('code')!,redirect_uri:`${publicURL}/auth/discord/callback`}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok)throw new Error('Discord konnte die Anmeldung nicht bestätigen');
    const credential=z.object({access_token:z.string()}).parse(await response.json());
    const identity=await fetcher('https://discord.com/api/users/@me',{headers:{Authorization:`Bearer ${credential.access_token}`},signal:AbortSignal.timeout(10_000)});
    if(!identity.ok)throw new Error('Discord-Profil konnte nicht geladen werden');
    const profile=z.object({id:z.string().regex(/^\d+$/),username:z.string(),global_name:z.string().nullable().optional()}).parse(await identity.json());
    login(res,{id:`discord:${profile.id}`,name:(profile.global_name||profile.username).slice(0,30),provider:'discord'});
    setCookie(res,'nexus_oauth','',0);
    res.writeHead(302,{Location:'/#lobby','Cache-Control':'no-store'});res.end();return;
   }
   if(path==='/api/decks'){
    const user=auth(req);if(!user){send(res,401,{error:'Bitte zuerst anmelden'});return;}
    if(req.method==='GET'){send(res,200,{decks:read<DeckData[]>(`decks:${user.id}`)??[]});return;}
    if(req.method==='PUT'){const data=z.object({decks:z.array(deckSchema).max(100)}).strict().parse(await json(req));const decks=data.decks.map(d=>checkDeck(d));save(`decks:${user.id}`,decks);send(res,200,{decks});return;}
   }
   if(path.startsWith('/api/')||path.startsWith('/auth/')){send(res,404,{error:'Nicht gefunden'});return;}
   if(req.method!=='GET'&&req.method!=='HEAD'){send(res,405,{error:'Nicht erlaubt'});return;}
   const dist=resolve(root,'dist');const file=resolve(dist,`.${decodeURIComponent(path)}`);
   if(!file.startsWith(dist+sep)&&file!==dist){send(res,403,{error:'Nicht erlaubt'});return;}
   const target=path==='/'?resolve(dist,'index.html'):file;
   if(!existsSync(target)||!statSync(target).isFile()||path.endsWith('/')&&path!=='/'){send(res,404,{error:'Datei nicht gefunden. Bitte zuerst bauen.'});return;}
   const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
   res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache'});res.end(req.method==='HEAD'?undefined:readFileSync(target));
  }catch(error){if(path==='/auth/discord/callback'){oauthFailure(res,'Discord konnte die Anmeldung gerade nicht abschließen. Bitte versuche es erneut.');return;}send(res,400,{error:error instanceof z.ZodError?'Ungültige Eingabe':error instanceof Error&&!production?error.message:'Anfrage fehlgeschlagen'});}
 });
 const io=new Server(http,{maxHttpBufferSize:100_000,allowRequest:(req,done)=>done(null,sameOrigin(req)),serveClient:false});
 const forge=createForgeRooms(config.forge,(id,view)=>io.to(`user:${id}`).emit('forge:room',view));
 const connections=new Map<string,Set<string>>();
 const findRoom=(id:string)=>[...rooms.values()].find(room=>room.seats.some(s=>s.user.id===id));
 const view=(room:Room,id:string):RoomView=>({code:room.code,hostId:room.hostId,seat:id,started:Boolean(room.game),revision:room.revision,botsPaused:room.botsPaused===true,combat:room.combat??null,players:room.seats.map(s=>({id:s.user.id,deckId:s.deck.id,name:s.user.name,ready:s.ready,connected:s.bot===true||Boolean(connections.get(s.user.id)?.size),bot:s.bot===true,commander:[s.deck.commanderId,s.deck.secondCommanderId].filter(Boolean).map(id=>catalogue.find(c=>c.id===id)!.name).join(' + ')})),game:room.game?projectGame(room.game,id):null});
 const broadcast=(room:Room)=>{room.updated=Date.now();save(`room:${room.code}`,room);for(const seat of room.seats)io.to(`user:${seat.user.id}`).emit('room',view(room,seat.user.id));};
 io.use((socket,next)=>{const user=auth(socket.request);if(!user)return next(new Error('Bitte anmelden'));socket.data.user=user;next();});
 const actionRates=new Map<string,{at:number;n:number}>();
 io.on('connection',socket=>{
  const user=socket.data.user as User;
  socket.join(`user:${user.id}`);const set=connections.get(user.id)??new Set<string>();set.add(socket.id);connections.set(user.id,set);
  const current=findRoom(user.id);if(current)broadcast(current);else socket.emit('room',null);
  socket.emit('forge:room',forge.snapshot(user.id));
  const handle=(name:string,fn:(input:any)=>void|Promise<void>)=>socket.on(name,async(input:unknown,ack:unknown)=>{
   if(typeof ack!=='function')return;
   try{if(!auth(socket.request))throw new Error('Sitzung abgelaufen. Bitte erneut anmelden');if(!withinRate(user.id,actionRates,90,10_000))throw new Error('Zu viele Aktionen. Bitte kurz warten.');await fn(input);ack({ok:true});}
   catch(error){ack({ok:false,error:error instanceof z.ZodError?'Ungültige Aktion':error instanceof Error?error.message:'Aktion fehlgeschlagen'});}
  });
  handle('forge:create',()=>{if(findRoom(user.id))throw new Error('Verlasse zuerst deinen Casual-Tisch');forge.create(user);});
  handle('forge:join',input=>{if(findRoom(user.id))throw new Error('Verlasse zuerst deinen Casual-Tisch');forge.join(user,input);});
  handle('forge:scenario',input=>forge.scenario(user,input));
  handle('forge:deck',input=>forge.deck(user,input));
  handle('forge:ready',input=>forge.ready(user,input));
  handle('forge:opponent',input=>forge.opponent(user,input));
  handle('forge:start',input=>forge.start(user,input));
  handle('forge:action',input=>forge.action(user,input));
  handle('forge:leave',()=>forge.leave(user));
  handle('room:create',()=>{
   if(forge.has(user.id))throw new Error('Verlasse zuerst deinen Forge-Testtisch');
   if(findRoom(user.id))throw new Error('Du bist bereits an einem Tisch');
   if(rooms.size>=200)throw new Error('Alle Tische sind belegt');
   let code='';do{code=Array.from({length:6},()=> 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(31)]).join('');}while(rooms.has(code));
   const room:Room={code,hostId:user.id,seats:[{user,deck:structuredClone(preparedDecks[0]),ready:false}],game:null,revision:0,seen:[],updated:Date.now()};rooms.set(code,room);broadcast(room);
  });
  handle('room:join',input=>{
   if(forge.has(user.id))throw new Error('Verlasse zuerst deinen Forge-Testtisch');
   const code=z.object({code:z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/)}).strict().parse(input).code;
   const old=findRoom(user.id);if(old){if(old.code===code){socket.emit('room',view(old,user.id));return;}throw new Error('Verlasse zuerst deinen aktuellen Tisch');}
   const room=rooms.get(code);if(!room)throw new Error('Dieser Tisch wurde nicht gefunden');
   if(room.game||room.seats.length>=4)throw new Error('Dieser Tisch ist bereits voll oder gestartet');
   room.seats.push({user,deck:structuredClone(preparedDecks[0]),ready:false});room.revision++;broadcast(room);
  });
  handle('room:leave',()=>{
   const room=findRoom(user.id);if(!room)return;
   if(room.game&&room.game.rules?.stage!=='finished'&&!room.game.rules?.lost.includes(user.id))room.game=applyAction(room.game,user.id,{type:'concede'});
   if(room.combat&&room.game&&(room.game.rules!.stage==='finished'||room.game.rules!.lost.includes(room.combat.attackerId)||room.game.rules!.lost.includes(room.combat.defenderId)))room.combat=undefined;
   room.seats=room.seats.filter(s=>s.user.id!==user.id);io.to(`user:${user.id}`).emit('room',null);
   if(!room.seats.some(s=>!s.bot)){rooms.delete(room.code);del.run(`room:${room.code}`);return;}
   if(room.hostId===user.id)room.hostId=room.seats.find(s=>!s.bot)!.user.id;room.revision++;broadcast(room);
  });
  handle('room:deck',input=>{
   const room=findRoom(user.id);if(!room||room.game)throw new Error('Deckauswahl ist hier nicht möglich');
   const seat=room.seats.find(s=>s.user.id===user.id)!;seat.deck=checkDeck(input,true);seat.ready=false;room.revision++;broadcast(room);
  });
  handle('room:ready',input=>{
   const room=findRoom(user.id);if(!room||room.game)throw new Error('Kein offener Tisch');
   const ready=z.object({ready:z.boolean()}).strict().parse(input).ready;
   const seat=room.seats.find(s=>s.user.id===user.id)!;checkDeck(seat.deck,true);seat.ready=ready;room.revision++;broadcast(room);
  });
  handle('room:botAdd',()=>{
   const room=findRoom(user.id);if(!room||room.hostId!==user.id||room.game)throw new Error('Nur der Gastgeber kann vor dem Start Bots hinzufügen');if(room.seats.length>=4)throw new Error('Alle vier Plätze sind belegt');
   const number=[1,2,3].find(n=>!room.seats.some(s=>s.bot&&s.user.name===`Bot ${n}`))!;room.seats.push({user:{id:`bot-${randomUUID()}`,name:`Bot ${number}`,provider:'guest'},deck:checkDeck(trainingDeck(),true),ready:true,bot:true,memory:{entered:{}}});room.revision++;broadcast(room);
  });
  handle('room:botRemove',input=>{
   const {id}=z.object({id:z.string().max(100)}).strict().parse(input),room=findRoom(user.id);if(!room||room.hostId!==user.id||room.game||!room.seats.some(s=>s.bot&&s.user.id===id))throw new Error('Bot kann hier nicht entfernt werden');room.seats=room.seats.filter(s=>s.user.id!==id);room.revision++;broadcast(room);
  });
  handle('room:botPause',input=>{
   const {paused}=z.object({paused:z.boolean()}).strict().parse(input),room=findRoom(user.id);if(!room?.game||room.hostId!==user.id||!room.seats.some(s=>s.bot))throw new Error('Nur der Gastgeber steuert die Trainingsbots');room.botsPaused=paused;room.revision++;broadcast(room);
  });
  handle('game:botCombat',input=>{
   const {id,blocks,manual}=z.object({id:z.string().max(100),blocks:z.array(z.object({attackerId:z.string().max(100),blockerId:z.string().max(100)}).strict()).max(100),manual:z.boolean().optional()}).strict().parse(input),room=findRoom(user.id);if(!room?.game||!room.combat||room.combat.id!==id||room.combat.defenderId!==user.id)throw new Error('Dieser Trainingskampf gehört nicht dir oder ist abgeschlossen');
   room.game=resolveTrainingCombat(room.game,room.combat,blocks,manual);room.combat=undefined;room.revision++;broadcast(room);
  });
  handle('game:botManual',input=>{
   const {choiceId}=z.object({choiceId:z.string().max(100)}).strict().parse(input),room=findRoom(user.id),p=room?.game?.rules?.pending;if(!room?.game||room.hostId!==user.id||!p||p.id!==choiceId||p.kind!=='manual'||!room.seats.some(s=>s.bot&&s.user.id===p.ownerId))throw new Error('Keine manuelle Bot-Verrechnung');room.game=applyAction(room.game,p.ownerId,{type:'choose',choiceId,first:[],second:[],decision:'done'});room.game.log=[...room.game.log,'TRAINING · Gastgeber bestätigt manuell ausgeführten Bot-Effekt.'].slice(-60);room.revision++;broadcast(room);
  });
  handle('game:botLife',input=>{
   const {id,amount}=z.object({id:z.string().max(100),amount:z.number().int().min(-100).max(100)}).strict().parse(input),room=findRoom(user.id);if(!room?.game||room.hostId!==user.id||!room.seats.some(s=>s.bot&&s.user.id===id)||room.game.rules?.stage!=='playing'||room.game.rules.pending||room.combat)throw new Error('Bot-Leben kann hier nicht korrigiert werden');
   room.game=structuredClone(room.game);room.game.players.find(p=>p.id===id)!.life+=amount;room.game.log=[...room.game.log,`TRAINING · ${user.name} ändert Bot-Leben um ${amount}.`].slice(-60);settle(room.game);room.revision++;broadcast(room);
  });
  handle('room:start',()=>{
   const room=findRoom(user.id);if(!room||room.hostId!==user.id||room.game)throw new Error('Nur der Gastgeber startet eine neue Partie');
   if(room.seats.length<2||room.seats.some(s=>!s.ready||!s.bot&&!connections.get(s.user.id)?.size))throw new Error('Mindestens zwei Spieler müssen verbunden und alle Teilnehmer bereit sein');
   room.game=newGame(room.seats);room.revision++;broadcast(room);
  });
  handle('room:finish',()=>{
   const room=findRoom(user.id);if(!room||room.hostId!==user.id||!room.game)throw new Error('Nur der Gastgeber kann die Partie beenden');
   room.game=null;room.combat=undefined;room.botsPaused=false;room.seen=[];room.seats.forEach(s=>{s.ready=s.bot===true;s.memory=undefined;s.reserved=undefined;});room.revision++;broadcast(room);
  });
  handle('game:autoPass',input=>{
   const data=z.object({revision:z.number().int().min(0),policy:z.object({reactionMode:z.enum(['off','always','auto']).optional(),enabled:z.boolean(),ownStops:z.array(z.number().int().min(0).max(11)).max(12),opponentStops:z.array(z.number().int().min(0).max(11)).max(12)}).strict()}).strict().parse(input);
   const room=findRoom(user.id);if(!room?.game||room.revision!==data.revision||room.combat||!canAutoPass(room.game,user.id,data.policy))return;
   room.game=applyAction(room.game,user.id,{type:'pass'});room.revision++;broadcast(room);
  });
  handle('game:action',input=>{
   const data=z.object({id:z.string().uuid(),action:actionSchema}).strict().parse(input);
   const room=findRoom(user.id);if(!room?.game)throw new Error('Keine laufende Partie');
   const key=`${user.id}:${data.id}`;if(room.seen.includes(key))return;
   const action=data.action.type==='copy'?{...data.action,newId:randomUUID()}:data.action;
   if(room.combat&&['pass','nextPhase','endTurn'].includes(action.type)&&!room.game.rules?.stack.length)throw new Error('Zuerst den Trainingskampf abschließen');
   room.game=applyAction(room.game,user.id,action);if(room.combat&&(room.game.rules!.stage==='finished'||room.game.rules!.lost.includes(room.combat.attackerId)||room.game.rules!.lost.includes(room.combat.defenderId)))room.combat=undefined;room.seen.push(key);room.seen=room.seen.slice(-4000);room.revision++;broadcast(room);
  });
  socket.on('disconnect',()=>{const active=connections.get(user.id);active?.delete(socket.id);if(!active?.size)connections.delete(user.id);const room=findRoom(user.id);if(room)broadcast(room);});
 });
 const botTimer=setInterval(()=>{
  for(const room of rooms.values()){
   if(!room.game||room.game.rules?.stage==='finished'||room.botsPaused||!room.seats.some(s=>!s.bot&&connections.get(s.user.id)?.size))continue;
   try{
    for(const bot of room.seats.filter(s=>s.bot)){
     bot.memory??={entered:{}};observeBot(room.game,bot.user.id,bot.memory);
     if(room.combat){if(room.combat.defenderId===bot.user.id){const used=new Set<string>();const blockers=room.game.cards.filter(c=>c.controllerId===bot.user.id&&c.zone==='battlefield'&&!c.tapped&&catalogue.find(d=>d.id===c.cardId)!.type.includes('Creature'));const blocks=room.combat.cardIds.flatMap(attackerId=>{const b=blockers.find(b=>!used.has(b.id));if(!b)return [];used.add(b.id);return [{attackerId,blockerId:b.id}];});room.game=resolveTrainingCombat(room.game,room.combat,blocks);room.combat=undefined;room.revision++;broadcast(room);break;}continue;}
     const attack=botAttack(room.game,bot.user.id,bot.memory);if(attack){room.combat={...attack,id:randomUUID()};room.game=structuredClone(room.game);room.game.cards.filter(c=>attack.cardIds.includes(c.id)).forEach(c=>c.tapped=true);room.game.log=[...room.game.log,`TRAINING · ${bot.user.name} greift mit ${attack.cardIds.length} Kreatur(en) an.`].slice(-60);room.revision++;broadcast(room);break;}
     const step=botCastStep(room.game,bot.user.id,bot.reserved);if(!step.action)continue;room.game=applyAction(room.game,bot.user.id,step.action);if(room.game.rules?.stage==='playing'&&!room.game.rules.lost.includes(bot.user.id))room.game=applyAction(room.game,bot.user.id,{type:'arrange'});bot.reserved=step.reserve;room.revision++;broadcast(room);break;
    }
   }catch(error){room.botsPaused=true;room.game.log=[...room.game.log,'TRAINING · Bots pausiert: Aktion konnte nicht ausgeführt werden.'].slice(-60);room.revision++;broadcast(room);}
  }
 },Math.max(20,Math.min(5000,config.botDelayMs??650)));botTimer.unref();
 const cleanup=setInterval(()=>{
   const now=Date.now();for(const [key,value] of oauthStates)if(value.expires<now)oauthStates.delete(key);
   for(const [key,value] of sessions)if(value.expires<now){sessions.delete(key);del.run(`session:${key}`);}
   for(const [key,value] of rooms)if(value.updated<now-TTL&&!value.seats.some(s=>connections.get(s.user.id)?.size)){rooms.delete(key);del.run(`room:${key}`);}
   for(const map of [httpRates,actionRates])for(const [key,value] of map)if(value.at<now-60_000)map.delete(key);
 },60_000);cleanup.unref();
 return {http,io,close:async()=>{forge.close();clearInterval(cleanup);clearInterval(botTimer);await new Promise<void>(done=>io.close(()=>done()));db.close();}};
}

function newGame(seats:Seat[]):GameState {
 const cards:CardInstance[]=[];
 const players=seats.map((seat,i)=>({id:seat.user.id,name:seat.user.name,commander:[seat.deck.commanderId,seat.deck.secondCommanderId].filter(Boolean).map(id=>catalogue.find(c=>c.id===id)!.name).join(' + '),color:['#63dfca','#e1ad71','#9c94e9','#e38a99'][i],life:40}));
 for(const seat of seats){
  const add=(cardId:string,commander=false):CardInstance=>({id:randomUUID(),cardId,ownerId:seat.user.id,controllerId:seat.user.id,zone:commander?'commander':'library',isCommander:commander,commanderCasts:0,isLand:(catalogue.find(c=>c.id===cardId)!.faces[0]?.type??catalogue.find(c=>c.id===cardId)!.type).includes('Land'),tapped:false,counters:0,position:{x:.16,y:.34}});
  cards.push(add(seat.deck.commanderId,true));
  if(seat.deck.secondCommanderId)cards.push(add(seat.deck.secondCommanderId,true));
  const library=Object.entries(seat.deck.quantities).flatMap(([id,n])=>Array.from({length:n},()=>add(id)));
  for(let i=library.length-1;i>0;i--){const j=randomInt(i+1);[library[i],library[j]]=[library[j],library[i]];}
  library.slice(0,7).forEach(c=>c.zone='hand');cards.push(...library);
 }
 const game=enableRules({players,cards,activePlayer:players[0].id,phase:0,turn:1,log:[`${players.length} Spieler verbunden. Kostenlose Mulligans auf sieben; danach behalten.`]},true);game.rules!.turnOnly=true;return game;
}
