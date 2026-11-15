/** Papaye Explorateurs — calendrier simple, local et explicite (pas FSRS). */
export const STORAGE_KEY = 'papaye-explorateurs-v1';
const DAY = 86400000;
const MAX_TIME = Date.UTC(2101, 0, 1);
const MAX_BYTES = 3 * 1024 * 1024;
const BADGES = ['first-review', 'twelve-cards', 'three-days', 'hundred-xp'];
const fail = (message) => { throw new Error(message); };
const plain = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null);
const integer = (x, min, max) => Number.isSafeInteger(x) && x >= min && x <= max;
const validId = (x) => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(x) && !['__proto__', 'constructor', 'prototype'].includes(x);
const exact = (x, fields) => plain(x) && Object.keys(x).every(k => fields.includes(k)) && fields.every(k => Object.hasOwn(x, k));
const checkTime = now => { if (!integer(now, 0, MAX_TIME - 180 * DAY)) fail('Date de révision invalide.'); };
export function dayKey(now = Date.now()) {
  checkTime(now);
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function validDay(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y,m,d] = key.split('-').map(Number);
  const v = new Date(y,m-1,d,12);
  return v.getFullYear() === y && v.getMonth() === m-1 && v.getDate() === d;
}
export function createProfile(name, avatar = '🦊') {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 24) fail('Choisissez un prénom de 1 à 24 caractères.');
  if (typeof avatar !== 'string' || !avatar || avatar.length > 12) fail('Avatar invalide.');
  const id = globalThis.crypto?.randomUUID?.() ?? `p-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, name: name.trim(), avatar, xp: 0, goal: 5, reviews: {}, daily: {}, badges: [] };
}
function deriveBadges(profile) {
  const count = Object.keys(profile.reviews).length;
  return BADGES.filter(id => ({'first-review': count >= 1, 'twelve-cards': count >= 12, 'three-days': Object.values(profile.daily).filter(d => d.count > 0).length >= 3, 'hundred-xp': profile.xp >= 100})[id]);
}
export function getQueue(profile, cards, now = Date.now()) {
  checkTime(now);
  const seen = new Set();
  const unique = cards.filter(card => { if (!validId(card.id)) fail('Identifiant de carte invalide.'); if (seen.has(card.id)) return false; seen.add(card.id); return true; });
  const due = unique.filter(c => profile.reviews[c.id] && profile.reviews[c.id].due <= now)
    .sort((a,b) => profile.reviews[a.id].due - profile.reviews[b.id].due);
  const fresh = unique.filter(c => !profile.reviews[c.id]);
  return [...due, ...fresh].slice(0, profile.goal);
}
export function reviewCard(profile, cardId, rating, now = Date.now()) {
  checkTime(now);
  if (!validId(cardId) || !['again','good','easy'].includes(rating)) fail('Révision invalide.');
  const previous = profile.reviews[cardId];
  if (previous && previous.due > now) fail('Cette carte est prévue pour plus tard.');
  const next = structuredClone(profile);
  const interval = rating === 'again' ? 600000 : Math.round(Math.min(180 * DAY,
    rating === 'good' ? Math.max(DAY, (previous?.interval ?? 0) * 2) : Math.max(3 * DAY, (previous?.interval ?? 0) * 2.5))); 
  next.reviews[cardId] = { interval, due: now + interval, lastReviewed: now, repetitions: (previous?.repetitions ?? 0) + 1, rating };
  const key = dayKey(now);
  const daily = next.daily[key] ?? { count: 0, cardIds: [], goalAwarded: false };
  if (!daily.cardIds.includes(cardId)) {
    daily.cardIds.push(cardId);
    daily.count = daily.cardIds.length;
    next.xp += 10;
  }
  if (!daily.goalAwarded && daily.count >= next.goal) {
    next.xp += 20;
    daily.goalAwarded = true;
  }
  next.daily[key] = daily;
  next.badges = deriveBadges(next);
  return next;
}
export function getStats(profile, cards, now = Date.now()) {
  checkTime(now);
  const ids = [...new Set(cards.map(c => c.id))];
  const reviewed = ids.map(id => profile.reviews[id]).filter(Boolean);
  const future = reviewed.map(r => r.due).filter(due => due > now);
  return { due: reviewed.filter(r => r.due <= now).length, newCount: ids.length - reviewed.length,
    learned: reviewed.filter(r => r.rating !== 'again').length,
    todayCount: profile.daily[dayKey(now)]?.count ?? 0, goal: profile.goal,
    xp: profile.xp, level: Math.floor(profile.xp / 100) + 1,
    badges: deriveBadges(profile), nextDue: future.length ? Math.min(...future) : null };
}
export function validateState(value) {
  let serialized;
  try { serialized = JSON.stringify(value); } catch { fail('Sauvegarde non sérialisable.'); }
  if (!serialized || serialized.length > MAX_BYTES) fail('Sauvegarde trop volumineuse (3 Mo maximum).');
  if (!exact(value, ['version','activeProfileId','profiles']) || value.version !== 1 || !Array.isArray(value.profiles) || value.profiles.length < 1 || value.profiles.length > 12) fail('Format de sauvegarde invalide.');
  const ids = new Set();
  for (const p of value.profiles) {
    if (!exact(p, ['id','name','avatar','xp','goal','reviews','daily','badges']) || !validId(p.id) || ids.has(p.id)) fail('Profil invalide ou dupliqué.');
    ids.add(p.id);
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 24 || typeof p.avatar !== 'string' || !p.avatar || p.avatar.length > 12 || !integer(p.goal,1,30) || !integer(p.xp,0,100000000)) fail('Paramètres du profil invalides.');
    if (!plain(p.reviews) || Object.keys(p.reviews).length > 2000 || !plain(p.daily) || Object.keys(p.daily).length > 3660 || !Array.isArray(p.badges) || p.badges.length > 4 || new Set(p.badges).size !== p.badges.length || p.badges.some(b => !BADGES.includes(b))) fail('Progression invalide.');
    for (const [id,r] of Object.entries(p.reviews)) {
      if (!validId(id) || !exact(r,['interval','due','lastReviewed','repetitions','rating']) || !integer(r.interval,600000,180*DAY) || !integer(r.lastReviewed,0,MAX_TIME) || !integer(r.due,0,MAX_TIME) || r.due !== r.lastReviewed + r.interval || !integer(r.repetitions,1,1000000) || !['again','good','easy'].includes(r.rating)) fail('Calendrier de révision invalide.');
    }
    for (const [key,d] of Object.entries(p.daily)) {
      if (!validDay(key) || !exact(d,['count','cardIds','goalAwarded']) || !Array.isArray(d.cardIds) || !integer(d.count,0,2000) || d.count !== d.cardIds.length || new Set(d.cardIds).size !== d.count || d.cardIds.some(id => !validId(id) || !Object.hasOwn(p.reviews,id)) || typeof d.goalAwarded !== 'boolean') fail('Historique quotidien invalide.');
    }
  }
  if (!ids.has(value.activeProfileId)) fail('Profil actif introuvable.');
  const clone = JSON.parse(serialized);
  for (const p of clone.profiles) { p.name = p.name.trim(); p.badges = deriveBadges(p); }
  return clone;
}
export function loadState(storage = globalThis.localStorage) {
  if (!storage) fail('Le stockage local est indisponible.');
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    const profile = createProfile('Explorateur');
    return { version: 1, activeProfileId: profile.id, profiles: [profile] };
  }
  if (raw.length > MAX_BYTES) fail('Sauvegarde locale trop volumineuse.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('Sauvegarde locale illisible. Exportez-la avant toute réinitialisation.'); }
  return validateState(parsed);
}
export function saveState(state, storage = globalThis.localStorage) {
  if (!storage) fail('Le stockage local est indisponible.');
  const validated = validateState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(validated));
  return validated;
}
