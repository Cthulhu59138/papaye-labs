import test from 'node:test';
import assert from 'node:assert/strict';
import {filterWorksheet,worksheetFilters,worksheetMarkup,worksheetPage,worksheetViewState,restoreWorksheetView} from '../public/dashboard-worksheet.mjs';
import {createWorksheetEdits} from '../public/dashboard-worksheet-edits.mjs';

const template={subject:'Contrôler la conduite',description:'Essai de démonstration',code:'Code A',articles:'§ 18',support:'Fiche',family:'Contrôle',pages:'3',revision:1,status:'',priority:'',decision:'',comment:''};
const rows=Array.from({length:14},(_,i)=>({...template,id:i+4,ref:'F-'+(i+1)}));
rows[3]={...rows[3],priority:'Haute',status:'En cours',decision:'Une autre piste',comment:'à revoir'};
const sheet={title:'Inventaire',rows,priorities:['Haute','Basse'],statuses:['En cours','En attente'],decisions:['Retenir','Reporter','Écarter']};

test('Les filtres cumulent recherche, code, statut, priorité et décision personnalisée',()=>{
  const filters={...worksheetFilters(),query:'À REVOIR',priority:'Haute',status:'En cours',decision:'Une autre piste',code:'Code A'};
  assert.deepEqual(filterWorksheet(rows,filters),[rows[3]]);
  assert.deepEqual(filterWorksheet(rows,{...filters,priority:'Basse'}),[]);
  assert.deepEqual(filterWorksheet(rows,{...worksheetFilters(),query:'autre piste'}),[rows[3]]);
  assert.match(worksheetMarkup(sheet,{...worksheetFilters(),decision:'Choix retiré'}),/value="Choix retiré" selected/);
});
test('Les sept colonnes comprennent un commentaire multiligne par sujet, visible sans déplier',()=>{
  const html=worksheetMarkup(sheet,worksheetFilters());
  assert.deepEqual([...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(match=>match[1]),['Sujet','Détails','Code et paragraphe','Statut','Décision','Priorité','Commentaire libre']);
  assert.match(html,/§ 18/);assert.doesNotMatch(html,/Essai de démonstration|ws-detail-body|Modifier le suivi/);
  assert.match(html,/<input type="text" list="ws-decision-suggestions"[^>]+value="Une autre piste"/);
  assert.equal((html.match(/<textarea /g)||[]).length,12);
  assert.match(html,/<textarea id="ws-comment-7"[^>]*aria-label="Commentaire libre pour Contrôler la conduite"[^>]*>\nà revoir<\/textarea>/);
  for(const field of ['status','decision','priority'])assert.match(html,new RegExp('data-ws-field="'+field+'"'));
});
test('Le détail reste unique et les commentaires des projets archivés sont lisibles sans déplier',()=>{
  const selected={...worksheetFilters(),expandedId:String(rows[3].id)};
  const opened=worksheetMarkup(sheet,selected);
  assert.equal((opened.match(/class="ws-detail"/g)||[]).length,1);
  assert.match(opened,/aria-controls="ws-detail-7"/);
  for(const value of ['Essai de démonstration','à revoir','F-4','data-ws-field="comment"'])assert.ok(opened.includes(value));
  assert.match(opened,/<td colspan="7">/);
  assert.equal((opened.match(/id="ws-comment-7"/g)||[]).length,1);
  const archive=worksheetMarkup(sheet,worksheetFilters(),true);
  assert.doesNotMatch(archive,/data-ws-field=|<textarea|ws-detail-body/);
  assert.match(archive,/<p class="ws-comment">à revoir<\/p>/);
  assert.doesNotMatch(worksheetMarkup(sheet,{...selected,page:2}),/ws-detail-body/);
});
test('Pagination, saisies libres et brouillons sont rendus selon la ligne et échappés',()=>{
  const html=worksheetMarkup(sheet,{...worksheetFilters(),page:100});
  assert.match(html,/13 à 14 sur 14/);assert.match(html,/data-ws-row="16"/);assert.doesNotMatch(html,/data-ws-row="4"/);
  const row={...rows[3],subject:'<em>Nom</em>'};
  const edits=new Map([[row.id,{id:row.id,values:{comment:'</textarea><img>',decision:'"><img>'}}]]);
  const withDraft=worksheetMarkup({...sheet,rows:[row]},{...worksheetFilters(),expandedId:String(row.id)},false,edits);
  assert.doesNotMatch(withDraft,/<img|<em>/);assert.match(withDraft,/&lt;img&gt;/);
});

test('Mes retours dénombre les sujets enregistrés indépendamment des filtres et des brouillons',()=>{
  const examples=[
    {...rows[0],status:'En cours',revision:3},
    {...rows[1],priority:'Haute'},
    {...rows[2],decision:'Reporter',priority:'Basse'},
    {...rows[3],decision:'',priority:'',comment:'Première ligne\nSeconde ligne'},
    {...rows[4],comment:'  '},
  ];
  const filters={...worksheetFilters(),returnsOnly:true};
  assert.deepEqual(filterWorksheet(examples,filters),examples.slice(1,4));
  const restricted={...filters,priority:'Haute'};
  assert.deepEqual(filterWorksheet(examples,restricted),[examples[1]]);
  const edits=new Map([[examples[0].id,{id:examples[0].id,values:{comment:'En cours de saisie'}}]]);
  const html=worksheetMarkup({...sheet,rows:examples},restricted,false,edits);
  assert.match(html,/id="ws-return-count">3</);
  assert.match(html,/1 à 1 sur 1 option/);
  assert.doesNotMatch(html,/En cours de saisie/);
  assert.equal(filterWorksheet(examples,worksheetFilters()).length,5);
});
test('L’historique restaure la vue de ce projet et de ce compte, le lien direct ouvre Mes retours',()=>{
  const filters={...worksheetFilters(),page:2,returnsOnly:true,code:'Code A',expandedId:'7'};
  const view=worksheetViewState('projet','compte',filters);
  assert.deepEqual(restoreWorksheetView(view,'projet','compte',null),{...filters,expandedId:null});
  assert.deepEqual(restoreWorksheetView(view,'autre','compte',null),worksheetFilters());
  assert.deepEqual(restoreWorksheetView(view,'projet','autre',null),worksheetFilters());
  assert.deepEqual(restoreWorksheetView(null,'projet','compte','retours'),{...worksheetFilters(),returnsOnly:true});
  assert.equal(restoreWorksheetView({...view,page:'4'},'projet','compte',null).page,1);
  assert.equal(worksheetPage(rows,restoreWorksheetView(view,'projet','compte',null)).page,1);
  assert.ok(!('expandedId' in view));
});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
test('Deux changements rapides utilisent des PATCH sérialisés et la révision confirmée par ligne',async()=>{
  const calls=[],pending=[],accepted=[];
  const drafts=createWorksheetEdits({write:(p,id,body)=>{calls.push([id,body]);return new Promise(resolve=>pending.push(resolve));},accept:(p,row)=>accepted.push(row),changed:()=>{},canWrite:()=>true});
  const first=rows[0],second=rows[1];
  drafts.edit('p',first,'status','En cours');
  drafts.edit('p',first,'decision','Vérifier la note');
  drafts.edit('p',second,'priority','Haute');
  assert.deepEqual(calls,[[4,{revision:1,status:'En cours'}],[5,{revision:1,priority:'Haute'}]]);
  pending[0]({...first,status:'En cours',revision:2});await tick();
  assert.deepEqual(calls[2],[4,{revision:2,decision:'Vérifier la note'}]);
  pending[1]({...second,priority:'Haute',revision:2});
  pending[2]({...first,status:'En cours',decision:'Vérifier la note',revision:3});
  await tick();assert.equal(drafts.list().length,0);assert.equal(accepted.length,3);
});
test('En cas de conflit, la saisie est conservée et la valeur distante est présentée avant toute nouvelle écriture',async()=>{
  const row=rows[0],calls=[];
  const latest={...row,comment:'Déjà enregistré ailleurs',revision:2};
  const drafts=createWorksheetEdits({
    async write(p,id,body){calls.push(body);if(calls.length===1)throw Object.assign(Error('La ligne a changé'),{status:409});return {...latest,...body,revision:3};},
    read:async()=>latest,accept:()=>{},changed:()=>{},canWrite:()=>true,
  });
  drafts.edit('p',row,'comment','Mon texte');await tick();
  const entry=drafts.get('p',4);
  assert.ok(entry.conflict&&entry.reviewed);assert.equal(entry.values.comment,'Mon texte');
  assert.equal(calls.length,1);await drafts.retry('p',4);
  assert.deepEqual(calls[1],{revision:2,comment:'Mon texte'});assert.deepEqual(drafts.list(),[]);
});
