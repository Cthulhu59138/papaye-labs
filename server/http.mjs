import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {readFileSync} from 'node:fs';
import {database} from './database.mjs';
import {handlePortal} from './portal.mjs';
import {QUESTIONNAIRE_PATH, QUESTIONNAIRE_BODY_LIMIT} from '../public/code-papaye-questionnaire.mjs';

export function createPortalServer(env) {
  const allowedHeaders=new Set(['authorization','content-type','x-csrf-token']);
  return createServer({requestTimeout:20000,headersTimeout:10000,maxHeaderSize:8192},async(req,res)=>{
    const origin=req.headers.origin;
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Vary','Origin');res.setHeader('X-Frame-Options','DENY');
    const fail=(status,error)=>{res.writeHead(status);res.end(JSON.stringify({error}));};
    if(origin&&origin!==env.APP_ORIGIN)return fail(403,'Origine non autorisée.');
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);
    if(req.method==='OPTIONS') {
      const requested=(req.headers['access-control-request-headers']||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
      if(!origin||requested.some(h=>!allowedHeaders.has(h)))return fail(403,'Origine ou en-têtes non autorisés.');
      res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-CSRF-Token');
      res.writeHead(204);return res.end();
    }
    if(req.url==='/health'&&req.method==='GET'){res.end('{"status":"ok","service":"papaye-api"}');return;}
    if(!req.url?.startsWith('/api/'))return fail(404,'Page introuvable.');
    if(!['GET','POST','PATCH','DELETE'].includes(req.method))return fail(405,'Méthode non autorisée.');
    const limit=req.method==='PATCH'&&req.url.split('?')[0]===QUESTIONNAIRE_PATH ? QUESTIONNAIRE_BODY_LIMIT : 48000;
    if(Number(req.headers['content-length']||0)>limit)return fail(413,'Contenu trop long.');
    try {
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>limit)return fail(413,'Contenu trop long.');chunks.push(chunk);}
      const headers=new Headers();
      for(const [key,value] of Object.entries(req.headers))if(typeof value==='string')headers.set(key,value);
      // The only listener is loopback. Tailscale's reverse proxy appends its client address.
      // Discard any attacker-supplied Cloudflare header and use the final valid proxy address.
      const forwarded=String(req.headers['x-forwarded-for']||'').split(',').at(-1)?.trim();
      headers.set('cf-connecting-ip',isIP(forwarded||'')?forwarded:req.socket.remoteAddress||'unknown');
      const request=new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
      const result=await handlePortal(request,env);
      if(!result)return fail(404,'Page introuvable.');
      for(const [key,value] of result.headers)if(!['access-control-allow-origin','vary'].includes(key))res.setHeader(key,value);
      res.writeHead(result.status);res.end(Buffer.from(await result.arrayBuffer()));
    } catch {if(!res.headersSent)fail(503,'Le service est momentanément indisponible.');else res.end();}
  });
}

if(process.argv[1]&&import.meta.url===new URL('file:///'+process.argv[1].replaceAll('\\','/').replace(/^\//,'')).href){
  const config=JSON.parse(readFileSync(process.env.PAPAYE_CONFIG||'/etc/papaye-api/config.json','utf8'));
  const DB=database(config.database||'/var/lib/papaye-api/catalogue.sqlite');
  const server=createPortalServer({...config,DB});
  server.listen(config.port||5293,'127.0.0.1',()=>console.log('Papaye API ready on loopback.'));
  const stop=()=>server.close(()=>{DB.sql.close();process.exit(0);});
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
