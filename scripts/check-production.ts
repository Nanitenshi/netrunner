import {serverConfig} from '../server/config.ts';
try{
 const config=serverConfig({production:true,publicURL:process.env.PUBLIC_URL||(process.env.DOMAIN?`https://${process.env.DOMAIN}`:'')});
 console.log(`Konfiguration gültig. Adresse: ${config.publicURL}`);
 console.log(`Discord-Redirect: ${config.publicURL}/auth/discord/callback`);
 console.log(`Testkonten: ${config.guest?'aktiviert':'deaktiviert'}. Proxy: ${config.proxy?'aktiviert':'deaktiviert'}.`);
 console.log('Prüft lokale Einstellungen; Discord-Zugang und Erreichbarkeit müssen nach Veröffentlichung geprüft werden.');
}catch(error){console.error((error as Error).message);process.exitCode=1;}
