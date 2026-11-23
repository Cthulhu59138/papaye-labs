import {escape as e} from './dashboard-model.mjs';

const pageSize=12;
export const worksheetFilters=()=>({query:'',code:'',priority:'',status:'',decision:'',page:1,expandedId:null});
const fields=[['status','Statut','statuses'],['decision','Décision','decisions'],['priority','Priorité','priorities']];

export function filterWorksheet(rows,filters) {
  const needle=filters.query.trim().toLocaleLowerCase('fr');
  return rows.filter(row=>(!filters.code || row.code===filters.code)
    && fields.every(([field])=>!filters[field] || row[field]===filters[field])
    && (!needle || [row.subject,row.description,row.ref,row.articles,row.family,row.decision,row.comment].join(' ').toLocaleLowerCase('fr').includes(needle)));
}
export function worksheetPage(rows,filters) {
  const matches=filterWorksheet(rows,filters),pages=Math.max(1,Math.ceil(matches.length/pageSize));
  const page=Math.min(pages,Math.max(1,filters.page)),offset=(page-1)*pageSize;
  return {items:matches.slice(offset,offset+pageSize),page,pages,offset,total:matches.length};
}
function options(values,selected) {
  return (values||[]).filter(Boolean).map(value=>
    `<option value="${e(value)}"${selected===value?' selected':''}>${e(value)}</option>`).join('');
}
function filterSelect(key,label,blank,values,selected) {
  return `<label for="worksheet-${key}">${label}<select id="worksheet-${key}" data-worksheet-filter="${key}"><option value="">${blank}</option>${options(values,selected)}</select></label>`;
}
function detailMarkup(row,archived,values) {
  const references=[['Pages du PDF',row.pages],['Repère',row.ref],['Famille',row.family],['Support',row.support]].filter(([,value])=>value);
  const id=e(row.id);
  return `<tr class="ws-detail" id="ws-detail-${id}"><td colspan="6"><div class="ws-detail-body">
    <p class="ws-description">${e(row.description)}</p>
    <dl class="ws-references">${references.map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>
    <label for="ws-comment-${id}">Commentaire libre</label>
    ${archived?`<p id="ws-comment-${id}" class="ws-comment">${e(row.comment)||'Aucun commentaire.'}</p>`:`<textarea id="ws-comment-${id}" rows="2" maxlength="8000" data-row="${id}" data-ws-field="comment">${e(values.comment??row.comment)}</textarea>`}
    </div></td></tr>`;
}
export function worksheetFeedback(row,entry) {
  if(!entry) return '';
  const id=e(row.id);
  if(!entry.error || entry.busy) return '';
  const labels={status:'Statut',decision:'Décision',priority:'Priorité',comment:'Commentaire'};
  const comparison=entry.conflict && entry.reviewed
    ? `<div>Valeurs déjà enregistrées : ${Object.keys(entry.values).map(f=>e(labels[f])+' · '+(e(row[f])||'—')).join(' / ')}</div>`:'';
  const label=entry.conflict?(entry.reviewed?'Appliquer ma saisie':'Relire la ligne'):'Réessayer';
  return `<div role="alert">${e(entry.error)}</div>${comparison}<button class="button small" type="button" id="ws-retry-${id}" data-action="worksheet-save-retry" data-id="${id}">${label}</button>
    ${!entry.conflict||entry.reviewed?`<button type="button" class="button text small" data-action="worksheet-discard" data-id="${id}">Écarter ma saisie</button>`:''}`;
}
function rowsMarkup(rows,sheet,filters,archived,edits) {
  return rows.map(row=>{
    const id=e(row.id), expanded=String(row.id)===filters.expandedId, entry=edits.get(row.id), values=entry?.values??{};
    const toggle=`data-action="worksheet-toggle" data-id="${id}" aria-expanded="${expanded}"${expanded?` aria-controls="ws-detail-${id}"`:''}`;
    return `<tr class="ws-summary${expanded?' ws-selected':''}" data-ws-row="${id}">
      <th scope="row"><button class="ws-toggle ws-subject" id="ws-toggle-${id}" ${toggle}>${e(row.subject)}</button>
      <div class="ws-feedback" id="ws-feedback-${id}" aria-live="polite">${worksheetFeedback(row,entry)}</div></th>
      <td class="ws-disclosure"><button type="button" class="ws-toggle ws-detail-toggle" id="ws-chevron-${id}" ${toggle} aria-label="${expanded?'Replier':'Déplier'} les détails de ${e(row.subject)}"><span class="ws-chevron" aria-hidden="true"></span></button></td>
      <td class="ws-citation"><strong>${e(row.code)}</strong><span>${e(row.articles)}</span></td>
      ${fields.map(([field,label,list])=>{
        const value=values[field]??row[field]??'';
        return `<td class="ws-choice"><span class="ws-mobile-label" aria-hidden="true">${label}</span>${archived?e(value)||'—':field==='decision'?`<input type="text" list="ws-decision-suggestions" maxlength="400" autocomplete="off" id="ws-decision-${id}" data-row="${id}" data-ws-field="decision" aria-label="Décision pour ${e(row.subject)}" value="${e(value)}">`:`<select id="ws-${field}-${id}" data-row="${id}" data-ws-field="${field}" aria-label="${label} pour ${e(row.subject)}"><option value="">—</option>${options(sheet[list],value)}</select>`}</td>`;
      }).join('')}</tr>${expanded?detailMarkup(row,archived,values):''}`;
  }).join('');
}
export function worksheetRecovery(rows,edits,visibleIds) {
  return [...edits.values()].filter(entry=>entry.error && !visibleIds.has(entry.id)).map(entry=>{
    const row=rows.find(item=>item.id===entry.id);
    return row?`<button type="button" class="button small" data-action="worksheet-find-draft" data-id="${e(row.id)}">Reprendre la saisie · ${e(row.subject)}</button>`:'';
  }).join('');
}
export function worksheetMarkup(sheet,filters,archived=false,edits=new Map()) {
  const {items,total,pages,page,offset}=worksheetPage(sheet.rows,filters);
  const decisions=[...new Set([...(sheet.decisions||[]),...sheet.rows.map(row=>row.decision),filters.decision].filter(Boolean))];
  const codes=[...new Set(sheet.rows.map(row=>row.code))].sort((a,b)=>a.localeCompare(b,'fr'));
  return `<div class="ws-heading"><h2 id="worksheet-title">${e(sheet.title)}</h2>
    <button class="button" data-action="worksheet-download">Télécharger le classeur Excel</button></div>
    <div class="ws-filters"><label for="worksheet-query">Rechercher<input id="worksheet-query" data-worksheet-filter="query" type="search" value="${e(filters.query)}" placeholder="Sujet, paragraphe, repère…"></label>
    ${filterSelect('code','Code','Tous les codes',codes,filters.code)}
    ${filterSelect('status','Statut','Tous les statuts',sheet.statuses,filters.status)}
    ${filterSelect('decision','Décision','Toutes les décisions',decisions,filters.decision)}
    ${filterSelect('priority','Priorité','Toutes les priorités',sheet.priorities,filters.priority)}</div>
    <div class="ws-countbar"><p class="ws-count" id="ws-count" role="status">${worksheetCount(offset,items.length,total)}</p><span id="ws-save-status" role="status"></span></div>
    <datalist id="ws-decision-suggestions">${options(sheet.decisions,undefined)}</datalist>
    <div id="ws-recovery">${worksheetRecovery(sheet.rows,edits,new Set(items.map(r=>r.id)))}</div>
    ${items.length?`<div class="ws-table-wrap"><table class="ws-table" aria-labelledby="worksheet-title"><thead><tr>${['Sujet','Détails','Code et paragraphe','Statut','Décision','Priorité'].map(label=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${rowsMarkup(items,sheet,filters,archived,edits)}</tbody></table></div>`:''}
    ${pages>1?`<nav class="ws-pager" data-pages="${pages}" aria-label="Pages du tableau"><button class="button small" data-action="worksheet-page" data-page="${page-1}" ${page===1?'disabled':''}>Précédente</button><span>Page ${page} sur ${pages}</span><button class="button small" data-action="worksheet-page" data-page="${page+1}" ${page===pages?'disabled':''}>Suivante</button></nav>`:''}`;
}
export const worksheetCount=(offset,length,total)=>total?`${offset+1} à ${offset+length} sur ${total} option${total>1?'s':''}`:'Aucune option pour ces filtres.';
export const pageForIndex=index=>1+Math.floor(Math.max(index,0)/pageSize);
