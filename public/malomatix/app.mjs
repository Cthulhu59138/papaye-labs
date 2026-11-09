import {GAMES,newSession,act,nextRound,hint,simulateRobot} from './engine.mjs';
import {STORAGE_KEY,freshData,parseData,recordRun} from './storage.mjs';
import {button,esc,home,memories,game} from './views.mjs';
const main=document.querySelector('#main'),modal=document.querySelector('#modal');
let data=freshData(),storageFailed=false,view='home',timer=null,pendingGame=null;
let effects={flashVisible:false,animating:false,robotPosition:null};
try{data=parseData(localStorage.getItem(STORAGE_KEY));}catch{storageFailed=true;}
const player=()=>data.profiles[data.profile],run=()=>player().run;
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch{storageFailed=true;}}
function stopEffects(){clearTimeout(timer);timer=null;effects={flashVisible:false,animating:false,robotPosition:null};}
function writeRun(s){data=recordRun(data,s);save();}
function modalContent(title,content){modal.innerHTML=`<div class="modal-heading"><h2 id="modal-title">${title}</h2>${button('×','close','','close-button','aria-label="Fermer"')}</div>${content}`;if(!modal.open)modal.showModal();}
function render(focus=false){document.body.dataset.theme=data.theme;if(view==='play'&&!run())view='home';main.innerHTML=view==='home'?home(data,storageFailed):view==='memories'?memories(data):game(run(),effects);if(focus){main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}}
function start(id,options={}){stopEffects();writeRun(newSession(id,data.profile,{level:data.level,...options}));view='play';modal.close();render(true);}
function choose(id){if(run()&&run().status!=='done'){pendingGame=id;modalContent('Une partie t’attend',`<p>Tu as une partie de ${esc(GAMES.find(g=>g.id===run().game).name)} en cours. La remplacer effacera seulement cette partie ; tes souvenirs restent dans le carnet.</p><div class="modal-buttons">${button('Reprendre ma partie','resume','','primary')}${button('Commencer un autre jeu','replace','','quiet')}</div>`);return;}configureGame(id);}
function configureGame(id){if(id==='compare'){modalContent('Que veux-tu comparer ?',`<p>Le même défi pendant cinq manches. Choisis ce que tu veux observer.</p><div class="option-grid">${button('Le plus','start-compare','more','option')}${button('Le moins','start-compare','less','option')}${button('Autant ?','start-compare','equal','option')}</div>`);}else if(id==='calculation'){modalContent('On compte ensemble ?',`<p>Les jetons sont là pour t’aider. Choisis une opération pour ta partie.</p><div class="option-grid">${button('+ Additionner','start-calc','add','option')}${button('− Soustraire','start-calc','subtract','option')}</div>`);}else start(id);}
function settings(){modalContent('Chacun son rythme',`<p>Deux profils, chacun son carnet. Les parties restent sur ce navigateur.</p><h3>Qui joue ?</h3><div class="option-grid">${button('🌱 Enfant','profile','child','option',`aria-pressed="${data.profile==='child'}"`)}${button('⚡ Adulte','profile','adult','option',`aria-pressed="${data.profile==='adult'}"`)}</div><h3>Le départ des prochaines parties</h3><div class="option-grid">${[1,2,3].map((n,i)=>button(['Tout doux','Curieux','Explorateur'][i],'level',n,'option',`aria-pressed="${data.level===n}"`)).join('')}</div><p class="small-note">Le niveau joue sur Comparer, Flash, Suites et Puzzles. Les nouveaux ateliers restent jusqu’à 20. Une partie en cours garde ses réglages.</p><h3>L’ambiance</h3><div class="option-grid">${[['prairie','🌿 Prairie'],['ocean','🌊 Océan'],['safari','☀ Safari']].map(([v,t])=>button(t,'theme',v,'option',`aria-pressed="${data.theme===v}"`)).join('')}</div>${button('C’est parti !','close','','primary modal-done')}`);}
function observe(){if(run()?.game!=='flash'||run().status!=='playing'||effects.flashVisible)return;stopEffects();if(run().question.observed)writeRun(act(run(),'help'));effects.flashVisible=true;render();const id=run().id,round=run().round;timer=setTimeout(()=>{if(view!=='play'||run()?.id!==id||run()?.round!==round)return;effects.flashVisible=false;writeRun(act(run(),'observe'));render();main.querySelector('.answer')?.focus();},2000);}
function launch(){if(!run()?.question.program.length||effects.animating)return;const s=act(run(),'launch');writeRun(s);const trace=simulateRobot(s.question).trace;if(matchMedia('(prefers-reduced-motion: reduce)').matches){render();return;}effects.animating=true;let i=0;effects.robotPosition=trace[0];render();const id=s.id,round=s.round;const tick=()=>{if(view!=='play'||run()?.id!==id||run()?.round!==round)return;i++;if(i>=trace.length){stopEffects();render();if(run().status==='feedback')main.querySelector('[data-action="next"]')?.focus();return;}effects.robotPosition=trace[i];render();timer=setTimeout(tick,350);};timer=setTimeout(tick,350);}
document.addEventListener('click',event=>{const el=event.target.closest('button[data-action]');if(!el||el.disabled)return;const a=el.dataset.action,v=el.dataset.value;
 if(a==='close'){modal.close();return;}
 if(a==='settings'){stopEffects();if(view==='play')render();settings();return;}
 if(a==='about'){stopEffects();if(view==='play')render();modalContent('Les petits détails',`<p><strong>Malomatix — bêta web 0.1.</strong> Huit jeux adaptés de Malomatix Android J8, jouables au clavier et au toucher, sans installation.</p><p>Aucun compte, publicité ni outil de suivi. Profils anonymes, parties et souvenirs sont enregistrés localement dans ce navigateur. Ils ne sont pas envoyés à un serveur et ne se synchronisent pas avec l’APK Android ou un autre appareil. Effacer les données du navigateur les supprime.</p><p>Cette adaptation web reprend les huit jeux et leurs premières règles ; les options avancées et le code parent Android ne sont pas reproduits. Le profil adulte web est librement sélectionnable. Une connexion est nécessaire pour charger le jeu ; le mode hors ligne n’est pas garanti.</p><p>Choisir un niveau, prendre le temps, demander de l’aide : il n’y a pas de score affiché à l’enfant ni de limite de parties. Les sensations et la difficulté restent à apprécier en jouant.</p><p class="small-note">Créé chez Papaye Labs. <a href="/">Explorer les autres projets ↗</a></p>`);return;}
 if(a==='home'||a==='pause'){stopEffects();view='home';modal.close();render(true);return;}
 if(a==='memories'){stopEffects();view='memories';render(true);return;}
 if(a==='resume'){stopEffects();view='play';modal.close();render(true);return;}
 if(a==='profile'){stopEffects();data.profile=v==='adult'?'adult':'child';view='home';save();render();settings();return;}
 if(a==='level'){data.level=Number(v);save();settings();return;}
 if(a==='theme'){data.theme=v;save();render();settings();return;}
 if(a==='choose'){choose(v);return;}
 if(a==='replace'){player().run=null;save();configureGame(pendingGame);return;}
 if(a==='start-compare'){start('compare',{variant:v});return;}
 if(a==='start-calc'){start('calculation',{operation:v});return;}
 if(a==='again'){start(run().game,run().options);return;}
 if(view!=='play'||!run())return;
 if(a==='next'){stopEffects();writeRun(nextRound(run()));render(true);return;}
 if(a==='help'){stopEffects();writeRun(act(run(),'help'));render();modalContent('Un petit coup de pouce',`<p class="hint-text">${esc(hint(run()))}</p>${button('Je réessaie !','close','','primary')}`);return;}
 if(a==='observe'){observe();return;}
 if(a==='launch'){launch();return;}
 if(effects.animating)return;
 const numberAction=['coin','piece','place'].includes(a)||(a==='answer'&&['flash','calculation'].includes(run().game))||(a==='answer'&&run().game==='sequence'&&run().question.kind!=='shapes');
 writeRun(act(run(),a,numberAction?Number(v):v));render();if(run().status==='feedback')main.querySelector('[data-action="next"]')?.focus();else main.querySelector(`[data-action="${a}"][data-value="${v}"]`)?.focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&(effects.flashVisible||effects.animating)){stopEffects();render();}});
window.addEventListener('pagehide',stopEffects);
render();
