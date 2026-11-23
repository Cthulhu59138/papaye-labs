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
  assert.match(html,/13 à 14 sur 14/);assert.match(html,/worksheet-edit" data-id="16"/);assert.doesNotMatch(html,/worksheet-edit" data-id="4"/);
  assert.doesNotMatch(worksheetMarkup(sheet,worksheetFilters(),true),/data-action="worksheet-edit"/);
});
test('L’éditeur et le tableau affichent les valeurs de la base sous forme de texte',()=>{
  const row={...rows[3],comment:'</textarea><img src=x>',subject:'<em>Libellé</em>'};
  const html=worksheetEditor(row,sheet);
  assert.match(html,/&lt;img src=x&gt;/);assert.match(html,/value="Haute" selected/);assert.doesNotMatch(html,/<img|<em>/);
  assert.doesNotMatch(worksheetMarkup({...sheet,rows:[row]},worksheetFilters()),/<img|<em>/);
});
