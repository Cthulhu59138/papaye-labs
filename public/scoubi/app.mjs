import {palette,lessons,KEY,freshState,restoreState} from './lesson.mjs';
import {stitchScene,preparationScene,tunnelScene,scoubiArt} from './diagrams.mjs';
const icons={arrow:'M5 12h14m-6-6 6 6-6 6',back:'M19 12H5m6-6-6 6 6 6',play:'m8 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',replay:'M4 10a8 8 0 1 1 0 5M4 4v6h6',sound:'M11 5 6 9H3v6h3l5 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',heart:'M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-4 5 2 10 8 14 6-4 12-9 8-14Z',check:'m5 12 4 4L19 6',tag:'M3 3h9l9 9-9 9-9-9Zm4 4h.01',zoom:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM15 15l6 6M7 10h6m-3-3v6',hand:'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 6-9 8-12 4l-5-6a2 2 0 0 1 3-3l2 2',turtle:'M6 17a6 6 0 0 1 0-12h4a6 6 0 0 1 6 6v6ZM16 12h3a2 2 0 1 1 0 4h-3M5 17v3m7-3v3M2 10H0',print:'M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6Z'};
export function icon(name){return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.arrow}"/></svg>`;}
export function createApp(doc=window.document,win=window){
  const $=s=>doc.querySelector(s); const $$=s=>[...doc.querySelectorAll(s)];
  let saved;try{saved=win.localStorage.getItem(KEY);}catch{}
  let state=restoreState(saved),view='home',frame=0,motion=1,playing=false,zoomed=false,speechToken=0,speaking=false;
  const reduced=()=>win.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const colors=()=>state.colors.map(i=>palette[i].hex);
  const save=()=>{try{win.localStorage.setItem(KEY,JSON.stringify(state));}catch{}};
  const countLabel=()=>`${state.rounds} tour${state.rounds>1?'s':''} réussi${state.rounds>1?'s':''}`;
  const fillIcons=root=>root.querySelectorAll('[data-icon]').forEach(n=>{n.innerHTML=icon(n.dataset.icon);});
  fillIcons(doc);
  function speechMessage(message){$('#speech-status').textContent=message;$('#global-status').textContent=message;$('#global-status').hidden=!message||view==='lesson';}
  function stopSpeech(){speechToken++;speaking=false;if('speechSynthesis' in win)win.speechSynthesis.cancel();$('#listen').innerHTML=icon('sound')+' Écouter';}
  function speak(text){
    stopSpeech();speechMessage('');
    if(!win.speechSynthesis||!win.SpeechSynthesisUtterance){speechMessage('La voix n’est pas disponible sur cet appareil. Un grand peut te lire la consigne.');return;}
    const token=speechToken,utterance=new win.SpeechSynthesisUtterance(text);utterance.lang='fr-FR';utterance.rate=.82;utterance.pitch=1.04;
    const voice=win.speechSynthesis.getVoices().find(v=>v.lang.startsWith('fr'));if(voice)utterance.voice=voice;
    utterance.onend=()=>{if(token!==speechToken)return;speaking=false;$('#listen').innerHTML=icon('sound')+' Réécouter';};
    utterance.onerror=e=>{if(token!==speechToken)return;speaking=false;$('#listen').innerHTML=icon('sound')+' Écouter';if(!['canceled','interrupted'].includes(e.error))speechMessage('La voix n’a pas démarré. Réessaie, ou lis la consigne avec un grand.');};
    speaking=true;$('#listen').innerHTML=icon('pause')+' Arrêter';win.speechSynthesis.speak(utterance);
  }
  function speakStep(){const s=lessons[state.step];speak(`${s.title} ${s.body} ${s.hint}`);}
  function stopMotion(){if(frame)win.cancelAnimationFrame(frame);frame=0;playing=false;$('#play').innerHTML=icon('replay');$('#play').setAttribute('aria-label','Rejouer le geste');}
  function sceneAt(t){
    motion=t;const s=lessons[state.step];
    $('#scene').innerHTML=typeof s.scene==='number'?stitchScene(s.scene,t,colors(),s.active||0):preparationScene(s.scene,t,colors());
    if(s.zoom)$('#zoom-inset').innerHTML=`<p class="inset-caption">GROS PLAN · VU DE CÔTÉ</p>${tunnelScene(colors(),t)}`;
    $('#timeline').value=String(Math.round(t*100));$('#play-status').textContent=playing?'Regarde le mouvement':t===1?'À toi de jouer':'En pause';
  }
  function canAnimate(){const s=lessons[state.step];return typeof s.scene==='number'||s.scene==='fold';}
  function playAnimation(from=0){
    if(!canAnimate()){sceneAt(1);return;}
    stopMotion();playing=true;$('#play').innerHTML=icon('pause');$('#play').setAttribute('aria-label','Mettre la démonstration en pause');
    const duration=state.slow?5800:3000;let start;
    const tick=now=>{if(start===undefined)start=now;const t=Math.min(1,from+(now-start)/duration);sceneAt(t);if(t<1)frame=win.requestAnimationFrame(tick);else{stopMotion();sceneAt(1);}};
    sceneAt(from);frame=win.requestAnimationFrame(tick);
  }
  function voiceUI(){$('#voice-toggle').setAttribute('aria-pressed',String(state.voice));$('#voice-label').textContent=state.voice?'Voix activée':'Voix';}
  function homeUI(){
    const c=colors();doc.documentElement.style.setProperty('--a',c[0]);doc.documentElement.style.setProperty('--b',c[1]);$('#hero-art').innerHTML=scoubiArt(c,10,true);
    ['a','b'].forEach((name,role)=>{$('#color-name-'+name).textContent='Fil '+palette[state.colors[role]].name;$('#palette-'+name).innerHTML=palette.map((color,i)=>`<button class="swatch" data-palette="${role}" data-color="${i}" aria-label="${color.name}, fil ${role+1}" aria-pressed="${state.colors[role]===i}" style="--swatch:${color.hex}" ${state.colors[1-role]===i?'disabled':''}></button>`).join('');});
    $$('[data-material]').forEach(b=>b.setAttribute('aria-pressed',String(state.materials[Number(b.dataset.material)])));
    $('#ready-message').textContent=state.materials.every(Boolean)?'Tout est prêt. À toi de créer !':'Touche ce que tu as préparé.';
    $('#resume').hidden=!state.started;$('#resume').innerHTML=state.finished?'Revoir mon diplôme '+icon('check'):'Reprendre mon atelier '+icon('play');
    $('#start').innerHTML=state.started?'Reprendre mon atelier '+icon('arrow'):'On commence ! '+icon('arrow');voiceUI();
  }
  function setView(next){
    stopMotion();stopSpeech();closeZoom();view=next;speechMessage('');
    for(const n of ['home','lesson','done'])$('#'+n+'-view').hidden=n!==next;
    if(next==='home')homeUI();
  }
  function lessonUI(animate=false){
    stopMotion();stopSpeech();closeZoom();const s=lessons[state.step];
    $('#lesson-title').textContent=s.title;$('#instruction').textContent=s.body;$('#expected').textContent=s.check;$('#hint').textContent=s.hint;$('#help-text').textContent=s.help;
    const phaseIndex=state.step<3?state.step+1:state.step<10?state.step-2:state.step===10?7:1;
    $('#step-eyebrow').textContent=s.phase==='préparer'?`ON PRÉPARE · ${phaseIndex} / 3`:s.phase==='finir'?'LA TOUCHE FINALE':state.step===10?'PETITE VICTOIRE, GRANDE FIERTÉ':`TOUR N° ${state.rounds+(state.credited?0:1)} · GESTE ${phaseIndex} / 7`;
    $('#round-badge').textContent=state.rounds?`✦ ${countLabel()}`:'Mon premier scoubi';
    $$('[data-phase]').forEach(e=>{e.classList.toggle('active',e.dataset.phase===s.phase);if(e.dataset.phase===s.phase)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});
    $('#who-does').textContent=s.adult?'CETTE ÉTAPE, AVEC UN GRAND':'À TOI, AVEC TES VRAIS FILS';
    $('#demo-mode').textContent=s.scene==='start'?'LE RÉSULTAT À PRÉPARER':s.scene==='finish'?'TA CRÉATION À TERMINER':s.scene==='reward'?'TON SCOUBI GRANDIT':'LE GESTE À REGARDER';
    $('#previous').disabled=state.step===0;$('#next-label').textContent=s.next;
    $('#reward-panel').hidden=state.step!==10;$('#reward-copy').textContent=state.rounds===1?'Ton tout premier tour ! Tu peux déjà être fier.':state.rounds<3?'Deux tours : tu prends le coup de main !':`${state.rounds} tours, plein de petits gestes… et une création à toi.`;
    $('#reward-stars').textContent='✦'.repeat(Math.min(state.rounds,3));
    $('#help-panel').hidden=true;$('#help-button').setAttribute('aria-expanded','false');$('#show-thread').hidden=!s.active;$('#slow-replay').hidden=!canAnimate();
    $('#zoom-inset').hidden=!s.zoom;$('#speech-status').textContent='';
    $('#identify-feedback').textContent=s.active?`Touche le bout ${s.active} dans le dessin pour le repérer.`:'';
    $('#play').disabled=!canAnimate();$('#timeline').disabled=!canAnimate();$('#speed').disabled=!canAnimate();$('#speed').innerHTML=icon('turtle')+(state.slow?' Lent':' Normal');$('#speed').setAttribute('aria-pressed',String(state.slow));
    const total=s.phase==='préparer'?3:s.phase==='finir'?1:7,pos=Math.min(phaseIndex,total);
    $('#progress-dots').innerHTML=Array.from({length:total},(_,i)=>`<i class="${i+1===pos?'current':i+1<pos?'done':''}"></i>`).join('');
    $('#step-position').textContent=s.phase==='préparer'?`Préparation ${pos} sur 3`:s.phase==='finir'?'Dernière étape':state.step===10?'Un tour terminé !':`Geste ${pos} sur 7`;
    sceneAt(1);if(animate&&!reduced()&&canAnimate())playAnimation();
  }
  function goStep(n,{animate=true,read=true}={}){state.step=Math.max(0,Math.min(lessons.length-1,n));state.started=true;setView('lesson');lessonUI(animate);save();$('#lesson-title').focus({preventScroll:true});$('#lesson-view').scrollIntoView?.({behavior:reduced()?'auto':'smooth',block:'start'});if(state.voice&&read)speakStep();}
  function doneUI(){setView('done');$('#done-art').innerHTML=scoubiArt(colors(),12,false);$('#done-count').textContent=countLabel()+' avec mes mains';$('.confetti').innerHTML=reduced()?'':Array.from({length:24},(_,i)=>`<i style="--x:${(i*17)%100}%;--delay:${(i%8)*.09}s;--c:${[...colors(),'#d4b144'][i%3]};--r:${i*37}deg"></i>`).join('');$('#done-view').scrollIntoView?.({behavior:reduced()?'auto':'smooth'});}
  function next(){
    if(view!=='lesson')return;
    if(state.step===9&&!state.credited){state.rounds++;state.credited=true;}
    if(state.step===10){state.credited=false;goStep(3);return;}
    if(state.step===11){state.finished=true;save();doneUI();if(state.voice)speak('Bravo Malo ! Tu as fait ton scoubidou. Tu peux être fier de toi.');return;}
    goStep(state.step+1);
  }
  function openDialog(id){stopMotion();if(view==='lesson')sceneAt(motion);stopSpeech();const dialog=$('#'+id);if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  function closeDialog(id){const dialog=$('#'+id);if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}
  function closeZoom(){if(!zoomed)return;zoomed=false;$('#scene').classList.remove('enlarged');$('#zoom-button').setAttribute('aria-pressed','false');$('.enlarged-close')?.remove();$('#zoom-button').focus({preventScroll:true});}
  function toggleZoom(){if(zoomed){closeZoom();return;}stopMotion();sceneAt(1);zoomed=true;$('#scene').classList.add('enlarged');$('#zoom-button').setAttribute('aria-pressed','true');const b=doc.createElement('button');b.className='enlarged-close';b.textContent='Fermer le gros plan ×';b.addEventListener('click',closeZoom);doc.body.appendChild(b);b.focus();}
  function identify(n){const s=lessons[state.step];if(!s.active)return;stopMotion();sceneAt(1);$('#identify-feedback').textContent=n===s.active?`Oui, le ${n} ! Prends maintenant ce bout sur la table.`:`Cherche le ${s.active}, entouré en jaune. Prends ton temps.`;if(state.voice&&n===s.active)speak(`Oui, le ${n} ! Maintenant, prends ce bout sur la table.`);}
  $('#home-button').addEventListener('click',()=>{setView('home');save();win.scrollTo?.({top:0,behavior:'smooth'});});
  $('#pause').addEventListener('click',()=>{setView('home');save();win.scrollTo?.({top:0,behavior:'smooth'});});
  const resume=()=>{if(state.finished)doneUI();else goStep(state.step,{animate:false});};
  $('#start').addEventListener('click',resume);$('#resume').addEventListener('click',resume);
  $('#next').addEventListener('click',next);$('#previous').addEventListener('click',()=>{if(state.step>0)goStep(state.step-1);});
  $('#finish').addEventListener('click',()=>goStep(11));
  $('#voice-toggle').addEventListener('click',()=>{state.voice=!state.voice;voiceUI();save();if(!state.voice)stopSpeech();else if(view==='lesson')speakStep();else speak('Salut Malo ! Je vais te guider. Tu peux couper ma voix avec ce bouton.');});
  $('#listen').addEventListener('click',()=>{if(speaking)stopSpeech();else speakStep();});
  $('#play').addEventListener('click',()=>{if(playing){stopMotion();sceneAt(motion);}else playAnimation(motion<1?motion:0);});
  $('#timeline').addEventListener('input',()=>{stopMotion();sceneAt(Number($('#timeline').value)/100);});
  $('#speed').addEventListener('click',()=>{state.slow=!state.slow;save();$('#speed').setAttribute('aria-pressed',String(state.slow));$('#speed').innerHTML=icon('turtle')+(state.slow?' Lent':' Normal');if(playing)playAnimation(motion);});
  $('#help-button').addEventListener('click',()=>{const open=$('#help-panel').hidden;$('#help-panel').hidden=!open;$('#help-button').setAttribute('aria-expanded',String(open));});
  $('#show-thread').addEventListener('click',()=>identify(lessons[state.step].active));
  $('#slow-replay').addEventListener('click',()=>{state.slow=true;save();$('#speed').setAttribute('aria-pressed','true');$('#speed').innerHTML=icon('turtle')+' Lent';playAnimation();});
  $('#scene').addEventListener('click',e=>{const n=e.target.closest('[data-strand]');if(n)identify(Number(n.dataset.strand));});
  $('#scene').addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){const n=e.target.closest('[data-strand]');if(n){e.preventDefault();identify(Number(n.dataset.strand));}}});
  $('#zoom-button').addEventListener('click',toggleZoom);
  ['parents-button','footer-parents'].forEach(id=>$('#'+id).addEventListener('click',()=>openDialog('parents-dialog')));
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog(b.dataset.close)));
  $('#new-project').addEventListener('click',()=>openDialog('reset-dialog'));
  $('#confirm-reset').addEventListener('click',()=>{const c=state.colors,v=state.voice;state=freshState();state.colors=c;state.voice=v;save();closeDialog('reset-dialog');setView('home');$('#preparation').scrollIntoView?.({behavior:'smooth'});});
  $('#print').addEventListener('click',()=>win.print?.());
  doc.addEventListener('click',e=>{const p=e.target.closest('[data-palette]');if(p&&!p.disabled){const role=Number(p.dataset.palette),c=Number(p.dataset.color);if(c===state.colors[1-role])return;state.colors[role]=c;save();homeUI();doc.querySelector(`[data-palette="${role}"][data-color="${c}"]`)?.focus({preventScroll:true});}const m=e.target.closest('[data-material]');if(m){const i=Number(m.dataset.material);state.materials[i]=!state.materials[i];save();homeUI();}});
  doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&zoomed){e.preventDefault();closeZoom();}});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){stopMotion();stopSpeech();save();}});
  win.addEventListener('pagehide',()=>{stopMotion();stopSpeech();save();});
  homeUI();
  return {getState:()=>structuredClone(state),getView:()=>view,getMotion:()=>motion,destroy:()=>{stopMotion();stopSpeech();}};
}
if(typeof window!=='undefined'&&window.document?.querySelector('#home-view'))createApp();
