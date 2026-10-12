const {app,BrowserWindow,Menu,ipcMain,shell,dialog,net}=require('electron');
const {join}=require('node:path');
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
const {fork}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {createHash}=require('node:crypto');
const {serverURL,allowedNavigation}=require('./url.cjs');
app.setName('Nexus Commander');
let launcher,game,child,localURL,stopping=false;
let settings={server:'',localPort:17843};
const defaultServer=require('./server-config.json').server;
const launcherFile=join(__dirname,'launcher.html');
const launcherURL=pathToFileURL(launcherFile).href;
const userData=()=>app.getPath('userData');
function save(){mkdirSync(userData(),{recursive:true});writeFileSync(join(userData(),'desktop.json'),JSON.stringify(settings));}
function guard(event){if(event.sender!==launcher?.webContents||event.senderFrame?.url!==launcherURL)throw new Error('Nicht erlaubt');}
function lockSession(session){
 session.setPermissionRequestHandler((_webContents,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
 session.setPermissionCheckHandler((_webContents,permission)=>permission==='clipboard-sanitized-write');
 session.on('will-download',event=>event.preventDefault());
}
function external(url){try{const u=new URL(url);if(u.protocol==='https:'&&['discord.com','discord.gg'].includes(u.hostname))void shell.openExternal(u.href);}catch{}}
async function openGame(origin){
 let response;try{response=await net.fetch(`${origin}/api/session`,{signal:AbortSignal.timeout(10000)});}catch{throw new Error('Der Spielserver ist nicht erreichbar. Prüfe deine Internetverbindung oder versuche es später erneut.');}
 if(!response.ok)throw new Error('Der Spielserver antwortet nicht. Bitte später erneut versuchen.');
 const info=await response.json();
 if(typeof info.discordReady!=='boolean'||typeof info.guestEnabled!=='boolean')throw new Error('Unter dieser Adresse wurde kein Nexus-Spielserver gefunden.');
 const partition='persist:nexus-'+createHash('sha256').update(origin===localURL?'local':origin).digest('hex').slice(0,20);
 const next=new BrowserWindow({width:1600,height:1000,minWidth:900,minHeight:600,show:false,title:'Nexus Commander',icon:join(__dirname,'icon.png'),backgroundColor:'#080f1b',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,offscreen:Boolean(process.env.NEXUS_TEST_HIDDEN),backgroundThrottling:!process.env.NEXUS_TEST_HIDDEN,partition}});
 lockSession(next.webContents.session);
 const guardNav=(event,url)=>{if(!allowedNavigation(url,origin)){event.preventDefault();external(url);}};
 next.webContents.on('will-navigate',guardNav);next.webContents.on('will-redirect',guardNav);
 next.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
 try{await next.loadURL(origin);}catch{next.destroy();throw new Error('Der Spielserver ist nicht erreichbar. Prüfe die Adresse und deine Verbindung.');}
 const old=game;game=next;old?.destroy();
 next.on('closed',()=>{if(game===next){game=null;if(!stopping){launcher.show();launcher.focus();}}});
 if(!process.env.NEXUS_TEST_HIDDEN)next.show();launcher.hide();
}
async function startLocal(){
 if(localURL)return localURL;
 const runtime=app.isPackaged?join(process.resourcesPath,'runtime'):join(__dirname,'..','desktop-runtime');
 mkdirSync(join(userData(),'data'),{recursive:true});
 const node=join(runtime,'node.exe');
 child=fork(join(runtime,'server','desktop-server.mjs'),[],{execPath:node,windowsHide:true,silent:true,cwd:runtime,env:{...process.env,NODE_ENV:'development',DATABASE_PATH:join(userData(),'data','nexus.sqlite'),NEXUS_LOCAL_PORT:String(settings.localPort),ENABLE_GUEST:'true',TRUST_PROXY:'false',PUBLIC_URL:'',DISCORD_CLIENT_ID:'',DISCORD_CLIENT_SECRET:''}});
 // Drain output so a long session cannot fill the child process pipes.
 child.stdout?.on('data',()=>{});child.stderr?.on('data',()=>{});
 const started=child;
 child.once('exit',()=>{localURL=null;if(child===started)child=null;});
 const port=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{started.kill();reject(new Error('Der lokale Spielserver startet nicht.'));},20000);
  started.once('message',message=>{if(Number.isInteger(message?.port)){clearTimeout(timeout);resolve(message.port);}});
  started.once('error',()=>{clearTimeout(timeout);reject(new Error('Die lokale Laufzeit konnte nicht gestartet werden.'));});
  started.once('exit',()=>{clearTimeout(timeout);reject(new Error('Der lokale Spielserver wurde beendet.'));});
 });
 settings.localPort=port;save();localURL=`http://127.0.0.1:${port}`;return localURL;
}
async function result(action){try{await action();return {ok:true};}catch(error){return {ok:false,error:error.message};}}
if(!app.requestSingleInstanceLock())app.quit();
else{
 app.on('second-instance',()=>{const window=game||launcher;if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
 app.whenReady().then(()=>{
  try{const stored=JSON.parse(readFileSync(join(userData(),'desktop.json'),'utf8'));if(typeof stored.server==='string')settings.server=stored.server;if(Number.isInteger(stored.localPort)&&stored.localPort>1024&&stored.localPort<65536)settings.localPort=stored.localPort;}catch{}
  if(!settings.server&&defaultServer)settings.server=serverURL(defaultServer);
  launcher=new BrowserWindow({width:1100,height:780,minWidth:800,minHeight:650,show:!process.env.NEXUS_TEST_HIDDEN,title:'Nexus Commander',icon:join(__dirname,'icon.png'),backgroundColor:'#080f1b',webPreferences:{preload:join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,offscreen:Boolean(process.env.NEXUS_TEST_HIDDEN),backgroundThrottling:!process.env.NEXUS_TEST_HIDDEN}});
  lockSession(launcher.webContents.session);
  launcher.webContents.on('will-navigate',event=>event.preventDefault());
  launcher.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  launcher.on('closed',()=>{launcher=null;app.quit();});
  ipcMain.handle('launcher:settings',event=>{guard(event);return {server:settings.server};});
  ipcMain.handle('launcher:local',event=>{guard(event);return result(async()=>openGame(await startLocal()));});
  ipcMain.handle('launcher:connect',(event,value)=>{guard(event);return result(async()=>{const origin=serverURL(value);await openGame(origin);settings.server=origin;save();});});
  Menu.setApplicationMenu(Menu.buildFromTemplate([
   {label:'Nexus',submenu:[{label:'Server wechseln',accelerator:'CmdOrCtrl+Shift+S',click:()=>{launcher.show();launcher.focus();}},{type:'separator'},{label:'Beenden',role:'quit'}]},
   {label:'Ansicht',submenu:[{role:'reload',label:'Neu laden'},{role:'togglefullscreen',label:'Vollbild'},{role:'resetZoom',label:'Originalgröße'},{role:'zoomIn',label:'Vergrößern'},{role:'zoomOut',label:'Verkleinern'}]},
   {label:'Hilfe',submenu:[{label:'Über Nexus Commander',click:()=>dialog.showMessageBox({title:'Nexus Commander',message:'Nexus Commander · Windows',detail:'Lokaler Testmodus und Verbindung zu einem gemeinsamen Spielserver. Online-Partien benötigen einen erreichbaren Nexus-Server. Discord-Sprachkanäle öffnen sich in deiner Discord-App oder im Browser.'})}]}
  ]));
  void launcher.loadFile(launcherFile).then(async()=>{if(defaultServer){const connected=await result(()=>openGame(serverURL(settings.server)));if(!connected.ok)launcher.webContents.send('launcher:status',connected.error);}});
 });
 app.on('before-quit',event=>{
  if(stopping)return;stopping=true;
  if(child){event.preventDefault();const active=child;const timer=setTimeout(()=>{active.kill();app.quit();},5000);active.once('exit',()=>{clearTimeout(timer);app.quit();});if(active.connected)active.send('shutdown');else active.kill();}
 });
 app.on('window-all-closed',()=>app.quit());
}
