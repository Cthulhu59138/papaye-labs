// Local QA only. No production configuration, account or catalogue is loaded.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {database} from '../server/database.mjs';
import {createPortalServer} from '../server/http.mjs';
import {hashPassword} from '../server/password.mjs';

const port=4175,origin=`http://127.0.0.1:${port}`,DB=database(':memory:');
DB.sql.prepare('INSERT INTO account(id,login,password,version,updated_at) VALUES(?,?,?,?,?)').run('owner','recette',await hashPassword('papaye-recette-2026'),randomBytes(32).toString('base64url'),Math.floor(Date.now()/1000));
const api=createPortalServer({DB,APP_ORIGIN:origin});
const root=resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')||req.url==='/health'){api.emit('request',req,res);return;}
  res.setHeader('Cache-Control','no-store');
  if(req.url==='/portal.config.json'){res.setHeader('Content-Type','application/json');res.end('{"apiBase":""}');return;}
  try {
    let path=decodeURIComponent(new URL(req.url,origin).pathname);
    if(path.endsWith('/'))path+='index.html';
    const file=resolve(root,'.'+path);
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(file);res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(data);
  }catch{res.writeHead(404);res.end('Introuvable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Recette locale : ${origin} — compte fictif recette / papaye-recette-2026`));
const stop=()=>server.close(()=>{DB.sql.close();process.exit(0);});
process.on('SIGTERM',stop);process.on('SIGINT',stop);
