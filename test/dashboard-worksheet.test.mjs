import test from 'node:test';
import assert from 'node:assert/strict';
import {filterWorksheet,worksheetFilters,worksheetEditor,worksheetMarkup} from '../public/dashboard-worksheet.mjs';

const template = {subject:'Contrôler la conduite',description:'Essai de démonstration',code:'Code A',articles:'§ 18',support:'Fiche',family:'Contrôle',pages:'3',revision:1,status:'',priority:'',comment:''};
const rows = Array.from({length:14},(_,i)=>({...template,id:i+4,ref:'F-'+(i+1)}));
rows[3]={...rows[3],priority:'Haute',status:'En cours',comment:'à revoir'};
const sheet={title:'Inventaire',rows,priorities:['Haute','Basse'],statuses:['En cours','En attente']};

test('Les filtres cumulent recherche, code et décisions et prennent en compte les commentaires',()=>{
  const filters={...worksheetFilters(),query:'À REVOIR',priority:'Haute',status:'En cours',code:'Code A'};
  assert.deepEqual(filterWorksheet(rows,filters),[rows[3]]);
  assert.deepEqual(filterWorksheet(rows,{...filters,priority:'Basse'}),[]);
});
test('La pagination conserve les identifiants de ligne et borne la page aux résultats',()=>{
  const html=worksheetMarkup(sheet,{...worksheetFilters(),page:10});
  assert.match(html,/13 à 14 sur 14/);assert.match(html,/worksheet-toggle" data-id="16"/);assert.doesNotMatch(html,/worksheet-toggle" data-id="4"/);
  assert.doesNotMatch(worksheetMarkup(sheet,worksheetFilters(),true),/data-action="worksheet-edit"/);
});
test('Le détail et la modification apparaissent uniquement pour la ligne sélectionnée',()=>{
  const filters=worksheetFilters();
  const folded=worksheetMarkup(sheet,filters);
  assert.match(folded,/aria-expanded="false"/);
  assert.doesNotMatch(folded,/ws-detail-body|Essai de démonstration|§ 18|à revoir|worksheet-edit"/);
  const selected={...filters,expandedId:String(rows[3].id)};
  const opened=worksheetMarkup(sheet,selected);
  assert.equal((opened.match(/aria-expanded="true"/g)||[]).length,1);
  assert.equal((opened.match(/class="ws-detail"/g)||[]).length,1);
  assert.match(opened,/aria-controls="ws-detail-7"/);
  for (const value of ['Essai de démonstration','§ 18','à revoir','F-4','Modifier le suivi']) assert.ok(opened.includes(value));
  const archived=worksheetMarkup(sheet,selected,true);
  assert.match(archived,/à revoir/);
  assert.doesNotMatch(archived,/data-action="worksheet-edit"/);
  assert.doesNotMatch(worksheetMarkup(sheet,{...selected,page:2}),/ws-detail-body/);
});
test('L’éditeur et le tableau affichent les valeurs de la base sous forme de texte',()=>{
  const row={...rows[3],comment:'</textarea><img src=x>',subject:'<em>Libellé</em>'};
  const html=worksheetEditor(row,sheet);
  assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/value="Haute" selected/);assert.doesNotMatch(html,/<img|<em>/);
  assert.doesNotMatch(worksheetMarkup({...sheet,rows:[row]},{...worksheetFilters(),expandedId:String(row.id)}),/<img|<em>/);
});
