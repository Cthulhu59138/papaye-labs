import {hashPassword, verifyPassword} from './password.mjs';
import {timingSafeEqual} from 'node:crypto';
const OWNER_ID = 47718344;
const OWNER = 'Cthulhu59138';
const encode = value => btoa(String.fromCharCode(...value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const random = () => encode(crypto.getRandomValues(new Uint8Array(32)));
const hash = async value => encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const now = () => Math.floor(Date.now()/1000);
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
function response(data,status=200,extra={}) { return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...extra}}); }
export function safeUrl(value,empty=true) { if(empty && value==='')return '';if(typeof value!=='string'||value.length>2000)throw new HttpError(400,'Adresse invalide.');try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error();return u.href;}catch{throw new HttpError(400,'Utilisez une adresse HTTPS sans identifiant intégré.');} }
async function github(path,fetcher) {
  let r;
  try {r=await fetcher('https://api.github.com'+path,{headers:{Accept:'application/vnd.github+json','User-Agent':'Papaye-Labs','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(502,'L’actualisation GitHub est indisponible. Vos projets restent accessibles.');}
  if(!r.ok)throw new HttpError(502,'GitHub est indisponible. Vos projets et vos choix sont conservés.');
  return r.json();
}
async function publicRepos(fetcher) {
  const all=[];
  for(let page=1;page<=20;page++){
    const list=await github(`/users/${OWNER}/repos?type=owner&per_page=100&page=${page}`,fetcher);
    if(!Array.isArray(list))throw new HttpError(502,'Réponse GitHub invalide.');
    all.push(...list);
    if(list.length<100)return all;
  }
  throw new HttpError(502,'Catalogue GitHub incomplet.');
}
async function session(req,env) {
  const sid=req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if(!sid||sid.length>100)return null;
  return env.DB.prepare("SELECT sessions.*,account.login FROM sessions JOIN account ON account.id='owner' AND sessions.token=account.version WHERE sessions.hash=? AND sessions.expires>?").bind(await hash(sid),now()).first();
}
function sameOrigin(req,env) {if(req.headers.get('origin')!==env.APP_ORIGIN)throw new HttpError(403,'Ouvrez cette page directement dans Papaye Labs.');}
function passwordInput(value) {
  if(typeof value!=='string'||value.normalize('NFC').length<12||value.length>256)throw new HttpError(400,'Choisissez au moins 12 caractères. Une courte phrase convient, sans symbole obligatoire.');
  return value;
}
function loginInput(value) {
  if(typeof value!=='string'||!/^[a-zA-Z0-9._-]{3,40}$/.test(value.trim()))throw new HttpError(400,'Utilisez un identifiant de 3 à 40 lettres, chiffres, points ou tirets.');
  return value.trim().toLowerCase();
}
async function rateLimit(req,env,kind) {
  const current=now(),bucket=Math.floor(current/900),ip=await hash(req.headers.get('cf-connecting-ip')||'unknown');
  // Atomic counters also bound distributed guesses; never trust client-supplied forwarding headers.
  for(const [key,limit] of [[`${kind}:${bucket}:${ip}`,5],[`${kind}:${bucket}:all`,40]]){
    const count=await env.DB.prepare('INSERT INTO attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(bucket+2)*900).first();
    if(count.count>limit)throw new HttpError(429,'Trop de tentatives. Réessayez dans 15 minutes.');
  }
  await env.DB.prepare('DELETE FROM attempts WHERE expires<?').bind(current).run();
}
async function checkSetup(env,token) {
  const expected=Buffer.from(env.SETUP_TOKEN_HASH||'','base64url');
  const actual=Buffer.from(await hash(typeof token==='string'&&token.length<=100?token:''),'base64url');
  if(!Number.isFinite(Number(env.SETUP_EXPIRES))||Number(env.SETUP_EXPIRES)<=now()||expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new HttpError(403,'Ce lien d’activation est invalide ou expiré.');
  if(await env.DB.prepare("SELECT id FROM account WHERE id='owner'").first())throw new HttpError(409,'Le compte est déjà créé. Connectez-vous avec votre mot de passe.');
}
async function startSession(env,account,remember=false) {
  const sid=random(),csrf=random(),duration=remember===true?30*86400:12*3600;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires<?').bind(now()),
    env.DB.prepare('INSERT INTO sessions (hash,token,csrf,expires) VALUES (?,?,?,?)').bind(await hash(sid),account.version,csrf,now()+duration),
  ]);
  return response({ok:true,authenticated:true,login:account.login,csrf,configured:true,sessionToken:sid,expiresAt:(now()+duration)*1000});
}
function authorizeWrite(req,env,s) {if(req.headers.get('origin')!==env.APP_ORIGIN || req.headers.get('x-csrf-token')!==s.csrf)throw new HttpError(403,'La session a changé. Rechargez la page.');}
async function body(req) {if(req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')throw new HttpError(415,'Format invalide.');const text=await req.text();if(Buffer.byteLength(text,'utf8')>48000)throw new HttpError(413,'Contenu trop long.');try{const data=JSON.parse(text);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();return data;}catch{throw new HttpError(400,'Contenu invalide.');}}
const PROJECT_STATUSES = new Set(['À qualifier','Idée','En préparation','En cours','En pause','Terminé']);
const TASK_STATUSES = new Set(['À faire','En cours','Terminé']);
const PUBLIC_APP_URLS = new Set([
  'https://papaye-labs.fr/scoubi/',
  'https://papaye-labs.fr/malomatix/',
  'https://papaye-labs.fr/explorateurs/',
]);
export const applicationAccess = (url, stored = 'unknown') => PUBLIC_APP_URLS.has(url) ? 'public' : stored === 'protected' ? 'protected' : 'unknown';
const rowProject = p => ({
  id:p.id,name:p.name,description:p.description,url:p.url,source:p.source,
  sourcePrivate:!!p.source_private,revision:p.revision,status:p.status,
  dueDate:p.due_date,notes:p.notes,archived:!!p.archived,
  accessStatus:applicationAccess(p.url,p.access_status),updatedAt:p.updated_at*1000,
});
const rowTask = t => ({id:t.id,projectId:t.project_id,title:t.title,status:t.status,dueDate:t.due_date,revision:t.revision,createdAt:t.created_at*1000,updatedAt:t.updated_at*1000});
function fields(data, allowed) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !allowed.includes(key))) throw new HttpError(400,'Champs invalides.');
}
function textInput(value, max, required=false) {
  if(typeof value!=='string')throw new HttpError(400,'Le texte est invalide.');
  const text=value.trim();if((required&&!text)||text.length>max)throw new HttpError(400,'Vérifiez la longueur du texte.');return text;
}
function notesInput(value) {if(typeof value!=='string'||value.length>8000)throw new HttpError(400,'La note est limitée à 8 000 caractères.');return value;}
function statusInput(value, statuses) {if(!statuses.has(value))throw new HttpError(400,'Statut invalide.');return value;}
function dateInput(value) {
  if(value===null||value==='')return null;
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>'9999-12-31')throw new HttpError(400,'Date invalide.');
  const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value)throw new HttpError(400,'Date invalide.');return value;
}
function revisionInput(value) {if(!Number.isSafeInteger(value)||value<1)throw new HttpError(400,'Révision invalide.');return value;}
function projectInput(data,current=null) {
  fields(data,current?['revision','name','description','url','source','status','dueDate','notes','archived','accessStatus']:['name','description','url','source','status','dueDate','notes','accessStatus']);
  const value=(key,fallback)=>Object.hasOwn(data,key)?data[key]:fallback;
  const url=safeUrl(value('url',current?.url??''));
  const status=statusInput(value('status',current?.status??'À qualifier'),PROJECT_STATUSES);
  const archived=value('archived',!!current?.archived);if(typeof archived!=='boolean')throw new HttpError(400,'Archivage invalide.');
  let access=value('accessStatus',url===current?.url?(current?.access_status??'unknown'):'unknown');
  if(access==='public'&&PUBLIC_APP_URLS.has(url))access='unknown';
  if(!['unknown','protected'].includes(access))throw new HttpError(400,'L’accès public de cette application n’est pas vérifié.');
  return {name:textInput(value('name',current?.name),100,true),description:textInput(value('description',current?.description??''),600),url,source:safeUrl(value('source',current?.source??'')),status,dueDate:dateInput(value('dueDate',current?.due_date??null)),notes:notesInput(value('notes',current?.notes??'')),archived:Number(archived),access};
}
function taskInput(data,current=null) {
  fields(data,current?['revision','title','status','dueDate']:['title','status','dueDate']);
  return {title:textInput(data.title===undefined?current?.title:data.title,200,true),status:statusInput(data.status===undefined?(current?.status??'À faire'):data.status,TASK_STATUSES),dueDate:dateInput(data.dueDate===undefined?(current?.due_date??null):data.dueDate)};
}
const getProject = (env,id) => env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(id).first();
const getTask = (env,id) => env.DB.prepare('SELECT * FROM tasks WHERE id=?').bind(id).first();
async function requireProject(env,id) {const project=await getProject(env,id);if(!project)throw new HttpError(404,'Projet introuvable.');return project;}
function activeProject(project) {if(project.archived)throw new HttpError(409,'Restaurez ce projet avant de modifier ses tâches.');}
export async function handlePortal(req,env,fetcher=fetch) {
  const path=new URL(req.url).pathname;
  try {
    if(path==='/api/public/projects')return response({error:'Page introuvable.'},404);
    if(!path.startsWith('/api/'))return null;
    if(['/api/setup/check','/api/setup','/api/login'].includes(path)&&req.method==='POST'){
      sameOrigin(req,env);
      const data=await body(req);
      if(path!=='/api/setup/check')await rateLimit(req,env,path==='/api/login'?'login':'setup');
      if(path.startsWith('/api/setup')){
        await checkSetup(env,data.token);
        if(path==='/api/setup/check')return response({ok:true});
        const login=loginInput(data.login),password=await hashPassword(passwordInput(data.password)),version=random();
        const result=await env.DB.prepare("INSERT OR IGNORE INTO account (id,login,password,version,updated_at) VALUES ('owner',?,?,?,?)").bind(login,password,version,now()).run();
        if(!result.meta.changes)throw new HttpError(409,'Le compte est déjà créé. Connectez-vous.');
        return startSession(env,{login,version},data.remember);
      }
      const account=await env.DB.prepare("SELECT * FROM account WHERE id='owner'").first();
      const password=typeof data.password==='string'&&data.password.length<=256?data.password:'';
      const valid=await verifyPassword(password,account?.password);
      if(!valid||typeof data.login!=='string'||data.login.trim().toLowerCase()!==account?.login)throw new HttpError(401,'Identifiant ou mot de passe incorrect.');
      return startSession(env,account,data.remember);
    }
    const s=await session(req,env);
    if(path==='/api/me'&&req.method==='GET')return response({authenticated:!!s,login:s?.login||null,csrf:s?.csrf,configured:!!await env.DB.prepare("SELECT id FROM account WHERE id='owner'").first()});
    if(!s)throw new HttpError(401,'Connectez-vous à votre compte Papaye.');
    if(req.method!=='GET')authorizeWrite(req,env,s);
    if(path==='/api/logout'&&req.method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE hash=?').bind(s.hash).run();return response({ok:true});}
    if(path==='/api/password'&&req.method==='POST'){
      const data=await body(req);await rateLimit(req,env,'password');
      const account=await env.DB.prepare("SELECT * FROM account WHERE id='owner'").first();
      if(typeof data.currentPassword!=='string'||data.currentPassword.length>256||!await verifyPassword(data.currentPassword,account.password))throw new HttpError(400,'Le mot de passe actuel est incorrect.');
      const password=await hashPassword(passwordInput(data.password)),version=random();
      const result=await env.DB.prepare("UPDATE account SET password=?,version=?,updated_at=? WHERE id='owner' AND version=?").bind(password,version,now(),s.token).run();
      if(!result.meta.changes)throw new HttpError(409,'La session a changé. Reconnectez-vous.');
      return startSession(env,{login:account.login,version},data.remember);
    }
    if(path==='/api/projects'&&req.method==='GET'){const {results}=await env.DB.prepare('SELECT * FROM projects ORDER BY name COLLATE NOCASE').all();return response({projects:results.map(rowProject)});}
    if(path==='/api/tasks'&&req.method==='GET'){const {results}=await env.DB.prepare('SELECT * FROM tasks ORDER BY created_at,id').all();return response({tasks:results.map(rowTask)});}
    if(path==='/api/sync'&&req.method==='POST'){
      const repos=(await publicRepos(fetcher)).filter(r=>r.owner?.id===OWNER_ID&&!r.private&&r.name!=='papaye-labs'&&!r.fork&&!r.archived&&!r.disabled);
      // Complete all pages before touching the catalogue. No GitHub credential is used.
      const statements=[],sources=new Set();
      for(const r of repos){
        const source=`https://github.com/${OWNER}/${r.name}`;sources.add(source.toLowerCase());
        let url='';try{url=safeUrl(r.homepage);}catch{}
        if(url&&new URL(url).hostname==='github.com')url='';
        if(!url&&r.has_pages)url=`https://${OWNER.toLowerCase()}.github.io/${encodeURIComponent(r.name)}/`;
        const existing=await env.DB.prepare('SELECT * FROM projects WHERE lower(source)=lower(?)').bind(source).first();
        if(existing)statements.push(env.DB.prepare("UPDATE projects SET source_private=0,url=CASE WHEN url='' THEN ? ELSE url END,revision=revision+1,updated_at=? WHERE id=?").bind(url,now(),existing.id));
        else statements.push(env.DB.prepare('INSERT OR IGNORE INTO projects (id,name,description,url,source,source_private,visible,revision,updated_at) VALUES (?,?,?,?,?,0,0,1,?)').bind(`github-${r.id}`,r.name,String(r.description||'Projet GitHub.').slice(0,600),url,source,now()));
      }
      const {results}=await env.DB.prepare('SELECT * FROM projects WHERE source_private=0').all();
      for(const p of results)if(p.source.toLowerCase().startsWith(`https://github.com/${OWNER.toLowerCase()}/`)&&!sources.has(p.source.toLowerCase()))statements.push(env.DB.prepare('UPDATE projects SET source_private=1,visible=0,revision=revision+1,updated_at=? WHERE id=?').bind(now(),p.id));
      if(statements.length)await env.DB.batch(statements);
      return response({ok:true,count:repos.length});
    }
    if(path==='/api/projects'&&req.method==='POST'){
      const data=projectInput(await body(req)),id='link-'+crypto.randomUUID();
      await env.DB.prepare('INSERT INTO projects (id,name,description,url,source,source_private,visible,revision,updated_at,status,due_date,notes,archived,access_status) VALUES (?,?,?,?,?,1,0,1,?,?,?,?,0,?)').bind(id,data.name,data.description,data.url,data.source,now(),data.status,data.dueDate,data.notes,data.access).run();
      return response({project:rowProject(await getProject(env,id))},201);
    }
    const projectMatch=path.match(/^\/api\/projects\/([a-z0-9-]+)$/);
    if(projectMatch&&['GET','PATCH'].includes(req.method)){
      const id=projectMatch[1],current=await requireProject(env,id);
      if(req.method==='GET')return response({project:rowProject(current)});
      const raw=await body(req),revision=revisionInput(raw?.revision);
      if(revision!==current.revision)throw new HttpError(409,'Ce projet a changé dans une autre fenêtre. Rechargez la liste.');
      const data=projectInput(raw,current);
      const result=await env.DB.prepare('UPDATE projects SET name=?,description=?,url=?,source=?,source_private=CASE WHEN source<>? THEN 1 ELSE source_private END,status=?,due_date=?,notes=?,archived=?,access_status=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(data.name,data.description,data.url,data.source,data.source,data.status,data.dueDate,data.notes,data.archived,data.access,now(),id,revision).run();
      if(!result.meta.changes)throw new HttpError(409,'Ce projet a changé. Rechargez la liste.');
      return response({project:rowProject(await getProject(env,id))});
    }
    const projectTasks=path.match(/^\/api\/projects\/([a-z0-9-]+)\/tasks$/);
    if(projectTasks&&['GET','POST'].includes(req.method)){
      const id=projectTasks[1],project=await requireProject(env,id);
      if(req.method==='GET'){const {results}=await env.DB.prepare('SELECT * FROM tasks WHERE project_id=? ORDER BY created_at,id').bind(id).all();return response({tasks:results.map(rowTask)});}
      activeProject(project);const data=taskInput(await body(req)),taskId='task-'+crypto.randomUUID(),time=now();
      const result=await env.DB.prepare('INSERT INTO tasks (id,project_id,title,status,due_date,revision,created_at,updated_at) SELECT ?,id,?,?,?,1,?,? FROM projects WHERE id=? AND archived=0').bind(taskId,data.title,data.status,data.dueDate,time,time,id).run();
      if(!result.meta.changes)throw new HttpError(409,'Le projet a été archivé. Rechargez la liste.');
      return response({task:rowTask(await getTask(env,taskId))},201);
    }
    const taskMatch=path.match(/^\/api\/tasks\/([a-z0-9-]+)$/);
    if(taskMatch&&['PATCH','DELETE'].includes(req.method)){
      const id=taskMatch[1],current=await getTask(env,id);if(!current)throw new HttpError(404,'Tâche introuvable.');
      activeProject(await requireProject(env,current.project_id));
      const raw=await body(req),revision=revisionInput(raw?.revision);if(revision!==current.revision)throw new HttpError(409,'Cette tâche a changé dans une autre fenêtre. Rechargez la liste.');
      let result;
      if(req.method==='DELETE'){
        fields(raw,['revision']);result=await env.DB.prepare('DELETE FROM tasks WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM projects WHERE projects.id=tasks.project_id AND archived=0)').bind(id,revision).run();
      }else{
        const data=taskInput(raw,current);
        result=await env.DB.prepare('UPDATE tasks SET title=?,status=?,due_date=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM projects WHERE projects.id=tasks.project_id AND archived=0)').bind(data.title,data.status,data.dueDate,now(),id,revision).run();
      }
      if(!result.meta.changes)throw new HttpError(409,'La tâche ou son projet a changé. Rechargez la liste.');
      return response(req.method==='DELETE'?{ok:true}:{task:rowTask(await getTask(env,id))});
    }
    throw new HttpError(404,'Page introuvable.');
  }catch(e){return response({error:e instanceof HttpError?e.message:'Le service est momentanément indisponible.'},e instanceof HttpError?e.status:503);}
}
