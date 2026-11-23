import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fixture} from './helpers.mjs';

function testWorkbook() {
  return execFileSync('python3',['-I','-c',`
import io, sys, zipfile
out = io.BytesIO()
with zipfile.ZipFile(out, "w") as z:
    ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    rels = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    z.writestr("xl/worksheets/sheet1.xml", f'''<worksheet xmlns="{ns}" xmlns:r="{rels}"><dimension ref="A1:E4"/>
      <cols><col min="1" max="5" width="17" customWidth="1"/></cols><sheetData>
      <row r="3"><c r="C3" s="1"/></row><row r="4"><c r="B4"/><c r="C4" s="2"/><c r="D4"/><c r="E4"><f>HYPERLINK("fiche.txt","Fiche")</f></c></row>
      </sheetData><dataValidations count="1"><dataValidation type="list" sqref="C4:C4" showErrorMessage="1"><formula1>"Oui,Non"</formula1></dataValidation></dataValidations>
      <tableParts count="1"><tablePart r:id="r1"/></tableParts></worksheet>''')
    columns = ''.join(f'<tableColumn id="{i}" name="{name}"/>' for i,name in enumerate(["Objet","Priorité","Statut","Commentaire","Fiche"],1))
    z.writestr("xl/tables/table1.xml", f'<table xmlns="{ns}" ref="A3:E4"><autoFilter ref="A3:E4"/><tableColumns count="5">{columns}</tableColumns><tableStyleInfo name="TableStyleLight1"/></table>')
    z.writestr("xl/worksheets/_rels/sheet1.xml.rels", f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="{rels}/table" Target="../tables/table1.xml"/></Relationships>')
    z.writestr("custom/template.bin",b"opaque template metadata")
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
    articles:'A',family:'Carrés',pages:'1',support:'Fiche fictive',priority:'',status:'',comment:'',decision:'',revision:1
  });
  assert.deepEqual(table.priorities,['1 – Haute','2 – Moyenne','3 – Basse','Non prioritaire']);
  assert.deepEqual(table.statuses,['Finalisé','En cours','À développer','En attente','Annulé','Autre']);
  assert.deepEqual(table.decisions,['Retenir','Reporter','Écarter']);
  for (const invalid of [{priority:'Haute'},{status:'inconnu'},{revision:0},{comment:'a'.repeat(8001)},{subject:'Autre objet'},
    {decision:400},{decision:null},{decision:'x'.repeat(401)},{decision:'\udfff'}]) {
    assert.equal((await patch(rowUrl,invalid)).status,400);
  }
  const partial=data=>x.call(rowUrl,{...owner,method:'PATCH',data});
  assert.equal((await partial({revision:1})).status,400);
  assert.equal((await partial({decision:'Retenir'})).status,400);
  const saved=await patch(rowUrl);
  assert.equal(saved.status,200);
  const {row:legacyRow}=await saved.json();
  assert.equal(legacyRow.revision,2);
  assert.equal(legacyRow.decision,'');
  const decision='Retenir sous réserve d’une seconde mesure';
  const decided=await partial({revision:2,decision});
  assert.equal(decided.status,200);
  const {row:decisionRow}=await decided.json();
  assert.deepEqual(decisionRow,{...legacyRow,decision,revision:3});
  assert.equal((await partial({revision:2,status:'Annulé'})).status,409);
  // A client still sending the original three fields must preserve the new one.
  const {row}=await (await patch(rowUrl,{revision:3,comment:'  Commentaire libre\n=SUM(1,2)  '})).json();
  assert.equal(row.decision,decision);
  assert.equal(row.revision,4);
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
    assert z.read("custom/template.bin") == b"opaque template metadata"
    table=ET.fromstring(z.read("xl/tables/table1.xml"))
    assert table.get("ref") == table.find("{*}autoFilter").get("ref") == "A3:F4"
    assert [c.get("name") for c in table.findall("{*}tableColumns/{*}tableColumn")][-1] == "Décision"
    assert table.find("{*}tableColumns").get("count") == "6"
    assert sheet.find("{*}dimension").get("ref") == "A1:F4"
    cells={c.get("r"):c for c in sheet.iterfind(".//{*}c")}
    assert cells["E4"].findtext("{*}f") == 'HYPERLINK("fiche.txt","Fiche")'
    assert cells["F3"].findtext("{*}is/{*}t") == "Décision"
    assert cells["F4"].get("s") == cells["C4"].get("s")
    validations=sheet.find("{*}dataValidations")
    old,new=validations.findall("{*}dataValidation")
    assert old.get("sqref") == "C4:C4" and old.findtext("{*}formula1") == '"Oui,Non"'
    assert validations.get("count") == "2"
    assert new.get("sqref") == "F4:F4" and new.get("showErrorMessage") == "0"
    assert new.findtext("{*}formula1") == '"Retenir,Reporter,Écarter"'
    print(json.dumps([cells[c+"4"].findtext("{*}is/{*}t") for c in "BCDF"]))
`],{input:Buffer.from(await download.arrayBuffer()),encoding:'utf8'});
  assert.deepEqual(JSON.parse(exported),[row.priority,row.status,row.comment,decision]);
  const archive=await x.call(projectUrl,{...owner,method:'PATCH',data:{revision:1,archived:true}});
  assert.equal(archive.status,200);
  assert.equal((await partial({revision:4,decision:'Reporter'})).status,409);
  assert.deepEqual((await (await x.call(url,owner)).json()).rows[0],row);
  await x.call(projectUrl,{...owner,method:'PATCH',data:{revision:2,archived:false}});
  const {row:clearedDecision}=await (await partial({revision:4,decision:''})).json();
  assert.deepEqual(clearedDecision,{...row,revision:5,decision:''});
  const cleared=await patch(rowUrl,{revision:5,priority:'',status:'',comment:''});
  assert.equal(cleared.status,200);
  assert.equal((await cleared.json()).row.comment,'');
  const limitDecision='é'.repeat(400);
  const multi=await partial({revision:6,decision:limitDecision,status:'En cours'});
  assert.equal(multi.status,200);
  const {row:multiRow}=await multi.json();
  assert.deepEqual([multiRow.priority,multiRow.status,multiRow.comment,multiRow.decision],['','En cours','',limitDecision]);
});
