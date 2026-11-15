import test from 'node:test';
import assert from 'node:assert/strict';
import {escape,safeHref,parisDay,validDate,dateLabel,dueLabel,projectProgress,activeTasks,sortTasks,filterProjects,filterTasks,parseSession,canShare,validateProject,validateTask} from '../public/dashboard-model.mjs';

const projects=[{id:'a',name:'Atelier',description:'Prochaine création',status:'En cours',archived:false},{id:'b',name:'Carnet',description:'Notes',status:'Idée',archived:false},{id:'old',name:'Ancien',description:'Conservé',status:'En pause',archived:true}];
const tasks=[{id:'t1',projectId:'a',title:'Préparer',status:'À faire',dueDate:'2026-11-15'},{id:'t2',projectId:'a',title:'Dessiner',status:'Terminé',dueDate:'2026-11-10'},{id:'t3',projectId:'b',title:'Lire',status:'En cours',dueDate:null},{id:'t4',projectId:'old',title:'Archivé',status:'À faire',dueDate:'2026-01-01'},{id:'orphan',projectId:'gone',title:'Orphelin',status:'À faire',dueDate:null}];

test('les échéances suivent le jour de Paris et restent des dates civiles',()=>{
  assert.equal(parisDay(new Date('2026-11-14T23:30:00Z')),'2026-11-15');
  assert.equal(parisDay(new Date('2026-07-14T22:30:00Z')),'2026-07-15');
  assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2028-02-29'),true);
  assert.equal(dueLabel('2026-11-14','2026-11-15').overdue,true);
  assert.equal(dueLabel('2026-11-15','2026-11-15').label,'Aujourd’hui');
  assert.equal(dateLabel(null),'Sans échéance');
});
test('les tâches archivées et orphelines ne reviennent pas dans la vue active',()=>{
  assert.deepEqual(activeTasks(projects,tasks).map(task=>task.id),['t1','t2','t3']);
  assert.deepEqual(filterTasks(projects,tasks).map(task=>task.id),['t1','t3']);
  assert.deepEqual(filterTasks(projects,tasks,{status:'Terminé'}).map(task=>task.id),['t2']);
  assert.deepEqual(filterTasks(projects,tasks,{status:'',projectId:'a',query:'pré'}).map(task=>task.id),['t1']);
});
test('avancement exact et absence de pourcentage artificiel',()=>{
  assert.deepEqual(projectProgress('a',tasks),{done:1,total:2,percent:50});
  assert.deepEqual(projectProgress('empty',tasks),{done:0,total:0,percent:null});
  assert.deepEqual(projectProgress('old',tasks),{done:0,total:1,percent:0});
});
test('recherche projets et archives restent séparées',()=>{
  assert.deepEqual(filterProjects(projects,{query:'CRÉATION'}).map(project=>project.id),['a']);
  assert.deepEqual(filterProjects(projects,{archived:true}).map(project=>project.id),['old']);
  assert.deepEqual(filterProjects(projects,{status:'Idée'}).map(project=>project.id),['b']);
});
test('tri priorise les tâches ouvertes et datées sans muter les données',()=>{
  const input=tasks.slice(0,3);const snapshot=structuredClone(input);
  assert.deepEqual(sortTasks(input).map(task=>task.id),['t1','t3','t2']);assert.deepEqual(input,snapshot);
});
test('une session expirée ou invalide n’est jamais restaurée et aucune donnée annexe n’est reprise',()=>{
  const token='a'.repeat(43);
  assert.equal(parseSession('{'),null);
  assert.equal(parseSession(JSON.stringify({sessionToken:token,expiresAt:100}),101),null);
  assert.equal(parseSession(JSON.stringify({sessionToken:'<script>',expiresAt:300}),101),null);
  assert.deepEqual(parseSession(JSON.stringify({sessionToken:token,expiresAt:300,projects:[{notes:'private'}],csrf:'not trusted'}),101),{sessionToken:token,expiresAt:300});
});
test('les liens et textes hostiles ne deviennent pas des actions ou du HTML',()=>{
  assert.equal(safeHref('javascript:alert(1)'),null);assert.equal(safeHref('https://user:secret@example.com/'),null);
  assert.equal(safeHref('http://example.com/'),null);assert.equal(safeHref('https://example.com/tool'),'https://example.com/tool');
  assert.equal(escape('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('copier un lien public nécessite un accès confirmé et un projet actif',()=>{
  const project={url:'https://example.com/',accessStatus:'unknown',archived:false};
  assert.equal(canShare(project),false);assert.equal(canShare({...project,accessStatus:'protected'}),false);
  assert.equal(canShare({...project,accessStatus:'public'}),true);
  assert.equal(canShare({...project,accessStatus:'public',archived:true}),false);
  assert.equal(canShare({...project,accessStatus:'public',url:'javascript:alert(1)'}),false);
});
test('validation formulaires : projet sans application permis, dates et statuts réels exigés',()=>{
  const project={name:'Idée',description:'',url:'',source:'',notes:'',status:'Idée',dueDate:''};
  assert.equal(validateProject(project),'');assert.notEqual(validateProject({...project,dueDate:'2026-02-30'}),'');
  assert.notEqual(validateProject({...project,notes:'x'.repeat(8001)}),'');
  const task={title:'Préparer',projectId:'a',status:'À faire',dueDate:''};
  assert.equal(validateTask(task),'');assert.notEqual(validateTask({...task,status:'Publié'}),'');
  assert.notEqual(validateTask({...task,projectId:''}),'');
});
