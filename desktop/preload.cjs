const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('nexusLauncher',Object.freeze({
 settings:()=>ipcRenderer.invoke('launcher:settings'),
 local:()=>ipcRenderer.invoke('launcher:local'),
 connect:url=>ipcRenderer.invoke('launcher:connect',url),
 onStatus:callback=>{if(typeof callback==='function')ipcRenderer.on('launcher:status',(_event,message)=>callback(String(message)));}
}));
