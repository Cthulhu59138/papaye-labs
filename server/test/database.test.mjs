import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {database} from '../database.mjs';
import {fixture} from './helpers.mjs';

function directory(t){const path=mkdtempSync(join(tmpdir(),'papaye-db-test-'));t.after(()=>rmSync(path,{recursive:true,force:true}));return path;}

test('legacy migration preserves catalogue IDs, revision, account and sessions and is idempotent',t=>{
  const path=join(directory(t),'legacy.sqlite');
  const old=new DatabaseSync(path);
  old.exec(`CREATE TABLE projects (id TEXT PRIMARY KEY NOT NULL,name TEXT NOT NULL,description TEXT NOT NULL,url TEXT NOT NULL,source TEXT NOT NULL,source_private INTEGER NOT NULL,visible INTEGER NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE account (id TEXT PRIMARY KEY NOT NULL,login TEXT NOT NULL,password TEXT NOT NULL,version TEXT NOT NULL,updated_at INTEGER NOT NULL);
    CREATE TABLE sessions (hash TEXT PRIMARY KEY NOT NULL,token TEXT NOT NULL,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    INSERT INTO projects VALUES ('legacy','Private project','Notes legacy description','https://private.example/','https://repo.example/',1,0,7,123456);
    INSERT INTO account VALUES ('owner','test-owner','test-hash-not-a-secret','version',123456);
    INSERT INTO sessions VALUES ('test-session','version','test-csrf',9999999999);`);
  old.close();let DB=database(path);
  let p=DB.sql.prepare('SELECT * FROM projects').get();assert.equal(p.id,'legacy');assert.equal(p.revision,7);assert.equal(p.description,'Notes legacy description');assert.equal(p.url,'https://private.example/');assert.equal(p.notes,'');assert.equal(p.status,'À qualifier');assert.equal(p.archived,0);assert.equal(p.access_status,'unknown');
  assert.equal(DB.sql.prepare('PRAGMA user_version').get().user_version,5);assert.equal(DB.sql.prepare('PRAGMA foreign_keys').get().foreign_keys,1);
  assert.equal(DB.sql.prepare('SELECT password FROM account').get().password,'test-hash-not-a-secret');assert.equal(DB.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
  DB.sql.prepare('UPDATE projects SET notes=?,status=?').run('After migration','En cours');DB.sql.close();DB=database(path);
  p=DB.sql.prepare('SELECT * FROM projects').get();assert.equal(p.notes,'After migration');assert.equal(p.status,'En cours');assert.equal(p.revision,7);DB.sql.close();
});

test('foreign keys forbid orphan tasks and schema migration failure leaves legacy catalogue intact',t=>{
  const DB=database(':memory:');assert.throws(()=>DB.sql.prepare("INSERT INTO tasks VALUES ('task','absent','Bad task','À faire',NULL,1,1,1)").run(),/FOREIGN KEY/);DB.sql.close();
  const path=join(directory(t),'broken.sqlite'),old=new DatabaseSync(path);
  old.exec("CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,description TEXT,url TEXT,source TEXT,source_private INTEGER,visible INTEGER,revision INTEGER,updated_at INTEGER); INSERT INTO projects VALUES ('old','Keep','Desc','','',1,0,8,1); CREATE TABLE tasks (wrong_column TEXT);");old.close();
  assert.throws(()=>database(path));
  const check=new DatabaseSync(path);assert.equal(check.prepare('PRAGMA user_version').get().user_version,0);assert.equal(check.prepare('SELECT name FROM projects').get().name,'Keep');assert.equal(check.prepare('PRAGMA table_info(projects)').all().length,9);check.close();
});

test('future schema is rejected without mutation',t=>{
  const path=join(directory(t),'future.sqlite');const old=new DatabaseSync(path);old.exec('PRAGMA user_version=99');old.close();assert.throws(()=>database(path),/newer/);const check=new DatabaseSync(path);assert.equal(check.prepare('PRAGMA user_version').get().user_version,99);check.close();
});

test('version 1 catalogue gains private worksheets while retaining existing project choices',t=>{
  const path=join(directory(t),'dashboard.sqlite');
  const original=database(path);
  original.sql.exec(`DROP TABLE worksheet_rows; DROP TABLE project_worksheets; PRAGMA user_version=1;
    INSERT INTO projects (id,name,description,url,source,revision,updated_at,status,notes)
    VALUES ('example','Projet existant','','','',9,123,'En pause','Note existante');`);
  original.sql.close();
  const migrated=database(path);
  assert.equal(migrated.sql.prepare('PRAGMA user_version').get().user_version,5);
  assert.deepEqual({...migrated.sql.prepare('SELECT revision,status,notes FROM projects WHERE id=?').get('example')},
    {revision:9,status:'En pause',notes:'Note existante'});
  assert.equal(migrated.sql.prepare('SELECT count(*) AS n FROM project_worksheets').get().n,0);
  assert.throws(()=>migrated.sql.prepare('INSERT INTO project_worksheets VALUES (?,?,?)').run('missing','Tableau fictif',Buffer.from('test')),/FOREIGN KEY/);
  migrated.sql.close();
});

test('migration from version 4 keeps existing questionnaire state', t=>{
  const path=join(directory(t),'questionnaire-v4.sqlite');
  const old=database(path);
  old.sql.exec("ALTER TABLE project_questionnaire DROP COLUMN question_comments; PRAGMA user_version=4;");
  old.sql.prepare('INSERT INTO projects(id,name,description,url,source,updated_at) VALUES (?,?,?,?,?,?)')
    .run('code-papaye','Code Papaye','','','',0);
  const answers=JSON.stringify({situations_entrees:['ps'],auto_dossier_materiel:['utile']});
  old.sql.prepare('INSERT INTO project_questionnaire VALUES (?,?,?,?,?)')
    .run('code-papaye',answers,'Commentaire général',7,1234);
  old.sql.close();
  const migrated=database(path);
  assert.deepEqual({...migrated.sql.prepare('SELECT answers,comment,revision,updated_at,question_comments FROM project_questionnaire').get()},
    {answers,comment:'Commentaire général',revision:7,updated_at:1234,question_comments:'{}'});
  migrated.sql.close();
});

test('version 2 rows retain priorities, statuses, comments and revisions when decisions are added',t=>{
  const path=join(directory(t),'worksheet-v2.sqlite');
  const original=database(path);
  original.sql.exec(`ALTER TABLE worksheet_rows DROP COLUMN decision; PRAGMA user_version=2;
    INSERT INTO projects(id,name,description,url,source,updated_at) VALUES('example','Exemple','','','',1);
    INSERT INTO project_worksheets VALUES('example','Tableau',X'1234');
    INSERT INTO worksheet_rows(project_id,id,ref,subject,description,code,articles,family,pages,support,priority,status,comment,revision)
      VALUES('example',4,'A','Objet','','','','','','','Non prioritaire','En attente','À revoir',7);`);
  original.sql.close();
  const migrated=database(path);
  assert.deepEqual({...migrated.sql.prepare('SELECT priority,status,comment,decision,revision FROM worksheet_rows').get()},
    {priority:'Non prioritaire',status:'En attente',comment:'À revoir',decision:'',revision:7});
  migrated.sql.prepare('UPDATE worksheet_rows SET decision=?').run('Retenir sous réserve de revue');
  migrated.sql.close();
  const reopened=database(path);
  assert.equal(reopened.sql.prepare('SELECT decision FROM worksheet_rows').get().decision,'Retenir sous réserve de revue');
  reopened.sql.close();
});

test('private data and authentication survive reopen and a real SQLite backup can be restored',async t=>{
  const dir=directory(t),path=join(dir,'live.sqlite'),restoredPath=join(dir,'restore.sqlite'),x=fixture(t,path),s=await x.login();
  const p=await x.create(s,{notes:'Private note',dueDate:'2026-12-30',status:'En cours'}),task=await x.createTask(s,p,{status:'Terminé'});
  await backup(x.DB.sql,restoredPath);x.DB.sql.close();
  const reopened=database(path);assert.equal(reopened.sql.prepare('SELECT notes FROM projects WHERE id=?').get(p.id).notes,'Private note');assert.equal(reopened.sql.prepare('SELECT status FROM tasks WHERE id=?').get(task.id).status,'Terminé');assert.equal(reopened.sql.prepare('SELECT count(*) AS n FROM account').get().n,1);reopened.sql.close();
  const restored=database(restoredPath);assert.equal(restored.sql.prepare('SELECT notes FROM projects').get().notes,'Private note');assert.equal(restored.sql.prepare('SELECT title FROM tasks').get().title,'Première action');assert.deepEqual(restored.sql.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok']);restored.sql.close();
});
