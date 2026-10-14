import {serverConfig} from '../server/config.ts';
try{
 const config=serverConfig({production:true,publicURL:process.env.PUBLIC_URL||(process.env.DOMAIN?`https://${process.env.DOMAIN}`:'')});
 console.log(`Konfiguration gültig. Adresse: ${config.publicURL}`);
 console.log(`Discord: ${config.discordReady?config.publicURL+'/auth/discord/callback':'optional, nicht eingerichtet'}`);
 console.log(`Gastzugang: ${config.guest?'aktiviert':'deaktiviert'}. Proxy: ${config.proxy?'aktiviert':'deaktiviert'}.`);
 console.log('Prüft lokale Einstellungen; Gastspiel, optionaler Discord-Zugang und Erreichbarkeit nach Veröffentlichung prüfen.');
}catch(error){console.error((error as Error).message);process.exitCode=1;}
