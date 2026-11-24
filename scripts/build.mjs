import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
const config=JSON.parse(await readFile('portal.config.json','utf8'));
const endpoint=new URL(config.apiBase);
if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.pathname!=='/'||endpoint.search||endpoint.hash)throw Error('L’API de production doit être une origine HTTPS.');
// A clean build cannot retain an old catalogue or deployment artefact.
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true,filter:source=>!['catalog-ui.mjs','catalog.mjs'].includes(source.split('/').at(-1))});
// Keep previously shared downloads and assets available at their original addresses.
await cp('public/pap','dist/dmp',{recursive:true,filter:source=>source!=='public/pap/index.html'});
await writeFile('dist/portal.config.json',JSON.stringify({apiBase:endpoint.origin})+'\n');
await writeFile('dist/.nojekyll','');
console.log('Papaye Labs : tableau de bord authentifié et applications autonomes.');
