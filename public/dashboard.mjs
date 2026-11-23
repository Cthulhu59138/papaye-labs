import {PROJECT_STATUSES,TASK_STATUSES,ACCESS_LABELS,SESSION_KEY,LOGOUT_KEY,escape as e,safeHref,parisDay,dateLabel,dueLabel,projectProgress,activeTasks,sortTasks,filterProjects,filterTasks,parseSession,canShare,validateProject,validateTask} from './dashboard-model.mjs';
import {setFormBusy,readFormValues} from './dashboard-forms.mjs';
import {createConfirmation} from './dashboard-confirm.mjs';
import {worksheetFilters,worksheetMarkup,worksheetEditor} from './dashboard-worksheet.mjs';

const app = document.querySelector('#app');
const dialog = document.querySelector('#editor');
const confirmation = createConfirmation(document.querySelector('#confirmation'));
const toast = document.querySelector('#toast');
const activation = new URLSearchParams(location.hash.slice(1)).get('activation');
if (activation) history.replaceState(null,'',location.pathname + location.search);
const state = {
  apiBase:null, session:null, remember:false, authenticated:false, configured:true,
  projects:[],tasks:[],view:'overview',selected:null,epoch:0,loading:false,
  filters:{projects:{query:'',status:'',archived:false},tasks:{query:'',status:'open',projectId:''}},
  editor:null,pendingDraft:null,activation:activation || null,setupAllowed:false,loginError:'',expiryTimer:null,
};
const initialProject = new URLSearchParams(location.search).get('projet');
if (initialProject && /^[a-z0-9-]+$/.test(initialProject)) {
  state.view = 'project';
  state.selected = initialProject;
}
let worksheet = null;
let sheetFilters = worksheetFilters();
let returnFocus = null;
let toastTimer;
let validationPromise;
const brand = '<span class="wordmark">papaye<span class="labs">labs</span><span class="brand-period">.</span></span>';
const icon = name => `<span class="nav-icon" aria-hidden="true">${({overview:'▦',projects:'▤',tasks:'✓'})[name] || '+'}</span>`;
const options = (values,selected) => values.map(value => `<option value="${e(value)}"${value === selected ? ' selected' : ''}>${e(value)}</option>`).join('');
const countLabel = (count,singular,plural = singular+'s') => `${count} ${count === 1 ? singular : plural}`;
const projectById = id => state.projects.find(project => project.id === id);
const taskById = id => state.tasks.find(task => task.id === id);

function storedSession() {
  for (const [store,remember] of [['sessionStorage',false],['localStorage',true]]) {
    try {const value = parseSession(window[store].getItem(SESSION_KEY)); if (value) return {...value,remember}; window[store].removeItem(SESSION_KEY);} catch {}
  }
  return null;
}
function removeStoredSession() {
  for (const name of ['sessionStorage','localStorage']) try {window[name].removeItem(SESSION_KEY);} catch {}
}
function storeSession(session,remember) {
  removeStoredSession();
  try {window[remember ? 'localStorage' : 'sessionStorage'].setItem(SESSION_KEY,JSON.stringify({sessionToken:session.sessionToken,expiresAt:session.expiresAt}));}
  catch {notify('La connexion reste active dans cet onglet. Le navigateur ne permet pas de la mémoriser.');}
}
function notify(message) {
  clearTimeout(toastTimer); toast.textContent = message; toast.hidden = false;
  toastTimer = setTimeout(() => {toast.hidden = true; toast.textContent = '';},6000);
}
function clearToast() {clearTimeout(toastTimer);toast.hidden = true;toast.textContent = '';}
function loadingScreen(message='Vérification de ta connexion…') {
  app.innerHTML = `<main id="main" class="boot-screen" tabindex="-1">${brand}<span class="loader" aria-hidden="true"></span><p role="status">${e(message)}</p></main>`;
}
function hideEditor() {
  if (dialog.open) dialog.close();
  dialog.replaceChildren();state.editor = null;
}
function captureDraft() {
  if (state.editor?.dirty && ['project','task','worksheet'].includes(state.editor.kind)) {
    const form = dialog.querySelector('form');
    if (form) state.pendingDraft = {...state.editor,values:readFormValues(form),dirty:true};
  }
}
function purgePrivate({keepDraft=false}={}) {
  if (keepDraft) captureDraft(); else state.pendingDraft = null;
  confirmation.cancel();
  worksheet = null;
  if (!keepDraft) sheetFilters = worksheetFilters();
  state.epoch++;state.authenticated = false;state.projects=[];state.tasks=[];
  clearTimeout(state.expiryTimer);clearToast();hideEditor();app.replaceChildren();
}
function lock(message='Ta session a expiré. Reconnecte-toi pour continuer.',{keepDraft=true}={}) {
  purgePrivate({keepDraft});state.session = null;removeStoredSession();state.loginError = message;
  renderLogin();
}
function scheduleExpiry() {
  clearTimeout(state.expiryTimer);
  if (!state.session) return;
  const remaining = state.session.expiresAt - Date.now();
  state.expiryTimer = setTimeout(() => {
    if (state.session?.expiresAt <= Date.now()) lock(); else scheduleExpiry();
  },Math.min(Math.max(remaining,0),2147483647));
}
class ApiError extends Error {constructor(message,status=0){super(message);this.status=status;}}
async function api(path,{method='GET',body,anonymous=false,download=false}={}) {
  if (state.apiBase === null) throw new ApiError('Le service n’est pas encore prêt.');
  const headers = {'Accept':download?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/json'};
  const token = anonymous ? null : state.session?.sessionToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type']='application/json';
  if (method !== 'GET' && !anonymous && state.session?.csrf) headers['X-CSRF-Token']=state.session.csrf;
  let response;
  try {
    response = await fetch(state.apiBase+path,{method,headers,body:body === undefined ? undefined : JSON.stringify(body),cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(20000)});
  } catch {throw new ApiError('Le service est momentanément indisponible. Vérifie ta connexion, puis réessaie.');}
  if (download && response.ok) return response.blob();
  let result;
  try {result = await response.json();} catch {throw new ApiError('Le service a renvoyé une réponse inattendue.',response.status);}
  if (!response.ok) {
    if (response.status === 401 && token && state.session?.sessionToken === token) lock();
    throw new ApiError(typeof result?.error === 'string' ? result.error : 'Cette action n’a pas abouti.',response.status);
  }
  return result;
}
function renderLogin() {
  const setup = state.setupAllowed && !!state.activation;
  const disabled = state.apiBase === null;
  app.innerHTML = `<div class="login-shell"><header class="login-header"><a href="/" aria-label="Papaye Labs, accueil">${brand}</a><span class="privacy-mark"><span aria-hidden="true">●</span> Espace personnel</span></header>
    <main id="main" class="login-main" tabindex="-1"><div class="login-intro"><span class="eyebrow">TON COIN PAPAYE</span><h1>Tes projets.<br>Au même endroit<span class="brand-period">.</span></h1><p>Un espace à toi pour garder le fil,<br class="desktop-only"> avancer et retrouver tes applications.</p><div class="privacy-note"><span class="lock-symbol" aria-hidden="true">⌑</span><span>Ton tableau de bord est privé.<br><strong>Les applications se partagent séparément.</strong></span></div></div>
    <section class="login-card" aria-labelledby="login-title"><span class="small-tag">${setup ? 'PREMIÈRE CONNEXION' : 'BIENVENUE'}</span><h2 id="login-title">${setup ? 'Créer ton compte Papaye' : 'Ouvrir mon espace'}</h2><p class="muted">${setup ? 'Choisis ton identifiant et une phrase de passe personnelle.' : 'Connecte-toi avec ton compte Papaye.'}</p>
    ${state.loginError ? `<div class="notice error" role="alert">${e(state.loginError)}</div>` : ''}
    ${!state.configured && !setup ? '<div class="notice">Ton compte doit être activé avec ton lien personnel avant la première connexion.</div>' : ''}
    ${state.pendingDraft ? '<p class="draft-note">Ton brouillon est conservé dans cet onglet jusqu’à ta reconnexion.</p>' : ''}
    <form id="login-form" data-form="login"><label for="login-name">Identifiant</label><input id="login-name" name="login" autocomplete="username" autocapitalize="none" spellcheck="false" minlength="3" maxlength="40" required${disabled ? ' disabled' : ''}>
    <label for="login-password">${setup ? 'Phrase de passe' : 'Mot de passe'}</label><input id="login-password" name="password" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" ${setup ? 'minlength="12"' : ''} maxlength="256" required${disabled ? ' disabled' : ''}>
    ${setup ? '<p class="field-hint">Au moins 12 caractères. Une courte phrase convient.</p><label for="login-confirm">Confirmer la phrase de passe</label><input id="login-confirm" name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="256" required>' : ''}
    <label class="check-label"><input type="checkbox" name="remember"><span>Rester connecté pendant 30 jours<small>Sur un appareil qui t’appartient.</small></span></label>
    <div class="form-error" role="alert" hidden></div><button class="button primary full" type="submit"${disabled || (!state.configured && !setup) ? ' disabled' : ''}>${setup ? 'Créer mon compte' : 'Me connecter'} <span aria-hidden="true">→</span></button></form>
    <button class="button text full" data-action="retry-login">Vérifier la connexion au service</button><p class="login-footnote">Un compte Papaye indépendant.<br>Aucun compte GitHub ou ChatGPT nécessaire.</p></section></main><footer class="login-footer">Papaye Labs <span>Un peu d’ordre. De la place pour les idées.</span></footer></div>`;
}
function authShell() {
  const activeView = state.view === 'project' ? 'projects' : state.view;
  return `<div class="workspace"><aside class="sidebar"><a class="sidebar-brand" href="/" data-view="overview" aria-label="Papaye Labs, vue d’ensemble">${brand}</a><p class="sidebar-caption">MON ESPACE</p><nav class="main-nav" aria-label="Navigation principale">${[['overview','Vue d’ensemble'],['projects','Projets'],['tasks','Tâches']].map(([key,label]) => `<button data-view="${key}" class="nav-item${key === activeView ? ' active' : ''}"${key === activeView ? ' aria-current="page"' : ''}>${icon(key)}<span>${label}</span></button>`).join('')}</nav><div class="sidebar-bottom"><span class="private-label"><span aria-hidden="true">●</span> Tableau de bord privé</span><button class="account-button" data-action="account"><span class="avatar" aria-hidden="true">${e((state.session?.login || 'P').slice(0,1).toUpperCase())}</span><span><strong>${e(state.session?.login || 'Mon compte')}</strong><small>Mon compte</small></span><span aria-hidden="true">↗</span></button><button class="button text logout" data-action="logout">Me déconnecter</button></div></aside><div class="workspace-body"><header class="topbar"><span class="breadcrumb">Mon espace <span aria-hidden="true">/</span> <strong>${({overview:'Vue d’ensemble',projects:'Projets',tasks:'Tâches',project:'Fiche projet'})[state.view]}</strong></span><div class="topbar-actions"><span class="today">${e(new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long',timeZone:'Europe/Paris'}).format(new Date()))}</span><button class="button subtle" data-action="refresh" aria-label="Actualiser le tableau de bord"><span aria-hidden="true">↻</span><span class="desktop-only">Actualiser</span></button><button class="button subtle mobile-only" data-action="account">Compte</button></div></header><main id="main" tabindex="-1">${state.pendingDraft ? '<div class="notice draft-banner"><span>Un brouillon attend dans cet onglet.</span><div><button class="button small" data-action="resume-draft">Reprendre</button><button class="button text small" data-action="discard-draft">Abandonner</button></div></div>' : ''}<div id="content"></div></main><footer class="workspace-footer"><span>Papaye Labs</span><span>Ton suivi reste privé, même quand tu partages une application.</span></footer></div></div>`;
}
function renderPrivate({focus=false}={}) {
  if (!state.authenticated) return;
  app.innerHTML = authShell();renderContent();
  if (focus) document.querySelector('#main')?.focus({preventScroll:true});
}
function empty(title,message,action='',button='') {
  return `<div class="empty-state"><span class="empty-mark" aria-hidden="true">＋</span><h3>${e(title)}</h3><p>${e(message)}</p>${action ? `<button class="button" data-action="${e(action)}">${e(button)}</button>` : ''}</div>`;
}
function heading(kicker,title,description,actions='') {
  return `<div class="page-heading"><div><p class="eyebrow">${e(kicker)}</p><h1>${e(title)}<span class="brand-period">.</span></h1><p class="page-description">${e(description)}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function addButtons() {
  return `<button class="button" data-action="new-task"${!state.projects.some(project => !project.archived) ? ' disabled' : ''}>+ Nouvelle tâche</button><button class="button primary" data-action="new-project">+ Nouveau projet</button>`;
}
function statusBadge(status) {return `<span class="status-badge${status === 'Terminé' ? ' completed' : status === 'En cours' ? ' in-progress' : ''}">${e(status)}</span>`;}
function progressMarkup(project) {
  const progress = projectProgress(project.id,state.tasks);
  return `<div class="progress-block"><span>${progress.total ? `${progress.done} tâche${progress.done > 1 ? 's' : ''} terminée${progress.done > 1 ? 's' : ''} sur ${progress.total}` : 'Aucune tâche'}</span>${progress.total ? `<progress max="${progress.total}" value="${progress.done}" aria-label="Avancement de ${e(project.name)}">${progress.percent}%</progress>` : '<span class="progress-empty" aria-hidden="true"></span>'}</div>`;
}
function externalProjectUrl(project) {
  const href=safeHref(project.url);
  if (!href || !project.hasWorksheet) return href;
  const url=new URL(href);
  const self=url.origin===location.origin && url.pathname==='/' && url.searchParams.get('projet')===project.id;
  return self ? null : href;
}
function projectCard(project,compact=false) {
  const href = externalProjectUrl(project);
  return `<article class="project-card${compact ? ' compact' : ''}"><div class="project-card-top"><span class="project-monogram" aria-hidden="true">${e(project.name.slice(0,2).toUpperCase())}</span>${statusBadge(project.status)}</div><button class="project-name" data-action="open-project" data-id="${e(project.id)}">${e(project.name)} <span aria-hidden="true">↗</span></button><p class="project-description">${e(project.description || 'Une prochaine idée à faire grandir.')}</p>${progressMarkup(project)}<div class="project-meta"><span>${project.dueDate ? e(dateLabel(project.dueDate)) : 'Sans échéance'}</span><span class="access-dot ${project.accessStatus === 'public' ? 'public' : ''}">${e(ACCESS_LABELS[project.accessStatus] || ACCESS_LABELS.unknown)}</span></div><div class="card-actions"><button class="button small" data-action="open-project" data-id="${e(project.id)}">Voir le projet</button>${href ? `<a class="button text small" href="${e(href)}" target="_blank" rel="noopener noreferrer">Ouvrir <span aria-hidden="true">↗</span><span class="sr-only"> l’application ${e(project.name)}</span></a>` : ''}</div></article>`;
}
function taskRow(task,{showProject=true,readonly=false}={}) {
  const project = projectById(task.projectId);
  const done = task.status === 'Terminé';
  const due = dueLabel(task.dueDate);
  return `<li class="task-row${done ? ' done' : ''}"><button class="task-check" data-action="toggle-task" data-id="${e(task.id)}" aria-label="${e(done ? 'Rouvrir la tâche '+task.title : 'Terminer la tâche '+task.title)}" aria-pressed="${done}"${readonly ? ' disabled' : ''}>${done ? '✓' : '<span></span>'}</button><div class="task-main">${readonly ? `<strong class="task-title">${e(task.title)}</strong>` : `<button class="task-title" data-action="edit-task" data-id="${e(task.id)}">${e(task.title)}</button>`}<div class="task-caption">${showProject ? `<button class="inline-link" data-action="open-project" data-id="${e(task.projectId)}">${e(project?.name || 'Projet')}</button><span aria-hidden="true">·</span>` : ''}<span class="${due.overdue && !done ? 'overdue' : ''}">${e(due.label)}</span></div></div><span class="task-status">${e(task.status)}</span>${readonly ? '' : `<button class="icon-button" data-action="edit-task" data-id="${e(task.id)}" aria-label="Modifier ${e(task.title)}">···</button>`}</li>`;
}
function overview() {
  const projects = state.projects.filter(project => !project.archived);
  const tasks = activeTasks(state.projects,state.tasks);
  const open = tasks.filter(task => task.status !== 'Terminé');
  const today = parisDay();
  const due = open.filter(task => task.dueDate && task.dueDate <= today);
  const coming = sortTasks(open).slice(0,6);
  const current = [...projects].sort((a,b) => Number(b.status === 'En cours')-Number(a.status === 'En cours') || b.updatedAt-a.updatedAt).slice(0,4);
  const deadlines = projects.filter(project => project.dueDate && project.status !== 'Terminé').sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,4);
  return heading('UNE VUE POUR AVANCER','Vue d’ensemble','Les prochaines étapes, et les projets qui comptent.',addButtons())+
    `<section class="summary-grid" aria-label="Repères du tableau de bord"><button class="summary-card" data-view="projects"><span>Projets actifs</span><strong>${projects.length}<small>à retrouver ici</small></strong><span class="summary-arrow" aria-hidden="true">↗</span></button><button class="summary-card accent" data-action="due-tasks"><span>À faire aujourd’hui</span><strong>${due.length}<small>avec les tâches en retard</small></strong><span class="summary-arrow" aria-hidden="true">↗</span></button><button class="summary-card" data-view="tasks"><span>Tâches ouvertes</span><strong>${open.length}<small>une étape après l’autre</small></strong><span class="summary-arrow" aria-hidden="true">↗</span></button></section>
    <div class="overview-grid"><section class="panel priority-panel"><div class="section-heading"><div><span class="small-tag">PROCHAINES ÉTAPES</span><h2>À faire maintenant</h2></div><button class="button text small" data-view="tasks">Tout voir →</button></div>${coming.length ? `<ul class="task-list">${coming.map(task => taskRow(task)).join('')}</ul>` : empty('Le champ est libre',projects.length ? 'Ajoute une prochaine étape pour garder le fil de tes projets.' : 'Commence par créer ton premier projet.','new-project',projects.length ? 'Créer un projet' : 'Ajouter un projet')}</section><section class="panel deadlines-panel"><div class="section-heading"><div><span class="small-tag">DANS LE CALENDRIER</span><h2>Échéances des projets</h2></div></div>${deadlines.length ? `<ul class="deadline-list">${deadlines.map(project => `<li><span class="calendar-tile" aria-hidden="true">${e(project.dueDate.slice(8))}<small>${e(new Intl.DateTimeFormat('fr-FR',{month:'short',timeZone:'Europe/Paris'}).format(new Date(project.dueDate+'T12:00:00Z')))}</small></span><div><button class="inline-link strong" data-action="open-project" data-id="${e(project.id)}">${e(project.name)}</button><small class="${project.dueDate < today ? 'overdue' : ''}">${e(dueLabel(project.dueDate).label)}</small></div></li>`).join('')}</ul>` : '<p class="quiet-empty">Aucune échéance pour le moment.<br>Ajoute une date lorsqu’un projet en a besoin.</p>'}</section></div>
    <section class="projects-section"><div class="section-heading"><div><span class="small-tag">TES TERRAINS DE JEU</span><h2>Les projets à portée de main</h2></div><button class="button text small" data-view="projects">Tous les projets →</button></div>${current.length ? `<div class="project-grid overview-projects">${current.map(project => projectCard(project,true)).join('')}</div>` : empty('Ton premier projet commence ici','Un nom, une idée, une prochaine étape. Tu pourras compléter le reste ensuite.','new-project','Créer mon premier projet')}</section>`;
}
function projectsView() {
  const filter = state.filters.projects;
  const projects = filterProjects(state.projects,filter);
  return heading('DU PREMIER ESSAI À LA SUITE','Mes projets','Retrouve tes applications et garde une trace de ce qui avance.','<button class="button primary" data-action="new-project">+ Nouveau projet</button>')+
    `<section class="filter-bar" aria-label="Filtrer les projets"><div class="search-field"><label for="project-search" class="sr-only">Rechercher un projet</label><span aria-hidden="true">⌕</span><input id="project-search" type="search" data-filter="project-query" value="${e(filter.query)}" placeholder="Rechercher un projet…"></div><label class="sr-only" for="project-status-filter">Statut du projet</label><select id="project-status-filter" data-filter="project-status"><option value="">Tous les statuts</option>${options(PROJECT_STATUSES,filter.status)}</select><label class="sr-only" for="project-archive-filter">Projets actifs ou archivés</label><select id="project-archive-filter" data-filter="project-archive"><option value="active"${!filter.archived ? ' selected' : ''}>Projets actifs</option><option value="archived"${filter.archived ? ' selected' : ''}>Archives</option></select></section><p class="result-count">${countLabel(projects.length,'projet')}${filter.archived ? ' archivé'+(projects.length > 1 ? 's' : '') : ''}</p>
    ${projects.length ? `<div class="project-grid">${projects.map(project => projectCard(project)).join('')}</div>` : empty(filter.archived ? 'Aucun projet archivé' : 'Aucun projet trouvé',filter.query || filter.status ? 'Essaie une autre recherche ou efface les filtres.' : 'Ajoute un projet pour commencer à organiser la suite.',filter.query || filter.status ? 'reset-project-filters' : filter.archived ? '' : 'new-project',filter.query || filter.status ? 'Effacer les filtres' : 'Ajouter un projet')}`;
}
function tasksView() {
  const filter = state.filters.tasks;
  let tasks = filterTasks(state.projects,state.tasks,filter);
  if (filter.dueOnly) tasks=tasks.filter(task => task.dueDate && task.dueDate<=parisDay());
  const projects = state.projects.filter(project => !project.archived);
  return heading('UNE ÉTAPE APRÈS L’AUTRE','Mes tâches','Les petites actions qui font avancer les projets.',`<button class="button primary" data-action="new-task"${!projects.length ? ' disabled' : ''}>+ Nouvelle tâche</button>`)+
    `<section class="filter-bar" aria-label="Filtrer les tâches"><div class="search-field"><label for="task-search" class="sr-only">Rechercher une tâche</label><span aria-hidden="true">⌕</span><input id="task-search" type="search" data-filter="task-query" value="${e(filter.query)}" placeholder="Rechercher une tâche…"></div><label class="sr-only" for="task-status-filter">Statut de la tâche</label><select id="task-status-filter" data-filter="task-status"><option value="open"${filter.status === 'open' ? ' selected' : ''}>Tâches ouvertes</option><option value=""${filter.status === '' ? ' selected' : ''}>Tous les statuts</option>${options(TASK_STATUSES,filter.status)}</select><label class="sr-only" for="task-project-filter">Projet</label><select id="task-project-filter" data-filter="task-project"><option value="">Tous les projets</option>${projects.map(project => `<option value="${e(project.id)}"${filter.projectId === project.id ? ' selected' : ''}>${e(project.name)}</option>`).join('')}</select></section>${filter.dueOnly ? '<div class="filter-note">Aujourd’hui et en retard <button class="button text small" data-action="reset-task-filters">Voir toutes les tâches</button></div>' : ''}<p class="result-count">${countLabel(tasks.length,'tâche')}</p><section class="panel">${tasks.length ? `<ul class="task-list">${tasks.map(task => taskRow(task)).join('')}</ul>` : empty('Rien dans cette liste',projects.length ? 'Ajoute une tâche ou ajuste les filtres pour retrouver tes prochaines étapes.' : 'Crée d’abord un projet pour lui associer des tâches.',projects.length ? 'reset-task-filters' : 'new-project',projects.length ? 'Effacer les filtres' : 'Créer un projet')}</section>`;
}
function projectView() {
  const project=projectById(state.selected);
  if (!project) return empty('Ce projet n’est plus disponible','Actualise le tableau de bord pour retrouver tes projets.','refresh','Actualiser');
  const tasks=sortTasks(state.tasks.filter(task=>task.projectId===project.id));
  const href=externalProjectUrl(project),source=safeHref(project.source);
  return `<button class="button text back-link" data-view="projects">← Tous mes projets</button>`+
    heading(project.archived ? 'PROJET ARCHIVÉ' : 'FICHE PROJET',project.name,project.description || 'Les idées et les prochaines étapes de ce projet.',`<button class="button" data-action="${project.archived ? 'restore-project' : 'edit-project'}" data-id="${e(project.id)}">${project.archived ? 'Restaurer le projet' : 'Modifier le projet'}</button>`)+
    (project.hasWorksheet ? '<section class="panel worksheet-panel" id="project-worksheet" aria-label="Tableau du projet"><p role="status">Chargement du tableau…</p></section>' : '')+
    `${project.archived ? '<div class="notice">Ce projet est archivé. Ses tâches et ses notes sont conservées ; restaure-le pour reprendre le suivi.</div>' : ''}<div class="detail-layout"><div class="detail-main">${project.hasWorksheet && !href && !source ? '' : `<section class="panel launch-panel"><div><span class="small-tag">APPLICATION</span><h2>${e(ACCESS_LABELS[project.accessStatus] || ACCESS_LABELS.unknown)}</h2><p class="muted">${project.accessStatus === 'public' ? 'Son adresse ouvre l’application. Ton suivi et tes notes restent privés.' : project.accessStatus === 'protected' ? 'L’application garde sa propre connexion. Son lien n’ouvre pas ton tableau de bord.' : 'Le suivi est privé. L’accès sans compte à cette application n’a pas été confirmé.'}</p></div><div class="launch-actions">${href ? `<a class="button primary" href="${e(href)}" target="_blank" rel="noopener noreferrer">Ouvrir l’application ↗</a>` : '<span class="muted">Aucune adresse d’application</span>'}${canShare(project) ? `<button class="button" data-action="share" data-id="${e(project.id)}">Copier le lien public</button>` : ''}${source ? `<a class="button text" href="${e(source)}" target="_blank" rel="noopener noreferrer">Ouvrir la ressource ↗</a>` : ''}</div></section>`}<section class="panel"><div class="section-heading"><div><span class="small-tag">PROCHAINES ÉTAPES</span><h2>Tâches <span class="count">${tasks.length}</span></h2></div>${!project.archived ? `<button class="button small" data-action="new-task" data-project="${e(project.id)}">+ Ajouter</button>` : ''}</div>${tasks.length ? `<ul class="task-list">${tasks.map(task=>taskRow(task,{showProject:false,readonly:project.archived})).join('')}</ul>` : '<p class="quiet-empty">Aucune tâche pour le moment.</p>'}</section><section class="panel"><div class="section-heading"><div><span class="small-tag">POUR GARDER LE FIL</span><h2>Notes privées</h2></div>${!project.archived ? `<button class="button text small" data-action="edit-project" data-id="${e(project.id)}" data-focus="project-notes">Modifier</button>` : ''}</div>${project.notes ? `<div class="notes-text">${e(project.notes)}</div>` : '<p class="quiet-empty">Une idée, une décision, quelque chose à ne pas oublier…<br>Ces notes ne sont visibles que dans ton espace.</p>'}</section></div><aside class="detail-aside"><section class="panel project-summary"><span class="small-tag">LE POINT SUR LE PROJET</span><h2>Repères</h2><dl><div><dt>Statut</dt><dd>${statusBadge(project.status)}</dd></div><div><dt>Échéance</dt><dd>${e(dateLabel(project.dueDate))}</dd></div><div><dt>Avancement</dt><dd>${progressMarkup(project)}</dd></div></dl></section>${!project.archived ? `<section class="archive-box"><h3>Mettre de côté</h3><p>L’archivage garde les notes et les tâches, et libère la vue d’ensemble.</p><button class="button small" data-action="archive-project" data-id="${e(project.id)}">Archiver ce projet</button></section>` : ''}</aside></div>`;
}
function renderContent({restoreInput}={}) {
  const content=document.querySelector('#content');
  if (!content || !state.authenticated) return;
  content.innerHTML=({overview,projects:projectsView,tasks:tasksView,project:projectView})[state.view]();
  if (document.getElementById('project-worksheet')) showWorksheet();
  if (restoreInput) {const input=document.getElementById(restoreInput.id);input?.focus({preventScroll:true});if (typeof restoreInput.start==='number') try {input.setSelectionRange(restoreInput.start,restoreInput.end);} catch {}}
}
function worksheetPath(id) {return '/api/projects/'+encodeURIComponent(id)+'/worksheet';}
function currentSheetRow(id) {return worksheet?.data?.rows.find(row=>String(row.id)===String(id));}
function mayRenderSheet(current) {
  return current===worksheet && state.authenticated && state.selected===current.id && state.view==='project';
}
async function fetchWorksheet(projectId,force=false) {
  if (!force && worksheet?.id===projectId) return worksheet.loading;
  const current = {id:projectId,data:null,error:'',loading:null};
  worksheet = current;
  current.loading = api(worksheetPath(projectId)).then(result=>{
    if (!Array.isArray(result.rows)||!Array.isArray(result.priorities)||!Array.isArray(result.statuses)) throw new ApiError('Le tableau reçu est incomplet.');
    current.data=result;
  }).catch(error=>{current.error=error.message;});
  return current.loading;
}
function drawWorksheet() {
  const panel=document.getElementById('project-worksheet');
  if (!panel || !worksheet || !mayRenderSheet(worksheet)) return;
  if (worksheet.error) {
    panel.innerHTML=`<div role="alert">${e(worksheet.error)}</div><button class="button" data-action="worksheet-retry">Réessayer</button>`;
  } else if (worksheet.data) {
    panel.innerHTML=worksheetMarkup(worksheet.data,sheetFilters,projectById(worksheet.id)?.archived);
  }
}
async function showWorksheet() {
  const id=state.selected;
  if (worksheet?.id!==id || !worksheet.data) await fetchWorksheet(id);
  drawWorksheet();
}
async function downloadWorksheet(button) {
  const current=worksheet;
  if (!current || !mayRenderSheet(current)) return;
  button.disabled=true;
  try {
    const blob=await api(worksheetPath(current.id)+'/download',{download:true});
    if (!mayRenderSheet(current)) return;
    const href=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=href;link.download=(projectById(current.id)?.name || 'Tableau')+'.xlsx';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(href),30000);
  } catch(error) {if(mayRenderSheet(current)) notify(error.message);}
  finally {if(button.isConnected)button.disabled=false;}
}
async function loadData(epoch) {
  const [projects,tasks]=await Promise.all([api('/api/projects'),api('/api/tasks')]);
  if(epoch!==state.epoch) return false;
  if(!Array.isArray(projects.projects)||!Array.isArray(tasks.tasks))throw new ApiError('Les données du tableau de bord sont incomplètes.');
  state.projects=projects.projects;state.tasks=tasks.tasks;return true;
}
async function validateSession({message=''}={}) {
  if(validationPromise) return validationPromise;
  validationPromise=(async()=>{
    const candidate=state.session || storedSession();
    purgePrivate({keepDraft:true});loadingScreen();
    const epoch=state.epoch;
    if(candidate) {state.session=candidate;state.remember=candidate.remember ?? state.remember;}
    try {
      const me=await api('/api/me');
      if(epoch!==state.epoch)return;
      state.configured=!!me.configured;
      if(!me.authenticated || !candidate || candidate.expiresAt<=Date.now()) {
        state.session=null;removeStoredSession();state.loginError=message || (candidate ? 'Ta session a expiré. Reconnecte-toi pour continuer.' : '');
        renderLogin();return;
      }
      state.session={...candidate,login:me.login,csrf:me.csrf};
      if(!await loadData(epoch))return;
      state.authenticated=true;scheduleExpiry();renderPrivate();
    } catch(error) {
      if(epoch!==state.epoch)return;
      state.loginError=error.message;state.authenticated=false;renderLogin();
    }
  })();
  try {await validationPromise;} finally {validationPromise=null;}
}
function formError(form,message) {
  const target=form.querySelector('.form-error');if(target){target.textContent=message;target.hidden=false;target.tabIndex=-1;target.focus();}
}
function submitting(form,busy,values={}) {setFormBusy(form,busy,{scope:form.closest('dialog') || form.closest('.login-card') || form,values});}
async function authenticate(form) {
  if(form.dataset.busy==='true')return;
  const data=Object.fromEntries(new FormData(form));const remember=data.remember==='on';
  const setup=state.setupAllowed&&!!state.activation;
  if(setup&&data.password!==data.confirmation)return formError(form,'Les deux phrases de passe ne correspondent pas.');
  submitting(form,true,data);const epoch=state.epoch;
  try {
    const result=await api(setup?'/api/setup':'/api/login',{method:'POST',anonymous:true,body:{login:data.login,password:data.password,remember,...(setup?{token:state.activation}:{})}});
    if(epoch!==state.epoch)return;
    state.session=result;state.remember=remember;state.configured=true;state.activation=null;state.setupAllowed=false;state.loginError='';
    storeSession(result,remember);form.reset();
    await validateSession();
  } catch(error){if(epoch===state.epoch)formError(form,error.message);} finally {if(form.isConnected)submitting(form,false);}
}
function editorValues() {const form=dialog.querySelector('form');return form ? readFormValues(form) : {};}
function openEditor(kind,id=null,{projectId=null,values=null,revision=null,focus=null,dirty=false}={}) {
  if(!state.authenticated)return;
  returnFocus=document.activeElement;
  state.editor={kind,id,projectId,values,revision,dirty,focus};
  let title,body,footer;
  if(kind==='project') {
    const project=id?projectById(id):null;
    if(id&&!project)return;
    const value=values||project||{name:'',description:'',url:'',source:'',status:'À qualifier',dueDate:'',notes:''};
    state.editor.revision=revision??project?.revision;
    title=id?'Modifier le projet':'Nouveau projet';
    body=`<label for="project-name">Nom du projet <span class="required">*</span></label><input id="project-name" name="name" maxlength="100" required value="${e(value.name)}"><label for="project-description">Description</label><textarea id="project-description" name="description" rows="2" maxlength="600">${e(value.description)}</textarea><div class="form-grid"><div><label for="project-status">Statut</label><select id="project-status" name="status">${options(PROJECT_STATUSES,value.status)}</select></div><div><label for="project-due">Échéance <span class="optional">facultatif</span></label><input id="project-due" name="dueDate" type="date" value="${e(value.dueDate || '')}"></div></div><label for="project-url">Adresse de l’application <span class="optional">facultatif</span></label><input id="project-url" name="url" type="url" maxlength="2000" placeholder="https://…" value="${e(value.url)}"><p class="field-hint">Ajouter une adresse ne change pas les droits d’accès de l’application.</p><label for="project-source">Lien vers une ressource <span class="optional">facultatif</span></label><input id="project-source" name="source" type="url" maxlength="2000" placeholder="https://…" value="${e(value.source)}"><label for="project-notes">Notes privées</label><textarea id="project-notes" name="notes" rows="6" maxlength="8000" placeholder="Idées, décisions, prochaines pistes…">${e(value.notes)}</textarea><p class="field-hint">Ces notes restent dans ton tableau de bord, même si l’application est publique.</p>`;
    footer='<button type="button" class="button" data-action="close-editor">Annuler</button><button type="submit" class="button primary">Enregistrer le projet</button>';
  } else if(kind==='task') {
    const task=id?taskById(id):null;
    if(id&&!task)return;
    const value=values||task||{title:'',status:'À faire',dueDate:'',projectId:projectId||state.projects.find(project=>!project.archived)?.id};
    state.editor.revision=revision??task?.revision;
    title=id?'Modifier la tâche':'Nouvelle tâche';
    const projects=state.projects.filter(project=>!project.archived);
    body=`<label for="task-title">Prochaine action <span class="required">*</span></label><input id="task-title" name="title" maxlength="200" required value="${e(value.title)}" placeholder="Une action concrète…"><label for="task-project">Projet</label>${id?`<input name="projectId" type="hidden" value="${e(value.projectId)}"><p class="readonly-field">${e(projectById(value.projectId)?.name)}</p>`:`<select id="task-project" name="projectId" required>${projects.map(project=>`<option value="${e(project.id)}"${project.id===value.projectId?' selected':''}>${e(project.name)}</option>`).join('')}</select>`}<div class="form-grid"><div><label for="task-status">Statut</label><select id="task-status" name="status">${options(TASK_STATUSES,value.status)}</select></div><div><label for="task-due">Échéance <span class="optional">facultatif</span></label><input id="task-due" name="dueDate" type="date" value="${e(value.dueDate || '')}"></div></div>`;
    footer=`${id?'<button type="button" class="button text danger push-left" data-action="delete-task">Supprimer</button>':''}<button type="button" class="button" data-action="close-editor">Annuler</button><button type="submit" class="button primary">Enregistrer la tâche</button>`;
  } else if(kind==='worksheet') {
    const row=currentSheetRow(id);
    if(!row || worksheet.id!==projectId || projectById(projectId)?.archived){state.editor=null;return;}
    state.editor.revision=revision??row.revision;
    title='Modifier le suivi';
    body=worksheetEditor(row,worksheet.data,values||row);
    footer='<button type="button" class="button" data-action="close-editor">Annuler</button><button type="submit" class="button primary">Enregistrer</button>';
  } else if(kind==='account') {
    title='Mon compte';
    body=`<p class="account-intro">Connecté avec <strong>${e(state.session.login)}</strong>.</p><h3>Changer mon mot de passe</h3><p class="field-hint">Ce changement déconnecte tes autres sessions.</p><label for="current-password">Mot de passe actuel</label><input id="current-password" type="password" name="currentPassword" autocomplete="current-password" maxlength="256" required><label for="new-password">Nouvelle phrase de passe</label><input id="new-password" type="password" name="password" autocomplete="new-password" minlength="12" maxlength="256" required><p class="field-hint">Au moins 12 caractères, sans symbole obligatoire.</p><label for="confirm-password">Confirmer</label><input id="confirm-password" type="password" name="confirmation" autocomplete="new-password" minlength="12" maxlength="256" required><label class="check-label"><input type="checkbox" name="remember"${state.remember?' checked':''}><span>Rester connecté pendant 30 jours</span></label>`;
    footer='<button type="button" class="button text danger push-left" data-action="logout">Me déconnecter</button><button type="submit" class="button primary">Changer le mot de passe</button>';
  } else return;
  dialog.innerHTML=`<div class="dialog-heading"><div><span class="small-tag">MON ESPACE PRIVÉ</span><h2 id="dialog-title">${title}</h2></div><button class="icon-button" type="button" data-action="close-editor" aria-label="Fermer">×</button></div><form data-form="editor"><div class="dialog-fields">${body}<div class="form-error" role="alert" hidden></div><div class="conflict-actions" hidden><button type="button" class="button small" data-action="reload-editor">Charger la version actuelle</button><p class="field-hint">Cette action remplacera les champs de ton brouillon après confirmation.</p></div></div><div class="dialog-footer">${footer}</div></form>`;
  if(!dialog.open)dialog.showModal();
  requestAnimationFrame(()=>{if(focus)document.getElementById(focus)?.focus();else dialog.querySelector('input:not([type="hidden"]),textarea,select')?.focus();});
}
async function closeEditor({force=false}={}) {
  if(!force&&dialog.querySelector('form')?.dataset.busy==='true'){notify('Enregistrement en cours…');return false;}
  const epoch=state.epoch,editor=state.editor;
  if(!force&&editor?.dirty) {
    const accepted=await confirmation.request({title:'Abandonner les modifications ?',message:'Les modifications de ce formulaire n’ont pas encore été enregistrées.',confirmLabel:'Abandonner',destructive:true});
    if(!accepted||epoch!==state.epoch||state.editor!==editor)return false;
  }
  hideEditor();if(returnFocus?.isConnected)returnFocus.focus();else document.querySelector('#main')?.focus({preventScroll:true});
  return true;
}
async function saveEditor(form) {
  if(form.dataset.busy==='true'||!state.editor)return;
  const editor={...state.editor};const values=editorValues();
  let error='';
  if(editor.kind==='project')error=validateProject(values);
  if(editor.kind==='task')error=validateTask(values);
  if(editor.kind==='account'&&values.password!==values.confirmation)error='Les deux phrases de passe ne correspondent pas.';
  if(error)return formError(form,error);
  submitting(form,true,values);const epoch=state.epoch;
  try {
    if(editor.kind==='project') {
      const body={...values,name:values.name.trim(),description:values.description.trim(),url:values.url.trim(),source:values.source.trim(),dueDate:values.dueDate||null};
      if(editor.id)body.revision=editor.revision;
      const result=await api(editor.id?`/api/projects/${encodeURIComponent(editor.id)}`:'/api/projects',{method:editor.id?'PATCH':'POST',body});
      if(epoch!==state.epoch)return;
      state.projects=editor.id?state.projects.map(project=>project.id===editor.id?result.project:project):[...state.projects,result.project];
      state.selected=result.project.id;state.view='project';
    } else if(editor.kind==='task') {
      const body={title:values.title.trim(),status:values.status,dueDate:values.dueDate||null,...(editor.id?{revision:editor.revision}:{})};
      const result=await api(editor.id?`/api/tasks/${encodeURIComponent(editor.id)}`:`/api/projects/${encodeURIComponent(values.projectId)}/tasks`,{method:editor.id?'PATCH':'POST',body});
      if(epoch!==state.epoch)return;
      state.tasks=editor.id?state.tasks.map(task=>task.id===editor.id?result.task:task):[...state.tasks,result.task];
    } else if(editor.kind==='worksheet') {
      const result=await api(worksheetPath(editor.projectId)+'/rows/'+encodeURIComponent(editor.id),{method:'PATCH',body:{revision:editor.revision,priority:values.priority,status:values.status,comment:values.comment}});
      if(epoch!==state.epoch || worksheet?.id!==editor.projectId)return;
      worksheet.data.rows=worksheet.data.rows.map(row=>row.id===result.row.id?result.row:row);
    } else {
      const remember=values.remember==='on';
      const result=await api('/api/password',{method:'POST',body:{currentPassword:values.currentPassword,password:values.password,remember}});
      if(epoch!==state.epoch)return;
      state.session=result;state.remember=remember;storeSession(result,remember);scheduleExpiry();
    }
    if(epoch!==state.epoch)return;
    state.editor.dirty=false;
    closeEditor({force:true});renderPrivate({focus:true});notify(editor.kind==='account'?'Mot de passe modifié. Les autres sessions sont déconnectées.':'C’est enregistré.');
  } catch(error) {
    if(epoch!==state.epoch)return;
    formError(form,error.message);
    if(error.status===409&&editor.kind!=='account')dialog.querySelector('.conflict-actions').hidden=false;
  } finally {if(form.isConnected)submitting(form,false);}
}
async function reloadEditor() {
  const form=dialog.querySelector('form');
  if(!state.editor||form?.dataset.busy==='true')return;
  const editor=state.editor,{kind,id,projectId}=editor,epoch=state.epoch;
  const accepted=await confirmation.request({title:'Charger la version actuelle ?',message:'Les champs de ce formulaire seront remplacés par la dernière version enregistrée. Ton brouillon actuel sera abandonné.',confirmLabel:'Charger la version',destructive:true});
  if(!accepted||epoch!==state.epoch||state.editor!==editor||!form.isConnected)return;
  submitting(form,true,editorValues());
  try {
    if(kind==='worksheet') {
      await fetchWorksheet(projectId,true);
      if(epoch!==state.epoch || state.editor!==editor)return;
      if(worksheet?.error)throw new ApiError(worksheet.error);
      if(!currentSheetRow(id))throw new ApiError('Cette option ne figure plus dans le tableau.');
      openEditor(kind,id,{projectId});drawWorksheet();
    } else if(await loadData(epoch)){
      state.editor.dirty=false;openEditor(kind,id,{projectId});renderPrivate();
    }
  }
  catch(error){if(epoch===state.epoch)formError(form,error.message);}
  finally {if(form.isConnected)submitting(form,false);}
}
async function toggleTask(id) {
  const task=taskById(id);if(!task||projectById(task.projectId)?.archived)return;
  const epoch=state.epoch;
  try {
    const result=await api(`/api/tasks/${encodeURIComponent(id)}`,{method:'PATCH',body:{revision:task.revision,status:task.status==='Terminé'?'À faire':'Terminé'}});
    if(epoch!==state.epoch)return;
    state.tasks=state.tasks.map(item=>item.id===id?result.task:item);renderContent();notify(result.task.status==='Terminé'?'Une étape de plus, c’est fait.':'Tâche rouverte.');
  } catch(error){if(epoch===state.epoch)notify(error.status===409?'Cette tâche a changé dans une autre fenêtre. Actualise le tableau de bord.':error.message);}
}
async function archiveProject(id,archived) {
  const project=projectById(id);if(!project)return;
  const epoch=state.epoch;
  if(archived) {
    const accepted=await confirmation.request({title:'Archiver ce projet ?',message:'Le projet quittera les vues actives. Ses notes et ses tâches seront conservées ; tu pourras le restaurer depuis les archives.',confirmLabel:'Archiver le projet'});
    if(!accepted||epoch!==state.epoch||!state.authenticated)return;
  }
  try {
    const result=await api(`/api/projects/${encodeURIComponent(id)}`,{method:'PATCH',body:{revision:project.revision,archived}});
    if(epoch!==state.epoch)return;
    state.projects=state.projects.map(item=>item.id===id?result.project:item);renderPrivate();notify(archived?'Projet archivé. Tu peux le restaurer depuis les archives.':'Projet restauré.');
  }catch(error){if(epoch===state.epoch)notify(error.message);}
}
async function deleteTask() {
  const form=dialog.querySelector('form');
  if(!form||form.dataset.busy==='true')return;
  const id=state.editor?.kind==='task'?state.editor.id:null;const task=taskById(id);
  if(!task)return;
  const epoch=state.epoch,editor=state.editor,revision=editor.revision;
  const accepted=await confirmation.request({title:'Supprimer cette tâche ?',message:'Cette suppression est définitive. Les autres tâches et les notes du projet seront conservées.',confirmLabel:'Supprimer la tâche',destructive:true});
  if(!accepted||epoch!==state.epoch||state.editor!==editor||!form.isConnected)return;
  submitting(form,true,editorValues());
  try {
    await api(`/api/tasks/${encodeURIComponent(id)}`,{method:'DELETE',body:{revision}});
    if(epoch!==state.epoch)return;
    state.tasks=state.tasks.filter(item=>item.id!==id);closeEditor({force:true});renderPrivate();notify('Tâche supprimée.');
  }catch(error){if(epoch===state.epoch)formError(form,error.message);}
  finally {if(form.isConnected)submitting(form,false);}
}
function openShare(id) {
  const project=projectById(id);if(!project||!canShare(project))return;
  returnFocus=document.activeElement;state.editor={kind:'share',id,dirty:false};
  dialog.innerHTML=`<div class="dialog-heading"><div><span class="small-tag">APPLICATION PUBLIQUE</span><h2 id="dialog-title">Partager ${e(project.name)}</h2></div><button class="icon-button" data-action="close-editor" aria-label="Fermer">×</button></div><div class="dialog-fields"><p>Cette adresse ouvre l’application sans compte. Ton tableau de bord, tes tâches et tes notes restent privés.</p><label for="share-url">Lien à envoyer</label><input id="share-url" readonly value="${e(safeHref(project.url))}"><p class="field-hint">Toute personne qui reçoit cette adresse peut l’utiliser et la transmettre.</p><div class="form-error" role="alert" hidden></div></div><div class="dialog-footer"><button class="button" data-action="close-editor">Fermer</button><button class="button primary" data-action="copy-url">Copier le lien</button></div>`;
  dialog.showModal();
}
async function copyUrl() {
  const project=projectById(state.editor?.id);if(!project||!canShare(project))return;
  const epoch=state.epoch;
  try {await navigator.clipboard.writeText(safeHref(project.url));if(epoch===state.epoch)notify('Lien public copié. Prêt à envoyer.');}
  catch {if(epoch!==state.epoch)return;const input=document.querySelector('#share-url');input.focus();input.select();const error=dialog.querySelector('.form-error');error.textContent='La copie automatique n’est pas disponible. Copie l’adresse sélectionnée avec le menu de ton appareil.';error.hidden=false;}
}
async function logout() {
  const epoch=state.epoch;
  if(state.editor?.dirty||state.pendingDraft) {
    const accepted=await confirmation.request({title:'Te déconnecter ?',message:'Tes modifications non enregistrées seront abandonnées. Les données déjà enregistrées restent dans ton espace.',confirmLabel:'Abandonner et me déconnecter',destructive:true});
    if(!accepted||epoch!==state.epoch||!state.authenticated)return;
  }
  const token=state.session;const request=token?api('/api/logout',{method:'POST',body:{}}):Promise.resolve();
  lock('',{keepDraft:false});state.view='overview';state.selected=null;
  try {localStorage.setItem(LOGOUT_KEY,String(Date.now()));}catch{}
  try {await request;notify('Tu es déconnecté.');}catch {notify('Déconnecté sur cet appareil. Le service n’a pas confirmé la fermeture de la session distante.');}
}
function navigate(view,id=null) {
  if(!state.authenticated)return;
  if (id!==state.selected || view!=='project') {worksheet=null;sheetFilters=worksheetFilters();}
  const url=new URL(location.href);
  if(view==='project' && id)url.searchParams.set('projet',id);else url.searchParams.delete('projet');
  history.replaceState(null,'',url);
  state.view=view;state.selected=id;renderPrivate({focus:true});window.scrollTo({top:0,behavior:'instant'});
}
async function discardDraft() {
  const draft=state.pendingDraft,epoch=state.epoch;if(!draft)return;
  const accepted=await confirmation.request({title:'Abandonner ce brouillon ?',message:'Ce brouillon est conservé uniquement dans cet onglet. Il sera supprimé sans modifier les données déjà enregistrées.',confirmLabel:'Abandonner le brouillon',destructive:true});
  if(!accepted||epoch!==state.epoch||state.pendingDraft!==draft)return;
  state.pendingDraft=null;renderPrivate();
}
async function handleAction(button) {
  const action=button.dataset.action,id=button.dataset.id;
  if(button.disabled)return;
  if(action==='retry-login'){state.loginError='';await boot();return;}
  if(action==='close-editor'){await closeEditor();return;}
  if(!state.authenticated)return;
  switch(action) {
    case 'worksheet-edit':openEditor('worksheet',id,{projectId:state.selected});break;
    case 'worksheet-download':await downloadWorksheet(button);break;
    case 'worksheet-retry':await fetchWorksheet(state.selected,true);drawWorksheet();break;
    case 'worksheet-page':{
      sheetFilters.page=Number(button.dataset.page);
      drawWorksheet();
      const heading=document.getElementById('worksheet-title');
      if(heading){heading.tabIndex=-1;heading.focus();}
      break;
    }
    case 'new-project':openEditor('project');break;
    case 'edit-project':openEditor('project',id,{focus:button.dataset.focus});break;
    case 'open-project':navigate('project',id);break;
    case 'new-task':if(state.projects.some(project=>!project.archived))openEditor('task',null,{projectId:button.dataset.project});break;
    case 'edit-task':openEditor('task',id);break;
    case 'toggle-task':button.disabled=true;try{await toggleTask(id);}finally{if(button.isConnected)button.disabled=false;}break;
    case 'archive-project':await archiveProject(id,true);break;
    case 'restore-project':await archiveProject(id,false);break;
    case 'delete-task':await deleteTask();break;
    case 'share':openShare(id);break;
    case 'copy-url':await copyUrl();break;
    case 'account':openEditor('account');break;
    case 'logout':await logout();break;
    case 'refresh':await validateSession();break;
    case 'reload-editor':await reloadEditor();break;
    case 'due-tasks':state.filters.tasks={query:'',status:'open',projectId:'',dueOnly:true};navigate('tasks');break;
    case 'reset-project-filters':state.filters.projects={query:'',status:'',archived:false};renderContent();break;
    case 'reset-task-filters':state.filters.tasks={query:'',status:'open',projectId:''};renderContent();break;
    case 'discard-draft':await discardDraft();break;
    case 'resume-draft':{const draft=state.pendingDraft;
      if(draft?.kind==='worksheet'){
        const project=projectById(draft.projectId), epoch=state.epoch;
        if(!project?.hasWorksheet || project.archived){notify('Le tableau de ce brouillon est indisponible.');break;}
        navigate('project',project.id);await fetchWorksheet(project.id);
        if(epoch!==state.epoch || state.pendingDraft!==draft || state.selected!==project.id)break;
        if(!currentSheetRow(draft.id)){notify(worksheet?.error || 'Cette option est indisponible. Ton brouillon est conservé.');break;}
        state.pendingDraft=null;renderPrivate();openEditor('worksheet',draft.id,draft);break;
      }
      if(draft?.id&&!(draft.kind==='project'?projectById(draft.id):taskById(draft.id))){notify('L’élément du brouillon n’est plus disponible. Le brouillon reste conservé dans cet onglet.');break;}state.pendingDraft=null;renderPrivate();if(draft)openEditor(draft.kind,draft.id,{...draft});break;}
  }
}
document.addEventListener('click',event=>{
  const action=event.target.closest('[data-action]'),navigation=event.target.closest('[data-view]');
  if(action){event.preventDefault();handleAction(action).catch(error=>notify(error.message || 'Cette action n’a pas abouti.'));}
  else if(navigation){event.preventDefault();navigate(navigation.dataset.view);}
});
document.addEventListener('submit',event=>{
  const form=event.target.closest('form[data-form]');if(!form)return;event.preventDefault();
  (form.dataset.form==='login'?authenticate(form):saveEditor(form)).catch(error=>{if(form.isConnected)formError(form,error.message);});
});
dialog.addEventListener('input',()=>{if(state.editor)state.editor.dirty=true;});
dialog.addEventListener('change',()=>{if(state.editor)state.editor.dirty=true;});
dialog.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
function updateFilter(event) {
  const input=event.target;
  const sheetKey=input.dataset.worksheetFilter;
  if(sheetKey) {
    if((input.tagName==='SELECT')!==(event.type==='change'))return;
    sheetFilters[sheetKey]=input.value;sheetFilters.page=1;
    const start=input.selectionStart,end=input.selectionEnd;
    drawWorksheet();
    const replacement=document.getElementById(input.id);
    replacement?.focus({preventScroll:true});
    if(typeof start==='number')replacement?.setSelectionRange(start,end);
    return;
  }
  const key=input.dataset.filter;if(!key)return;
  if(event.type==='input'&&input.tagName==='SELECT')return;
  if(event.type==='change'&&input.tagName==='INPUT')return;
  const mappings={'project-query':['projects','query'],'project-status':['projects','status'],'project-archive':['projects','archived'],'task-query':['tasks','query'],'task-status':['tasks','status'],'task-project':['tasks','projectId']};
  const [group,field]=mappings[key];state.filters[group][field]=field==='archived'?input.value==='archived':input.value;
  renderContent({restoreInput:{id:input.id,start:input.selectionStart,end:input.selectionEnd}});
}
document.addEventListener('input',updateFilter);document.addEventListener('change',updateFilter);
window.addEventListener('storage',event=>{
  if(event.key===LOGOUT_KEY&&event.newValue)lock('Déconnecté depuis un autre onglet.',{keepDraft:true});
  else if(event.key===SESSION_KEY&&state.remember&&event.newValue!==JSON.stringify({sessionToken:state.session?.sessionToken,expiresAt:state.session?.expiresAt})) {
    state.session=null;if(document.visibilityState==='visible')validateSession();else purgePrivate({keepDraft:true});
  }
});
window.addEventListener('pagehide',()=>{if(state.authenticated){purgePrivate({keepDraft:true});loadingScreen();}});
window.addEventListener('pageshow',event=>{if(event.persisted)validateSession();});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'&&state.authenticated){purgePrivate({keepDraft:true});loadingScreen();}
  else if(document.visibilityState==='visible'&&state.session)validateSession();
});
window.addEventListener('beforeunload',event=>{if(state.editor?.dirty||state.pendingDraft){event.preventDefault();event.returnValue='';}});
async function boot() {
  loadingScreen('Ouverture de ton espace…');
  try {
    if(state.apiBase===null) {
      const response=await fetch('/portal.config.json',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error();
      const config=await response.json();
      const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
      if(config.apiBase===''&&local)state.apiBase='';
      else {const url=new URL(config.apiBase);if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(local&&url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error();state.apiBase=url.origin;}
    }
    if(state.activation) {
      try {await api('/api/setup/check',{method:'POST',anonymous:true,body:{token:state.activation}});state.setupAllowed=true;}
      catch(error){state.setupAllowed=false;state.loginError=error.message;}
    }
    const error=state.loginError;
    await validateSession({message:error});
  } catch {state.loginError='Impossible de joindre le service Papaye. Réessaie dans un instant.';renderLogin();}
}
boot();
