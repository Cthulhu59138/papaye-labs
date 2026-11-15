import {DatabaseSync,backup} from 'node:sqlite';
import {existsSync,chmodSync} from 'node:fs';
const [operation,source,target]=process.argv.slice(2);
if(!['backup','verify','restore'].includes(operation)||!source)throw Error('Usage: backup.mjs backup|verify|restore SOURCE [NEW_TARGET]');
const db=new DatabaseSync(source,{readOnly:true});
try {
  const checks=db.prepare('PRAGMA integrity_check').all();
  if(checks.length!==1||checks[0].integrity_check!=='ok')throw Error('La sauvegarde n’est pas intègre.');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Relations invalides.');
  if(operation!=='verify'){
    if(!target||existsSync(target))throw Error('Choisissez une destination nouvelle ; aucun fichier ne sera écrasé.');
    // Both operations use SQLite's snapshot API, including committed WAL data.
    await backup(db,target);
    chmodSync(target,0o600);
    const restored=new DatabaseSync(target,{readOnly:true});
    try {
      if(restored.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||restored.prepare('PRAGMA foreign_key_check').all().length)throw Error('Destination invalide.');
      for(const table of ['projects','tasks','account'])if(restored.prepare(`SELECT count(*) AS n FROM ${table}`).get().n!==db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n)throw Error('Destination incomplète.');
    }finally{restored.close();}
  }
  console.log(JSON.stringify({ok:true,operation,projects:db.prepare('SELECT count(*) AS n FROM projects').get().n,tasks:db.prepare('SELECT count(*) AS n FROM tasks').get().n}));
}finally{db.close();}
