import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {handlePortal} from '../portal.mjs';
import {database} from '../database.mjs';
export const ORIGIN='https://portal.test';
export const PASSWORD='a simple local test phrase';
export const TOKEN='local-test-activation';
export function fixture(t, filename=':memory:') {
  const DB=database(filename),sql=DB.sql;
  t.after(()=>{try{sql.close();}catch{}});
  const env={APP_ORIGIN:ORIGIN,DB,SETUP_TOKEN_HASH:createHash('sha256').update(TOKEN).digest('base64url'),SETUP_EXPIRES:Math.floor(Date.now()/1000)+3600};
  const request=(path,{method='GET',cookie,csrf,data,from=ORIGIN}={})=>new Request(ORIGIN+path,{method,headers:{Origin:from,...(cookie?{Authorization:'Bearer '+cookie}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},...(data!==undefined?{body:JSON.stringify(data)}:{})});
  const call=(path,options,fetcher)=>handlePortal(request(path,options),env,fetcher||(()=>{throw Error('unexpected network')}));
  async function login() {
    const configured=!!sql.prepare('SELECT id FROM account').get();
    const end=await call(configured?'/api/login':'/api/setup',{method:'POST',data:{login:'Adrien',password:PASSWORD,token:TOKEN}});
    assert.equal(end.status,200,await end.clone().text());
    const identity=await end.clone().json();return {cookie:identity.sessionToken,csrf:identity.csrf,end};
  }
  async function create(s, overrides={}) {
    const r=await call('/api/projects',{...s,method:'POST',data:{name:'Mon projet',description:'Projet de test',...overrides}});
    assert.equal(r.status,201,await r.clone().text());return (await r.json()).project;
  }
  async function createTask(s,p,overrides={}) {
    const r=await call('/api/projects/'+p.id+'/tasks',{...s,method:'POST',data:{title:'Première action',...overrides}});
    assert.equal(r.status,201,await r.clone().text());return (await r.json()).task;
  }
  return {DB,sql,env,call,login,create,createTask};
}
