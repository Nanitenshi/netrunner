function serverURL(value){
 if(typeof value!=='string'||value.length>2048)throw new Error('Bitte eine gültige Serveradresse eingeben.');
 let url;try{url=new URL(value.trim());}catch{throw new Error('Die Adresse muss mit https:// beginnen.');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(loopback&&url.protocol==='http:'))throw new Error('Online-Server benötigen eine HTTPS-Adresse.');
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('Bitte nur die Serveradresse ohne Pfad, Passwort oder Zusatz eingeben.');
 return url.origin;
}
function allowedNavigation(value,origin){
 try{const url=new URL(value);return url.origin===origin||(url.origin==='https://discord.com'&&(url.pathname.startsWith('/oauth2/')||url.pathname==='/login'||url.pathname.startsWith('/api/oauth2/')));}catch{return false;}
}
module.exports={serverURL,allowedNavigation};
