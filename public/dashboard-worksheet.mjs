import {escape as e} from './dashboard-model.mjs';

const pageSize = 12;
export const worksheetFilters = () => ({query:'',code:'',priority:'',status:'',page:1});

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

function rowsMarkup(rows,archived) {
  return rows.map(row => `<tr>
    <td><strong class="ws-subject">${e(row.subject)}</strong><p>${e(row.description)}</p>
    <details><summary>Repères et support</summary><div>${[row.ref,row.family,row.support].filter(Boolean).map(e).join(' · ')}</div></details></td>
    <td data-label="Référence"><strong>${e(row.code)}</strong><br>${e(row.articles)}${row.pages?`<small>PDF p. ${e(row.pages)}</small>`:''}</td>
    <td data-label="Choix"><div>${row.priority?e(row.priority):'Priorité à choisir'}</div><div>${row.status?e(row.status):'Statut à choisir'}</div>
    ${row.comment?`<p class="ws-comment">${e(row.comment)}</p>`:''}
    ${archived?'':`<button class="button small" data-action="worksheet-edit" data-id="${e(row.id)}" aria-label="Modifier le suivi de ${e(row.subject)}">Modifier</button>`}</td>
  </tr>`).join('');
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
    ${rows.length?`<table class="ws-table" aria-labelledby="worksheet-title"><thead><tr><th scope="col">Feuille de calcul</th><th scope="col">Code et paragraphes</th><th scope="col">Mon suivi</th></tr></thead><tbody>${rowsMarkup(rows.slice(offset,offset+pageSize),archived)}</tbody></table>`:''}
    ${pages>1?`<nav class="ws-pager" aria-label="Pages du tableau"><button class="button small" data-action="worksheet-page" data-page="${page-1}" ${page===1?'disabled':''}>Précédente</button><span>Page ${page} sur ${pages}</span><button class="button small" data-action="worksheet-page" data-page="${page+1}" ${page===pages?'disabled':''}>Suivante</button></nav>`:''}`;
}
