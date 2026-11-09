import test from 'node:test';
import assert from 'node:assert/strict';
import {GAMES,newSession,makeQuestion,act,nextRound,tensMove,tensTotal,marketSolutions,payment,robotPath,simulateRobot,validSession,hint} from '../public/malomatix/engine.mjs';
import {freshData,parseData,recordRun} from '../public/malomatix/storage.mjs';
function rng(seed){return ()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
function solve(s){const q=s.question;if(s.game==='flash')s=act(s,'observe');if(['compare','flash','calculation','sequence'].includes(s.game))return act(s,'answer',q.answer);if(s.game==='puzzle'){for(const n of q.missing){s=act(s,'piece',n);s=act(s,'place',n);}return s;}if(s.game==='market'){for(const i of marketSolutions(q)[0])s=act(s,'coin',i);return s;}if(s.game==='robot'){for(const dir of robotPath(q))s=act(s,'arrow',dir);return act(s,'launch');}while(s.status==='playing'){if(s.question.units>=10)s=act(s,'tens','group');else if(tensTotal(s.question)<q.target)s=act(s,'tens',q.target-tensTotal(s.question)>=10?'add10':'add1');else if(tensTotal(s.question)>q.target)s=act(s,'tens',s.question.units>0?'remove1':'remove10');else throw Error('Unsolvable tens');}return s;}
test('800 sessions complètes : huit jeux, deux profils, limites, choix et victoire en cinq manches',()=>{
 for(const profile of ['child','adult'])for(const g of GAMES)for(let seed=1;seed<=50;seed++){
  const random=rng(seed),options={level:1+seed%3,operation:seed%2?'add':'subtract',variant:['more','less','equal'][seed%3]};let s=newSession(g.id,profile,options,random);
  for(let round=0;round<5;round++){
   assert.ok(validSession(s),`${g.id} ${profile} ${round}`);assert.equal(s.round,round);
   if(s.question.choices){assert.equal(new Set(s.question.choices).size,3);assert.ok(s.question.choices.includes(s.question.answer));}
   if(g.id==='robot'){assert.ok(robotPath(s.question).length<=(profile==='child'?6:8));assert.equal(simulateRobot(s.question,robotPath(s.question)).success,true);}
   const original=structuredClone(s);const solved=solve(s);assert.deepEqual(s,original);s=solved;assert.equal(s.status,'feedback',g.id);assert.equal(s.feedback.correct,true);assert.ok(validSession(s));assert.deepEqual(act(s,'answer',123),s);s=nextRound(s,random);
  }
  assert.equal(s.status,'done');assert.equal(s.correct,5);assert.ok(validSession(s));
 }
});
test('les échanges de dizaines conservent la quantité et aucune action ne dépasse 20',()=>{
 for(let packs=0;packs<=2;packs++)for(let units=0;units<=20-packs*10;units++)for(const action of ['add1','remove1','add10','remove10','group','ungroup']){const q={target:12,packs,units},out=tensMove(q,action);assert.ok(tensTotal(out)>=0&&tensTotal(out)<=20);assert.ok(out.units>=0&&out.packs>=0);if(['group','ungroup'].includes(action))assert.equal(tensTotal(out),tensTotal(q));}
 let s=newSession('tens');s.question={target:10,packs:0,units:10};assert.equal(s.status,'playing');s=act(s,'tens','group');assert.equal(s.status,'feedback');assert.equal(s.question.packs,1);
});
test('marché : toutes les combinaisons exactes, surplus corrigible et aide convergente',()=>{
 for(let seed=1;seed<=40;seed++){const s=newSession('market','adult',{},rng(seed));for(const selected of marketSolutions(s.question)){const copy=structuredClone(s);copy.question.selected=selected.slice(0,-1);assert.equal(act(copy,'coin',selected.at(-1)).status,'feedback');}}
 let s=newSession('market');s.question={target:6,wallet:[5,2,1],selected:[],item:0};s=act(act(s,'coin',0),'coin',1);assert.equal(payment(s.question),7);assert.equal(s.status,'playing');assert.match(hint(s),/retirer.*2/);s=act(act(s,'coin',1),'coin',2);assert.equal(s.status,'feedback');
});
test('robot : collisions, bords, détours et nécessité de finir sur la fleur',()=>{
 const q={size:3,start:0,goal:8,stones:[],program:[]};assert.equal(simulateRobot(q,['right','right','down','down']).success,true);assert.equal(simulateRobot(q,['down','down','right','right']).success,true);assert.equal(simulateRobot(q,['right','right','right']).blocked,true);assert.equal(simulateRobot(q,['up']).blocked,true);assert.equal(simulateRobot(q,['right','right','down','down','left']).success,false);assert.equal(simulateRobot({...q,stones:[1]},['right']).blocked,true);assert.equal(simulateRobot(q,[]).success,false);
 let s=newSession('robot');for(let i=0;i<20;i++)s=act(s,'arrow','right');assert.equal(s.question.program.length,6);assert.equal(act(s,'erase').question.program.length,5);
});
test('pause/reprise conserve les manipulations, profils et récompense unique après rechargement',()=>{
 for(const g of GAMES){let d=freshData(),s=newSession(g.id);if(g.id==='robot')s=act(s,'arrow','down');if(g.id==='market')s=act(s,'coin',0);if(g.id==='tens')s=act(s,'tens','add1');if(g.id==='puzzle')s=act(s,'piece',s.question.missing[0]);d=recordRun(d,s);assert.deepEqual(parseData(JSON.stringify(d)),d);}
 let d=freshData(),s=newSession('calculation');for(let i=0;i<5;i++)s=nextRound(solve(s));d=recordRun(d,s);assert.equal(d.profiles.child.completed,1);d=recordRun(parseData(JSON.stringify(d)),s);assert.equal(d.profiles.child.completed,1);assert.deepEqual(d.profiles.child.memories,['calculation']);assert.equal(d.profiles.adult.completed,0);
});
test('restauration invalide : rejet des ateliers impossibles et des données mal formées',()=>{
 assert.deepEqual(parseData('no json'),freshData());for(const id of ['tens','market','robot','puzzle']){const s=newSession(id);if(id==='tens')s.question.units=21;if(id==='market')s.question.selected=[999];if(id==='robot')s.question.program=['teleport'];if(id==='puzzle')s.question.placed=[99];assert.equal(validSession(s),false);const d=freshData();d.profiles.child.run=s;assert.equal(parseData(JSON.stringify(d)).profiles.child.run,null);}
});
test('flash ne répond pas avant observation ; réponse fausse explicative puis poursuite',()=>{
 let s=newSession('flash');assert.equal(act(s,'answer',s.question.answer).status,'playing');s=act(s,'observe');s=act(s,'answer',s.question.choices.find(n=>n!==s.question.answer));assert.equal(s.feedback.correct,false);assert.equal(s.correct,0);assert.equal(nextRound(s).round,1);
});
