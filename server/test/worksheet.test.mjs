import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fixture} from './helpers.mjs';

function testWorkbook() {
  return execFileSync('python3',['-I','-c',`
import io, sys, zipfile
out = io.BytesIO()
with zipfile.ZipFile(out, "w") as z:
    z.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="4"><c r="B4"/><c r="C4"/><c r="D4"/></row></sheetData></worksheet>')
sys.stdout.buffer.write(out.getvalue())
`]);
}

test('private worksheet reads, saves, exports and guards against conflicting edits',async t=>{
  const x=fixture(t);
  const owner=await x.login();
  const project=await x.create(owner);
  const other=await x.create(owner,{name:'Second exemple'});
  const projectUrl='/api/projects/'+project.id;
  const url=projectUrl+'/worksheet';
  const rowUrl=url+'/rows/4';
  x.sql.prepare('INSERT INTO project_worksheets(project_id,title,workbook) VALUES (?,?,?)')
    .run(project.id,'Choix de démonstration',testWorkbook());
  x.sql.prepare(`INSERT INTO worksheet_rows
    (project_id,id,ref,subject,description,code,articles,family,pages,support)
    VALUES (?,4,'Démo 1','Surface','Calculer une surface','Exemple','A','Carrés','1','Fiche fictive')`).run(project.id);
  const patch=(path,overrides={},credentials=owner)=>x.call(path,{...credentials,method:'PATCH',data:{
    revision:1,priority:'1 – Haute',status:'En cours',comment:'  Démo libre\n=SUM(1,2)  ',...overrides
  }});

  for (const target of [url,url+'/download']) assert.equal((await x.call(target)).status,401);
  assert.equal((await patch(rowUrl,{},{ })).status,401);
  assert.equal((await patch(rowUrl,{}, {...owner,csrf:'invalid'})).status,403);
  assert.equal((await patch(rowUrl,{}, {...owner,from:'https://other.example'})).status,403);
  assert.equal((await x.call('/api/projects/'+other.id+'/worksheet',owner)).status,404);
  assert.equal((await patch('/api/projects/'+other.id+'/worksheet/rows/4')).status,404);
  const projects=(await (await x.call('/api/projects',owner)).json()).projects;
  assert.equal(projects.find(p=>p.id===project.id).hasWorksheet,true);
  assert.equal(Object.hasOwn(projects.find(p=>p.id===other.id),'hasWorksheet'),false);
  assert.equal((await (await x.call(projectUrl,owner)).json()).project.hasWorksheet,true);
  const table=await (await x.call(url,owner)).json();
  assert.equal(table.title,'Choix de démonstration');
  assert.equal(table.rows.length,1);
  assert.deepEqual(table.rows[0],{
    id:4,ref:'Démo 1',subject:'Surface',description:'Calculer une surface',code:'Exemple',
    articles:'A',family:'Carrés',pages:'1',support:'Fiche fictive',priority:'',status:'',comment:'',revision:1
  });
  assert.deepEqual(table.priorities,['1 – Haute','2 – Moyenne','3 – Basse','Non prioritaire']);
  assert.deepEqual(table.statuses,['Finalisé','En cours','À développer','En attente','Annulé','Autre']);
  for (const invalid of [{priority:'Haute'},{status:'inconnu'},{revision:0},{comment:'a'.repeat(8001)},{subject:'Autre objet'}]) {
    assert.equal((await patch(rowUrl,invalid)).status,400);
  }
  const saved=await patch(rowUrl);
  assert.equal(saved.status,200);
  const {row}=await saved.json();
  assert.equal(row.revision,2);
  assert.equal((await patch(rowUrl,{comment:'saisie périmée'})).status,409);
  assert.deepEqual((await (await x.call(url,owner)).json()).rows[0],row);
  const download=await x.call(url+'/download',owner);
  assert.equal(download.status,200);
  assert.match(download.headers.get('content-disposition'),/attachment;.*xlsx/);
  assert.match(download.headers.get('content-type'),/spreadsheet/);
  assert.equal(download.headers.get('cache-control'),'no-store');
  const exported=execFileSync('python3',['-I','-c',`
import io,json,sys,zipfile
from xml.etree import ElementTree as ET
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    print(json.dumps([cell.findtext("{*}is/{*}t") for cell in sheet.iterfind(".//{*}c")]))
`],{input:Buffer.from(await download.arrayBuffer()),encoding:'utf8'});
  assert.deepEqual(JSON.parse(exported),[row.priority,row.status,row.comment]);
  const archive=await x.call(projectUrl,{...owner,method:'PATCH',data:{revision:1,archived:true}});
  assert.equal(archive.status,200);
  assert.equal((await patch(rowUrl,{revision:2})).status,409);
  assert.deepEqual((await (await x.call(url,owner)).json()).rows[0],row);
  await x.call(projectUrl,{...owner,method:'PATCH',data:{revision:2,archived:false}});
  const cleared=await patch(rowUrl,{revision:2,priority:'',status:'',comment:''});
  assert.equal(cleared.status,200);
  assert.equal((await cleared.json()).row.comment,'');
});
