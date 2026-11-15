export const PROJECT_STATUSES = ['À qualifier', 'Idée', 'En préparation', 'En cours', 'En pause', 'Terminé'];
export const TASK_STATUSES = ['À faire', 'En cours', 'Terminé'];
export const ACCESS_LABELS = {public:'Accessible sans compte', protected:'Connexion requise', unknown:'Accès à vérifier'};
export const SESSION_KEY = 'papaye.portal.session.v1';
export const LOGOUT_KEY = 'papaye.portal.logout.v1';

export const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export function safeHref(value) {
  try {const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;} catch {return null;}
}
export function parisDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris', year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part = name => parts.find(value => value.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function dateLabel(value) {
  return validDate(value) ? new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Paris'}).format(new Date(`${value}T12:00:00Z`)) : 'Sans échéance';
}
export function dueLabel(value, today = parisDay()) {
  if (!validDate(value)) return {label:'Sans échéance',overdue:false};
  if (value < today) return {label:`En retard · ${dateLabel(value)}`,overdue:true};
  if (value === today) return {label:'Aujourd’hui',overdue:false};
  return {label:dateLabel(value),overdue:false};
}
export function projectProgress(projectId, tasks) {
  const selected = tasks.filter(task => task.projectId === projectId);
  const done = selected.filter(task => task.status === 'Terminé').length;
  return {done,total:selected.length,percent:selected.length ? Math.round(done/selected.length*100) : null};
}
export function activeTasks(projects,tasks) {
  const ids = new Set(projects.filter(project => !project.archived).map(project => project.id));
  return tasks.filter(task => ids.has(task.projectId));
}
export function sortTasks(tasks) {
  return [...tasks].sort((a,b) => Number(a.status === 'Terminé') - Number(b.status === 'Terminé') || (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || a.title.localeCompare(b.title,'fr'));
}
export function filterProjects(projects,{query='',status='',archived=false}={}) {
  const needle = query.trim().toLocaleLowerCase('fr');
  return projects.filter(project => !!project.archived === archived && (!status || project.status === status) && (!needle || `${project.name} ${project.description}`.toLocaleLowerCase('fr').includes(needle))).sort((a,b) => a.name.localeCompare(b.name,'fr'));
}
export function filterTasks(projects,tasks,{query='',status='open',projectId=''}={}) {
  const needle = query.trim().toLocaleLowerCase('fr');
  return sortTasks(activeTasks(projects,tasks).filter(task => (!projectId || task.projectId === projectId) && (!status || (status === 'open' ? task.status !== 'Terminé' : task.status === status)) && (!needle || task.title.toLocaleLowerCase('fr').includes(needle))));
}
export function parseSession(value, now = Date.now()) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || !/^[A-Za-z0-9_-]{43}$/.test(parsed.sessionToken) || !Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= now) return null;
    return {sessionToken:parsed.sessionToken,expiresAt:parsed.expiresAt};
  } catch {return null;}
}
export function canShare(project) {return !project.archived && project.accessStatus === 'public' && !!safeHref(project.url);}
export function validateProject(values) {
  if (!values.name.trim() || values.name.trim().length > 100) return 'Le nom doit contenir entre 1 et 100 caractères.';
  if (values.description.length > 600 || values.notes.length > 8000) return 'La description ou les notes sont trop longues.';
  if ((values.url && !safeHref(values.url)) || (values.source && !safeHref(values.source))) return 'Utilise une adresse HTTPS sans identifiant intégré.';
  if (!PROJECT_STATUSES.includes(values.status)) return 'Choisis un statut de projet.';
  if (values.dueDate && !validDate(values.dueDate)) return 'Vérifie la date d’échéance.';
  return '';
}
export function validateTask(values) {
  if (!values.title.trim() || values.title.trim().length > 200) return 'Le titre doit contenir entre 1 et 200 caractères.';
  if (!values.projectId) return 'Choisis un projet.';
  if (!TASK_STATUSES.includes(values.status)) return 'Choisis un statut de tâche.';
  if (values.dueDate && !validDate(values.dueDate)) return 'Vérifie la date d’échéance.';
  return '';
}
