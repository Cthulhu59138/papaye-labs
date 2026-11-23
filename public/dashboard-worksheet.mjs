import {escape as e} from './dashboard-model.mjs';

const pageSize = 12;
export const worksheetFilters = () => ({query:'',code:'',priority:'',status:'',page:1,expandedId:null});

export function filterWorksheet(rows,filters) {
  const needle = filters.query.trim().toLocaleLowerCase('fr');
  return rows.filter(row => (!filters.code || row.code === filters.code)
    && (!filters.priority || row.priority === filters.priority)
    && (!filters.status || row.status === filters.status)
    && (!needle || [row.subject,row.description,row.ref,row.articles,row.family,row.comment].join(' ').toLocaleLowerCase('fr').includes(needle)));
}

function options(values,selected) {
  return values.filter(Boolean).map(value =>
    `<option value="${e(value)}"${selected===value?' selected':''}>${e(value)}</option>`).join('');
}
function filterSelect(key,label,blank,values,selected) {
  return `<label for="worksheet-${key}">${label}<select id="worksheet-${key}" data-worksheet-filter="${key}"><option value="">${blank}</option>${options(values,selected)}</select></label>`;
}
export function worksheetEditor(row,sheet,values=row) {
  return `<h3>${e(row.subject)}</h3><p>${e(row.description)}</p>
    <p><strong>${e(row.code)}</strong> · ${e(row.articles)}${row.pages?' · p. '+e(row.pages):''}</p>
    <div class="form-grid"><div><label for="worksheet-edit-priority">Priorité</label><select id="worksheet-edit-priority" name="priority"><option value="">Non renseignée</option>${options(sheet.priorities,values.priority)}</select></div>
    <div><label for="worksheet-edit-status">Statut</label><select id="worksheet-edit-status" name="status"><option value="">Non renseigné</option>${options(sheet.statuses,values.status)}</select></div></div>
    <label for="worksheet-edit-comment">Commentaire libre</label><textarea id="worksheet-edit-comment" name="comment" rows="4" maxlength="8000">${e(values.comment)}</textarea>`;
}

function detailMarkup(row,archived) {
  const references = [
    ['Code',row.code], ['Paragraphes',row.articles], ['Pages du PDF',row.pages],
    ['Repère',row.ref], ['Famille',row.family], ['Support',row.support]
  ].filter(([,value]) => value);
  const id=e(row.id);
  return `<tr class="ws-detail" id="ws-detail-${id}"><td colspan="3">
    <div class="ws-detail-body">
      <p class="ws-description">${e(row.description)}</p>
      <dl class="ws-references">${references.map(([label,value]) => `<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
      <div class="ws-followup"><div><strong>Commentaire</strong><p class="ws-comment">${row.comment?e(row.comment):'Aucun commentaire.'}</p></div>
      ${archived?'':`<button type="button" class="button small" data-action="worksheet-edit" data-id="${id}" aria-label="Modifier le suivi de ${e(row.subject)}">Modifier le suivi</button>`}</div>
    </div></td></tr>`;
}

function decisionCell(label,value) {
  return value
    ? `<td class="ws-choice"><span class="ws-mobile-label" aria-hidden="true">${label} · </span>${e(value)}</td>`
    : `<td class="ws-choice ws-unset"><span aria-hidden="true">—</span><span class="sr-only">Non renseigné</span></td>`;
}

function rowsMarkup(rows,expandedId,archived) {
  return rows.map(row => {
    const id=e(row.id);
    const expanded=String(row.id)===expandedId;
    return `<tr class="ws-summary${expanded?' ws-selected':''}" data-action="worksheet-toggle" data-id="${id}">
      <td><button type="button" class="ws-toggle" id="ws-toggle-${id}" aria-expanded="${expanded}"${expanded?` aria-controls="ws-detail-${id}"`:''}><span class="ws-chevron" aria-hidden="true"></span>${e(row.subject)}</button></td>
      ${decisionCell('Priorité',row.priority)}${decisionCell('Statut',row.status)}
    </tr>${expanded?detailMarkup(row,archived):''}`;
  }).join('');
}

export function worksheetMarkup(sheet,filters,archived=false) {
  const rows=filterWorksheet(sheet.rows,filters);
  const pages=Math.max(1,Math.ceil(rows.length/pageSize));
  const page=Math.min(pages,Math.max(1,filters.page));
  const offset=(page-1)*pageSize;
  const codes=[...new Set(sheet.rows.map(row=>row.code))].sort((a,b)=>a.localeCompare(b,'fr'));
  return `<div class="ws-heading"><h2 id="worksheet-title">${e(sheet.title)}</h2>
    <button class="button" data-action="worksheet-download">Télécharger le classeur Excel</button></div>
    <div class="ws-filters"><label for="worksheet-query">Rechercher<input id="worksheet-query" data-worksheet-filter="query" type="search" value="${e(filters.query)}" placeholder="Objet, paragraphe, repère…"></label>
    ${filterSelect('code','Code','Tous les codes',codes,filters.code)}
    ${filterSelect('priority','Priorité','Toutes les priorités',sheet.priorities,filters.priority)}
    ${filterSelect('status','Statut','Tous les statuts',sheet.statuses,filters.status)}</div>
    <p class="ws-count" role="status">${rows.length?`${offset+1} à ${Math.min(offset+pageSize,rows.length)} sur ${rows.length} option${rows.length>1?'s':''}`:'Aucune option pour ces filtres.'}</p>
    ${rows.length?`<table class="ws-table" aria-labelledby="worksheet-title"><thead><tr><th scope="col">Feuille de calcul</th><th scope="col">Priorité</th><th scope="col">Statut</th></tr></thead><tbody>${rowsMarkup(rows.slice(offset,offset+pageSize),filters.expandedId,archived)}</tbody></table>`:''}
    ${pages>1?`<nav class="ws-pager" aria-label="Pages du tableau"><button class="button small" data-action="worksheet-page" data-page="${page-1}" ${page===1?'disabled':''}>Précédente</button><span>Page ${page} sur ${pages}</span><button class="button small" data-action="worksheet-page" data-page="${page+1}" ${page===pages?'disabled':''}>Suivante</button></nav>`:''}`;
}
