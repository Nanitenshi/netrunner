import {DatabaseSync,backup} from 'node:sqlite';
import {mkdirSync,existsSync,chmodSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const source=resolve(process.env.DATABASE_PATH||'data/nexus.sqlite');
if(!existsSync(source))throw new Error('Datenbank nicht gefunden');
const target=resolve(process.argv[2]||`data/backups/nexus-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
if(source===target||existsSync(target))throw new Error('Backup-Ziel existiert bereits; bitte neuen Dateinamen wählen');
mkdirSync(dirname(target),{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
try{
 await backup(db,target);
 chmodSync(target,0o600);
 const check=new DatabaseSync(target,{readOnly:true});
 try{if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Backup-Prüfung fehlgeschlagen');}finally{check.close();}
 console.log(`Datenbank gesichert und geprüft: ${target}`);
}finally{db.close();}
