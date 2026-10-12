const status=document.querySelector('#status');
const input=document.querySelector('#server');
const buttons=[...document.querySelectorAll('button')];
let busy=false;
async function run(action,message){
 if(busy)return;busy=true;buttons.forEach(b=>b.disabled=true);status.textContent=message;
 try{const result=await action();status.textContent=result.ok?'Dein Spielfenster ist geöffnet.':result.error;}
 catch{status.textContent='Der Start ist fehlgeschlagen. Bitte versuche es erneut.';}
 finally{busy=false;buttons.forEach(b=>b.disabled=false);}
}
window.nexusLauncher.settings().then(settings=>input.value=settings.server).catch(()=>{});
window.nexusLauncher.onStatus(message=>status.textContent=message);
document.querySelector('#connect').addEventListener('submit',event=>{event.preventDefault();void run(()=>window.nexusLauncher.connect(input.value),'Verbindung zum Spielserver wird aufgebaut …');});
document.querySelector('#local').addEventListener('click',()=>void run(()=>window.nexusLauncher.local(),'Deine lokale Arena startet …'));
