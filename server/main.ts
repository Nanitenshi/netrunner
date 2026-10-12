import {createNexusServer} from './server.ts';
if(process.env.NODE_ENV==='production'&&!process.env.PUBLIC_URL)throw new Error('PUBLIC_URL muss für den Produktivbetrieb gesetzt sein');
const server=createNexusServer({forge:process.env.FORGE_JAVA&&process.env.FORGE_RUNTIME&&process.env.FORGE_CLASSES?{java:process.env.FORGE_JAVA,runtime:process.env.FORGE_RUNTIME,classes:process.env.FORGE_CLASSES}:undefined});
const port=Number(process.env.PORT||5173);
server.http.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Nexus-Server läuft auf Port ${port}. Lokal: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>{void server.close().then(()=>process.exit(0));});
