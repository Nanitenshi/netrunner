import {createNexusServer} from '../server/server.ts';
const server=createNexusServer({production:false,guest:true,publicURL:'',clientId:'',clientSecret:'',proxy:false});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await server.close();process.exit(0);}
process.on('message',message=>{if(message==='shutdown')void stop();});
process.on('disconnect',()=>void stop());
process.on('SIGTERM',()=>void stop());
const preferred=Number(process.env.NEXUS_LOCAL_PORT||17843);
server.http.once('error',(error:NodeJS.ErrnoException)=>{
 if(error.code==='EADDRINUSE')server.http.listen(0,'127.0.0.1');
 else{console.error('Lokaler Spielserver konnte nicht starten.');process.exit(1);}
});
server.http.on('listening',()=>process.send?.({port:(server.http.address() as {port:number}).port}));
server.http.listen(preferred,'127.0.0.1');
