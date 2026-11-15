import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {database} from '../server/database.mjs';

test('private import rejects divergent text without overwriting existing records',()=>{
  const dir=mkdtempSync(join(tmpdir(),'papaye-import-'));
  const config=join(dir,'config.json'),dbPath=join(dir,'data.sqlite'),input=join(dir,'input.json');
  const p={id:'one',name:'Un projet',description:'Texte original',url:'',source:'',source_private:1,visible:0,revision:1,updated_at:1};
  const run=()=>spawnSync(process.execPath,['server/admin.mjs','initialize',config,dbPath,input],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  try {
    writeFileSync(input,JSON.stringify({projects:[p],account:[]}));
    assert.equal(run().status,0);
    for(const changes of [{description:'Autre texte'},{source:'https://example.com/source'},{source_private:0}]){
      writeFileSync(input,JSON.stringify({projects:[{...p,...changes}],account:[]}));
      assert.notEqual(run().status,0);
    }
    const db=database(dbPath);try{assert.equal(db.sql.prepare('SELECT description FROM projects').get().description,p.description);}finally{db.sql.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});
