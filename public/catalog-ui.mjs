import { renderCards } from './catalog.mjs';
const config=JSON.parse(document.getElementById('catalog-data').textContent);
const list=document.querySelector('.project-list'),count=document.querySelector('.count'),status=document.getElementById('catalog-status'),refresh=document.getElementById('catalog-refresh');
let busy=false;
async function update(){
 if(busy)return;busy=true;refresh.disabled=true;status.textContent='Actualisation de la sélection…';
 try{const r=await fetch(config.endpoint,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.projects))throw Error();list.innerHTML=data.projects.length?renderCards(data.projects):'<p class="catalog-empty">La sélection publique arrive bientôt.</p>';count.textContent=String(data.projects.length);status.textContent='Sélection publique à jour';}
 catch{list.innerHTML='<p class="catalog-empty">La sélection est momentanément indisponible. Réessayez dans un instant.</p>';count.textContent='—';status.textContent='Actualisation indisponible';}
 finally{busy=false;refresh.disabled=false;}
}
document.querySelector('.catalog-controls').hidden=false;
// No local cache: a project withdrawn by its owner must not reappear from stale storage.
try{localStorage.removeItem('papaye:catalog:v1');}catch{}
refresh.addEventListener('click',update);update();
