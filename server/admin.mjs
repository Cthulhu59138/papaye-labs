import {readFileSync,writeFileSync,existsSync,chmodSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {database} from './database.mjs';

const [command,configPath,dbPath,inputPath]=process.argv.slice(2);
if(command!=='initialize'||!configPath||!dbPath)throw Error('Usage: admin.mjs initialize CONFIG DATABASE [PRIVATE_IMPORT_JSON]');
const DB=database(dbPath);
try {
  if(inputPath){
    const bundle=JSON.parse(readFileSync(inputPath,'utf8'));
    if(!Array.isArray(bundle.projects)||bundle.projects.length>1000)throw Error('Import invalide.');
    const seen=new Set();
    const rows=bundle.projects;
    for(const p of rows){
      if(!/^[a-z0-9-]+$/.test(p.id)||seen.has(p.id))throw Error('Identifiant invalide ou dupliqué.');seen.add(p.id);
      if(typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.description!=='string'||p.description.length>600)throw Error('Projet invalide.');
      for(const key of ['url','source']){if(typeof p[key]!=='string')throw Error('Lien invalide.');if(p[key]){const u=new URL(p[key]);if(u.protocol!=='https:'||u.username||u.password)throw Error('Lien non autorisé.');}}
      if(!Number.isSafeInteger(p.revision)||p.revision<1||!Number.isSafeInteger(p.updated_at))throw Error('Révision invalide.');
    }
    DB.sql.exec('BEGIN IMMEDIATE');
    try {
      const insert=DB.sql.prepare('INSERT INTO projects(id,name,description,url,source,source_private,visible,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
      for(const p of rows){
        const existing=DB.sql.prepare('SELECT * FROM projects WHERE id=?').get(p.id);
        if(existing){if(['revision','updated_at','name','description','url','source'].some(key=>existing[key]!==p[key])||!!existing.source_private!==!!p.source_private)throw Error('Un projet présent diffère de l’import : arrêt sans écrasement.');continue;}
        insert.run(p.id,p.name,p.description,p.url,p.source,Number(!!p.source_private),0,p.revision,p.updated_at);
      }
      const oldAccount=DB.sql.prepare("SELECT id FROM account WHERE id='owner'").get();
      if(bundle.account?.length&&!oldAccount){
        if(bundle.account.length!==1)throw Error('Compte importé ambigu.');
        const a=bundle.account[0];
        if(a.id!=='owner'||typeof a.login!=='string'||!String(a.password).startsWith('scrypt$16384$8$5$')||typeof a.version!=='string')throw Error('Compte importé incompatible.');
        DB.sql.prepare('INSERT INTO account(id,login,password,version,updated_at) VALUES(?,?,?,?,?)').run(a.id,a.login,a.password,a.version,a.updated_at);
      }
      DB.sql.exec('COMMIT');
    }catch(error){DB.sql.exec('ROLLBACK');throw error;}
  }
  const existing=existsSync(configPath)?JSON.parse(readFileSync(configPath,'utf8')):{};
  const config={...existing,APP_ORIGIN:'https://papaye-labs.fr',database:dbPath,port:5293};
  const account=DB.sql.prepare("SELECT id FROM account WHERE id='owner'").get();
  let activationUrl=null;
  if(!account){
    const token=randomBytes(32).toString('base64url');
    config.SETUP_TOKEN_HASH=createHash('sha256').update(token).digest('base64url');
    config.SETUP_EXPIRES=Math.floor(Date.now()/1000)+48*3600;
    activationUrl='https://papaye-labs.fr/#activation='+token;
  }
  writeFileSync(configPath,JSON.stringify(config)+'\n',{mode:0o600});chmodSync(configPath,0o600);
  console.log(JSON.stringify({configured:!!account,activationUrl,expires:account?null:config.SETUP_EXPIRES,projects:DB.sql.prepare('SELECT count(*) AS n FROM projects').get().n}));
}finally{DB.sql.close();}
