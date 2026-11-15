import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decks,media} from '../../public/explorateurs/content.js';
import {treeSubjects,treeMedia} from '../../public/explorateurs/tree-data.js';
import {animalMedia} from '../../public/explorateurs/animal-data.js';
import {createProfile,reviewCard,getQueue,validateState,saveState,loadState} from '../../public/explorateurs/engine.js';

const cards=decks.flatMap(d=>d.cards);
const fingerprint=bytes=>createHash('sha256').update(bytes).digest('hex');
test('40 cartes : 8 arbres × 4 vues indépendantes et 8 indices animaux',()=>{
 assert.equal(decks.length,2);assert.equal(decks[0].cards.length,32);assert.equal(decks[1].cards.length,8);
 assert.equal(new Set(cards.map(c=>c.id)).size,40);
 assert.equal(treeSubjects.length,8);
 assert.equal(new Set([...treeMedia,...animalMedia].map(m=>m.id)).size,treeMedia.length+animalMedia.length);
 assert.deepEqual(new Set(treeSubjects.map(s=>s.scientificName)),new Set(['Quercus robur','Fagus sylvatica','Betula pendula','Aesculus hippocastanum','Acer pseudoplatanus','Corylus avellana','Ilex aquifolium','Pinus sylvestris']));
 for(const s of treeSubjects){
  const group=cards.filter(c=>c.subjectId===s.id);
  assert.equal(group.length,4);assert.equal(new Set(group.map(c=>c.view)).size,4);
  for(const c of group) for(const id of [...c.questionMediaIds,...c.answerMediaIds]) assert.equal(media[id].scientificName,s.scientificName);
 }
 for(const c of cards){
  for(const key of ['answer','question','hint','fact','sourceUrl'])assert.ok(c[key]?.trim(),`${c.id}: ${key}`);
  assert.equal(c.questionMediaIds.length,2,c.id);
  assert.equal(new Set(c.questionMediaIds).size,2,c.id);
  assert.ok(c.answerMediaIds.length>=2,c.id);
  for(const id of [...c.questionMediaIds,...c.answerMediaIds]) assert.ok(media[id],`média absent ${id}`);
 }
});
test('photos locales réelles et variantes distinctes, crédits complets',async()=>{
 const bytes=new Map();
 for(const [id,m] of Object.entries(media)){
  assert.equal(id,m.id);assert.match(m.src,/^assets\/photos\/(trees|animals)\/[a-zA-Z0-9_-]+\.webp$/);
  for(const key of ['alt','caption','author','license','licenseUrl','sourceUrl'])assert.ok(m[key]?.trim(),`${id}: ${key}`);
  assert.match(m.license,/^(CC[ -]?(0|BY(?:-SA)?)(?: [0-9.]+)?|public domain|domaine public)$/i,`${id}: licence`);
  for(const key of ['licenseUrl','sourceUrl'])assert.equal(new URL(m[key]).protocol,'https:');
  const b=await readFile(new URL(`../../public/explorateurs/${m.src}`,import.meta.url));
  assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
  assert.ok(b.length>1000,`${id}: photo vide`);bytes.set(id,b);
 }
 for(const c of cards){
  assert.notEqual(fingerprint(bytes.get(c.questionMediaIds[0])),fingerprint(bytes.get(c.questionMediaIds[1])),`${c.id}: clichés identiques`);
  assert.notEqual(media[c.questionMediaIds[0]].sourceUrl,media[c.questionMediaIds[1]].sourceUrl,`${c.id}: même original`);
 }
});
test('question sans nom de réponse dans le texte alternatif',()=>{
 const words={ 'Quercus robur':['chêne','quercus'], 'Fagus sylvatica':['hêtre','fagus'], 'Betula pendula':['bouleau','betula'], 'Aesculus hippocastanum':['marronnier','aesculus'], 'Acer pseudoplatanus':['érable','acer'], 'Corylus avellana':['noisetier','corylus'], 'Ilex aquifolium':['houx','ilex'], 'Pinus sylvestris':['pin sylvestre','pinus'] };
 for(const c of cards){
  const banned=words[c.scientificName]??[c.id];
  for(const id of c.questionMediaIds)for(const word of banned)assert.ok(!media[id].alt.toLowerCase().includes(word),`${c.id}: réponse dans alt`);
 }
});
test('ancienne sauvegarde : XP, badges et historique préservés, nouvelles vues non maîtrisées',()=>{
 const now=Date.UTC(2026,10,15,12);let p=createProfile('Ancien joueur');
 for(const id of ['chene','hetre','bouleau','marronnier','renard']) p=reviewCard(p,id,'good',now);
 const old={version:1,activeProfileId:p.id,profiles:[p]};
 const backing=new Map();const storage={getItem:k=>backing.get(k)??null,setItem:(k,v)=>backing.set(k,v)};
 saveState(old,storage);const restored=loadState(storage);assert.deepEqual(restored,validateState(old));
 assert.equal(restored.profiles[0].xp,70);assert.ok(restored.profiles[0].badges.includes('first-review'));
 assert.ok(restored.profiles[0].reviews.chene);assert.ok(restored.profiles[0].reviews.renard);
 for(const c of decks[0].cards)assert.equal(restored.profiles[0].reviews[c.id],undefined);
 assert.ok(!getQueue(restored.profiles[0],decks[1].cards,now).some(c=>c.id==='renard'));
 assert.equal(restored.profiles[0].reviews.renard.due,p.reviews.renard.due);
 assert.equal(getQueue(restored.profiles[0],decks[0].cards,now).length,5);
});
