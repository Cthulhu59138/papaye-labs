import test from 'node:test';
import assert from 'node:assert/strict';
import {setFormBusy,readFormValues} from '../public/dashboard-forms.mjs';

function fixture() {
  const attributes=new Map();
  const form={dataset:{},getAttribute:key=>attributes.get(key)??null,setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key)};
  const controls=[{name:'title',disabled:false},{name:'notes',disabled:false},{name:'save',disabled:false},{name:'close-outside-form',disabled:false},{name:'delete',disabled:false},{name:'already-disabled',disabled:true}];
  const scope={querySelectorAll:()=>controls};
  return {form,controls,scope};
}
test('une mutation fige les champs et les actions du dialogue puis restaure chaque état initial',()=>{
  const {form,controls,scope}=fixture();
  setFormBusy(form,true,{scope,values:{title:'Version envoyée'}});
  assert.ok(controls.every(control=>control.disabled));
  assert.equal(form.dataset.busy,'true');assert.equal(form.getAttribute('aria-busy'),'true');
  setFormBusy(form,false);
  assert.deepEqual(controls.map(control=>control.disabled),[false,false,false,false,false,true]);
  assert.equal(form.dataset.busy,'false');assert.equal(form.getAttribute('aria-busy'),null);
});
test('le brouillon envoyé reste lisible pendant le gel, sans dépendre des champs désactivés',()=>{
  const {form,scope}=fixture();const values={title:'Préparer',notes:'Brouillon privé'};
  setFormBusy(form,true,{scope,values});values.notes='Mutation extérieure';
  assert.deepEqual(readFormValues(form),{title:'Préparer',notes:'Brouillon privé'});
  const copy=readFormValues(form);copy.notes='Autre copie';
  assert.equal(readFormValues(form).notes,'Brouillon privé');
});
test('un double déclenchement ne remplace ni le snapshot ni les états disabled initiaux',()=>{
  const {form,controls,scope}=fixture();form.setAttribute('aria-busy','false');
  setFormBusy(form,true,{scope,values:{title:'Première mutation'}});
  setFormBusy(form,true,{scope,values:{title:'Deuxième mutation'}});
  assert.equal(readFormValues(form).title,'Première mutation');
  setFormBusy(form,false);setFormBusy(form,false);
  assert.equal(controls[0].disabled,false);assert.equal(controls.at(-1).disabled,true);
  assert.equal(form.getAttribute('aria-busy'),'false');
});
