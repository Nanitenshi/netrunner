import {isIP} from 'node:net';
import type {IncomingMessage} from 'node:http';

export interface ServerConfig {
 database?:string; publicURL?:string; guest?:boolean; clientId?:string; clientSecret?:string;
 fetcher?:typeof fetch; production?:boolean; proxy?:boolean;
}
export function serverConfig(input:ServerConfig={},env:NodeJS.ProcessEnv=process.env){
 const production=input.production??env.NODE_ENV==='production';
 const raw=(input.publicURL??env.PUBLIC_URL??'').trim();
 let publicURL='';
 if(raw){
  let url:URL;try{url=new URL(raw);}catch{throw new Error('PUBLIC_URL muss eine vollständige URL sein');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('PUBLIC_URL muss eine reine http(s)-Adresse ohne Pfad sein');
  if(production&&url.protocol!=='https:')throw new Error('PUBLIC_URL muss im Produktivbetrieb HTTPS verwenden');
  publicURL=url.origin;
 }
 const clientId=(input.clientId??env.DISCORD_CLIENT_ID??'').trim();
 const clientSecret=(input.clientSecret??env.DISCORD_CLIENT_SECRET??'').trim();
 for(const key of ['ENABLE_GUEST','TRUST_PROXY'])if(env[key]&&!['true','false'].includes(env[key]!))throw new Error(`${key} muss true oder false sein`);
 const guest=input.guest??(env.ENABLE_GUEST?env.ENABLE_GUEST==='true':!production);
 const proxy=input.proxy??env.TRUST_PROXY==='true';
 if(production&&!publicURL)throw new Error('PUBLIC_URL fehlt für den Produktivbetrieb');
 if(production&&(!clientId||!clientSecret))throw new Error('Discord Client ID und Client Secret fehlen für den Produktivbetrieb');
 if(clientId&&!/^\d+$/.test(clientId))throw new Error('DISCORD_CLIENT_ID muss die numerische Anwendungs-ID enthalten');
 return {production,publicURL,clientId,clientSecret,guest,proxy,discordReady:Boolean(clientId&&clientSecret&&publicURL)};
}

// Only enable behind the bundled private proxy. Caddy overwrites this header;
// the application port must never be publicly exposed in this mode.
export function clientAddress(req:IncomingMessage,proxy:boolean){
 const forwarded=req.headers['x-nexus-client-ip'];
 if(proxy&&typeof forwarded==='string'&&isIP(forwarded))return forwarded;
 return req.socket.remoteAddress||'unknown';
}
