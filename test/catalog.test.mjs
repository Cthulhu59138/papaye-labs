import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderCards,httpsUrl} from '../public/catalog.mjs';
test('public project rendering escapes external text and rejects unsafe links',()=>{const p={id:'example',name:'<script>',category:'App',description:'<img onerror=x>',url:'https://example.test',tags:[]};const html=renderCards([p]);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.throws(()=>renderCards([{...p,url:'javascript:alert(1)'}]));assert.equal(httpsUrl('https://user:secret@example.test'),null);});
test('public browser only uses the curated service, with no repo discovery or stale project cache',async()=>{const js=await readFile('public/catalog-ui.mjs','utf8');assert.ok(js.includes('config.endpoint'));assert.ok(!js.includes('api.github.com'));assert.ok(!js.includes('setItem'));assert.ok(js.includes("cache:'no-store'"));});
test('Scoubi is hosted locally without an authentication dependency or personal name',async()=>{const html=await readFile('public/scoubi/index.html','utf8');assert.ok(html.includes('Scoubi Club'));assert.ok(!/malo|signin-with-chatgpt|atelier-scoubidou-malo/i.test(html));for(const file of ['app.mjs','lesson.mjs','diagrams.mjs','style.css'])assert.ok((await readFile('public/scoubi/'+file,'utf8')).length>100);});
