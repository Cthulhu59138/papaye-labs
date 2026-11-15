import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture,PASSWORD,TOKEN} from './helpers.mjs';

test('all project and task data require a session; obsolete public route always returns 404',async t=>{
  const x=fixture(t);
  for(const [path,method] of [['/api/projects','GET'],['/api/tasks','GET'],['/api/projects/known-id','GET'],['/api/projects/known-id/tasks','GET'],['/api/sync','POST'],['/api/projects/known-id','PATCH'],['/api/tasks/known-id','DELETE']])assert.equal((await x.call(path,{method})).status,401);
  assert.equal((await x.call('/api/public/projects')).status,404);
  const s=await x.login();assert.equal((await x.call('/api/public/projects',s)).status,404);
  assert.deepEqual((await(await x.call('/api/projects',s)).json()).projects,[]);
  assert.equal(x.sql.prepare('SELECT count(*) AS n FROM projects').get().n,0,'no automatic catalogue seed');
});

test('activation requires private unexpired token, same origin and one-time creation',async t=>{
  const x=fixture(t),data={token:TOKEN,login:'Adrien',password:PASSWORD};
  assert.equal((await x.call('/api/setup',{method:'POST',data:{...data,token:'wrong'}})).status,403);
  assert.equal((await x.call('/api/setup',{method:'POST',data,from:'https://evil.test'})).status,403);
  x.env.SETUP_EXPIRES=0;assert.equal((await x.call('/api/setup',{method:'POST',data})).status,403);x.env.SETUP_EXPIRES=Math.floor(Date.now()/1000)+3600;
  assert.equal((await x.call('/api/setup',{method:'POST',data:{...data,password:'short'}})).status,400);
  const s=await x.login();assert.equal((await x.call('/api/setup',{method:'POST',data})).status,409);
  assert.match(s.cookie,/^[A-Za-z0-9_-]{43}$/);assert.equal(s.end.headers.get('set-cookie'),null);
  const stored=x.sql.prepare('SELECT * FROM account').get();assert.match(stored.password,/^scrypt\$/);assert.ok(!JSON.stringify(stored).includes(PASSWORD));
  assert.equal((await(await x.call('/api/me',s)).json()).login,'adrien');
});

test('independent sessions work across devices with bounded remember duration',async t=>{
  const x=fixture(t),first=await x.login();
  assert.equal((await x.call('/api/login',{method:'POST',data:{login:'adrien',password:'wrong'}})).status,401);
  assert.equal((await x.call('/api/login',{method:'POST',data:{login:'someone-else',password:PASSWORD}})).status,401);
  const second=await x.login();assert.notEqual(first.cookie,second.cookie);
  assert.equal((await x.call('/api/projects',first)).status,200);assert.equal((await x.call('/api/projects',second)).status,200);
  const short=(await first.end.clone().json()).expiresAt;assert.ok(short>Date.now()+11*3600000&&short<=Date.now()+12*3600000);
  const long=await x.call('/api/login',{method:'POST',data:{login:'ADRIEN',password:PASSWORD,remember:true}});assert.ok((await long.json()).expiresAt>Date.now()+29*86400000);
});

test('login is rate limited and a foreign origin cannot start a session',async t=>{
  const x=fixture(t);await x.login();const data={login:'adrien',password:'wrong'};
  assert.equal((await x.call('/api/login',{method:'POST',data,from:'https://evil.test'})).status,403);
  for(let i=0;i<5;i++)assert.equal((await x.call('/api/login',{method:'POST',data})).status,401);
  assert.equal((await x.call('/api/login',{method:'POST',data})).status,429);
  assert.equal(x.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
});

test('password change checks current password and CSRF, invalidates every older session',async t=>{
  const x=fixture(t),s=await x.login(),other=await x.login(),data={currentPassword:PASSWORD,password:'a different local test phrase'};
  assert.equal((await x.call('/api/password',{...s,method:'POST',data,csrf:'bad'})).status,403);
  assert.equal((await x.call('/api/password',{...s,method:'POST',data:{...data,currentPassword:'wrong'}})).status,400);
  const changed=await x.call('/api/password',{...s,method:'POST',data});assert.equal(changed.status,200);
  assert.equal((await x.call('/api/projects',s)).status,401);assert.equal((await x.call('/api/projects',other)).status,401);
  assert.equal((await x.call('/api/projects',{cookie:(await changed.clone().json()).sessionToken})).status,200);
  assert.equal((await x.call('/api/login',{method:'POST',data:{login:'adrien',password:PASSWORD}})).status,401);
});

test('project fields support private planning, exact dates and notes without exposing legacy visibility',async t=>{
  const x=fixture(t),s=await x.login(),notes='  <script>alert("private")</script>\nUne note privée.\n ';
  const p=await x.create(s,{notes,status:'En cours',dueDate:'2028-02-29'});
  assert.equal(p.url,'');assert.equal(p.notes,notes);assert.equal(p.dueDate,'2028-02-29');assert.equal(p.accessStatus,'unknown');assert.equal(p.archived,false);assert.equal(p.revision,1);
  assert.ok(!('visible' in p));assert.ok(p.updatedAt>1700000000000);
  const r=await x.call('/api/projects/'+p.id,{...s,method:'PATCH',data:{revision:1,name:'Nouveau nom',source:'https://github.com/example/test',notes:'Notes modifiées',dueDate:null}});
  assert.equal(r.status,200);const updated=(await r.json()).project;assert.equal(updated.revision,2);assert.equal(updated.notes,'Notes modifiées');assert.equal(updated.dueDate,null);assert.equal(updated.sourcePrivate,true);
  assert.equal((await(await x.call('/api/projects/'+p.id,s)).json()).project.name,'Nouveau nom');
});

test('project mutations require Origin, CSRF, current revision and valid strict fields',async t=>{
  const x=fixture(t),s=await x.login(),p=await x.create(s),path='/api/projects/'+p.id;
  assert.equal((await x.call(path,{...s,method:'PATCH',data:{revision:1,name:'A'},csrf:'bad'})).status,403);
  assert.equal((await x.call(path,{...s,method:'PATCH',data:{revision:1,name:'A'},from:'https://evil.test'})).status,403);
  assert.equal((await x.call(path,{...s,method:'PATCH',data:{revision:1,name:'A'}})).status,200);
  assert.equal((await x.call(path,{...s,method:'PATCH',data:{revision:1,name:'Lost update'}})).status,409);
  for(const data of [{revision:2,dueDate:'2027-02-29'},{revision:2,dueDate:'2026-01-01T00:00:00Z'},{revision:2,status:'bad'},{revision:2,notes:'x'.repeat(8001)},{revision:2,archived:'true'},{revision:2,visible:true},{revision:2,url:'javascript:alert(1)'},{revision:2,url:null},{revision:'2',name:'Bad revision'}])assert.equal((await x.call(path,{...s,method:'PATCH',data})).status,400,JSON.stringify(data).slice(0,120));
  assert.equal((await x.call('/api/projects',{...s,method:'POST',data:[]})).status,400);
  assert.equal((await x.call('/api/projects',{...s,method:'POST',data:null})).status,400);
});

test('public sharing is derived only from exact verified application URLs',async t=>{
  const x=fixture(t),s=await x.login();
  for(const name of ['scoubi','malomatix','explorateurs'])assert.equal((await x.create(s,{url:'https://papaye-labs.fr/'+name+'/'})).accessStatus,'public');
  const p=await x.create(s,{url:'https://papaye-labs.fr/explorateurs/?secret=1'});assert.equal(p.accessStatus,'unknown');
  assert.equal((await x.call('/api/projects/'+p.id,{...s,method:'PATCH',data:{revision:1,accessStatus:'public'}})).status,400);
  const protectedProject=await x.create(s,{url:'https://private.example/',accessStatus:'protected'});assert.equal(protectedProject.accessStatus,'protected');
  const r=await x.call('/api/projects/'+protectedProject.id,{...s,method:'PATCH',data:{revision:1,url:'https://another.example/'}});assert.equal((await r.json()).project.accessStatus,'unknown');
});

test('task CRUD supports whole-dashboard listing, optimistic concurrency and deletion',async t=>{
  const x=fixture(t),s=await x.login(),p=await x.create(s),task=await x.createTask(s,p,{dueDate:'2026-12-01'});
  assert.equal(task.projectId,p.id);assert.equal(task.status,'À faire');assert.equal(task.revision,1);
  for(const path of ['/api/tasks','/api/projects/'+p.id+'/tasks'])assert.equal((await(await x.call(path,s)).json()).tasks.length,1);
  let r=await x.call('/api/tasks/'+task.id,{...s,method:'PATCH',data:{revision:1,status:'Terminé',title:'Action terminée',dueDate:null}});
  assert.equal(r.status,200);const done=(await r.json()).task;assert.equal(done.status,'Terminé');assert.equal(done.revision,2);assert.equal(done.dueDate,null);
  assert.equal((await x.call('/api/tasks/'+task.id,{...s,method:'DELETE',data:{revision:1}})).status,409);
  assert.equal((await x.call('/api/tasks/'+task.id,{...s,method:'DELETE',data:{revision:2}})).status,200);
  assert.equal((await(await x.call('/api/tasks',s)).json()).tasks.length,0);
  assert.equal((await x.call('/api/tasks/'+task.id,{...s,method:'PATCH',data:{revision:2,title:'Missing'}})).status,404);
});

test('archiving retains tasks and notes, prevents task edits, and restoration re-enables them',async t=>{
  const x=fixture(t),s=await x.login(),p=await x.create(s,{notes:'Conserver'}),task=await x.createTask(s,p);
  assert.equal((await x.call('/api/projects/'+p.id,{...s,method:'PATCH',data:{revision:1,archived:true}})).status,200);
  assert.equal((await(await x.call('/api/tasks',s)).json()).tasks.length,1);
  for(const [path,method,data] of [['/api/projects/'+p.id+'/tasks','POST',{title:'Impossible'}],['/api/tasks/'+task.id,'PATCH',{revision:1,status:'Terminé'}],['/api/tasks/'+task.id,'DELETE',{revision:1}]])assert.equal((await x.call(path,{...s,method,data})).status,409);
  assert.equal((await(await x.call('/api/projects/'+p.id,s)).json()).project.notes,'Conserver');
  assert.equal((await x.call('/api/projects/'+p.id,{...s,method:'PATCH',data:{revision:2,archived:false}})).status,200);
  assert.equal((await x.call('/api/tasks/'+task.id,{...s,method:'PATCH',data:{revision:1,status:'Terminé'}})).status,200);
});

test('invalid tasks are rejected without creating records and foreign projects never accept tasks',async t=>{
  const x=fixture(t),s=await x.login(),p=await x.create(s);
  for(const data of [{title:''},{title:'x'.repeat(201)},{title:'Action',status:'bad'},{title:'Action',dueDate:'2026-04-31'},{title:'Action',projectId:'another'}])assert.equal((await x.call('/api/projects/'+p.id+'/tasks',{...s,method:'POST',data})).status,400);
  assert.equal((await x.call('/api/projects/missing/tasks',{...s,method:'POST',data:{title:'Unknown'}})).status,404);
  assert.equal((await(await x.call('/api/tasks',s)).json()).tasks.length,0);
});

test('explicit GitHub refresh preserves local notes and does not declare applications public',async t=>{
  const x=fixture(t),s=await x.login(),p=await x.create(s,{name:'Nom local',source:'https://github.com/Cthulhu59138/known',notes:'Mes notes',status:'En pause'});
  const mock=async(url,options)=>{assert.equal(options.headers.Authorization,undefined);return new Response(JSON.stringify([{id:1,name:'known',owner:{id:47718344},private:false,homepage:'https://external.example/'},{id:2,name:'new',owner:{id:47718344},private:false,has_pages:true}]));};
  assert.equal((await x.call('/api/sync',{...s,method:'POST'},mock)).status,200);
  const all=(await(await x.call('/api/projects',s)).json()).projects;assert.equal(all.length,2);
  const preserved=all.find(item=>item.id===p.id);assert.equal(preserved.name,'Nom local');assert.equal(preserved.notes,'Mes notes');assert.equal(preserved.status,'En pause');
  assert.equal(all.find(item=>item.id==='github-2').accessStatus,'unknown');assert.equal(all.find(item=>item.id==='github-2').status,'À qualifier');
});

test('failed paginated GitHub refresh leaves the entire catalogue unchanged',async t=>{
  const x=fixture(t),s=await x.login();await x.create(s);
  const before=JSON.stringify(x.sql.prepare('SELECT * FROM projects').all());
  const mock=async url=>url.includes('page=2')?new Response('{}',{status:403}):new Response(JSON.stringify(Array.from({length:100},(_,id)=>({id,name:'project-'+id,owner:{id:47718344},private:false}))));
  assert.equal((await x.call('/api/sync',{...s,method:'POST'},mock)).status,502);assert.equal(JSON.stringify(x.sql.prepare('SELECT * FROM projects').all()),before);
});

test('logout and expiration revoke private access and every response forbids caching',async t=>{
  const x=fixture(t),s=await x.login();assert.equal((await x.call('/api/projects',s)).headers.get('cache-control'),'no-store');
  assert.equal((await x.call('/api/logout',{...s,method:'POST'})).status,200);assert.equal((await x.call('/api/projects',s)).status,401);
  const next=await x.login();x.sql.exec('UPDATE sessions SET expires=0');assert.equal((await x.call('/api/tasks',next)).status,401);
  assert.equal((await x.call('/api/projects')).headers.get('cache-control'),'no-store');
});
