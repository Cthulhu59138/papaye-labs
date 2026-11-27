import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {automationSections, sections, QUESTION_COMMENT_LIMIT, QUESTIONNAIRE_PATH} from '../../public/code-papaye-questionnaire.mjs';

test('Code Papaye questionnaire saves optional multiple choices and free text privately',async t=>{
  const x=fixture(t);
  assert.equal((await x.call(QUESTIONNAIRE_PATH)).status,401);
  assert.equal((await x.call(QUESTIONNAIRE_PATH,{method:'PATCH'})).status,401);
  x.sql.prepare('INSERT INTO projects(id,name,description,url,source,updated_at) VALUES (?,?,?,?,?,?)').run('code-papaye','Code Papaye','','','',0);
  const s=await x.login();
  const get=()=>x.call(QUESTIONNAIRE_PATH,s);
  const save=(data,options={})=>x.call(QUESTIONNAIRE_PATH,{...s,method:'PATCH',data,...options});
  const blank=await get();
  assert.equal(blank.headers.get('cache-control'),'no-store');
  assert.deepEqual(await blank.json(),{answers:{},comment:'',questionComments:{},revision:0,updatedAt:null});
  const data={answers:{situations_entrees:['ps','ts'],dimensions:['calcul','corrosion']},comment:'Étape 1\n<texte libre>',revision:0};
  assert.equal((await save(data,{csrf:'bad'})).status,403);
  assert.equal((await save({...data,answers:{dimensions:['calcul','calcul']}})).status,400);
  assert.equal((await save({...data,answers:{other:['value']}})).status,400);
  assert.equal((await save({...data,comment:'a'.repeat(4001)})).status,400);
  const saved=await save(data);
  assert.equal(saved.status,200,await saved.clone().text());
  const {updatedAt,...state}=await saved.json();
  assert.ok(updatedAt>0);
  assert.deepEqual(state,{...data,questionComments:{},revision:1});
  assert.equal((await save(data)).status,409);
  const edit=await save({answers:{},comment:'Autre cas',revision:1});
  assert.equal(edit.status,200);
  assert.equal((await (await get()).json()).comment,'Autre cas');
  x.sql.prepare('UPDATE projects SET archived=1 WHERE id=?').run('code-papaye');
  assert.equal((await save({...data,revision:2})).status,409);
  assert.equal((await get()).status,200);
  assert.equal((await x.call('/api/logout',{...s,method:'POST'})).status,200);
  assert.equal((await get()).status,401);
});

test('per-question comments support both sections, optional choices, validation and clearing',async t=>{
  const x=fixture(t);
  x.sql.prepare('INSERT INTO projects(id,name,description,url,source,updated_at) VALUES (?,?,?,?,?,?)').run('code-papaye','Code Papaye','','','',0);
  const session=await x.login();
  const save=(data,extra={})=>x.call(QUESTIONNAIRE_PATH,{...session,method:'PATCH',data,...extra});
  const base={answers:{situations_entrees:['ps']},comment:'Commentaire général',revision:0};
  const questionComments={situations_entrees:'Question initiale',auto_dossier_materiel:'<précision> sans avis'};
  assert.equal((await save({...base,questionComments},{csrf:'bad'})).status,403);
  for (const invalid of [null,[],{absente:'texte'},{situations_entrees:23},{situations_entrees:'a'.repeat(QUESTION_COMMENT_LIMIT+1)}]) {
    assert.equal((await save({...base,questionComments:invalid})).status,400);
  }
  const saved=await save({...base,questionComments});
  assert.equal(saved.status,200,await saved.clone().text());
  assert.deepEqual((await saved.json()).questionComments,questionComments);
  const older=await save({...base,revision:1});
  assert.deepEqual((await older.json()).questionComments,questionComments);
  const edited=await save({...base,revision:2,questionComments:{situations_entrees:''}});
  assert.deepEqual((await edited.json()).questionComments,{auto_dossier_materiel:'<précision> sans avis'});
  const all=Object.fromEntries([...sections,...automationSections].flatMap(([,questions])=>
    questions.map(([key])=>[key,'é'.repeat(QUESTION_COMMENT_LIMIT)])));
  const maximum=await save({...base,revision:3,questionComments:all});
  assert.equal(maximum.status,200,await maximum.clone().text());
  const read=await (await x.call(QUESTIONNAIRE_PATH,session)).json();
  assert.deepEqual(read.questionComments,all);
  assert.equal(read.comment,base.comment);
  assert.deepEqual(read.answers,base.answers);
});

test('automation ratings are private, single-choice and survive older clients',async t=>{
  const x=fixture(t);
  x.sql.prepare('INSERT INTO projects(id,name,description,url,source,updated_at) VALUES (?,?,?,?,?,?)').run('code-papaye','Code Papaye','','','',0);
  const session=await x.login();
  const save=data=>x.call(QUESTIONNAIRE_PATH,{...session,method:'PATCH',data});
  const questions=automationSections.flatMap(([,items])=>items);
  assert.equal(questions.length,60);
  assert.equal(new Set(questions.map(([key])=>key)).size,60);
  const first=questions[0][0], last=questions.at(-1)[0];
  const previous={answers:{situations_entrees:['ps','ts']},comment:'Commentaire initial',revision:0};
  assert.equal((await save(previous)).status,200);
  assert.equal((await save({...previous,revision:1,answers:{[first]:['utile','hors_sujet']}})).status,400);
  const rated={...previous,revision:1,answers:{...previous.answers,[first]:['prioritaire'],[last]:['hors_sujet']}};
  const saved=await save(rated);
  assert.equal(saved.status,200,await saved.clone().text());
  assert.deepEqual((await saved.json()).answers,rated.answers);
  const older=await save({...previous,revision:2});
  assert.deepEqual((await older.json()).answers,rated.answers);
  const clear=await save({...rated,revision:3,answers:{...rated.answers,[last]:[]}});
  assert.equal(clear.status,200);
  const data=await (await x.call(QUESTIONNAIRE_PATH,session)).json();
  assert.deepEqual(data.answers,{...rated.answers,[last]:[]});
  assert.equal(data.comment,previous.comment);
});
