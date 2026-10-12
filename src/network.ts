import type {ForgeRoom} from '../shared/forge-protocol';
import {uuid} from '../shared/id.ts';
import {useEffect,useRef,useState} from 'react';
import {io,type Socket} from 'socket.io-client';
import type {User,RoomView,Reply} from '../shared/protocol';
import type {GameAction} from '../shared/game';
export async function api<T>(path:string,body?:unknown,method=body?'POST':'GET'):Promise<T>{
 const response=await fetch(path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 let data;try{data=await response.json();}catch{throw new Error('Der Server antwortet gerade nicht korrekt. Bitte versuche es erneut.');}if(!response.ok)throw new Error(data.error||'Server nicht erreichbar');return data;
}
export function useNetwork(){
 const [forgeReady,setForgeReady]=useState(false);
 const [forgeRoom,setForgeRoom]=useState<ForgeRoom|null>(null);
 const [user,setUser]=useState<User|null>(null);
 const [available,setAvailable]=useState(false);
 const [discordReady,setDiscordReady]=useState(false);
 const [publicServer,setPublicServer]=useState(false);
 const [guestEnabled,setGuestEnabled]=useState(false);
 const [connected,setConnected]=useState(false);
 const [room,setRoom]=useState<RoomView|null>(null);
 const [error,setError]=useState('');
 const socket=useRef<Socket|null>(null);
 async function refresh(){try{const data=await api<{user:User|null;discordReady:boolean;guestEnabled:boolean;publicServer?:boolean;forgeReady?:boolean}>('/api/session');setForgeReady(Boolean(data.forgeReady));setUser(data.user);setAvailable(true);setDiscordReady(data.discordReady);setGuestEnabled(data.guestEnabled);setPublicServer(Boolean(data.publicServer));setError('');}catch{setAvailable(false);setError('Der Spielserver ist nicht erreichbar. Prüfe deine Verbindung und versuche es erneut.');}}
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{
   if(!user)return;
   const connection=io({transports:['websocket'],reconnection:true,withCredentials:true});socket.current=connection;
   connection.on('connect',()=>{setConnected(true);setError('');});
   connection.on('disconnect',()=>setConnected(false));
   connection.on('connect_error',error=>{setConnected(false);setError(error.message==='Bitte anmelden'?'Sitzung abgelaufen. Bitte im Konto erneut anmelden.':'Verbindung unterbrochen. Erneuter Verbindungsaufbau läuft …');});
   connection.on('forge:room',(next:ForgeRoom|null)=>setForgeRoom(next));
   connection.on('room',(next:RoomView|null)=>setRoom(next));
   return()=>{connection.disconnect();socket.current=null;setConnected(false);setRoom(null);setForgeRoom(null);};
 },[user?.id]);
 async function send(event:string,input:unknown={}):Promise<boolean>{
   if(!socket.current?.connected){setError('Keine Verbindung. Die Aktion wurde nicht gesendet.');return false;}
   try{const reply=await socket.current.timeout(event==='forge:start'?65000:event==='forge:action'?20000:8000).emitWithAck(event,input) as Reply;if(!reply.ok)throw new Error(reply.error);setError('');return true;}
   catch(error){setError(error instanceof Error?error.message:'Antwort fehlt. Prüfe den aktuellen Tischzustand.');return false;}
 }
 async function guest(name:string){try{const result=await api<{user:User}>('/api/guest',{name});setUser(result.user);setError('');}catch(error){setError((error as Error).message);}}
 async function logout(){try{await api('/api/logout',{});setUser(null);setRoom(null);}catch(error){setError((error as Error).message);}}
 const action=(action:GameAction)=>{void send('game:action',{id:uuid(),action});};
 return {forgeReady,forgeRoom,user,available,discordReady,guestEnabled,publicServer,connected,room,error,setError,refresh,send,guest,logout,action};
}
export type Network=ReturnType<typeof useNetwork>;
