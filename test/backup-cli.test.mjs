import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {database} from '../server/database.mjs';

test('restore CLI includes committed WAL data and refuses overwriting a file',()=>{
  const folder=mkdtempSync(join(tmpdir(),'papaye-restore-'));
  const source=join(folder,'source.sqlite'),target=join(folder,'restored.sqlite');
  const db=database(source);
  try {
    db.sql.exec('PRAGMA wal_autocheckpoint=0; PRAGMA wal_checkpoint(TRUNCATE);');
    db.sql.prepare('INSERT INTO projects(id,name,description,url,source,source_private,visible,revision,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run('test','Test privé','','','',1,0,1,1);
    assert.ok(existsSync(source+'-wal'));
    const run=()=>spawnSync(process.execPath,['server/backup.mjs','restore',source,target],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
    const result=run();assert.equal(result.status,0,result.stderr);
    const restored=new DatabaseSync(target,{readOnly:true});
    try{assert.equal(restored.prepare('SELECT name FROM projects').get().name,'Test privé');}finally{restored.close();}
    assert.notEqual(run().status,0);
  }finally{db.sql.close();rmSync(folder,{recursive:true,force:true});}
});
