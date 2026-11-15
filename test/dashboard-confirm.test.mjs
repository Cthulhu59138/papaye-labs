import test from 'node:test';
import assert from 'node:assert/strict';
import {createConfirmation} from '../public/dashboard-confirm.mjs';

function fixture({deferClose=false}={}) {
  const handlers={},nodes=new Map(),closeEvents=[];let focusReturns=0;
  const dialog={open:false,ownerDocument:{activeElement:{isConnected:true,focus(){focusReturns++;}}},
    addEventListener(name,handler){handlers[name]=handler;},
    querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{textContent:'',classList:{add(){}},focus(){this.focused=true;}});return nodes.get(selector);},
    showModal(){this.open=true;},close(){this.open=false;if(deferClose)closeEvents.push(()=>handlers.close?.());else handlers.close?.();},replaceChildren(){nodes.clear();this.innerHTML='';},
  };
  const controls=createConfirmation(dialog);
  const choose=value=>handlers.click({target:{closest:()=>({dataset:{confirmation:value}})}});
  return {dialog,controls,handlers,nodes,choose,deliverClose(){closeEvents.shift()?.();},get focusReturns(){return focusReturns;}};
}
test('la confirmation attend une action explicite et rend le focus au déclencheur',async()=>{
  const f=fixture();let resolved=false;
  const result=f.controls.request({title:'Archiver ?',message:'Les données sont conservées.',confirmLabel:'Archiver'}).then(value=>{resolved=true;return value;});
  assert.equal(f.dialog.open,true);assert.equal(resolved,false);
  assert.equal(f.nodes.get('[data-confirmation="cancel"]').focused,true);
  f.choose('accept');assert.equal(await result,true);assert.equal(f.dialog.open,false);assert.equal(f.focusReturns,1);
});
test('Échap refuse l’action et efface le contenu du dialogue',async()=>{
  const f=fixture();const result=f.controls.request({title:'Supprimer ?',message:'Action définitive.'});let prevented=false;
  f.handlers.cancel({preventDefault(){prevented=true;}});
  assert.equal(await result,false);assert.equal(prevented,true);assert.equal(f.dialog.innerHTML,'');
});
test('la purge de session annule la décision en attente au lieu de lancer sa mutation',async()=>{
  const f=fixture();const result=f.controls.request({title:'Abandonner ?',message:'Brouillon non enregistré.'});
  f.controls.cancel();assert.equal(await result,false);assert.equal(f.dialog.open,false);
  f.choose('accept');assert.equal(f.dialog.open,false);
});
test('une nouvelle confirmation ne réutilise pas une ancienne décision',async()=>{
  const f=fixture();const first=f.controls.request({title:'Première',message:'Une action'});
  const second=f.controls.request({title:'Seconde',message:'Autre action'});
  assert.equal(await first,false);assert.equal(f.dialog.open,true);
  f.choose('cancel');assert.equal(await second,false);
});
test('un ancien événement close différé ne peut pas annuler la confirmation suivante',async()=>{
  const f=fixture({deferClose:true});
  const first=f.controls.request({title:'Première',message:'Une action'});
  let secondResolved=false;
  const second=f.controls.request({title:'Seconde',message:'Autre action'}).then(value=>{secondResolved=true;return value;});
  assert.equal(await first,false);
  f.deliverClose();await Promise.resolve();
  assert.equal(secondResolved,false);assert.equal(f.dialog.open,true);
  assert.equal(f.nodes.get('#confirmation-title').textContent,'Seconde');
  f.choose('accept');assert.equal(await second,true);
  f.deliverClose();assert.equal(f.dialog.open,false);
});
