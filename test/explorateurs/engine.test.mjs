import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code = await readFile(new URL('../../public/explorateurs/engine.js', import.meta.url), 'utf8');
const {createProfile, getQueue, reviewCard, getStats, validateState, loadState, saveState, STORAGE_KEY, dayKey} = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const NOW = new Date(2026,10,14,12).getTime();
const DAY=86400000;
const cards=Array.from({length:30},(_,i)=>({id:`card-${i}`}));
const stateOf=p=>({version:1,activeProfileId:p.id,profiles:[p]});
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),data};};
test('nouveaux, échéances, intervalles et immutabilité',()=>{
 const p=createProfile(' Zoé '); assert.equal(p.name,'Zoé');
 assert.equal(getQueue(p,cards,NOW).length,5);
 const p1=reviewCard(p,'card-0','good',NOW);
 assert.deepEqual(p.reviews,{}); assert.equal(p1.reviews['card-0'].interval,DAY);
 assert.equal(getQueue(p1,[cards[0]],NOW+DAY-1).length,0);
 assert.equal(getQueue(p1,[cards[0]],NOW+DAY).length,1);
 assert.throws(()=>reviewCard(p1,'card-0','easy',NOW+1));
 const p2=reviewCard(p1,'card-0','good',NOW+DAY);
 assert.equal(p2.reviews['card-0'].interval,2*DAY);
 const p3=reviewCard(p2,'card-0','easy',NOW+3*DAY);
 assert.equal(p3.reviews['card-0'].interval,5*DAY);
});
test('again revient après dix minutes, sans doubler les XP',()=>{
 const p=reviewCard(createProfile('Papa'),'card-0','again',NOW);
 assert.equal(p.reviews['card-0'].due,NOW+600000); assert.equal(p.xp,10);
 const p2=reviewCard(p,'card-0','good',NOW+600000);
 assert.equal(p2.xp,10); assert.equal(p2.daily[dayKey(NOW)].count,1);
 assert.equal(p2.reviews['card-0'].interval,DAY);
});
test('échéances prioritaires sur les nouvelles, plafond de session',()=>{
 let p=reviewCard(createProfile('Papa'),'card-8','good',NOW);
 p=reviewCard(p,'card-9','again',NOW);
 const q=getQueue(p,cards,NOW+DAY);
 assert.deepEqual(q.slice(0,2).map(x=>x.id),['card-9','card-8']);
 assert.equal(q.length,5);
});
test('bonus objectif unique et badges calculés',()=>{
 let p=createProfile('Papa');
 for(let i=0;i<5;i++)p=reviewCard(p,`card-${i}`,'again',NOW);
 assert.equal(p.xp,70); assert.equal(p.daily[dayKey(NOW)].goalAwarded,true);
 p=reviewCard(p,'card-0','good',NOW+600000); assert.equal(p.xp,70);
 for(let i=5;i<8;i++)p=reviewCard(p,`card-${i}`,'good',NOW+600000);
 assert.equal(p.xp,100);assert.deepEqual(p.badges,['first-review','hundred-xp']);
});
test('minuit local, trois jours actifs et profils indépendants',()=>{
 const before=new Date(2026,10,14,23,59).getTime();
 const after=new Date(2026,10,15,0,10).getTime();
 let a=createProfile('A'),b=createProfile('B');
 a=reviewCard(a,'card-0','again',before);
 a=reviewCard(a,'card-0','again',after);
 assert.equal(a.daily['2026-11-14'].count,1);assert.equal(a.daily['2026-11-15'].count,1);
 assert.equal(a.xp,20);assert.equal(b.xp,0);assert.deepEqual(b.reviews,{});
 a=reviewCard(a,'card-0','good',after+DAY);
 assert.ok(a.badges.includes('three-days'));
});
test('plafond à 180 jours',()=>{
 let p=createProfile('A'),now=NOW;
 for(let i=0;i<12;i++){
  p=reviewCard(p,'card-0','easy',now);now=p.reviews['card-0'].due;
 }
 assert.equal(p.reviews['card-0'].interval,180*DAY);
});
test('statistiques par deck et prochain rappel',()=>{
 let p=reviewCard(createProfile('A'),'card-0','good',NOW);
 const stats=getStats(p,cards,NOW);
 assert.equal(stats.newCount,29);assert.equal(stats.learned,1);assert.equal(stats.due,0);
 assert.equal(stats.nextDue,NOW+DAY);assert.equal(stats.todayCount,1);
 assert.equal(getStats(p,[cards[1]],NOW).nextDue,null);
});
test('aller-retour stockage et absence sans écrasement',()=>{
 const store=memory(),initial=loadState(store);
 assert.equal(store.data.size,0); assert.equal(initial.profiles.length,1);
 let p=reviewCard(initial.profiles[0],'card-0','good',NOW);
 const state=stateOf(p);saveState(state,store);
 assert.deepEqual(loadState(store),state);
 const copy=validateState(state);copy.profiles[0].name='Autre';assert.notEqual(copy.profiles[0].name,state.profiles[0].name);
});
test('corruption et stockage refusé ne sont pas masqués',()=>{
 const store=memory();store.setItem(STORAGE_KEY,'{');assert.throws(()=>loadState(store));assert.equal(store.getItem(STORAGE_KEY),'{');
 assert.throws(()=>saveState(stateOf(createProfile('A')),{setItem(){throw Error('quota');}}),/quota/);
 assert.throws(()=>loadState(null));
});
test('imports invalides sans écriture, profils dupliqués, bornes',()=>{
 const p=createProfile('A'),state=stateOf(p),store=memory();
 for(const value of [null,{}, {...state,version:2},{...state,activeProfileId:'absent'}, {...state,profiles:[p,p]}, {...state,profiles:[{...p,goal:0}]}, {...state,profiles:[{...p,xp:Infinity}]}]){
  assert.throws(()=>saveState(value,store));
 }
 assert.equal(store.data.size,0);
 assert.throws(()=>createProfile(' '));assert.throws(()=>createProfile('a'.repeat(25)));
 const bad=JSON.parse(JSON.stringify(state));bad.profiles[0].reviews['__proto__']={};
 assert.throws(()=>validateState(bad));
});
test('changement objectif ne renouvelle pas le bonus obtenu',()=>{
 let p=createProfile('A');
 for(let i=0;i<5;i++)p=reviewCard(p,`card-${i}`,'again',NOW);
 assert.equal(p.xp,70);
 p={...p,goal:10};
 for(let i=5;i<10;i++)p=reviewCard(p,`card-${i}`,'good',NOW);
 assert.equal(p.xp,120);assert.equal(p.daily[dayKey(NOW)].goalAwarded,true);
});
test('badge douze cartes accessible dans les seize cartes',()=>{
 let p=createProfile('A');
 for(let i=0;i<12;i++)p=reviewCard(p,`card-${i}`,'good',NOW);
 assert.ok(p.badges.includes('twelve-cards'));
 assert.ok(!p.badges.includes('twenty-cards'));
 assert.doesNotThrow(()=>validateState(stateOf(p)));
});
test('refuse dates, clés et historiques incohérents',()=>{
 assert.throws(()=>reviewCard(createProfile('A'),'constructor','good',NOW));
 assert.throws(()=>reviewCard(createProfile('A'),'card-0','good',Infinity));
 assert.throws(()=>reviewCard(createProfile('A'),'card-0','good',Date.UTC(2500,0,1)));
 const p=reviewCard(createProfile('A'),'card-0','good',NOW);
 const corrupt=stateOf(structuredClone(p));corrupt.profiles[0].reviews['card-0'].due+=1;
 assert.throws(()=>validateState(corrupt));
 const history=stateOf(structuredClone(p));history.profiles[0].daily[dayKey(NOW)].cardIds.push('card-0');
 assert.throws(()=>validateState(history));
});
