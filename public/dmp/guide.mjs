import { loadCatalogue } from './catalogue.mjs';

const byId = id => document.getElementById(id);
const travaux = byId('travaux');
const famille = byId('famille');
const serie = byId('serie');
const support = byId('support');
const groupe = byId('groupe');
const groupStep = byId('group-step');
const groupDetail = byId('group-detail');
const status = byId('guide-status');
const table = byId('candidats');
const retry = byId('guide-retry');
let data;

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function source(label, href) {
  const anchor = element('a', label);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function resetSelect(select, prompt) {
  select.replaceChildren(new Option(prompt, ''));
}

function fillFilter(select, prompt, values) {
  resetSelect(select, prompt);
  for (const value of [...new Set(values)].sort((a, b) => a.localeCompare(b, 'fr'))) {
    select.add(new Option(value, value));
  }
}

function seriesByWork() {
  return Object.entries(data.series).filter(([, item]) => !travaux.value || item.travaux === travaux.value);
}

function updateFamilies() {
  fillFilter(famille, 'Tous les milieux et ouvrages', seriesByWork().map(([, item]) => item.famille));
  updateSeries();
}

function updateSeries() {
  resetSelect(serie, 'Choisir une série');
  for (const [code, item] of seriesByWork()) {
    if (!famille.value || item.famille === famille.value) {
      serie.add(new Option([code, item.travaux, item.milieu].join(' · '), code));
    }
  }
  updateSupports();
}

function couplesForSeries() {
  return data.couples.filter(couple => couple.serie === serie.value);
}

function material(couple) {
  return couple.support || data.groupes[couple.groupe].support;
}

function updateSupports() {
  const selection = data.series[serie.value];
  byId('serie-detail').textContent = selection ? [selection.travaux, selection.milieu].join(' · ') : '';
  groupStep.disabled = !selection;
  fillFilter(support, 'Tous les supports', couplesForSeries().map(material));
  updateGroups();
}

function updateGroups() {
  resetSelect(groupe, serie.value ? 'Choisir un groupe' : 'Choisir d’abord une série');
  for (const couple of couplesForSeries()) {
    const surface = material(couple);
    if (support.value && surface !== support.value) continue;
    const item = data.groupes[couple.groupe];
    const label = [couple.groupe, surface, item.etat, item.fonction, item.temperature].filter(Boolean).join(' · ');
    groupe.add(new Option(label, couple.groupe));
  }
  showCandidates();
}

function describeGroup(couple) {
  const item = data.groupes[couple.groupe];
  const list = document.createElement('dl');
  list.className = 'guide-conditions';
  for (const [label, value] of [
    ['Support', material(couple)], ['État ou emplacement', item.etat],
    ['Protection recherchée', item.fonction], ['Température de surface en service', item.temperature]
  ]) {
    if (value) list.append(element('dt', label), element('dd', value));
  }
  groupDetail.append(list);
  if (item.reserve) {
    const note = element('p', item.reserve);
    note.className = 'group-note';
    if (item.complement) note.append(' ', source('Consulter la fiche citée', item.complement));
    groupDetail.append(note);
  }
  groupDetail.append(source('Codification EDF ' + couple.serie + ' ' + couple.groupe, couple.url));
}

function candidateRow(number) {
  const system = data.systemes[number];
  const row = document.createElement('tr');
  const header = document.createElement('th');
  header.scope = 'row';
  header.append(source('FNP ' + number, system.fiche));
  const products = [...new Set(system.produits.map(product => product.nom).filter(Boolean))];
  const documentCell = document.createElement('td');
  const sheet = source('Fiche technique', system.ft);
  sheet.setAttribute('aria-label', 'Fiche technique du FNP ' + number);
  documentCell.append(sheet);
  row.append(header, element('td', system.societe), element('td', products.join(' · ')), documentCell);
  return row;
}

function showCandidates() {
  groupDetail.replaceChildren();
  table.tBodies[0].replaceChildren();
  table.hidden = true;
  status.textContent = '';
  if (!groupe.value) return;

  const couple = couplesForSeries().find(item => item.groupe === groupe.value);
  describeGroup(couple);
  const count = couple.fnp.length;
  const code = couple.serie + ' ' + couple.groupe;
  if (!count) {
    status.textContent = 'Aucun système publié associé à ' + code + ' dans ce relevé EDF.';
    return;
  }
  status.textContent = count + (count === 1 ? ' système candidat pour ' : ' systèmes candidats pour ') + code + '.';
  table.tBodies[0].replaceChildren(...couple.fnp.map(candidateRow));
  table.hidden = false;
}

async function start() {
  retry.hidden = true;
  status.textContent = 'Chargement du tableau…';
  try {
    data = await loadCatalogue();
    fillFilter(travaux, 'Tous les travaux', Object.values(data.series).map(item => item.travaux));
    updateFamilies();
    travaux.disabled = famille.disabled = serie.disabled = false;
  } catch {
    status.textContent = 'Le tableau en ligne est momentanément indisponible. Le classeur Excel reste téléchargeable.';
    retry.hidden = false;
  }
}

travaux.addEventListener('change', updateFamilies);
famille.addEventListener('change', updateSeries);
serie.addEventListener('change', updateSupports);
support.addEventListener('change', updateGroups);
groupe.addEventListener('change', showCandidates);
retry.addEventListener('click', start);
start();
